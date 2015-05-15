'use strict';

var inherits = require('inherits');

var $ = require('bitcore').util.preconditions;

var Script = require('bitcore').Script;
var Transaction = require('bitcore').Transaction;
var _ = require('bitcore').deps._;


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
  Transaction.call(this, opts.transaction);

  this.network = opts.network || 'livenet';
  this.publicKeys = opts.publicKeys;
  this.outscript = Script.buildMultisigOut(this.publicKeys, 2);
  this.address = this.outscript.toScriptHashOut().toAddress();
  if (!this.outputs.length) {
    this.change(this.address);
    this._updateChangeOutput();
  }

  Object.defineProperty(this, 'amount', {
    configurable: false,
    get: function() {
      return this.inputAmount;
    }
  });
}
inherits(Commitment, Transaction);

Commitment.prototype.toObject = function() {
  var transaction = Transaction.prototype.toObject.apply(this);
  return {
    transaction: transaction,
    publicKeys: _.map(this.publicKeys, function(publicKey) {
      return publicKey.toString();
    }),
    network: this.network.toString(),
  };
};

/**
 * @return {bitcore.Address}
 */
Commitment.prototype.getAddress = function() {
  return this.address;
};

module.exports = Commitment;
