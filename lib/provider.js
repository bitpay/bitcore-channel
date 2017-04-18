'use strict';

var _ = require('lodash');
var utils = require('./utils');
var bitcore = require('bitcore-lib');
var Address = bitcore.Address;
var Hash = bitcore.crypto.Hash;
var Input = bitcore.Transaction.Input;
var Interpreter = bitcore.Script.Interpreter;
var PublicKey = bitcore.PublicKey;
var PrivateKey = bitcore.PrivateKey;
var Transaction = bitcore.Transaction;
var CLTVTransaction = require('./transaction/transaction');
var Output = Transaction.Output;
var sighash = bitcore.Transaction.sighash;
var Signature = bitcore.crypto.Signature;
var Script = require('./transaction/script');
var RedeemScriptHashInput = require('./transaction/input/redeemscripthash');

var _mapUtxosToInputs = function(tx, inputTxs) {

  //proceed to find a utxo in inputTxs for each input in tx
  var inputTxIds = inputTxs.map(function(tx) {
    return tx.hash;
  });

  for(var i = 0; i < tx.inputs.length; i++) {

    var input = tx.inputs[i];
    var output;

    var index = inputTxIds.indexOf(input.prevTxId.toString('hex'));
    if (index > -1) {
      output = inputTxs[index].outputs[input.outputIndex];
    }

    if (!output) {
      throw new Error('utxo for channel tx input number: ' + i + ' could not be found from input txs.');
    }
    //we must set the output (utxo) on the input prior to deserializing existing signatures on the input's scriptSig
    input.output = new Output(output);
    if (input instanceof RedeemScriptHashInput) {
      input.setSignatures({ inputIndex: i, transaction: tx });
    }
  }

};

/* Given that we have a redeem script, we can roll over all the input
 * txs and match the redeem script to one of the outputs in each. This
 * will be our commitment tx.
*/
var _findCommitmentTxInInputTxs = function(redeemScript, inputTxs) {

  for(var i = 0; i < inputTxs.length; i++) {
    var tx = inputTxs[i];
    var index = utils.findCommitmentTransactionOutputIndex(redeemScript, tx);
    if (index !== -1) {
      return tx;
    }
  }

};

var _findCommitmentTxInputObject = function(tx) {

  for(var i = 0; i < tx.inputs.length; i++) {
    var input = tx.inputs[i];
    var redeemScript = _getRedeemScriptFromInput(input);
    //redeemScript will be 82 bytes with compressed pubkeys, we should reject is consumer is using
    //uncompressed pubkey, this also assumes a 4 byte locktime
    if (!redeemScript || redeemScript.length !== 164) {
      continue;
    }
    return { input: input, index: i, redeemScript: redeemScript, signatureCount: _getSignatureCount(input) };
  }
};

var _getSignatureCount = function(input) {
  return 1;
};

var _findRedeemScript = function(tx) {
};

var _getRedeemScriptFromInput = function(input) {
  var chunks = input.script.chunks;
  var redeemScript = chunks.slice(-1);
  if (redeemScript.length < 1 || !redeemScript[0].buf) {
    return;
  }
  return redeemScript[0].buf.toString('hex');
};

var _checkCommitmentInputSignature = function(channelTx, commitmentTxInputIndex, redeemScript) {
  var input = new Input(channelTx.inputs[commitmentTxInputIndex]);
  var chunks = input.script.chunks;
  var pubKeyString = Script.getParamsFromCLTVRedeemScript(redeemScript.toBuffer()).pubkeys[1];
  var pubKey = new PublicKey(pubKeyString);
  var sigBuf = chunks[0].buf;
  var sig = Signature.fromTxFormat(sigBuf);
  return sighash.verify(channelTx, sig, pubKey, commitmentTxInputIndex, redeemScript);
};

var _getFee = function(tx) {
  var inputAmount = 0;
  tx.inputs.forEach(function(input) {
    inputAmount += input.output.satoshis;
  });
  var fee = inputAmount - tx.outputAmount;
  return fee;
};

