var _ = require('lodash');

var bitcore = require('bitcore');
var preconditions = require('preconditions');
var $ = preconditions.singleton();

var util = require('../util/util');

/**
 * @constructor
 * @param {Object} opts
 * @param {Array.<string>} opts.pubkeys
 */
function Commitment(opts) {
  $.checkArgument(opts.pubkeys
                  && opts.pubkeys.length === 2,
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
    util.assertUsesSatoshis(value);
    self.amount += value.amountSat;
  });
  return this.amount;
};

/**
 * @param {Object} input
 */
Commitment.prototype.addInput = function(input) {
  util.assertUsesSatoshis(input);
  this.inputs.push(input);

  this.builder.setUnspent(this.inputs);
  this.builder.setOutputs({
    address: this.getAddress().toString(),
    amountSatStr: this._calculateAmount() - util.STANDARD_FEE
  });
};

/**
 * @param {bitcore.WalletKey} key
 */
Commitment.prototype.addKey = function(key) {
  this.keys.push(key);
  if (this.inputs.length) {
    this.builder.sign([key]);
  }
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
  this.builder.sign(this.keys);

  $.checkState(this.builder.isFullySigned(), 'Some provided inputs couldnt be signed');
  return this.builder.build();
};

module.exports = Commitment;
