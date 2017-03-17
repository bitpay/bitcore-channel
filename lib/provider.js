'use strict';

var _ = require('lodash');
var bitcore = require('bitcore-lib');
var Transaction = bitcore.Transaction;
var inherits = require('inherits');
var $ = bitcore.util.preconditions;
var JSUtil = bitcore.util.js;

/**
 * Represents a transaction, a set of inputs and outputs to change ownership of tokens
 *
 * @param {*} serialized
 * @constructor
 */
var ChannelTransaction = function(serialized) {
  Transaction.apply(this, arguments);
};

inherits(ChannelTransaction, Transaction);

 /*
 * @param {(Array.<Transaction~fromObject>|Transaction~fromObject)} utxo
 * @param {Array=} pubkeys
 * @param {number=} threshold
 */
ChannelTransaction.prototype.from = function(utxo, pubkeys) {
  $.checkArgument(_.isArray(pubkeys) && pubkeys.length === 2,
    '2 signatures are required to create a commitment transaction input.');
  var exists = _.any(this.inputs, function(input) {
    return input.prevTxId.toString('hex') === utxo.txId && input.outputIndex === utxo.outputIndex;
  });
  if (exists) {
    return this;
  }
  utxo = new bitcore.UnspentOutput(utxo);
  var input = RedeemScriptHashInput;
  this.addInput(new clazz({
    output: new bitcore.Output({
      script: utxo.script,
      satoshis: utxo.satoshis
    }),
    prevTxId: utxo.txId,
    outputIndex: utxo.outputIndex,
    script: bitcore.Script.empty()
  }, pubkeys));
  return this;
};
