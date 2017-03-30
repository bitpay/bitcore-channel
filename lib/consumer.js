'use strict';

var bitcore = require('bitcore-lib');
var Transaction = require('./transaction/transaction');
var PrivateKey = bitcore.PrivateKey;
var Script = require('./transaction/script');
var Signature = bitcore.crypto.Signature;
var Address = bitcore.Address;
var PublicKey = bitcore.PublicKey;
var Hash = bitcore.crypto.Hash;
var Output = bitcore.Transaction.Output;

var _getRefundTxLockTime = function(script) {
  //this determines the earliest time/height, given a redeem script that a spending tx can be spent
  var script = new Script(script);
  var params = Script.getParamsFromCLTVRedeemScript(script.toBuffer());
  var redeemScriptLockTime = params.lockTime;
  //CLTV logic says that if redeemScriptLockTime <= the spending Tx's nLockTime value (with other checks also passing),
  //evaluate to true, for safety, we will go one block or second more
  return redeemScriptLockTime;
};

var createRedeemScript = function(publicKeys, lockTime) {
  return Script.buildCLTVRedeemScript(publicKeys, lockTime);
};

/*
  timeLength: in seconds, the max length of time the channel should remain open
*/
var getChannelParameters = function(satoshis, timeLength, publicKey) {
  var timeNow = Math.round((Date.now() + (new Date().getTimezoneOffset() * 60000)) / 1000);
  var lockTime = timeNow + timeLength;
  return {
    satoshis: satoshis,
    lockTime: lockTime,
    publicKey: new PublicKey(publicKey)
  };
};

var createChannelTransaction = function(opts) {
  var network = opts.network || 'livenet';
  if (! opts.consumerPrivateKey) {
    throw 'consumer private key needed for this transaction';
  }
  if (!opts.satoshis) {
    throw 'bitcoin amount in satoshis is needed';
  }
  if (!opts.toAddress) {
    throw 'to address is required';
  }
  if (!opts.redeemScript) {
    throw 'redeemScript is required';
  }
  if (!(opts.fee > 0)) {
    throw 'fee is required';
  }
  if (!opts.commitmentTransaction) {
    throw 'commitment transaction is required';
  }
  if (typeof opts.changeAddress === 'undefined') {
    throw 'change address is required to be explicitly null or a value, but not undefined';
  }
  var consumerPrivateKey = new PrivateKey(opts.consumerPrivateKey, network);
  var providerPrivateKey = opts.providerPrivateKey;
  var satoshis = opts.satoshis;
  var toAddress = new Address(opts.toAddress, network);
  var lockTime = opts.lockTime;
  var fee = opts.fee;
  var redeemScript = opts.redeemScript;
  var changeAddress = opts.changeAddress;

  var commitmentTransaction = new Transaction(opts.commitmentTransaction);
  var inputAmount = commitmentTransaction.outputs[0].satoshis;

  var chanTx = new Transaction();

  var utxo = {
    txId: commitmentTransaction.hash,
    outputIndex: 0,
    address: commitmentTransaction.outputs[0].script.toAddress().toString(),
    satoshis: commitmentTransaction.outputs[0].satoshis,
    script: commitmentTransaction.outputs[0].script.toHex()
  };

  chanTx.from(utxo, redeemScript);

  // we need to build outputs in a specific order, so that we can sign only the output with
  // the same input index and no others
  // we are setting outputs explicitly to allow for explicit output indexes of outputs
  var changeAmount = inputAmount - (satoshis + fee);

  if (changeAmount < 0) {
    throw 'Output amounts exceed input amounts';
  }

  if (changeAmount !== 0 && changeAddress === null) {
    throw 'change address was explicitly set to null, however the sum of the outputs plus the fee does not exactly equal the inputs amounts';
  }

  var toOutput = new Output({ satoshis: satoshis, script: Script.fromAddress(toAddress) });
  var changeOutput = new Output({ satoshis: changeAmount, script: Script.fromAddress(changeAddress) });

  chanTx.addOutput(changeOutput);
  chanTx.addOutput(toOutput);

  if (opts.lockTime >= 0 && opts.sequenceNumber >= 0) {
    chanTx.inputs[0].sequenceNumber = opts.sequenceNumber;
    chanTx.nLockTime = opts.lockTime;
  }

  if (providerPrivateKey) {
    chanTx.sign(providerPrivateKey);
  }

  chanTx.sign(consumerPrivateKey, opts.sighashType || Signature.SIGHASH_SINGLE);
  return chanTx;
};

