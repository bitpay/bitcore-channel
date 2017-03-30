'use strict';

var _ = require('lodash');
var inherits = require('inherits');
var bitcore = require('bitcore-lib');
var MultiSigScriptHashInput = bitcore.Transaction.Input.MultiSigScriptHash;
var Input = bitcore.Transaction.Input;
var Script = require('../script');

function RedeemScriptHashInput(input, redeemScript, signatures) {

  Input.apply(this, arguments);
  var self = this;
  signatures = signatures || input.signatures;
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

RedeemScriptHashInput.prototype._updateScript = function() {
  this.setScript(Script.buildP2SHMultisigIn(
    this.publicKeys,
    this._createSignatures(),
    { cachedMultisig: this.redeemScript }
  ));
  return this;
};

RedeemScriptHashInput.prototype.isFullySigned = function() {
  return this.countSignatures() === 2;
};

module.exports = RedeemScriptHashInput;
