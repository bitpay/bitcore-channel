'use strict';

var _ = require('lodash');
var inherits = require('inherits');
var bitcore = require('bitcore-lib');
var Input = bitcore.Transaction.Input;
var Output = bitcore.Transaction.Output;
var $ = bitcore.util.preconditions;

var Script = bitcore.Script;
var Signature = bitcore.crypto.Signature;
var Sighash = bitcore.Transaction.Sighash;
var PublicKey = bitcore.PublicKey;
var BufferUtil = bitcore.util.buffer;
var TransactionSignature = bitcore.Transaction.Signature;

/**
 * @constructor
 */
function RedeemScriptHashInput(input, pubkeys, threshold, redeemScript, signatures) {
  Input.apply(this, arguments);
  var self = this;
  pubkeys = pubkeys || input.publicKeys;
  threshold = threshold || input.threshold;
  signatures = signatures || input.signatures;
  this.publicKeys = _.sortBy(pubkeys, function(publicKey) { return publicKey.toString('hex'); });
  //we have to assume that the provided redeem script is going to be spendable under under the expected conditions (expected by the creators of the redeem script)
  this.redeemScript = redeemScript;
  this.publicKeyIndex = {};
  _.each(this.publicKeys, function(publicKey, index) {
    self.publicKeyIndex[publicKey.toString()] = index;
  });
  this.threshold = threshold;
  // Empty array of signatures
  this.signatures = signatures ? this._deserializeSignatures(signatures) : new Array(this.publicKeys.length);
}
inherits(RedeemScriptHashInput, Input);

RedeemScriptHashInput.prototype.toObject = function() {
  var obj = Input.prototype.toObject.apply(this, arguments);
  obj.threshold = this.threshold;
  obj.publicKeys = _.map(this.publicKeys, function(publicKey) { return publicKey.toString(); });
  obj.signatures = this._serializeSignatures();
  return obj;
};

RedeemScriptHashInput.prototype._deserializeSignatures = function(signatures) {
  return _.map(signatures, function(signature) {
    if (!signature) {
      return undefined;
    }
    return new TransactionSignature(signature);
  });
};

RedeemScriptHashInput.prototype._serializeSignatures = function() {
  return _.map(this.signatures, function(signature) {
    if (!signature) {
      return undefined;
    }
    return signature.toObject();
  });
};

RedeemScriptHashInput.prototype.getSignatures = function(transaction, privateKey, index, sigtype) {
  $.checkState(this.output instanceof Output);
  sigtype = sigtype || Signature.SIGHASH_ALL;

  var self = this;
  var results = [];
  _.each(this.publicKeys, function(publicKey) {
    if (publicKey.toString() === privateKey.publicKey.toString()) {
      results.push(new TransactionSignature({
        publicKey: privateKey.publicKey,
        prevTxId: self.prevTxId,
        outputIndex: self.outputIndex,
        inputIndex: index,
        signature: Sighash.sign(transaction, privateKey, sigtype, index, self.redeemScript),
        sigtype: sigtype
      }));
    }
  });
  return results;
};

RedeemScriptHashInput.prototype.addSignature = function(transaction, signature) {
  $.checkState(!this.isFullySigned(), 'All needed signatures have already been added');
  $.checkArgument(!_.isUndefined(this.publicKeyIndex[signature.publicKey.toString()]),
                  'Signature has no matching public key');
  $.checkState(this.isValidSignature(transaction, signature));
  this.signatures[this.publicKeyIndex[signature.publicKey.toString()]] = signature;
  this._updateScript();
  return this;
};

RedeemScriptHashInput.prototype._updateScript = function() {
  this.setScript(Script.buildP2SHMultisigIn(
    this.publicKeys,
    this.threshold,
    this._createSignatures(),
    { cachedMultisig: this.redeemScript }
  ));
  return this;
};

RedeemScriptHashInput.prototype._createSignatures = function() {
  return _.map(
    _.filter(this.signatures, function(signature) { return !_.isUndefined(signature); }),
    function(signature) {
      return BufferUtil.concat([
        signature.signature.toDER(),
        BufferUtil.integerAsSingleByteBuffer(signature.sigtype)
      ]);
    }
  );
};

RedeemScriptHashInput.prototype.clearSignatures = function() {
  this.signatures = new Array(this.publicKeys.length);
  this._updateScript();
};

RedeemScriptHashInput.prototype.isFullySigned = function() {
  return this.countSignatures() === this.threshold;
};

RedeemScriptHashInput.prototype.countMissingSignatures = function() {
  return this.threshold - this.countSignatures();
};

RedeemScriptHashInput.prototype.countSignatures = function() {
  return _.reduce(this.signatures, function(sum, signature) {
    return sum + (!!signature);
  }, 0);
};

RedeemScriptHashInput.prototype.publicKeysWithoutSignature = function() {
  var self = this;
  return _.filter(this.publicKeys, function(publicKey) {
    return !(self.signatures[self.publicKeyIndex[publicKey.toString()]]);
  });
};

RedeemScriptHashInput.prototype.isValidSignature = function(transaction, signature) {
  // FIXME: Refactor signature so this is not necessary
  signature.signature.nhashtype = signature.sigtype;
  return Sighash.verify(
      transaction,
      signature.signature,
      signature.publicKey,
      signature.inputIndex,
      this.redeemScript
  );
};

RedeemScriptHashInput.OPCODES_SIZE = 7; // serialized size (<=3) + 0 .. N .. M OP_CHECKMULTISIG
RedeemScriptHashInput.SIGNATURE_SIZE = 74; // size (1) + DER (<=72) + sighash (1)
RedeemScriptHashInput.PUBKEY_SIZE = 34; // size (1) + DER (<=33)

RedeemScriptHashInput.prototype._estimateSize = function() {
  return RedeemScriptHashInput.OPCODES_SIZE +
    this.threshold * RedeemScriptHashInput.SIGNATURE_SIZE +
    this.publicKeys.length * RedeemScriptHashInput.PUBKEY_SIZE;
};

module.exports = RedeemScriptHashInput;
