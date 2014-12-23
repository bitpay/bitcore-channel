'use strict';

var _ = require('lodash');
var preconditions = require('preconditions');
var $ = preconditions.singleton();
var util = require('./util/util');

var Payment = require('./transactions/Payment');
var Refund = require('./transactions/Refund');

var PrivateKey = require('bitcore/lib/privatekey');
var Address = require('bitcore/lib/address');
var Networks = require('bitcore/lib/networks');

/**
 * @constructor
 */
function Provider(opts) {
  this.network = Networks.get(opts.network);
  if (!opts.paymentAddress) {
    this.paymentKey = new PrivateKey();
    this.paymentAddress = this.paymentKey.toAddress(this.network);
  } else {
    this.paymentAddress = new Address(opts.paymentAddress);
  }

  this.currentAmount = opts.currentAmount || 0;
  this.key = opts.key || new PrivateKey();
}

Provider.prototype.getPublicKey = function getPublicKey() {
  return this.key.publicKey;
};

Provider.prototype.signRefund = function signRefund(receivedData) {
  var refund = new Refund(receivedData);
  refund.sign(this.key);
  return {
    refund: refund.toObject(),
    paymentAddress: this.paymentAddress
  };
};

Provider.prototype.validPayment = function validPayment(receivedData) {
  var payment = new Payment(receivedData);
  var newAmount;
  var self = this;

  payment.sign(this.key);
  $.checkState(payment.isFullySigned());
  payment.outputs.map(function(output) {
    if (output.script.toAddress(self.network).toString() === self.paymentAddress.toString()) {
      newAmount = output.satoshis;
    }
  });
  $.checkState(_.isUndefined(newAmount) || newAmount > this.currentAmount);
  this.currentAmount = newAmount;
  return payment;
};

Provider.prototype.getPaymentTx = function getPaymentTx() {
  return this.paymentTx.build();
};

module.exports = Provider;
