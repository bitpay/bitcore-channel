'use strict';

var _ = require('lodash');
var inherits = require('inherits');
var bitcore = require('bitcore-lib');
var $ = bitcore.util.preconditions;
var MultiSigScriptHashInput = bitcore.Transaction.Input.MultiSigScriptHash;
var Input = bitcore.Transaction.Input;
var Script = require('../script');
var Signature = bitcore.crypto.Signature;
var PublicKey = bitcore.PublicKey;

function RedeemScriptHashInput(input, redeemScript, threshold, signatures) {
  var self = this;

  Input.apply(self, arguments);

  self.redeemScript = new Script(redeemScript);
  var params = Script.getParamsFromCLTVRedeemScript(redeemScript.toBuffer());

  self.publicKeys = params.pubkeys;
  self.lockTime = params.lockTime;
  self.threshold = threshold || 1;
  self.publicKeyIndex = {};

  signatures = signatures || input.signatures;

  _.each(self.publicKeys, function(publicKey, index) {
    self.publicKeyIndex[publicKey.toString()] = index;
  });

  self.signatures = signatures ? self._deserializeSignatures(signatures) : new Array(self.publicKeys.length);
}

inherits(RedeemScriptHashInput, MultiSigScriptHashInput);

RedeemScriptHashInput.prototype.addSignature = function(transaction, signature) {
  $.checkArgument(!_.isUndefined(this.publicKeyIndex[signature.publicKey.toString()]),
                  'Signature has no matching public key');
  $.checkState(this.isValidSignature(transaction, signature));
  this.signatures[this.publicKeyIndex[signature.publicKey.toString()]] = signature;
  this._updateScript();
  return this;
};

RedeemScriptHashInput._getCLTVRedeemScript = function(scriptBuffer) {
  var script = new Script(scriptBuffer);

  var scripts = script.chunks.slice(-1);
  var redeemScript = scripts[0];

  if (!redeemScript.buf || redeemScript.len !== 82) {
    return;
  }

  return new Script(redeemScript.buf);
};

RedeemScriptHashInput.fromBufferReader = function(br) {
  var baseInput = Input.fromBufferReader(br);
  var redeemScript = RedeemScriptHashInput._getCLTVRedeemScript(baseInput._scriptBuffer);

  if (!redeemScript) {
    return baseInput;
  }

  var input = new RedeemScriptHashInput(baseInput, redeemScript, 2);
  return input;
};

/*
 * When deserializing a CLTV Transaction, there might be signatures on the
 * one or more of the inputs. For RedeemScriptHashInput-type inputs, this
 * function will extract the serialized signature and sighash type.
 * It will then
*/
RedeemScriptHashInput.prototype.setSignatures = function(opts) {
  //this type of input dictates that there be a maximum of 2 signatures,
  //where the order of signatures is important.
  //if there are 2 signatures, then the first signature MUST be the provider's
  //if there is only one signature, then the signature could be from either the
  //the provider's or the consumer's, so we must test the signature with, possibly,
  //both the provider and consumer's pubkey. Chances are, in the single signature
  //situation, the signature has been produced by the consumer's private key.
  //This assumption is based on the most common work-flow of a payment channel.
  $.checkArgument(opts && opts.inputIndex >= 0 && opts.transaction, 'inputIndex and transaction are required');

  var script = new Script(this._scriptBuffer);

  //We also assume that this script is really a CLTV-type scriptSig.
  //The format should resemble [ sig1(opt), sig2(opt), CLTV redeem script]
  if (script.chunks.length < 2) {
    return;
  }

  var sigBufs = script.chunks.slice(0, 2);

  for(var i = 0; i < sigBufs.length; i++) {

    var sig = sigBufs[i];
    if (!sig.buf || sig.len < 70 || sig.len > 75) {
      continue;
    }

    var signature = Signature.fromTxFormat(sig.buf); //throws like a boss
    var sigs = [];

    for(var j = 0; j < this.publicKeys.length; j++) {

      var pubKey = new PublicKey(this.publicKeys[j]);
      var sigObj = {
        signature: signature,
        publicKey: pubKey,
        inputIndex: opts.inputIndex,
        outputIndex: this.outputIndex,
        sigtype: signature.nhashtype,
        prevTxId: this.prevTxId
      };

      if (this.isValidSignature(opts.transaction, sigObj)) {
        sigs.push(sigObj);
      } else {
        sigs.push(null);
      }

    }

  }

  this.signatures = this._deserializeSignatures(sigs);
};

RedeemScriptHashInput.prototype._updateScript = function() {
  this.setScript(Script.buildCLTVMultisigIn(
    this.publicKeys,
    this.lockTime,
    this._createSignatures(),
    { cachedMultisig: this.redeemScript }
  ));
  return this;
};

module.exports = RedeemScriptHashInput;
