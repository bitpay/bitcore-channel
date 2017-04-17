'use strict';

var bitcore = require('bitcore-lib');
var $ = bitcore.util.preconditions;
var Transaction = bitcore.Transaction;
var UnspentOutput = bitcore.Transaction.UnspentOutput;
var Output = bitcore.Transaction.Output;
var RedeemScriptHashInput = require('./input/redeemscripthash');
var inherits = require('inherits');

var CURRENT_VERSION = 1;
var DEFAULT_NLOCKTIME = 0;
var MAX_BLOCK_SIZE = 1000000;

var CLTVTransaction = function(serialized) {
  if (!(this instanceof Transaction)) {
    return new Transaction(serialized);
  }
  if (serialized instanceof Transaction) {
    return serialized;
  }
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

CLTVTransaction.prototype.fromBufferReader = function(reader) {
  $.checkArgument(!reader.finished(), 'No transaction data received');
  var i, sizeTxIns, sizeTxOuts;

  this.version = reader.readInt32LE();
  sizeTxIns = reader.readVarintNum();
  var cltvInputs = [];
  for (i = 0; i < sizeTxIns; i++) {
    //this will safely build a CLTV-type redeem script if the input matches the type
    var input = RedeemScriptHashInput.fromBufferReader(reader);
    this.inputs.push(input);
  }
  sizeTxOuts = reader.readVarintNum();
  for (i = 0; i < sizeTxOuts; i++) {
    this.outputs.push(Output.fromBufferReader(reader));
  }
  this.nLockTime = reader.readUInt32LE();
  return this;
};

module.exports = CLTVTransaction;
