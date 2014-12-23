'use strict';

var _ = require('lodash');
var bitcore = require('bitcore');
var preconditions = require('preconditions');
var $ = preconditions.singleton();
var inherits = require('inherits');

/**
 * @constructor
 * @param {Object} opts
 * @param {Commitment} opts.commitment
 * @param {bitcore.Address} opts.paymentAddress
 * @param {bitcore.Address} opts.changeAddress
 */
function Refund(opts) {
  bitcore.Transaction.call(this, opts.transaction ? opts.transaction : undefined);

  this.refundAddress = new bitcore.Address(opts.refundAddress);

  this.multisigOut = new bitcore.Transaction.UnspentOutput(opts.multisigOut);
  this.publicKeys = _.map(opts.publicKeys, bitcore.PublicKey);
  if (!this.inputs.length) {
    this.from(this.multisigOut, this.publicKeys, 2);
  }
  if (!this.outputs.length) {
    this.change(this.refundAddress);
    this._updateChangeOutput();
  }
  if (opts.lockTime) {
    this.nLockTime = opts.lockTime;
  }
  this.amount = this._outputAmount;
  this._changeSetup = undefined;
  $.checkArgument(_.isNumber(this.amount), 'Amount must be a number');
}
inherits(Refund, bitcore.Transaction);

Refund.prototype.toObject = function() {
  return {
    publicKeys: this.publicKeys,
    multisigOut: this.multisigOut,
    amount: this.amount,
    refundAddress: this.refundAddress.toObject(),
    transaction: bitcore.Transaction.prototype.toObject.apply(this)
  };
};

module.exports = Refund;
