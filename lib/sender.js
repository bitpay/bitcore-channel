'use strict';

var bitcore = require('bitcore-lib');
var Opcode = bitcore.opcode;

var Sender = function(opts) {
  this._opts = opts;
  this._expirationTime = this._opts.expirationTime;
  this._amount = this._opts.amount || this._opts.satoshis;
  this._senderMofN = this._opts.senderMofN || '1';
  this._receiverMofN = this._opts.receiverMofN || '1';
  this._senderPublicKeys = this._opts.senderPublicKeys;
  this._receiverPublicKeys = this._opts.receiverPublicKeys;
  this._network = this._opts.network || 'livenet';
  this._senderRefundAddress = this._opts.senderRefundAddress ||
    new bitcore.PublicKey(this._senderPublicKeys[0], { network: this._network }).toAddress().toString();
  this._fundingUtxos = this._opts.fundingUtxos;
  this._checkArgs();
};

Sender.prototype._checkArgs = function() {
  if (!this._amount ||
    !this._expirationTime ||
    !this._senderPublicKeys ||
    !this._receiverPuiblicKeys ||
    this._senderPublicKeys.length < 1 ||
    this.receiverPublicKeys.length < 1 ||
    !this._checkFundingUtxos()) {
    throw 'Amount and Expiration Time and Public Key expected for Sender.';
  }
};

Sender.prototype._checkFundingUtxos = function() {
  return true;
};

Sender.prototype.getFundingTxAddress = function() {
  this._buildRedeemScript();
  this._hashRedeemScript();
  this._getAddressFromScriptHash();
  return this._fundingAddress;
};

Sender.prototype._hashRedeemScript = function() {

};

Sender.prototype._buildRedeemScript = function() {
  this._redeemScript = new bitcore.Script();
  this._redeemScript.add(Opcode.OP_IF)
    .add(this._receiverPublicKeys[0])
    .add(Opcode.OP_CHECKSIG)
    .add(Opcode.OP_ELSE)
    .add(this._expirationTime)
    .add(Opcode.OP_CHECKLOCKTIMEVERIFY)
    .add(Opcode.OP_DROP)
    .add(Opcode.OP_ENDIF)
    .add(this._senderPublicKeys[0])
    .add(Opcode.CHECKSIG);
};

Sender.prototype.signFundingTx = function() {
};
