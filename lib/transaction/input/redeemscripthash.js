'use strict';

var _ = require('lodash');
var inherits = require('inherits');
var bitcore = require('bitcore-lib');
var MultiSigScriptHashInput = bitcore.Transaction.Input.MultiSigScriptHash;
var Input = bitcore.Transaction.Input;
var Output = bitcore.Transaction.Output;
var $ = bitcore.util.preconditions;

var Script = require('../script');
var Signature = bitcore.crypto.Signature;
var Sighash = bitcore.Transaction.Sighash;
var PublicKey = bitcore.PublicKey;
var BufferUtil = bitcore.util.buffer;
var TransactionSignature = bitcore.Transaction.Signature;

/**
 * @constructor
 */
function RedeemScriptHashInput(input, pubkeys, lockTime, signatures) {
  Input.apply(this, arguments);
  var self = this;
  pubkeys = pubkeys || input.publicKeys;
  signatures = signatures || input.signatures;
  this.threshold = 1;
  this.publicKeys = pubkeys;
  this.redeemScript = Script.buildFromCLTVOut(pubkeys, lockTime);
  this.publicKeyIndex = {};
  _.each(this.publicKeys, function(publicKey, index) {
    self.publicKeyIndex[publicKey.toString()] = index;
  });
  // Empty array of signatures
  this.signatures = signatures ? this._deserializeSignatures(signatures) : new Array(this.publicKeys.length);
}

inherits(RedeemScriptHashInput, MultiSigScriptHashInput);

module.exports = RedeemScriptHashInput;