var createCommitmentTransaction = function(options) {
  var opts = options || {};
  var network = opts.network || 'livenet';
  if (!opts.privateKey) {
    throw 'private key needed for spending transaction';
  }
  if (!opts.satoshis) {
    throw 'bitcoin amount in satoshis is needed';
  }
  if (!opts.changeAddress) {
    throw 'change address is required';
  }
  if (!opts.redeemScript) {
    throw 'redeem script is required';
  }
  if (!(opts.fee > 0)) {
    throw 'fee is required';
  }
  if (!opts.prevTx) {
    throw 'previous transaction is required';
  }
  if (!(opts.prevTxOutputIndex >= 0)) {
    throw 'previous transaction output index is required';
  }
  var privateKey = new PrivateKey(opts.privateKey, network);
  var satoshis  = opts.satoshis;
  var changeAddress = new Address(opts.changeAddress, network);
  var fee = opts.fee;
  var redeemScript = new Script(opts.redeemScript);
  var prevTxOutputIndex = opts.prevTxOutputIndex;
  var prevTx = new Transaction(opts.prevTx);

  var commitmentTx = new Transaction();
  // TODO: support other pay to types other than P2PKH
  commitmentTx.from({
    txId: prevTx.hash,
    outputIndex: prevTxOutputIndex,
    address: prevTx.outputs[prevTxOutputIndex].script.toAddress().toString(),
    satoshis: prevTx.outputs[prevTxOutputIndex].satoshis,
    script: prevTx.outputs[prevTxOutputIndex].script.toHex()
  });
  var toAddress = Address.fromScriptHash(Hash.sha256ripemd160(redeemScript.toBuffer()), network);

  commitmentTx.to(toAddress, satoshis);
  commitmentTx.change(changeAddress.toString());
  commitmentTx.fee(fee);
  commitmentTx.sign(privateKey);
  return commitmentTx;
};

/*
 * in the unlikely event that the provider does not close the payment channel, we can create a refund
 * tx that will spend funds back to ourselves by using the CHECKLOCKTIMEVERIFY logic in Bitcoin. This
 * tx can be spent AFTER the initial lock time/block height expires. Remember that the initial lock
 * time/height was used to create the redeem script that the commitment tx funds were sent to. Therefore,
 * A commitment refund tx can be created, signed, and broadcasted to the bitcoin p2p network at any time,
 * but cannot be added to a block until CHECKLOCKTIMEVERIFY logic in the redeem script evaluates to true.
 *
 * As you can see this is really just a channel tx that has a NON-finalized input (sequenceNumber is
 * not 0xffffffff) and a unneeded change addresss.
*/
var createCommitmentRefundTransaction = function(opts) {

  opts.sighashType = Signature.SIGHASH_ALL;
  opts.lockTime = opts.lockTime || _getRefundTxLockTime(opts.redeemScript);
  opts.sequenceNumber = opts.sequenceNumber || (0xffffffff - 1);
  return createChannelTransaction(opts);

}

module.exports = {
  createRedeemScript: createRedeemScript,
  getChannelParameters: getChannelParameters,
  createChannelTransaction: createChannelTransaction,
  createCommitmentTransaction: createCommitmentTransaction,
  createCommitmentRefundTransaction: createCommitmentRefundTransaction
};
