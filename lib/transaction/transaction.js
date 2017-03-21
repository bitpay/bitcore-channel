'use strict';

var bitcore = require('bitcore-lib');
var Transaction = bitcore.Transaction;
var UnspentOutput = bitcore.Transaction.UnspentOutput;
var Output = bitcore.Transaction.Output;
var Script = require('./script');
var RedeemScriptHashInput = require('./input/redeemscripthash');
var inherits = require('inherits');

var CURRENT_VERSION = 1;
var DEFAULT_NLOCKTIME = 0;
var MAX_BLOCK_SIZE = 1000000;

var CLTVTransaction = function(serialized) {
  return Transaction.apply(this, arguments);
};

inherits(CLTVTransaction, Transaction);

//used by consumer to generate channel tx
CLTVTransaction.prototype.from = function(utxo, redeemScript) {

  if (typeof redeemScript === 'undefined') {
    var superClassPrototype = Object.getPrototypeOf(CLTVTransaction.prototype);
    return superClassPrototype.from.call(this, utxo);
  }

  utxo = new UnspentOutput(utxo);
  utxo.prevTxId = utxo.txId;
  utxo.output = new Output({ script: utxo.script, satoshis: utxo.satoshis });
  var redeemScriptHashInput = new RedeemScriptHashInput(utxo, redeemScript);
  this.addInput(redeemScriptHashInput);

  return this;

};


module.exports = CLTVTransaction;
