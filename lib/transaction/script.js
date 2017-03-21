'use strict';

var _ = require('lodash');
var bitcore = require('bitcore-lib');
var Opcode = bitcore.Opcode;
var Script = bitcore.Script;
var $ = bitcore.util.preconditions;
var JSUtil = bitcore.util.js;


Script._convertExpirationTimeStamp = function(lockTime) {
  var time = new Date(lockTime * 1000);
  time = Math.round(time.getTime() / 1000);
  var expiryBuf = new Buffer('0000000000', 'hex');
  expiryBuf.writeUInt32LE(time);
  return expiryBuf;
};

Script.getParamsFromCLTVRedeemScript = function(scriptBuf) {
  $.checkArgument(Buffer.isBuffer(scriptBuf),
    'First parameter should be a CLTV script buffer.');

  var script = new Script(scriptBuf);
  var pubKey1 = script.chunks[1].buf.toString('hex');
  var pubKey2 = script.chunks[8].buf.toString('hex');
  var lockTime = script.chunks[4].buf.toString('hex');

  return { pubkeys: [pubKey1, pubKey2], lockTime: lockTime };
};

Script.buildCLTVRedeemScript = function(pubkeys, lockTime) {
  $.checkArgument(_.isArray(pubkeys) && pubkeys.length === 2,
    'Two public keys are required to build a CLTV redeem script.');

  $.checkArgument(
    JSUtil.isNaturalNumber(lockTime),
    'Lock time is expected to be a positive integer and be at least 6 hours in the future');

  var script = new Script();

  script.add(Opcode.OP_IF)
    .add(new Buffer(pubkeys[0], 'hex'))
    .add(Opcode.OP_CHECKSIG)
    .add(Opcode.OP_ELSE)
    .add(Script._convertExpirationTimeStamp(lockTime))
    .add(Opcode.OP_CHECKLOCKTIMEVERIFY)
    .add(Opcode.OP_DROP)
    .add(Opcode.OP_ENDIF)
    .add(new Buffer(pubkeys[1], 'hex'))
    .add(Opcode.OP_CHECKSIG);

  return script;
};

module.exports = Script;