var _isSpendableNow = function(tx) {
  //if nSequence is MAXINT, it means this input is finalized and the nLockTime field is NOT
  //considered during the validation checks, so we will require channel txs to have all inputs'
  //sequence numbers be set to MAXINT so that we can safely spend the channel tx, if needed.
  //Otherwise the nLockTime field would be considered and we would have to make an additional
  //check for the value of nLockTime
  tx.inputs.forEach(function(input) {
    if (!(input.sequenceNumber === 4294967295)) {
      return false;
    }
  });
  return true;
};

var verifyChannelTransaction = function(options) {
  if (!options.channelTx ||
      !options.commitmentTxRedeemScript ||
      !_.isArray(options.inputTxs) ||
      !(options.inputTxs.length > 0) ||
      !(options.expectedOutputAmount > 0) ||
      !options.expectedOutputAddress ||
      !(options.lowestAllowedFee > 0)) {
        throw 'missing parameters';
  }

  //This is the tx that we received from the payment channel.
  //It is really important that this tx be valid for inclusion into the next block should
  //the provider wish to apply a signature to the commitment input and broadcast the tx.
  var channelTx = new Transaction(options.channelTx);

  //This is a list of all the transactions referred to by the inputs in the channel tx. Specifically, they
  //are the previous transactions for all the inputs. Normally, there will just be one input on the channel tx,
  //therefore, there will be only one transaction in inputTxs (the commitment tx itself). This is necessary so
  //we can calculate fees and check signatures.
  var inputTxs = options.inputTxs.map(function(tx) {
    return new Transaction(tx);
  });

  //basic sanity check, if you have more than one input on the channel tx (not typical),
  //then you need to have a list of input txs of the same length. Typical use is 1 input
  //and 1 tx in inputTxs
  if (channelTx.inputs.length !== inputTxs.length) {
    return false;
  }


  //This is the original commitment tx redeem script that the provider needs to hold on to in order
  //to validate channel txs. This script should be provided in ALL channel tx's for this channel in one,
  //and only one, input. Additionally, this redeemscript should also be accompanied by the consumer's
  //signature in the input.
  var commitmentTxRedeemScript = new Script(options.commitmentTxRedeemScript);


  var expectedOutputAmount = options.expectedOutputAmount; //in satoshis
  var expectedOutputAddress = options.expectedOutputAddress; //this is address we asked the channel tx to spend to
  var lowestAllowedFee = options.lowestAllowedFee;
  //This is a somewhat  dangerous option, if you allow additional inputs that are
  //not related to the commitment transaction, but are otherwise valid and possibly paying our
  //output, then you need to enforce that the consumer also include these inputs in any further
  //channel tx's.
  //It would be best to allowAdditionalInputsToPay if you intend to close the payment channel
  //immediately after validating this tx.
  //This option would be best for payments that need to be made late in the payment
  //channel's life cycle when there isn't enough bitcoin left to spend from the commitment
  //tx. If you allow an additional input then you can safely go over the commitment channel's utxo amount.
  var allowAdditionalInputsToPay = options.allowAdditionalInputsToPay === true;

  //perform basic sanity checks
  if(!channelTx.verify()) {
    return false;
  }

  //map input tx utoxs to inputs on channel tx
  _mapUtxosToInputs(channelTx, inputTxs);

  //This is to make sure that one of the inputs on the channel tx is spending funds
  //from the commitment tx. The commitment tx redeem script should be used to prove this
  var commitmentTxInputObject = _findCommitmentTxInputObject(channelTx);

  if (!commitmentTxInputObject) {
    return false;
  }

  //This proves that the redeem script that was provided as a param is the same redeem script
  //that is in one of the channel tx inputs
  if (commitmentTxInputObject.redeemScript !== commitmentTxRedeemScript.toHex()) {
    return false;
  }

  //This is to retrieve the commitment tx from within inputTxs. Since the channel tx
  //can, technically speaking, have > 1 input, this function must receive all the previous
  //txs matching those inputs
  var commitmentTx = _findCommitmentTxInInputTxs(commitmentTxRedeemScript, inputTxs);

  if (commitmentTx) {
    commitmentTx = new Transaction(commitmentTx);
  }

  //check the commitment transaction itself
  if (!commitmentTx || !commitmentTx.verify()) {
    return false;
  }

  //Next, we need to check the signature that was applied to the commitment tx and make sure it is valid
  if (!_checkCommitmentInputSignature(channelTx, commitmentTxInputObject.index, commitmentTxRedeemScript)) {
    return false;
  }

  //if the consumer put a really low fee on the tx, we will have problems
  var fee = _getFee(channelTx);
  if (fee < lowestAllowedFee) {
    return false;
  }

  //we want this tx to be in a final state where nSequence is MAXINT
  //so that no matter the value in nLockTime, we can spend tx right now
  if (!_isSpendableNow(channelTx)) {
    return false;
  }

  //find the output containing our funds
  var ourOutput;
  var network = Address.fromString(expectedOutputAddress).network;
  for(var i = 0; i < channelTx.outputs.length; i++) {
    var output = channelTx.outputs[i];
    if (output.script.toAddress(network).toString() === expectedOutputAddress &&
    output.satoshis === expectedOutputAmount) {
      ourOutput = output;
      break;
    }
  }

  //our output was not present, abort
  //we are only allowing payment of one output for simplicity with the added benefit of minimizing utxos
  if (!ourOutput) {
    return false;
  }

  if (!allowAdditionalInputsToPay) {
    //this means the sum of the channel tx outputs + the chan tx fee should exactly equal the commitment tx input fee
    var diff = commitmentTxInputObject.input.output.satoshis - (channelTx.outputAmount + fee);
    return diff === 0;
  }

  return true;
};

