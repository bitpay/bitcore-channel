'use strict';

var _ = require('lodash');
var bitcore = require('bitcore-lib');
var Opcode = bitcore.Opcode;

var Sender = function(opts) {
  this._opts = opts;
  this._senderPrivateKey = new bitcore.PrivateKey();
  this._expirationTime = this._opts.expirationTime;
  this._expirationHeight = this._opts.expirationHeight;
  this._amount = this._opts.amount || this._opts.satoshis;
  this._senderMofN = this._opts.senderMofN || '1';
  this._receiverMofN = this._opts.receiverMofN || '1';
  this._senderPublicKeys = this._opts.senderPublicKeys || [this._senderPrivateKey.publicKey];

  this._receiverPublicKeys = this._opts.receiverPublicKeys;

  this._network = this._opts.network || 'livenet';
  this._senderRefundAddress = this._opts.senderRefundAddress ||
    new bitcore.PublicKey(this._senderPublicKeys[0], { network: this._network }).toAddress().toString();
  this._fundingUtxos = this._opts.fundingUtxos;
  this._checkExpirationTime();
  //this._checkArgs();
  this._MINIMUM_EXPIRY_TIME = 6 * 3600 * 1000; //6 hours
};

Sender.prototype._checkArgs = function() {
  if (!this._amount ||
    !this._expirationTime ||
    !this._receiverPuiblicKeys ||
    this._senderPublicKeys.length < 1 ||
    this.receiverPublicKeys.length < 1 ||
    !this._checkFundingUtxos()) {
    throw 'Amount and Expiration Time and Public Key expected for Sender.';
  }
};

Sender.prototype._checkExpirationTime = function() {
  //the Bitcoin network allows spending of nLockTime tx's up to 2 hours ahead of time due to the drift in clocks

  //TODO: deal with the fact that the user may need to normalize dates to UTC
  //TODO: deal with not only time stamps, but block heights too
  this._expiryDate = new Date(this._expirationTime);
  var now = new Date();
  if (!_.isDate(this._expiryDate) ||
    (this._expiryDate.getTime() - now.getTime()) < this._MINIMUM_EXPIRY_TIME) {
    return false;
  }
  return true;
};

Sender.prototype._convertExpirationTimeStamp = function() {
  //purpose of this is that CHECKLOCKTIMEVERIFY can take a 5 byte operand (because operands are unsigned ints)
  //This means that we will need more bytes to represent timestamps in the near future.
  //We will convert the expiry time, first, to UTC integer, then to a 4 byte unsigned int padded
  var time = this._expiryDate.getTime() + (this._expiryDate.getTimezoneOffset() * 60000);
  time = Math.round(time / 1000);
  var expiryBuf = new Buffer('0000000000', 'hex');
  expiryBuf.writeUInt32BE(time);
  return expiryBuf;
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
    .add(this._receiverPublicKeys[0].toBuffer())
    .add(Opcode.OP_CHECKSIG)
    .add(Opcode.OP_ELSE)
    .add(this._convertExpirationTimeStamp())
    .add(Opcode.OP_CHECKLOCKTIMEVERIFY)
    .add(Opcode.OP_DROP)
    .add(Opcode.OP_ENDIF)
    .add(this._senderPublicKeys[0].toBuffer())
    .add(Opcode.OP_CHECKSIG);
};


module.exports = Sender;
