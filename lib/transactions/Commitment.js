'use strict';

var _ = require('lodash');
var inherits = require('inherits');

var $ = require('bitcore/lib/util/preconditions');
var JSUtil = require('bitcore/lib/util/js');
var Address = require('bitcore/lib/address');
var Script = require('bitcore/lib/script');
var Transaction = require('bitcore/lib/transaction');


/**
 * A commitment transaction (also referred to as Lock transaction).
 *
 * @constructor
 * @param {Object} opts
 * @param {Array.<string>} opts.publicKeys
 * @param {string|bitcore.Network} opts.network - livenet by default
 */
function Commitment(opts) {
  $.checkArgument(opts.publicKeys && opts.publicKeys.length === 2, 'Must provide exactly two public keys');
  Transaction.apply(this);

  this.network = opts.network || 'livenet';
  this.outscript = Script.buildMultisigOut(this.publicKeys, 2);
  this.address = Address(this.outscript, this.network);
  this.change(this.address);

  this.publicKeys = opts.publicKeys;
  this.keys = [];
  Object.defineProperty(this, 'amount', {
    configurable: false,
    get: function() {
      return this._inputAmount;
    }
  });
}
inherits(Commitment, Transaction);

Commitment.prototype.from = function() {
  Transaction.prototype.from.apply(this, arguments);
};

/**
 * @return {bitcore.Address}
 */
Commitment.prototype.getAddress = function() {
  return this.address;
};

Commitment.prototype.addKey = function(key) {
  this.keys.push(key);
};

Commitment.prototype.serialize = function() {
  this.sign(this.keys);
  $.checkState(this.isFullySigned());
  Transaction.prototype.serialize.call(this);
};

module.exports = Commitment;