var generateCommitmentTxAddress = function(options) {
  var pubKeys = [options.providerPubKey, options.consumerPubKey];
  var lockTime = options.lockTime;
  var network = options.network || 'livenet';

  var script = Script.buildFromCLTVOut(pubKeys, lockTime);
  var scriptHash = Hash.sha256ripemd160(script.toBuffer());
  var address = Address.fromScriptHash(scriptHash, network);
  return address;
};

/*
 * Because we pass around serialized transactions as hex characters and we live in a pre-BIP141 world, incoming
 * transactions don't have enough information in order to apply signatures after deserialization. In order to directly
 * apply signatures, we need a reference to each utxo per input and not simply a pointer (prevTxId and outputIndex).
 * This comes down needing an actual utxo object for each input. Additionally, we must require sighash type of ALL for
 * safety.
*/
var signChannelTransaction = function(options) {

  if (!options.privateKey ||
      !_.isArray(options.inputTxs) ||
      !(options.inputTxs.length > 0) ||
      !options.channelTx) {
        throw 'missing parameters';
  }

  var inputTxs = options.inputTxs.map(function(tx) {
    return new Transaction(tx);
  });

  var privateKey = new PrivateKey(options.privateKey);
  var channelTx = new CLTVTransaction(options.channelTx);

  //beware that the channel tx must already be verified and validated as paying the provider appropriately
  //this function does not take in enough input data to perform this validation.
  //This makes the assumption that it is safe to match an inputs prevTxId matches the tx hash.
  //In other words, this function makes the assumption that the commitment tx hasn't been malleated.
  //It is the caller's responsibilty to ensure the commitment and channel tx are properly constructed.
  _mapUtxosToInputs(channelTx, inputTxs);

  channelTx.sign(privateKey);

  if (!channelTx.serialize()) {
    throw 'channel tx did not verify after signing';
  }

  return channelTx;

};

var increaseChannelTransactionFee = function(opts) {
  if (!(options.newFee <= 0) ||
      !options.channelTx) {
        throw 'missing parameters';
  }

  var newFee = options.newFee;
  var channelTx = options.channelTx;

  if (newFee <= channelTx.getFee()) {
    throw 'new fee must be larger than old fee.';
  }

  if (channelTx.countSignatures() == 2) {
    throw 'channel transaction already has provider\'s signature applied, therefore changing fees is not possible.';
  }

  //which output is our output?
}

module.exports = {
  verifyChannelTransaction: verifyChannelTransaction,
  generateCommitmentTxAddress: generateCommitmentTxAddress,
  signChannelTransaction: signChannelTransaction,
  increaseChannelTransactionFee: increaseChannelTransactionFee
};
