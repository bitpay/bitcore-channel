var _ = require('lodash');
var preconditions = require('preconditions');
var $ = preconditions.singleton();
var bitcore = require('bitcore');
var util = require('./util');

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

Provider.prototype.signRefundTx = function signRefundTx(refundTx) {
  $.checkArgument(_.isObject(refundTx), 'Parameter for signRefundTx must be an object');
  var txBuilder = bitcore.TransactionBuilder.fromObj(refundTx);
  txBuilder.sign([new bitcore.WalletKey({
    network: this.network,
    privKey: this.key
  })]);
  return txBuilder.build().serialize().toString('hex');
};

Provider.prototype.getPublicKey = function getPublicKey() {
  return this.key.public.toString('hex');
};

Provider.prototype.validateCommitementTx = function(serverPubKey, receivedCommitTx) {
};

Provider.prototype.validatePaymentTx = function validatePaymentTx(paymentId, paymentTx) {
};

module.exports = Provider;
