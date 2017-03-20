'use strict';

var _ = require('lodash');
var bitcore = require('bitcore-lib');
var Transaction = bitcore.Transaction;
var Script = require('./transaction/script');
var Hash = bitcore.crypto.Hash;
var Address = bitcore.Address;
var PublicKey = bitcore.PublicKey;
var Interpreter = bitcore.Script.Interpreter;
var Input = bitcore.Transaction.Input;
var Signature = bitcore.crypto.Signature;
var sighash = bitcore.Transaction.sighash;

var verifyChannelTransction = function(options) {
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

  //This is the original commitment tx redeem script that the provider needs to hold on to in order
  //to validate channel txs. This script should be provided in ALL channel tx's for this channel in one,
  //and only one, input. Additionally, this redeemscript should also be accompanied by the consumer's
  //signature in the input.
  var commitmentTxRedeemScript = new Script(options.commitmentTxRedeemScript);

  //This is a list of all the transactions referred to by the inputs in the channel tx. Specifically, they
  //are the previous transactions for all the inputs. Normally, there will just be one input on the channel tx,
  //therefore, there will be only one transaction in inputTxs (the commitment tx itself). This is necessary so
  //we can calculate fees and check signatures.
  var inputTxs = options.inputTxs.map(function(tx) {
    return new Transaction(tx);
  });

  var expectedOutputAmount = options.expectedOutputAmount; //in satoshis
  var expectedOutputAddress = options.expectedOutputAddress; //this is address we asked the channel tx is spend to
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
console.log('1');
    return false;
  }

  //map input tx utoxs to inputs on channel tx
  _mapUtxosToInputs(channelTx, inputTxs);

  //all but one input should be valid and verified. The one that we might sign with our private key before
  //broadcasting and closing channel
  var invalidInputs = _findInvalidInputs(channelTx);

  //if more than one invalid input, then another input other than our commitment tx input is invalid, not good
  if (invalidInputs.length !== 1) {
console.log('2');
    return false;
  }

  var commitmentInput = invalidInputs[0].input;
  var commitmentInputIndex = invalidInputs[0].index;

  //is the invalidInput our commitment tx? if it is, the scriptSig on the input should contain our redeemScript
  //the hash160 of this redeemScript should match the hash in the scriptPubKey of the commitment tx.
  if (!_checkCommitmentRedeemScript(commitmentTxRedeemScript, commitmentInput)) {
console.log('3');
    return false;
  }

  //Next, we need to check the signature that was applied to the commitment tx and make sure it is valid
  if (!_checkCommitmentInputSignature(channelTx, commitmentInputIndex)) {
console.log('4');
    return false;
  }

  //if the consumer put a really low fee on the tx, we will have problems
  var fee = _getFee(channelTx);
  if (fee < lowestAllowedFee) {
console.log('5');
    return false;
  }

  //we want this tx to be in a final state where nSequence is MAXINT
  //so that no matter the value in nLockTime, we can spend tx right now
  if (!_isSpendableNow(channelTx)) {
console.log('6');
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
    var ourInput = invalidInputs[0];
    var diff = ourInput.output.satoshis - ourOutput.satoshis;
    return diff === 0;
  }

  return true;
};

var verifyCommitmentTransction = function() {
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

var _mapUtxosToInputs = function(tx, inputTxs) {

  //proceed to find a utxo in inputTxs for each input in tx
  var inputTxIds = inputTxs.map(function(tx) {
    return tx.hash;
  });

  for(var i = 0; i < tx.inputs.length; i++) {

    var input = tx.inputs[i];
    var utxo;

    var index = inputTxIds.indexOf(input.prevTxId.toString('hex'));
    if (index > -1) {
      utxo = inputTxs[index].outputs[input.outputIndex];
    }

    if (!utxo) {
      throw 'utxo for channel tx input number: ' + i + ' could not be found from input txs.';
    }
    input.output = utxo;
  }

};

var _findInvalidInputs = function(tx) {

  var inputs = [];
  for(var i = 0; i < tx.inputs.length; i++) {
    var input = tx.inputs[i];
    var scriptSig = input.script;
    var scriptPubKey = input.output.script;
    var interpreter = new Interpreter();
    var verified = interpreter.verify(scriptSig, scriptPubKey,
      tx, i, Interpreter.SCRIPT_VERIFY_STRICTENC | Interpreter.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY);

    if (!verified) {
      inputs.push({ input: input, index: i });
    }
  }
  return inputs;

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

var _checkCommitmentInputSignature = function(tx, inputIndex) {
  var input = new Input(tx.inputs[inputIndex]);
  var redeemScriptBuf = input.script.chunks[2].buf;
  var pubKeyString = Script.getParamsFromCLTVRedeemScript(redeemScriptBuf).pubkeys[1];
  var pubKey = new PublicKey(pubKeyString);
  var sigBuf = input.script.chunks[1].buf;
  var sig = Signature.fromTxFormat(sigBuf);
  var scriptPubKey = tx.inputs[inputIndex].output.script;
  console.log(tx, sig, pubKey, inputIndex, scriptPubKey);
  return sighash.verify(tx, sig, pubKey, inputIndex, scriptPubKey);
};

var _checkCommitmentRedeemScript = function(redeemScript, input) {
  var inputRedeemScriptHex = input.script.chunks[2].buf.toString('hex');
  var redeemScriptHex = new Script(redeemScript).toHex();
  return inputRedeemScriptHex === redeemScriptHex;
};


module.exports = {
  verifyChannelTransaction: verifyChannelTransction
};
