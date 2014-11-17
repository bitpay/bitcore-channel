var _ = require('lodash');
var bitcore = require('bitcore');
var preconditions = require('preconditions');
var $ = preconditions.singleton();

var util = require('../util/util');

var Commitment = require('./Commitment');


/**
 * @constructor
 * @param {Object} opts
 * @param {Commitment} opts.commitment
 * @param {bitcore.Address} opts.paymentAddress
 * @param {bitcore.Address} opts.changeAddress
 */
function Refund(opts) {

  this.refundAddress = opts.refundAddress instanceof bitcore.Address
    ? opts.refundAddress
    : bitcore.fromString(opts.refundAddress);

  this.amount = opts.amount;

  this.p2shMap = {}
  this.p2shMap[opts.multisigOut.address] = bitcore.Script.createMultisig(2, opts.pubKeys)
    .getBuffer().toString('hex');

  this.builder = opts.builder
    ? bitcore.TransactionBuilder.fromObj(opts.builder)
    : new bitcore.TransactionBuilder({
      spendUnconfirmed: true,
      lockTime: opts.lockTime
    })
    .setUnspent([opts.multisigOut])
    .setOutputs([{
      address: this.refundAddress.toString(),
      amountSatStr: this.amount - util.STANDARD_FEE
    }])
    .setHashToScriptMap(this.p2shMap);
}

Refund.prototype.isSigned = function() {
  return this.builder.isFullySigned();
};

Refund.prototype.sign = function(key) {
  this.builder.sign(key);
};

Refund.prototype.serialize = function() {
  return JSON.stringify({
    amount: this.amount,
    p2shMap: this.p2shMap,
    refundAddress: this.refundAddress.toString(),
    builder: this.builder.toObj()
  });
};

Refund.prototype.build = function() {
  $.checkState(this.isSigned(), 'Transaction must be fully signed!');

  return this.builder.build().serialize().toString('hex');
};

module.exports = Refund;
