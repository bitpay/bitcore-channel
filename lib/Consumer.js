'use strict';

var _ = require('lodash');

var bitcore = require('bitcore');
var $ = bitcore.util.preconditions;

var Commitment = require('./transactions/Commitment');
var Payment = require('./transactions/Payment');
var Refund = require('./transactions/Refund');

var HOURS_IN_DAY = 24;
var MINUTES_IN_HOUR = 60;
var SECONDS_IN_MINUTE = 60;

var ONE_DAY = SECONDS_IN_MINUTE * MINUTES_IN_HOUR * HOURS_IN_DAY;

/**
 * @param {Object} opts
 * @param {number} opts.expires - unix timestamp in millis since epoch
 * @param {string} opts.network - 'livenet' or 'testnet'
 *
 * @param {bitcore.PrivateKey=} opts.commitmentKey - key to use when negotiating the channel
 * @param {string=} opts.refundAddress - address to use for refund/change
 *
 * @param {bitcore.PrivateKey=} opts.fundingKey - key to use for funding the channel
 *
 * @param {string=} opts.providerPublicKey - the public key for the server, in hexa compressed format
 * @param {string=} opts.providerAddress - the final address where the server will be paid
 *
 * @param {Status=} opts.status - initial state (used for deserialization)
 * @param {number=} opts.amountPaid - amount from which to start (used for deserialization)
 * @constructor
 */
function Consumer(opts) {
  /*jshint maxstatements: 30*/
  /*jshint maxcomplexity: 10*/
  opts = opts || {};

  /**
   * @type string
   * @desc Either 'livenet' or 'testnet'
   */
  this.network = bitcore.Networks.get(opts.network || 'livenet');
  /**
   * @type number
   * @desc The expiration date for the channel, in seconds since UNIX epoch
   */
  this.expires = opts.expires || Math.round(new Date().getTime() / 1000) + ONE_DAY;

  /**
   * @type bitcore.PrivateKey
   * @desc This is the key used for the 2-of-2 locking of funds
   */
  this.commitmentKey = opts.commitmentKey || new bitcore.PrivateKey();

  $.checkArgument(opts.providerPublicKey, 'Must provide a public key for the provider');
  if (_.isString(opts.providerPublicKey)) {
    opts.providerPublicKey = new bitcore.PublickKey(opts.providerPublicKey);
  }
  $.checkArgument(opts.providerPublicKey instanceof bitcore.PublicKey, 'Invalid public key provided');
  this.providerPublicKey = opts.providerPublicKey;

  $.checkArgument(opts.providerAddress);
  /**
   * @type {bitcore.Address|string}
   * @desc The address where the server will be paid.
   */
  this.providerAddress = new bitcore.Address(opts.providerAddress);

  /**
   * @type bitcore.Key
   * @desc A private key for funding the channel. An alternative implementation could
   * provide a list of unspent outputs and the keys needed to sign the outputs
   */
  this.fundingKey = opts.fundingKey || new bitcore.PrivateKey();

  /**
   * @type bitcore.Address
   * @desc The address where the user will pay to fund the channel
   */
  this.fundingAddress = this.fundingKey.toAddress();

  if (opts.refundAddress) {
    if (opts.refundAddress instanceof bitcore.Address) {
      /**
       * @type bitcore.Address
       * @desc The address where both the refund and the change will end up
       */
      this.refundAddress = opts.refundAddress;
    } else {
      this.refundAddress = new bitcore.Address(opts.refundAddress);
    }
  } else {
    /**
     * @type bitcore.PrivateKey
     * @desc If no refund address is provided, a private key is generated for the user
     */
    this.refundKey = new bitcore.PrivateKey();
    this.refundAddress = new bitcore.Address(this.refundKey.publicKey, this.network);
  }

  /**
   * @name Consumer#commitmentTx
   * @type Commitment
   * @desc The commitment transaction for this channel
   */
  this.commitmentTx = new Commitment({
    publicKeys: [this.commitmentKey.publicKey, this.providerPublicKey],
    network: this.network
  });
}

/**
 * Adds an UTXO to the funding transaction. The funding transaction exists
 * merely because we can't expect the wallet of the user to support payment
 * channels.
 *
 * @param {Object} utxo
 */
Consumer.prototype.processFunding = function(utxo) {
  $.checkArgument(_.isObject(utxo), 'Can only process an array of objects or an object');
  this.commitmentTx.from(utxo);
};

/**
 * Build the refund transaction (TX 2)
 *
 * @return {bitcore.Transaction}
 */
Consumer.prototype.setupRefund = function() {
  var amount = this.commitmentTx.amount;
  var multisigOut = {
    txid: this.commitmentTx.id,
    outputIndex: 0,
    satoshis: amount,
    script: this.commitmentTx.outputs[0].script
  };
  this.refundTx = new Refund({
    multisigOut: multisigOut,
    amount: amount,
    refundAddress: this.refundAddress,
    publicKeys: this.commitmentTx.publicKeys,
    lockTime: this.expires,
    network: this.network
  });
  return this.refundTx;
};

/**
 * Validates that a message contains a valid signature from the Provider
 * that allows the Consumer to spend the lock transaction (TX 1)
 *
 * @param {string} messageFromProvider JSON-serialized message
 * @return {boolean} true if the signature is valid
 */
Consumer.prototype.validateRefund = function(messageFromProvider) {
  var refund = new Refund(messageFromProvider.refund);
  refund.sign(this.commitmentKey);
  $.checkState(new bitcore.Address(refund.outputs[0].script, this.network).toString() ===
               this.refundAddress.toString());
  var amount = refund.outputs[0].satoshis;
  $.checkState(amount + refund._estimateFee() === this.commitmentTx.amount);
  $.checkState(refund.outputs.length === 1, 'More than expected outputs received');
  $.checkState(refund.isFullySigned(), 'Refund was not fully signed');
  this.refundTx = refund;
  var multisigOut = {
    txid: this.commitmentTx.hash,
    outputIndex: 0,
    satoshis: amount,
    script: this.commitmentTx.outputs[0].script
  };
  this.paymentTx = new Payment({
    multisigOut: multisigOut,
    amount: amount,
    paymentAddress: this.providerAddress,
    changeAddress: this.refundAddress,
    publicKeys: this.commitmentTx.publicKeys,
    lockTime: this.expires,
    network: this.network
  });
  this.paymentTx.sign(this.commitmentKey);
  return true;
};

/**
 * Increments the amount being paid by a given amount of satoshis.
 * @return {bitcore.Transaction} the updated transaction
 */
Consumer.prototype.incrementPaymentBy = function (satoshis) {
  this.paymentTx.updateValue(satoshis);
  this.paymentTx.sign(this.commitmentKey);
  return this.paymentTx.toObject();
};

/**
 * Idiomatic shortcut to retrieve the payment transaction.
 * @return {bitcore.Transaction}
 */
Consumer.prototype.getPaymentTx = function () {
  return this.paymentTx;
};

module.exports = Consumer;
