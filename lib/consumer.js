'use strict';

var bitcore = require('bitcore-lib');
var Transaction = require('./transaction/transaction');
var Script = require('./transaction/script');
var Address = bitcore.Address;
var Hash = bitcore.crypto.Hash;

//TODO: the commitment tx requires its first output to be the payment into the channel
//and the next tx to be change address and no other outputs
var Consumer = function(opts) {
  this._opts = opts || {};
  this._tx = new Transaction(this._opts.serializedTx);
  this._spendingTx = new Transaction(this._opts.spendingTx);
  this._spendingTxOutputIndex = this._opts.spendingTxOutputIndex;
  this._pubKeys = this._opts.pubKeys;
  this._amount = this._opts.amount;
  this._lockTime = this._opts.lockTime;
  this._changeAddress = this._opts.changeAddress;
  this._toAddress = this._opts.toAddress;
  this._network = this._opts.network || 'livenet';
  this._fee = this._opts.fee
};

Consumer.prototype._check = function() {
  if (!this._opts.spendingTx || !(this._opts.spendingTxOutputIndex >= 0)) {
   throw 'Spending Transaction was not provided, therefore unable to create a commitment transaction.';
  }
};

Consumer.prototype._getUtxo = function() {
  return {
    txId: this._spendingTx.hash,
    script: this._spendingTx.outputs[this._spendingTxOutputIndex].script.toHex(),
    outputIndex: this._spendingTxOutputIndex,
    satoshis: this._spendingTx.outputs[this._spendingTxOutputIndex].satoshis,
    address: this._getUtxoAddress().toString()
  };
};

Consumer.prototype._getAddress = function(script) {
  return Address.fromScriptHash(Hash.sha256ripemd160(script), this._network);
};

Consumer.prototype._getUtxoAddress  = function() {
  var script = this._spendingTx.outputs[this._spendingTxOutputIndex].script;
  return script.toAddress() || this._getAddress(script.toBuffer());
};

Consumer.prototype.createCommitmentTransaction = function() {

  this._check();

  var cltvScript = Script.buildFromCLTVOut(this._pubKeys, this._lockTime);
  this._toAddress = this._getAddress(cltvScript.toBuffer());

  this._tx.from(this._getUtxo());

  this._tx.to(this._toAddress, this._amount);

  this._tx.change(this._changeAddress);
  this._tx.fee(this._fee);
  return this._tx;
};

Consumer.prototype.createChannelTransaction = function() {

  this._check();

  this._tx.from(this._getUtxo(), this._pubKeys, this._lockTime);
  this._tx.to(this._toAddress, 10000);
  this._tx.change(this._changeAddress);
  this._tx.fee(this._fee);

  return this._tx;

};


module.exports = Consumer;
