'use strict';

var _ = require('lodash');
var bitcore = require('bitcore-lib');
var Opcode = bitcore.Opcode;
var Script = bitcore.Script;
var $ = bitcore.util.preconditions;
var JSUtil = bitcore.util.js;
var BN = require('bn.js');

Script._convertExpirationBufferToTimestamp = function(buffer) {
  return (new BN(buffer.reverse())).toNumber();
};

Script._convertExpirationTimeStampToBuffer = function(lockTime) {
  var time = new Date(lockTime * 1000);
  time = Math.round(time.getTime() / 1000);
  var expiryBuf = new BN(time).toBuffer().reverse();
  if (expiryBuf.length > 5) {
    throw 'Lock time supplied is too large to fit into a 5 byte big num.';
  }
  return expiryBuf;
};

Script.getParamsFromCLTVRedeemScript = function(scriptBuf) {
  $.checkArgument(Buffer.isBuffer(scriptBuf),
    'First parameter should be a CLTV script buffer.');

  var script = new Script(scriptBuf);
  var pubKey1 = script.chunks[5].buf.toString('hex');
  var pubKey2 = script.chunks[0].buf.toString('hex');
  var lockTime = Script._convertExpirationBufferToTimestamp(script.chunks[2].buf);

  return { pubkeys: [pubKey1, pubKey2], lockTime: lockTime };
};

Script.buildCLTVRedeemScript = function(pubkeys, lockTime) {
  $.checkArgument(_.isArray(pubkeys) && pubkeys.length === 2,
    'Two public keys are required to build a CLTV redeem script.');

  $.checkArgument(
    JSUtil.isNaturalNumber(lockTime),
    'Lock time is expected to be a positive integer and be at least 6 hours in the future');

  var script = new Script();

  /*
   * How this script works:
   * 1. consumer pub key is top of stack,  then sig, optionally another sig, then OP_0
   * 2. consumer sig should be right under consumer pub key, check the sig, if bad, then exit script entirely as false.
   * 3. push the lock time at top of stack
   * 4. eval checklocktimeverify, there are several conditions that could return false, but only one condition to
   * return true. If return false, exit the script immediately as false.
   */
  script
    .add(new Buffer(pubkeys[1], 'hex')) // 1
    .add(Opcode.OP_CHECKSIGVERIFY) // 2
    .add(Script._convertExpirationTimeStampToBuffer(lockTime)) // 3
    .add(Opcode.OP_CHECKLOCKTIMEVERIFY) // 4
    .add(Opcode.OP_NOTIF) // 5
    .add(new Buffer(pubkeys[0], 'hex')) // 6
    .add(Opcode.OP_CHECKSIGVERIFY) // 7
    .add(Opcode.OP_ELSE) // 8
    .add(Opcode.OP_TRUE) // 9
    .add(Opcode.OP_ENDIF); // 10

  return script;
};

module.exports = Script;
