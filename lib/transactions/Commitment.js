var bitcore = require('bitcore');
var preconditions = require('preconditions');
var $ = preconditions.singleton();

var util = require('./util');

/**
 * @constructor
 * @param {Object} opts
 * @param {Array.<string>} opts.pubkeys
 */
function Commitment(opts) {
  $.checkArgument(opts.pubkeys
                  && opts.pubkeys.length === 2
                  && util.isCompressedPubkey(opts.pubkeys[0])
                  && util.isCompressedPubkey(opts.pubkeys[1]),
                  'Must provide exactly two public keys');

  this.pubkeys = opts.pubkeys;
  this.network = opts.network || 'livenet';
  this.inputs = [];
  this.keys = [];
  this.builder = new bitcore.TransactionBuilder({
    spendUnconfirmed: true
  });
}

/**
 * @return {bitcore.Address}
 */
Commitment.prototype.getAddress = function() {
  if (!this._address) {
    this.outscript = bitcore.Script.createMultisig(2, this.pubkeys);

    this._address = bitcore.Address.fromScript(
      this.outscript.getBuffer().toString('hex'),
      this.network
    );
  }
  return this._address;
};

Commitment.prototype._calculateAmount = function _calculateAmount() {
  var self = this;
  this.amount = 0;
  _.each(this.inputs, function(value) {
    assertUsesSatoshis(value);
    self.amount += value.amountSat;
  });
};

/**
 * @param {Object} input
 */
Commitment.prototype.addInput = function(input) {
  util.assertUsesSatoshis(input);
  this.inputs.push(input);

  this.builder.setUnspent(this.inputs);
  this.builder.setOutputs({
    address: this.getAddress(),
    amountSatStr: this._calculateAmount() - STANDARD_FEE
  });
  this.builder.sign(this.keys);
};

/**
 * @param {bitcore.WalletKey} key
 */
Commitment.prototype.addKey = function(key) {
  this.keys.push(key);
  this.builder.sign(key);
};

/**
 * @param {Array} inputs
 */
Commitment.prototype.addInputs = function(inputs) {
  var self = this;
  inputs.map(function(input) { self.addInput(input); });
};

/**
 * @param {Array.<bitcore.WalletKey>} keys
 */
Commitment.prototype.addKeys = function(keys) {
  var self = this;
  keys.map(function(key) { self.addKey(key); });
};

/**
 * @return {bitcore.Transaction}
 */
Commitment.prototype.build = function() {
  return this.builder.build();
};
