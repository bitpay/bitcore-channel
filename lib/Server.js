var inherits = require('inherits');
var event = require('event');
var bitcore = require('bitcore');

function Server() {
  this.key = new bitcore.Key();
}
inherits(Server, event.EventEmitter);

Server.prototype.signRefund = function signRefund(serverPubKey, refundTx) {
};

Server.prototype.getPublicKey = function getPublicKey() {
  return this.key.public.toString();
};

Server.prototype.processNewChannel = function processNewChannel(serverPubKey, receivedCommitTx) {
};

Server.prototype.receivePayment = function receivePayment(paymentId, paymentTx) {
};

Server.prototype.processError = function processError(paymentId, error) {
};

Server.prototype.processFinish = function processFinish(paymentId) {
};
