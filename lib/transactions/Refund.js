var _ = require('lodash');
var bitcore = require('bitcore');
var buffer = require('buffer');
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
    : new bitcore.Address(opts.refundAddress);

  this.amount = opts.amount;

  this.multisigOut = opts.multisigOut;
  this.pubKeys = opts.pubKeys;
  if (_.any(this.pubKeys, function(pubkey) { return !(pubkey instanceof buffer.SlowBuffer); })) {
    this.pubKeys = this.pubKeys.map(function(values) { return new buffer.Buffer(values); });
  }

  this.p2shMap = {}
  this.p2shMap[opts.multisigOut.address] = bitcore.Script.createMultisig(2, this.pubKeys)
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
    pubKeys: this.pubKeys,
    multisigOut: this.multisigOut,
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
