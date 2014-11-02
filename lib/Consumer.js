var _ = require('lodash');
var assert = require('better-assert');
var bitcore = require('bitcore');

/**
 * @param {Object} opts
 * @param {number} opts.expires - unix timestamp in millis since epoch
 * @param {string} opts.network - 'livenet' or 'testnet'
 *
 * @param {bitcore.Key*} opts.fundingKey - optional, key to use for funding the channel
 * @param {bitcore.Key*} opts.commitmentKey - optional, key to use when negotiating the channel
 * @param {bitcore.Address*} opts.refundAddress - optional, address to use for refund/change
 *
 * @param {bitcore.Key*} opts.serverPublicKey - optional, the public key for the server
 * @param {bitcore.Address*} opts.serverAddress - optional, the public key for the server
 *
 * @param {Status*} opts.status - initial state (used for deserialization)
 * @param {number*} opts.amountPaid - amount from which to start (used for deserialization)
 */
function Consumer(opts) {
  assert(!opts.expires || _.isNumber(opts.expires));

  this.network = opts.network || 'livenet';
  this.status = opts.status || Status.DISCONNECTED;
  this.expires = opts.expires;

  this.inputs = [];
  this.commitmentKey = opts.commitmentKey || new bitcore.Key();

  if (opts.serverPublicKey) {
    this.setupServerPublicKey(opts.serverPublicKey);
  }
  this.serverAddress = opts.serverAddress;

  this.fundingKey = opts.fundingKey || new bitcore.Key();
  this.fundingAddress = createAddress(this.fundingKey.public);

  this.amountPaid = opts.amountPaid || 0;

  if (opts.refundAddress) {
    this.refundAddress = opts.refundAddress;
  } else {
    this.refundKey = new bitcore.Key();
    this.refundAddress = createAddress(this.refundKey.public);
  }
}

function createAddress(key) {
  var hash = bitcore.util.sha256ripe160(key);
  var version = bitcore.networks['livenet'].addressVersion;
  var addr = new bitcore.Address(version, hash);
  return addr.data;
}

/**
 * @enum Status
 * TODO: Use this
 */
var Status = {
  DISCONNECTED: 'disconnected',
  ESTABLISHED: 'established',
  ERRORED: 'errored',
  FINISHED: 'finished'
};

/**
 * Use this  to provide a set of inputs to be spent in the channel.
 * If this isn't called before the channel is created, an address to pay will be provided.
 */
Consumer.prototype.addUtxo = function useInput(utxo) {
  // TODO: Assert that this.fundingKey can sign the utxo
  this.inputs.push(utxo);
};

var isHexa = function isHexa(str) {
  return /[0-9a-fA-F]+/.test(str);
};

Consumer.prototype.setupServerPublicKey = function setupServerPublicKey(serverPublicKey) {
  assert(isHexa(serverPublicKey), 'Public key provided is not hexa');
  assert(_.size(serverPublicKey) === 33, 'Public key provided is not compressed');
  this.serverPublicKey = new bitcore.Key(serverPublicKey);
};

Consumer.prototype.setServerPaymentAddress = function setServerPaymentAddress(serverAddress) {
  this.serverAddress = serverAddress;
};

Consumer.prototype.getFundingAddress = function getFundingAddress() {
  return this.fundingAddress;
};

Consumer.prototype.createCommitmentTx = function createCommitmentTx() {
  assert(this.serverPublicKey, 'Must set up a server public key first');
  assert(_.size(this.inputs), 'Must have at least one input stored to establish channel');

  var outputPubkeys = [this.commitmentKey.public, this.serverPublicKey];
  this.commitmentTransactionBuilder = new bitcore.TransactionBuilder()
    .setUnspent(this.inputs)
    .setOutputs([bitcore.Script.createMultisig(2, outputPubkeys)])
    .sign(this.fundingKey.privKey)
  ;
  assert(this.commitmentTransactionBuilder.isFullySigned(),
    'Internal error: inputs for commitment transaction could not be signed with private key'
  );
  this.amount = _.reduce(this.inputs, function(sum, input) { return sum + input.v; });
  this.commitmentTransaction = this.commitmentTransactionBuilder.build();
  return this.commitmentTransaction.serialize();
};

Consumer.prototype.getRefundTxForSigning = function getRefundTxForSigning() {
  assert(this.commitmentTransaction, 'The commitment transaction must be created before');
  assert(this.serverPublicKey, 'Must set up a server public key first');
  assert(this.amount > 0, 'Amount must be greater than zero');
  assert(_.size(this.inputs), 'Must have at least one input stored to establish channel');

  var output = this.commitmentTransaction.outs()[0];
  this.refundTransaction = new bitcore.TransactionBuilder({lockTime: this.expires})
    .setUnspent([{
      txid: this.commitmentTransaction.getHash(),
      amountSat: output.v,
      scriptPubKey: output.s
    }])
    .setOutputs([{
      amount: this.amount,
      address: this.refundAddress
    }])
    .sign(this.commitmentKey.privKey)
  ;
  return this.refundTransaction.toObj();
};

// check that there are enough funds
Consumer.prototype.validateSignedRefund = function validatedSignedRefund(refundTransaction) {

  var transactionBuilder = TransactionBuilder.fromObj(refundTransaction);
  if (_.size(transactionBuilder.outs) > 1) {
    return false;
  }
  if (transactionBuilder.outs[0].s !== this.refundTransaction.outs[0].s) {
    return false;
  }
  if (transactionBuilder.outs[0].v !== this.refundTransaction.outs[0].v) {
    return false;
  }
  if (!transactionBuilder.isFullySigned()) {
    return false;
  }
  this.refundTransaction = transactionBuilder;
  return true;
};

// TODO: Just sign using SIGHASH_SINGLE | SIGHASH_ANYONECANPAY and return that
Consumer.prototype.getPaymentTx = function getPaymentTx(satoshis) {

  assert(this.commitmentTransaction, 'The commitment transaction must be created before');
  assert(this.refundTransaction && this.refundTransaction.isFullySigned(),
         'The refund transaction must be signed');
  assert(this.serverPublicKey, 'Must set up a server public key first');
  assert(_.size(this.inputs), 'Must have at least one input stored to establish channel');

  this.amountPaid += satoshis;
  var output = this.commitmentTransaction.outs()[0];
  return this.lastPayment = new bitcore.TransactionBuilder()
    .setUnspent([{
      txid: this.commitmentTransaction.getHash(),
      amountSat: output.v,
      scriptPubKey: output.s
    }])
    .setOutputs([{
      amount: this.amount - this.amountPaid,
      address: this.refundAddress
    }, {
      amount: this.amountPaid,
      address: this.serverAddress
    }])
    .sign(this.commitmentKey.privKey)
    .toObj()
  ;
};

Consumer.prototype.getSignedRefundTx = function getSignedRefundTx() {
  assert(this.refundTransaction().isFullySigned(), 'Refund transaction must be fully signed!');
  return this.refundTransaction().build().serialize();
};

module.exports = Consumer;
