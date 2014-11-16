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
function Payment(opts) {

  this.commitment = opts.commitment instanceof Commitment
    ? opts.commitment
    : bitcore.Transaction.fromObj(opts.commitment);

  this.paymentAddress = opts.paymentAddress instanceof bitcore.Address
    ? opts.paymentAddress
    : bitcore.fromString(opts.paymentAddress);

  this.changeAddress = opts.changeAddress instanceof bitcore.Address
    ? opts.changeAddress
    : bitcore.fromString(opts.changeAddress);

  this.amount = opts.amount;
  this.paid = opts.paid || 0; 
  this.sequence = opts.sequence || 0;

  this.builder = opts.builder
    ? bitcore.TransactionBuilder.fromObj(opts.builder)
    : new bitcore.TransactionBuilder(_.extend({spendUnconfirmed: true}))
      .setUnspent([opts.multisigOut])
      .setOutputs([{
        address: this.changeAddress.toString(),
        amountSatStr: this.amount - util.STANDARD_FEE
      }]);
}

Payment.prototype.updateValue = function(delta) {
  this.paid += delta;
  this.sequence += 1;
  this.builder.setOutputs([
    {
      address: this.paymentAddress.toString(),
      amountSatStr: this.paid
    },
    {
      address: this.changeAddress.toString(),
      amountSatStr: this.amount - this.paid - util.STANDARD_FEE
    }
  ]);
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
    sequence: this.secuence,
    paymentAddress: this.paymentAddress.toString(),
    changeAddress: this.changeAddress.toString(),
    commitment: this.commitment.toObj(),
    builder: this.builder.toObj()
  });
};

Payment.prototype.build = function() {
  $.checkState(this.isSigned(), 'Transaction must be fully signed!');

  return this.builder.build().serialize().toString('hex');
};

module.exports = Payment;
