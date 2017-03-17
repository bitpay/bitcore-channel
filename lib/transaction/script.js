'use strict';

var _ = require('lodash');
var bitcore = require('bitcore-lib');
var Opcode = bitcore.Opcode;
var Script = bitcore.Script;
var $ = bitcore.util.preconditions;
var JSUtil = bitcore.util.js;

var MINIMUM_EXPIRY_TIME = 6 * 3600 * 1000;

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

Script.buildFromCLTVOut = function(pubkeys, lockTime) {
  $.checkArgument(_.isArray(pubkeys) && pubkeys.length === 2,
    'Two public keys are required to build a CLTV redeem script.');

  $.checkArgument(
    Script._checkLockTime(lockTime) &&
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
