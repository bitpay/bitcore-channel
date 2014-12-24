'use strict';

var _ = require('lodash');

var bitcore = require('bitcore');
var buffer = require('buffer');
var preconditions = require('preconditions');
var $ = preconditions.singleton();

var Commitment = require('./transactions/Commitment');
var Payment = require('./transactions/Payment');
var Refund = require('./transactions/Refund');

var HOURS_IN_DAY = 24;
var MINUTES_IN_HOUR = 60;
var SECONDS_IN_MINUTE = 60;
var MILLIS_IN_SECOND = 1000;

var ONE_DAY = MILLIS_IN_SECOND * SECONDS_IN_MINUTE * MINUTES_IN_HOUR * HOURS_IN_DAY;

/**
 * @param {Object} opts
 * @param {number} opts.expires - unix timestamp in millis since epoch
 * @param {string} opts.network - 'livenet' or 'testnet'
 *
 * @param {bitcore.Key=} opts.commitmentKey - key to use when negotiating the channel
 * @param {string=} opts.refundAddress - address to use for refund/change
 *
 * @param {bitcore.Key=} opts.fundingKey - key to use for funding the channel
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
  this.network = opts.network || 'livenet';
  /**
   * @type number
   * @desc The expiration date for the channel, in millis since UNIX epoch
   */
  this.expires = opts.expires || new Date().getTime() + ONE_DAY;

  /**
   * @type bitcore.Key
   * @desc This is the key used for the 2-of-2 locking of funds
   */
  this.commitmentKey = opts.commitmentKey || bitcore.Key.generateSync();

  $.checkArgument(opts.providerPublicKey, 'Must provide a public key for the provider');
  if (_.isString(opts.providerPublicKey)) {
    var providerPublicKey = new bitcore.Key();
    providerPublicKey.public = new buffer.Buffer(opts.providerPublicKey, 'hex');
    opts.providerPublicKey = providerPublicKey;
  }
  $.checkArgument(opts.providerPublicKey instanceof bitcore.Key, 'Invalid public key provided');
  this.providerPublicKey = opts.providerPublicKey;

  $.checkArgument(opts.providerAddress);
  /**
   * @type {bitcore.Address|string}
   * @desc The address where the server will be paid.
   */
  this.providerAddress = opts.providerAddress;

  /**
   * @type bitcore.Key
   * @desc A private key for funding the channel. An alternative implementation could
   * provide a list of unspent outputs and the keys needed to sign the outputs
   */
  this.fundingKey = opts.fundingKey || bitcore.Key.generateSync();

  /**
   * @type bitcore.Address
   * @desc The address where the user will pay to fund the channel
   */
  this.fundingAddress = bitcore.Address.fromPubKey(this.fundingKey.public, this.network);

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
     * @type bitcore.Key
     * @desc If no refund address is provided, a private key is generated for the user
     */
    this.refundKey = bitcore.Key.generateSync();
    this.refundAddress = bitcore.Address.fromPubKey(this.refundKey.public, this.network);
  }

  /**
   * @name Consumer#commitmentTx
   * @type Commitment
   * @desc The commitment transaction for this channel
   */
  this.commitmentTx = new Commitment({
    pubkeys: [this.commitmentKey.public, this.providerPublicKey.public],
    network: this.network
  });
  this.fundingWalletKey = new bitcore.WalletKey({
    network: bitcore.networks[this.network],
    privKey: this.fundingKey
  });
  this.commitmentTx.addKey(this.fundingWalletKey);
  this.commitmentWalletKey = new bitcore.WalletKey({
    network: bitcore.networks[this.network],
    privKey: this.commitmentKey
  });
}

Consumer.prototype.processFunding = function addUtxo(utxo) {
  if (_.isArray(utxo)) {
    this.commitmentTx.addInputs(utxo);
  } else if (_.isObject(utxo)) {
    this.commitmentTx.addInput(utxo);
  } else {
    throw new Error('Can only process an array of objects or an object');
  }
};

Consumer.prototype.getRefundTxToSign = function getRefundTxToSign() {
  var commitmentTx = this.commitmentTx.build();
  var amount = this.commitmentTx._calculateAmount();
  var multisigOut = {
    txid: commitmentTx.getHash(),
    vout: 0,
    amount: amount / 1e8,
    amountSatStr: amount,
    address: this.commitmentTx._address.toString(),
    scriptPubKey: this.commitmentTx.outscript.getBuffer()
  };
  this.refundTx = new Refund({
    multisigOut: multisigOut,
    amount: amount,
    refundAddress: this.refundAddress,
    pubKeys: this.commitmentTx.pubkeys,
    lockTime: this.expires,
    network: this.network
  });
  return this.refundTx.serialize();
};

Consumer.prototype.validateRefund = function(messageFromProvider) {
  var refund = new Refund(JSON.parse(messageFromProvider));
  refund.sign([this.commitmentWalletKey]);
  $.checkState(refund.isSigned());
  var built = refund.builder.build();
  var oldBuilt = this.refundTx.builder.build();
  $.checkState(built.outs.length === 1);
  $.checkState(built.outs[0].s.toString('hex') === oldBuilt.outs[0].s.toString('hex'));
  $.checkState(built.outs[0].v.toString('hex') === oldBuilt.outs[0].v.toString('hex'));
  this.refundTx = refund;
  var commitmentTx = this.commitmentTx.build();
  var amount = this.commitmentTx._calculateAmount();
  var multisigOut = {
    txid: commitmentTx.getHash(),
    vout: 0,
    amount: amount / 1e8,
    amountSatStr: amount,
    address: this.commitmentTx._address.toString(),
    scriptPubKey: this.commitmentTx.outscript.getBuffer()
  };
  this.paymentTx = new Payment({
    multisigOut: multisigOut,
    amount: amount,
    changeAddress: this.refundAddress,
    paymentAddress: this.serverAddress,
    pubKeys: this.commitmentTx.pubkeys,
    network: this.network
  });
  this.paymentTx.sign([this.commitmentWalletKey]);
  return true;
};

Consumer.prototype.incrementPaymentBy = function incrementPayment(satoshis) {
  this.paymentTx.updateValue(satoshis);
  this.paymentTx.sign([this.commitmentWalletKey]);
};

Consumer.prototype.sendToProvider = function sendToProvider() {
  return this.paymentTx.serialize();
};

module.exports = Consumer;
