var _ = require('lodash');

var bitcore = require('bitcore');
var buffer = require('buffer');
var preconditions = require('preconditions');
var $ = preconditions.singleton();

var util = require('./util/util');

var Commitment = require('./transactions/Commitment');
var Payment = require('./transactions/Payment');
var Refund = require('./transactions/Refund');

var TXHASH_SIZE = 32;
var SEQUENCE_NUMBER_SIZE = 4;

var HOURS_IN_DAY = 24;
var MINUTES_IN_HOUR = 60;
var SECONDS_IN_MINUTE = 60;
var MILLIS_IN_SECOND = 1000;

var STANDARD_FEE = 10000;

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
 * @param {string=} opts.serverPublicKey - the public key for the server, in hexa compressed format
 * @param {string=} opts.serverAddress - the final address where the server will be paid
 *
 * @param {Status=} opts.status - initial state (used for deserialization)
 * @param {number=} opts.amountPaid - amount from which to start (used for deserialization)
 * @constructor
 */
function Consumer(opts) {
  /*jshint maxstatements: 30*/
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

  if (opts.serverPublicKey) {
    this.serverKey = opts.serverPublicKey;
  }

  /**
   * @type bitcore.Address
   * @desc The address where the server will be paid. If not specified, it will
   * derive one from the server public key
   */
  this.serverAddress = opts.serverAddress;

  /**
   * @type bitcore.Key
   * @desc A private key for funding the channel. An alternative implementation could
   * provide a list of unspent outputs and the keys needed to sign the outputs
   */
  this.fundingKey = opts.fundingKey || bitcore.Key.generateSync();
  /**
   * @type bitcore.Address
   * @desc The address where the user will pay
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
    pubkeys: [this.commitmentKey.public, this.serverKey],
    network: this.network
  });
  var walletKey = new bitcore.WalletKey({
    network: this.network
  });
  walletKey.fromObj({
    priv: this.fundingKey.private.toString('hex')
  });
  this.commitmentTx.addKey(walletKey);
}

Consumer.prototype.addUtxo = function addUtxo(utxo) {
  this.commitmentTx.addInput(utxo);
};

module.exports = Consumer;
