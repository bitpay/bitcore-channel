var _ = require('lodash');

var bitcore = require('bitcore');
var buffer = require('buffer');
var preconditions = require('preconditions');
var $ = preconditions.singleton();

var util = require('./util');

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
    this.setupServerPublicKey(opts.serverPublicKey);
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

  this.resetState(opts);
}

/**
 * Sets up the state according to opts
 * @param {Object} opts
 */
Consumer.prototype.resetState = function resetState(opts) {
  opts = _.extend({}, opts);
  /**
   * @name Consumer#status
   * @type Status
   */
  this.status = opts.status || Status.DISCONNECTED;

  /**
   * @name Consumer#inputs
   * @type Array.<bitcore.Transaction.In>
   */
  this.inputs = [];

  /**
   * @name Consumer#amountPaid
   * @type number
   * @desc The amount that will be paid to the provider on a payment transaction
   */
  this.amountPaid = opts.amountPaid || 0;

  /**
   * @name Consumer#commitmentTx
   * @type bitcore.Transaction
   * @desc The commitment transaction for this channel
   */
  this.commitmentTx = null;

  /**
   * @name Consumer#refundTx
   * @type bitcore.Transaction
   * @desc The refund transaction for this channel
   */
  this.refundTx = null;

  /**
   * @name Consumer#serverRefundSignature
   * @type buffer.Buffer
   * @desc The signature for the refund transaction of the channel
   */
  this.serverRefundSignature = null;
};

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
 * Use this to provide a set of inputs to be spent in the channel.
 */
Consumer.prototype.addUtxo = function addUtxo(utxo) {
  // TODO: Assert that this.fundingKey can sign the utxo
  // $.checkArgument(utxo.address === this.fundingAddress.toString());
  this.inputs.push(utxo);
};

Consumer.prototype.setupServerPublicKey = function setupServerPublicKey(serverPublicKey) {
  $.checkArgument(util.isCompressedPubkey(serverPublicKey),
    'Public key provided is not compressed hexa'
  );
  $.checkArgument(_.size(serverPublicKey) === 66,
    'Public key provided is not compressed'
  );
  /**
   * @name Consumer#serverPublicKey
   * @type bitcore.Key
   * @desc The server key used for the locking of funds
   */
  this.serverPublicKey = new bitcore.Key();
  this.serverPublicKey.public = new buffer.Buffer(serverPublicKey, 'hex');
};

Consumer.prototype.setServerPaymentAddress = function setServerPaymentAddress(serverAddress) {
  if (serverAddress instanceof bitcore.Address) {
    this.serverAddress = serverAddress;
    return;
  }
  this.serverAddress = new bitcore.Address(serverAddress, this.network);
};

Consumer.prototype.getFundingAddress = function getFundingAddress() {
  return this.fundingAddress;
};

Consumer.prototype._createCommitmentAddress = function _createCommitmentAddress() {
  $.checkState(this.serverPublicKey, 'Must have set up server public key first');
  var outputPubkeys = [this.commitmentKey.public, this.serverPublicKey.public];
  /**
   * @name Consumer#commitmentOutputScript
   * @type bitcore.Script
   * @desc The script for the multisig output
   */
  this.commitmentOutputScript = bitcore.Script.createMultisig(2, outputPubkeys);

  return bitcore.Address.fromScript(
    this.commitmentOutputScript.getBuffer().toString('hex'),
    this.network
  ).toString();
};

function assertUsesSatoshis(output) {
  if (!output.amountSat) {
    output.amountSat = Math.round(output.amount * bitcore.util.COIN);
    output.amountSatStr = Math.round(output.amount * bitcore.util.COIN);
  }
}

Consumer.prototype._calculateAmount = function _calculateAmount() {
  var self = this;
  this.amount = 0;
  _.each(this.inputs, function(value) {
    assertUsesSatoshis(value);
    self.amount += value.amountSat;
  });
};

Consumer.prototype.createCommitmentTx = function createCommitmentTx() {
  $.checkState(this.serverPublicKey, 'Must set up a server public key first');
  $.checkState(_.size(this.inputs),
    'Must have at least one input stored to establish channel'
  );

  if (this.commitmentTx) {
    return this.commitmentTx;
  }
  this._calculateAmount();
  var commitmentTxBuilder = new bitcore.TransactionBuilder({
    spendUnconfirmed: true
  });
  commitmentTxBuilder.setUnspent(this.inputs);
  commitmentTxBuilder.setOutputs([{
    address: this._createCommitmentAddress(),
    amountSatStr: this.amount - STANDARD_FEE
  }]);
  this.commitmentTx = commitmentTxBuilder.build();
  return this.commitmentTx;
};

