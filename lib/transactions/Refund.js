'use strict';

var _ = require('lodash');
var inherits = require('inherits');

var $ = require('bitcore').util.preconditions;
var Transaction = require('bitcore').Transaction;
var Address = require('bitcore').Address;
var PublicKey = require('bitcore').PublicKey;

/**
 * @constructor
 * @param {Object} opts
 * @param {Commitment} opts.commitment
 * @param {bitcore.Address} opts.paymentAddress
 * @param {bitcore.Address} opts.changeAddress
 */
function Refund(opts) {
  Transaction.call(this, opts.transaction ? opts.transaction : undefined);

  this.refundAddress = new Address(opts.refundAddress);

  this.multisigOut = new Transaction.UnspentOutput(opts.multisigOut);
  this.publicKeys = _.map(opts.publicKeys, PublicKey);
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
inherits(Refund, Transaction);

Refund.prototype.toObject = function() {
  return {
    publicKeys: _.map(this.publicKeys, function(publicKey) { return publicKey.toString(); }),
    multisigOut: this.multisigOut.toObject(),
    amount: this.amount,
    refundAddress: this.refundAddress.toObject(),
    transaction: Transaction.prototype.toObject.apply(this)
  };
};

module.exports = Refund;
