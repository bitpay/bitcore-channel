var _ = require('lodash');
var assert = require('better-assert');
var bitcore = require('bitcore');
var util = require('./util');

var HOURS_IN_DAY = 24;
var MINUTES_IN_HOUR = 60;
var SECONDS_IN_MINUTE = 60;
var MILLIS_IN_SECOND = 1000;

var STANDARD_FEE = 0.0001;

var ONE_DAY = MILLIS_IN_SECOND * SECONDS_IN_MINUTE * MINUTES_IN_HOUR * HOURS_IN_DAY;

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
  opts = opts || {};

  this.network = opts.network || 'livenet';
  this.status = opts.status || Status.DISCONNECTED;
  this.expires = opts.expires || new Date().getTime() + ONE_DAY;

  this.inputs = [];
  this.commitmentKey = opts.commitmentKey || bitcore.Key.generateSync();

  if (opts.serverPublicKey) {
    this.setupServerPublicKey(opts.serverPublicKey);
  }
  this.serverAddress = opts.serverAddress;

  this.fundingKey = opts.fundingKey || bitcore.Key.generateSync();
  this.fundingAddress = util.createAddress(this.fundingKey.public, this.network);

  this.amountPaid = opts.amountPaid || 0;

  if (opts.refundAddress) {
    this.refundAddress = opts.refundAddress;
  } else {
    this.refundKey = bitcore.Key.generateSync();
    this.refundAddress = util.createAddress(this.refundKey.public, this.network);
  }
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
Consumer.prototype.addUtxo = function addUtxo(utxo) {
  // TODO: Assert that this.fundingKey can sign the utxo
  this.inputs.push(utxo);
};

Consumer.prototype.setupServerPublicKey = function setupServerPublicKey(serverPublicKey) {
  assert(util.isCompressedPubkey(serverPublicKey), 'Public key provided is not compressed hexa');
  assert(_.size(serverPublicKey) === 66, 'Public key provided is not compressed');
  this.serverPublicKey = new Buffer(serverPublicKey, 'hex');
};

Consumer.prototype.setServerPaymentAddress = function setServerPaymentAddress(serverAddress) {
  this.serverAddress = serverAddress;
};

Consumer.prototype.getFundingAddress = function getFundingAddress() {
  return this.fundingAddress;
};

Consumer.prototype.createCommitmentTx = function createCommitmentTx() {
  this.commitmentTransaction = this._createCommitmentTxBuilder().build();
  return this.commitmentTransaction.serialize().toString('hex');
};

Consumer.prototype._createCommitmentAddress = function _createCommitmentAddress() {
  var outputPubkeys = [this.commitmentKey.public, this.serverPublicKey];
  return bitcore.Address.fromScript(
    bitcore.Script.createMultisig(2, outputPubkeys).getBuffer().toString('hex'),
    this.network
  ).toString();
};

Consumer.prototype._calculateAmount = function _calculateAmount() {
  var self = this;
  this.amount = 0;
  _.each(this.inputs, function(value) { self.amount += value.amount; });
};

Consumer.prototype._createCommitmentTxBuilder = function _createCommitmentTxBuilder() {
  assert(this.serverPublicKey, 'Must set up a server public key first');
  assert(_.size(this.inputs), 'Must have at least one input stored to establish channel');

  this._calculateAmount();
  this.commitmentTransactionBuilder = new bitcore.TransactionBuilder({
    spendUnconfirmed: true,
    fee: STANDARD_FEE
  })
    .setUnspent(this.inputs)
    .setOutputs([{
      amount: this.amount - STANDARD_FEE,
      address: this._createCommitmentAddress()
    }])
    .sign([new bitcore.WalletKey({
      network: bitcore.networks[this.network],
      privKey: this.fundingKey
    })])
  ;
  assert(this.commitmentTransactionBuilder.isFullySigned(),
    'Internal error: inputs for commitment transaction could not be signed with private key'
  );
  return this.commitmentTransactionBuilder;
};

Consumer.prototype.getRefundAddress = function getRefundAddress() {
  return this.refundAddress.toString();
};

Consumer.prototype._getRefundTxP2SHInfoMap = function _getRefundTxP2SHInfoMap() {
  var opts = { nreq: 2, pubkeys: [this.commitmentKey.public, this.serverPublicKey] };
  var info = bitcore.TransactionBuilder.infoForP2sh(opts, 'testnet');
  var p2shAddress = info.address;
  var p2shScript = info.scriptBufHex;
  var hashMap = {address: p2shAddress}; 
  hashMap[p2shAddress] = p2shScript;
  return hashMap;
};

Consumer.prototype.getRefundTxForSigning = function getRefundTxForSigning() {
  assert(this.commitmentTransaction, 'The commitment transaction must be created before');
  assert(this.serverPublicKey, 'Must set up a server public key first');
  assert(this.amount > 0, 'Amount must be greater than zero');
  assert(_.size(this.inputs), 'Must have at least one input stored to establish channel');

  var output = this.commitmentTransaction.outs[0];
  var info = this._getRefundTxP2SHInfoMap();
  this.refundTransaction = new bitcore.TransactionBuilder({
    lockTime: Math.floor(this.expires / 1000),
    spendUnconfirmed: true,
    fee: STANDARD_FEE
  })
    .setUnspent([{
      address: info.address,
      txid: this.commitmentTransaction.getHash(),
      vout: 0,
      amount: this.amount - STANDARD_FEE,
      scriptPubKey: output.s.toString('hex')
    }])
    .setHashToScriptMap(info)
    .setOutputs([{
      amount: this.amount - 2 * STANDARD_FEE,
      address: this._createCommitmentAddress()
    }])
    .sign([new bitcore.WalletKey({
      network: bitcore.networks[this.network],
      privKey: this.commitmentKey
    })])
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
  return this.refundTransaction().build().serialize().toString('hex');
};

module.exports = Consumer;
