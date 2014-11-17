var _ = require('lodash');
var preconditions = require('preconditions');
var $ = preconditions.singleton();
var bitcore = require('bitcore');
var util = require('./util/util');

var Payment = require('./transactions/Payment');
var Refund = require('./transactions/Refund');

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
  this.walletKey = new bitcore.WalletKey({
    privKey: this.key,
    network: bitcore.networks[this.network]
  });
}

Provider.prototype.getPublicKey = function getPublicKey() {
  return this.key.public.toString('hex');
};

Provider.prototype.signRefund = function signRefund(receivedData) {
  var refund = new Refund(JSON.parse(receivedData));
  refund.sign([this.walletKey]);
  return {
    refund: refund.serialize(),
    paymentAddress: this.paymentAddress
  };
};

Provider.prototype.validPayment = function validPayment(receivedData) {
  var payment = new Payment(JSON.parse(receivedData));
  payment.sign([this.walletKey]);
  $.checkState(payment.isSigned());
  // TODO: Assert amount getting paid!!!
  this.paymentTx = payment;
  this.currentAmount = bitcore.util.valueToBigInt(payment.builder.build().outs[0].v);
  return true;
};

Provider.prototype.getPaymentTx = function getPaymentTx() {
  return this.paymentTx.build();
};

module.exports = Provider;
