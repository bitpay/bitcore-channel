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

function RedeemScriptHashInput(input, redeemScript, signatures) {
  Input.apply(this, arguments);
  var self = this;
  signatures = signatures || input.signatures;
  this.threshold = 2;
  this.redeemScript = new Script(redeemScript);
  var params = Script.getParamsFromCLTVRedeemScript(redeemScript.toBuffer());
  this.publicKeys = params.pubkeys;
  this.publicKeyIndex = {};
  _.each(this.publicKeys, function(publicKey, index) {
    self.publicKeyIndex[publicKey.toString()] = index;
  });
  this.signatures = signatures ? this._deserializeSignatures(signatures) : new Array(this.publicKeys.length);
}

inherits(RedeemScriptHashInput, MultiSigScriptHashInput);

module.exports = RedeemScriptHashInput;
