var bitcore = require('bitcore');
var assert = require('better-assert');

function Provider(opts) {
  assert(opts.paymentAddress);

  this.key = opts.key || new bitcore.Key();
  this.paymentAddress = paymentAddress;
}

Provider.prototype.signRefundTx = function signRefundTx(refundTx) {
  assert(_.isObject(refundTx), 'Parameter for signRefundTx must be an object');
  var txBuilder = TransactionBuilder.fromObj(refundTx);
  txBuilder.sign(this.key);
  return txBuilder.build().serialize();
};

Provider.prototype.getPublicKey = function getPublicKey() {
  return this.key.public.toString();
};

Provider.prototype.validateCommitementTx = function validateCommitementTx(serverPubKey, receivedCommitTx) {
};

Provider.prototype.validatePaymentTx = function validatePaymentTx(paymentId, paymentTx) {
};

module.exports = Provider;
