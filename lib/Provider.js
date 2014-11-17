var _ = require('lodash');
var preconditions = require('preconditions');
var $ = preconditions.singleton();
var bitcore = require('bitcore');
var util = require('./util/util');

/**
 * @constructor
 */
function Provider(opts) {
  if (!opts.paymentAddress) {
    this.paymentKey = new bitcore.Key();
    this.paymentAddress = util.createAddress(this.paymentKey.public);
  } else {
    this.paymentAddress = opts.paymentAddress;
  }
  this.network = opts.network || 'livenet';

  this.key = opts.key || bitcore.Key.generateSync();
}

Provider.prototype.getPublicKey = function getPublicKey() {
  return this.key.public.toString('hex');
};

Provider.prototype.signRefund = function signRefund(receivedData) {
  throw new Error('Not implemented');
};

Provider.prototype.validPayment = function validPayment(receivedData) {
  throw new Error('Not implemented');
  this.currentAmount = 0;
};

Provider.prototype.getPaymentTx = function getPaymentTx() {
  throw new Error('Not implemented');
};

module.exports = Provider;
