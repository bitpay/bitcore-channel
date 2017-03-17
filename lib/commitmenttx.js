'use strict';

var _ = require('lodash');
var bitcore = require('bitcore-lib');
var Transaction = bitcore.Transaction;
var Opcode = bitcore.Opcode;
var Script = bitcore.Script; var inherits = require('inherits');
var $ = bitcore.util.preconditions;
var JSUtil = bitcore.util.js;


/*
   Bitcoin Transaction types needed:

   1. Commitment Transavtion
   2. Channel Transaction

   Commitment Transaction:
   A on-chain bitcoin transaction that opens the payment channel. It is created and broadcasted to
   the bitcoin network by the sender using the sender's funds. It is a 2-2 multisig variant tx with
   a redeem script that can only spend funds if:

   1. both public keys have valid signatures in the scriptSig -or-
   2. the second public key has a valid signature in the script -and- the operand for OP_CHECKLOCKTIMEVERIFY
      is evaluated to be greater than or equal to the nLockTime field on the spending transaction. The value
      of OP_CHECKLOCKTIMEVERIFY's operand dictates whether you are locking by block height or block time. If
      the operand is less than 500 million, then you are locking by block height otherwise you are locking
      by block time.
   3. If one of the above conditions does not cause the interpreter to exit the script, then the sender's
      public key is used to check the signature from the script sig. If valid, the entire script evaluated
      to true and the funds are spendable.

   Channel Transaction:
   An off-chain tranaction that pays into the payment channel. This tx is sent by the sender to the receiver
   through pre-agreed upon means such as a websocket, etc. It will always spend the funds from the commitment
   transaction utxo. In other words, the output in the commitment transaction that spent funds to the CLTV
   redeem script becomes the input for ALL further off-chain channel transactions. Each channel transaction
   will spend the utxo value to two outputs. The first output will provide funds to the receiver and the other
   output will be the balance of the total funds minus a transaction fee to the bitcoin miners.

*/

/**
 * Represents a Payment Channel Commitment transaction, a set of inputs and outputs to change ownership of tokens
 *
 * @param {*} serialized
 * @constructor
 */

var CommitmentTransaction = function(serialized) {
  Transaction.apply(this, arguments);
  this._MINIMUM_EXPIRY_TIME = 6 * 3600 * 1000; //6 hours
};

inherits(CommitmentTransaction, Transaction);

CommitmentTransaction.prototype.from = function(utxo, pubKeys, lockTime) {

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

  if (pubkey) {
    this._fromMCLTVUtxo(utxo, pubkeys, lockTime);
  }

  return this;

};

CommitmentTransaction.prototype.from = function(utxo, pubKeys, lockTime) {
  utxo = new UnspentOutput(utxo);
  utxo.prevTxId = utxo.txId;
  utxo.output = new Output({ script: utxo.script, satoshis: utxo.satoshis });
  utxo.script = Script.empty;
  var redeemScriptHashInput = new RedeemScriptHashInput(utxo, pubKeys, lockTime);
  this.addInput(redeemScriptHashInput);
  return this;
};

Script._checkLockTime = function(lockTime) {
  //lockTime is a block height
  if (lockTime < 500000000) {
    return true;
  }
  //locktime is UTC only, so we must adjust for timezone of this server
  var time = new Date(lockTime * 1000);
  if (!_.isDate(time)) {
    return false;
  }
  var now = new Date();
  var utcnow = now.getTime() + (now.getTimezoneOffset() * 60000);
  if ((time.getTime() - utcnow) < MINIMUM_EXPIRY_TIME) {
    return false;
  }
  return true;
};

Script._convertExpirationTimeStamp = function(lockTime) {
  var time = new Date(lockTime * 1000);
  time = Math.round(time.getTime() / 1000);
  var expiryBuf = new Buffer('0000000000', 'hex');
  expiryBuf.writeUInt32LE(time);
  return expiryBuf;
};

Script.buildCLTVOut = function(pubkeys, lockTime) {
  $.checkArgument(_.isArray(pubkeys) && publicKeys.length === 2,
    'Two public keys are required to build a CLTV redeem script.');

  $.checkArgument(
    Script._checkLockTime(lockTime) &&
    JSUtil.isNaturalNumber(lockTime),
    'Lock time is expected to be a positive integer and be at least 6 hours in the future');

  var script = new Script();

  script.add(Opcode.OP_IF)
    .add(new Buffer(publicKeys[0], 'hex'))
    .add(Opcode.OP_CHECKSIG)
    .add(Opcode.OP_ELSE)
    .add(Script._convertExpirationTimeStamp(lockTime))
    .add(Opcode.OP_CHECKLOCKTIMEVERIFY)
    .add(Opcode.OP_DROP)
    .add(Opcode.OP_ENDIF)
    .add(new Buffer(publicKeys[1], 'hex'))
    .add(Opcode.OP_CHECKSIG);

  return script;
};

module.exports = CommitmentTransaction;
