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
  var pubKey1 = script.chunks[4].buf.toString('hex');
  var pubKey2 = script.chunks[0].buf.toString('hex');
  var lockTime = Script._convertExpirationBufferToTimestamp(script.chunks[7].buf);

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
   * How this script works:  text in brackets are stack items, last being the top of stack
   * 0. Starting stack: [ OP_0, (optional provider sig), (consumer sig), (consumer pub key) ]
   * 1. OP_CHECKSIGVERIFY, if consumer sig valid, [ OP_0, (possible provider sig) ]
   * if consumer sig invalid, the script is invalid and exits here.
   * 2. OP_IFDUP, if false not top of stack, duplicate top of stack.
   *  if we have provider sig: [ OP_0, (provider sig), (provider sig) ]
   *  if we do not have provider sig: [ OP_0 ]
   * for block inclusion, you want 2 valid signatures -or- 1 valid consumer signature and
   * CHECKLOCKTIMEVERIFY to eval true. Any single bad signature eval will cause the entire
   * script to become invalid.
   * 3. OP_IF, if we have a provider sig at top of stack, this will always evaluate to true
   * [ OP_0, (provider sig) ]
   * 4. [ OP_0, (provider sig), (provider pub key) ]
   * 5. OP_CHECKSIG, if provider's sig is valid, put OP_TRUE on top of stack, [ OP_TRUE ]
   * 6. OP_ELSE, if there was no provider key, then we will get here with an empty stack [ ]
   * 7. [ (lockTime) ]
   * 8. OP_CHECKLOCKTIMEVERIFY, check locktime against nLockTime value of spending/this tx.
   * After evaluation, if false then script is invalid, if true then stack contains the locktime.
   * [ (locktime) ]
   * 9. OP_ENDIF, balances previous OP_IF in step 3.
   */
  script
    .add(new Buffer(pubkeys[1], 'hex')) // 0
    .add(Opcode.OP_CHECKSIGVERIFY) // 1
    .add(Opcode.OP_IFDUP) // 2
    .add(Opcode.OP_IF) // 3
    .add(new Buffer(pubkeys[0], 'hex')) // 4
    .add(Opcode.OP_CHECKSIG) // 5
    .add(Opcode.OP_ELSE) // 6
    .add(Script._convertExpirationTimeStampToBuffer(lockTime)) // 7
    .add(Opcode.OP_CHECKLOCKTIMEVERIFY) // 8
    .add(Opcode.OP_ENDIF) // 9
  return script;
};

module.exports = Script;