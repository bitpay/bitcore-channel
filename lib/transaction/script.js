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
  var pubKey1 = script.chunks[1].buf.toString('hex');
  var pubKey2 = script.chunks[8].buf.toString('hex');
  var lockTime = Script._convertExpirationBufferToTimestamp(script.chunks[4].buf);

  return { pubkeys: [pubKey1, pubKey2], lockTime: lockTime };
};

Script.buildCLTVRedeemScript = function(pubkeys, lockTime) {
  $.checkArgument(_.isArray(pubkeys) && pubkeys.length === 2,
    'Two public keys are required to build a CLTV redeem script.');

  $.checkArgument(
    JSUtil.isNaturalNumber(lockTime),
    'Lock time is expected to be a positive integer and be at least 6 hours in the future');

  var script = new Script();

  script
    .add(Opcode.OP_DUP)
    .add(new Buffer(pubkeys[0], 'hex'))
    .add(Opcode.OP_CHECKSIG)
    .add(Opcode.OP_NOTIF)
    .add(Script._convertExpirationTimeStampToBuffer(lockTime))
    .add(Opcode.OP_CHECKLOCKTIMEVERIFY)
    .add(Opcode.OP_DROP)
    .add(Opcode.OP_ENDIF)
    .add(new Buffer(pubkeys[1], 'hex'))
    .add(Opcode.OP_CHECKSIG);

  return script;
};

module.exports = Script;