Consumer.prototype.getRefundAddress = function getRefundAddress() {
  return this.refundAddress;
};

Consumer.prototype._inputFromCommitment = function _inputFromCommitment() {
  var hash = this.commitmentTx.getHash();
  var output = new buffer.Buffer(TXHASH_SIZE + SEQUENCE_NUMBER_SIZE);
  hash.copy(output);
  output.writeUInt32LE(
    this.amount - STANDARD_FEE,
    hash.length
  );
  return new bitcore.Transaction.In({
    o: output,
    q: 0xFFFFFFFF
  });
};

Consumer.prototype._outputToConsumer = function _outputToConsumer() {
  $.checkState(this.commitmentTx, 'Commitment transaction must exist!');
  var amount = this.amount - this.amountPaid - STANDARD_FEE * 2;

	var scriptOut = bitcore.Script.createPubKeyHashOut(this.refundAddress.payload());
	scriptOut.updateBuffer();
	return new bitcore.Transaction.Out({
		s: scriptOut.getBuffer(),
		v: amount
	});
};

Consumer.prototype._outputToProvider = function _outputToProvider(amount) {
  $.checkState(this.commitmentTx, 'Commitment transaction must exist!');

	var scriptOut = bitcore.Script.createPubKeyHashOut(this.serverAddress.payload());
	scriptOut.updateBuffer();
	return new bitcore.Transaction.Out({
		s: scriptOut.getBuffer(),
		v: amount || this.amountPaid
	});
};

Consumer.prototype.getRefundTxHash = function getRefundTxHash() {
  this.createCommitmentTx();

	this.refundTx = new bitcore.Transaction();
	this.refundTx.version = 1;
  /*jshint camelcase:false*/
  this.refundTx.lock_time = Math.floor(this.expires / 1000);
  /*jshint camelcase:true*/

  this.refundTx.ins.push(this._inputFromCommitment());
  this.refundTx.outs.push(this._outputToConsumer());

  return this.refundTx.getHash();
};

Consumer.prototype.validateRefundSig = function validateRefundSig(signature) {
	var scriptPubKeyBuf = this.commitmentTx.outs[0].getBuffer();
	var scriptPubKey = new bitcore.Script(scriptPubKeyBuf);
	var sigHash = this.refundTx.hashForSignature(
    scriptPubKey, 0, bitcore.Transaction.SIGHASH_ALL
  );

	if (!this.serverPublicKey.verifySignatureSync(sigHash, signature)) {
		console.warn('Tried to apply bad server signature to refund');
    return false;
	}
  this.serverRefundSignature = signature;
  var scriptIn = new bitcore.Script();
  scriptIn.writeBytes(this.commitmentKey.signSync(sigHash));
  scriptIn.writeBytes(new buffer.Buffer(signature)); // TODO: add "'hex'" argument?
  scriptIn.writeBytes(scriptPubKeyBuf);
  this.refundTx.ins[0].s = scriptIn.getBuffer();
  return true;
};

Consumer.prototype.incrementPaymentBy = function incrementPaymentBy(satoshis) {
  this.amountPaid += satoshis;
};

// TODO: Just sign using SIGHASH_SINGLE | SIGHASH_ANYONECANPAY and return that
Consumer.prototype.getPaymentTxSignature = function getPaymentTxSignature() {

  $.checkState(this.commitmentTx,
    'The commitment transaction must be created before paying'
  );
  if (!this.serverRefundSignature) {
    console.warn('Signing paymentTx without refund tx signature!');
  }
  // TODO!
};

Consumer.prototype.getSignedRefundTx = function getSignedRefundTx() {
  $.checkState(this.serverRefundSignature,
    'Refund transaction must be signed by server!'
  );
  $.checkState(this.refundTx, 'Refund transaction was never built!');
  // TODO: Apply server signature
  // TODO: Apply own signature
  return this.refundTx.serialize().toString('hex');
};

module.exports = Consumer;
