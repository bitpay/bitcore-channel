'use strict';

var bitcore = require('bitcore-lib');
var Transaction = require('./transaction/transaction');
var PrivateKey = bitcore.PrivateKey;
var Script = require('./transaction/script');
var Address = bitcore.Address;
var PublicKey = bitcore.PublicKey;
var Hash = bitcore.crypto.Hash;

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
  if (! opts.privateKey) {
    throw 'private key needed for commitment transaction';
  }
  if (!opts.satoshis) {
    throw 'bitcoin amount in satoshis is needed';
  }
  if (!opts.toAddress) {
    throw 'to address is required';
  }
  if (!opts.changeAddress) {
    throw 'change address is required';
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
  var privateKey = new PrivateKey(opts.privateKey, network);
  var satoshis = opts.satoshis;
  var toAddress = new Address(opts.toAddress, network);
  var changeAddress = new Address(opts.changeAddress, network);
  var lockTime = opts.lockTime;
  var fee = opts.fee;
  var redeemScript = opts.redeemScript;

  var commitmentTransaction = new Transaction(opts.commitmentTransaction);

  var chanTx = new Transaction();

  chanTx.from({
    txId: commitmentTransaction.hash,
    outputIndex: 0,
    address: commitmentTransaction.outputs[0].script.toAddress().toString(),
    satoshis: commitmentTransaction.outputs[0].satoshis,
    script: commitmentTransaction.outputs[0].script.toHex()
  }, redeemScript);

  chanTx.to(toAddress.toString(), satoshis);
  chanTx.change(changeAddress);
  chanTx.fee(fee);
  chanTx.sign(privateKey);
  return chanTx;
};

var createCommitmentTransaction = function(opts) {
  var network = opts.network || 'livenet';
  if (! opts.privateKey) {
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


module.exports = {
  getChannelParameters: getChannelParameters,
  createChannelTransaction: createChannelTransaction,
  createCommitmentTransaction: createCommitmentTransaction
};
