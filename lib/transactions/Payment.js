var _ = require('lodash');
var bitcore = require('bitcore');
var preconditions = require('preconditions');
var $ = preconditions.singleton();

var util = require('../util/util');

var Commitment = require('./Commitment');


/**
 * @constructor
 * @param {Object} opts
 * @param {bitcore.Address} opts.paymentAddress
 * @param {bitcore.Address} opts.changeAddress
 */
function Payment(opts) {
  if (_.isString(opts)) {
    opts = JSON.parse(opts);
  }

  this.paymentAddress = opts.paymentAddress instanceof bitcore.Address
    ? opts.paymentAddress
    : new bitcore.Address(opts.paymentAddress);

  this.changeAddress = opts.changeAddress instanceof bitcore.Address
    ? opts.changeAddress
    : new bitcore.Address(opts.changeAddress);

  this.p2shMap = {};
  this.p2shMap[opts.multisigOut.address] = bitcore.Script.createMultisig(2, opts.pubKeys)
      .getBuffer().toString('hex');

  this.multisigOut = opts.multisigOut;
  this.amount = opts.amount;
  this.paid = opts.paid || 0;
  this.sequence = opts.sequence || 0;

  this.builder = opts.builder
    ? bitcore.TransactionBuilder.fromObj(opts.builder)
    : new bitcore.TransactionBuilder({
      spendUnconfirmed: true
    })
    .setUnspent([opts.multisigOut])
    .setOutputs([{
        address: this.changeAddress.toString(),
        amountSatStr: this.amount
    }])
    .setHashToScriptMap(this.p2shMap);
}

Payment.prototype.updateValue = function(delta) {
  this.paid += delta;
  this.sequence += 1;

  this.builder = new bitcore.TransactionBuilder({
      spendUnconfirmed: true,
      remainderOut: { address: this.changeAddress.toString() }
    })
    .setUnspent([this.multisigOut])
    .setOutputs([{
        address: this.paymentAddress.toString(),
        amountSatStr: this.paid
    }]).setHashToScriptMap(this.p2shMap);
  return this;
};

Payment.prototype.isSigned = function() {
  return this.builder.isFullySigned();
};

Payment.prototype.sign = function(key) {
  this.builder.sign(key);
  return this;
};

Payment.prototype.serialize = function() {
  return JSON.stringify({
    paid: this.paid,
    paymentAddress: this.paymentAddress.toString(),
    changeAddress: this.changeAddress.toString(),
    builder: this.builder.toObj()
  });
};

Payment.prototype.build = function() {
  $.checkState(this.isSigned(), 'Transaction must be fully signed!');

  return this.builder.build().serialize().toString('hex');
};

module.exports = Payment;
