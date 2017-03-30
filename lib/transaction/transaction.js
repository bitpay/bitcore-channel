'use strict';

var _ = require('lodash');
var bitcore = require('bitcore-lib');
var Transaction = bitcore.Transaction;
var UnspentOutput = bitcore.Transaction.UnspentOutput;
var Output = bitcore.Transaction.Output;
var Script = require('./script');
var RedeemScriptHashInput = require('./input/redeemscripthash');
var Input = bitcore.Transaction.Input;
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

Transaction.prototype.isFullySigned = function() {
  _.each(this.inputs, function(input) {
    if (input.isFullySigned === Input.prototype.isFullySigned) {
      throw new errors.Transaction.UnableToVerifySignature(
        'Unrecognized script kind, or not enough information to execute script.' +
        'This usually happens when creating a transaction from a serialized transaction'
      );
    }
  });
  return _.all(_.map(this.inputs, function(input) {
    if (input instanceof RedeemScriptHashInput) {
      return input.countSignatures() > 0;
    }
    return input.isFullySigned();
  }));
};

module.exports = CLTVTransaction;
