'use strict';

var _ = require('lodash');
var bitcore = require('bitcore-lib');
var Transaction = bitcore.Transaction;
var Opcode = bitcore.Opcode;
var inherits = require('inherits');
var $ = bitcore.util.preconditions;
var JSUtil = bitcore.util.js;


/*
   The Sender is the party wishing to open a payment channel and do off-chain txs. The Receiver is
   the party that will be receiving these off-chain txs in exchange for goods or services.

   The ultimate goal here is to MINIMIZE on-chain transactions overall. If two parties transact with each
   other more than once, then there is an opportunity to reduce the number of on-chain txs between those two
   parties.

   The simplest example is a trip to the pub. If a patron decides to consume more than one drink, but does not
   know how many drinks he will have, the pub operator may allow him to open a tab, yet retain a credit card in order
   ensure that the patron can't skip witout paying.

   The safest option, overall, would be for the patron to provide payment upon delivery of each drink. Doing so, would
   be more costly for the patron and the pub owner. The pub owner would pass the credit card per transaction fees along to
   the consumers to maintain his profit margins at the expense of reducing consumption likelihood of pub patrons because of
   the higher cost of drinks. A lose-lose proposition.

   Payment channels attempt to minimize transaction fees for both receiver and sender at the expense of locking up the
   sender's funds for a predetermined time in an on-chain tx. By doing this, the sender can prove to the receiver that
   any payments he makes that spend that on-chain / time-locked tx can't be double spent elsewhere.

   Bitcore-channel will facilitate the construction of the different types of bitcoin transactions needed to create and transact
   through the payment channel.

   Bitcoin Transaction types needed:

   1. Commitment Transavtion
   2. Channel Transaction

   Commitment Transaction: A on-chain bitcoin transaction that opens the payment channel. It is created and broadcasted to the bitcoin
   network by the sender using the sender's funds. It is a 2-2 multisig variant tx with a redeem script that can only spend funds if:
   1. both public keys have valid signatures in the scriptSig -or-
   2. the second public key has a valid signature in the script -and- the operand for OP_CHECKLOCKTIMEVERIFY is evaluated to be greater than
   or equal to the nLockTime field on the spending transaction. The value of OP_CHECKLOCKTIMEVERIFY's operand dictates whether you are locking by block
   height or block time. If the operand is less than 500 million, then you are locking by block height otherwise you are locking by block time.
   3. If one of the above conditions does not cause the interpreter to exit the script, then the sender's public key is used to check the signature from the script sig. If valid, the entire script evaluated to true and the funds are spendable.

   Channel Transaction: A off-chain tranaction that pays into the payment channel. This tx is sent by the sender to the receiver through pre-agreed upon means such as a websocket, etc. It will always spend the funds from the commitment transaction utxo. In other words, the output in the commitment transaction that spent funds to the CLTV redeem script becomes the input for ALL further off-chain channel transactions. Each channel transaction will spend the utxo value to two outputs. The first output will provide funds to the receiver and the other output will be the balance of the total funds minus a transaction fee to the bitcoin miners.


*/

/**
 * Represents a transaction, a set of inputs and outputs to change ownership of tokens
 *
 * @param {*} serialized
 * @constructor
 */
var CommitmentTransaction = function(serialized) {
  Transaction.apply(this, arguments);
  this._MINIMUM_EXPIRY_TIME = 6 * 3600 * 1000; //6 hours
};

inherits(CommitmentTransaction, Transaction);

CommitmentTransaction.prototype.createRedeemScript = function(publicKeys, lockTime) {
  $.checkArgument(_.isArray(publicKeys) && publicKeys.length === 2,
    JSUtil.isHexa(publicKey[0]), JSUtil.isHexa(publicKey[1]),
    'Public keys needs to be a list of hex strings'
  );
  $.checkArgument(
    this._checkLockTime(lockTime),
    JSUtil.isNaturalNumber(lockTime),
    'Lock time is expected to be a positive integer and be 6 hours in the future'
  );
  script: this._getCLTVRedeemScript(publicKeys, lockTime),
  return this;
};

CommitmentTransaction.prototype._checkLockTime = function(lockTime) {
  //TODO: normalize to UTC
  expiryTime = new Date(lockTime);
  var now = new Date();
  if (!_.isDate(expiryTime) ||
    (expiryTime.getTime() - now.getTime()) < this._MINIMUM_EXPIRY_TIME) {
    return false;
  }
  return true;
};

CommitmentTransaction.prototype._convertExpirationTimeStamp = function() {
  var time = this._expiryDate.getTime() + (this._expiryDate.getTimezoneOffset() * 60000);
  time = Math.round(time / 1000);
  var expiryBuf = new Buffer('0000000000', 'hex');
  expiryBuf.writeUInt32LE(time);
  return expiryBuf;
};

CommitmentTransaction.prototype._hashRedeemScript = function() {
  this.rebitcore.crypto.Hash.sha256ripemd160(this._redeemScript);
};

Sender.prototype._getAddressFromHashScript = function() {
  return n
};

CommitmentTransaction.prototype._getCLTVRedeemScript = function(publicKeys, lockTime) {
  this._redeemScript = new bitcore.Script();

  this._redeemScript.add(Opcode.OP_IF)
    .add(new Buffer(publicKeys[0], 'hex'))
    .add(Opcode.OP_CHECKSIG)
    .add(Opcode.OP_ELSE)
    .add(this._convertExpirationTimeStamp())
    .add(Opcode.OP_CHECKLOCKTIMEVERIFY)
    .add(Opcode.OP_DROP)
    .add(Opcode.OP_ENDIF)
    .add(new Buffer(publicKeys[1], 'hex'))
    .add(Opcode.OP_CHECKSIG);

  return this._redeemScript;
};




/**
 * Represents a transaction, a set of inputs and outputs to change ownership of tokens
 *
 * @param {*} serialized
 * @constructor
 */
ChannelTransaction = function(serialized) {
  Transaction.apply(this, arguments);
};

inherits(ChannelTransaction, Transaction);

 /*
 * @param {(Array.<Transaction~fromObject>|Transaction~fromObject)} utxo
 * @param {Array=} pubkeys
 * @param {number=} threshold
 */
ChannelTransaction.prototype.from = function(utxo, pubkeys) {
  $.checkArgument(pubkeys && pubkeys.length !== 2,
    '2 signatures are required to create a commitment transaction input.');
  if (_.isArray(utxo)) {
    var self = this;
    _.each(utxo, function(utxo) {
      self.from(utxo, pubkeys);
    });
    return this;
  }
  var exists = _.any(this.inputs, function(input) {
    return input.prevTxId.toString('hex') === utxo.txId && input.outputIndex === utxo.outputIndex;
  });
  if (exists) {
    return this;
  }
  utxo = new UnspentOutput(utxo);
  var clazz = RedeemScriptHashInput;
  this.addInput(new clazz({
    output: new Output({
      script: utxo.script,
      satoshis: utxo.satoshis
    }),
    prevTxId: utxo.txId,
    outputIndex: utxo.outputIndex,
    script: Script.empty()
  }, pubkeys));
  return this;
};


module.exports = Sender;
