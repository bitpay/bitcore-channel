'use strict';

var _ = require('lodash');
var bitcore = require('bitcore-lib');
var Opcode = bitcore.Opcode;
var Script = bitcore.Script;
var $ = bitcore.util.preconditions;
var JSUtil = bitcore.util.js;
var BN = require('bn.js');
var BufferUtil = bitcore.util.buffer;

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
  var lockTime = Script._convertExpirationBufferToTimestamp(script.chunks[8].buf);

  return { pubkeys: [pubKey1, pubKey2], lockTime: lockTime };
};

Script.buildCLTVMultisigIn = function(pubkeys, lockTime, signatures, opts) {
  $.checkArgument(_.isArray(pubkeys));
  $.checkArgument(_.isArray(signatures));
  opts = opts || {};
  var s = new Script();
  _.each(signatures, function(signature) {
    $.checkArgument(BufferUtil.isBuffer(signature), 'Signatures must be an array of Buffers');
    s.add(signature);
  });
  s.add((opts.cachedMultisig || Script.buildCLTVRedeemScript(pubkeys, lockTime)).toBuffer());
  return s;
};

Script.buildCLTVRedeemScript = function(pubkeys, lockTime) {
  $.checkArgument(_.isArray(pubkeys) && pubkeys.length === 2,
    'Two public keys are required to build a CLTV redeem script.');

  $.checkArgument(
    JSUtil.isNaturalNumber(lockTime),
    'Lock time is expected to be a positive integer.');

  var script = new Script();

  script
    .add(new Buffer(pubkeys[1], 'hex')) // 0 consumer sig, if this isn't valid, all hope is lost
    .add(Opcode.OP_CHECKSIG) // 1 places true or false on stack
    .add(Opcode.OP_IF) // 2 if consumer sig not valid, do nothing else
    .add(Opcode.OP_DEPTH) // 3 how many more stack items? do we have more sigs?
    .add(Opcode.OP_IF) // 4 if at least one stack item, check provider sig
    .add(new Buffer(pubkeys[0], 'hex')) // 5 provider pub key
    .add(Opcode.OP_CHECKSIG) // 6 provier and consumer sigs are valid, spendable
    .add(Opcode.OP_ELSE) // 7 there are no stack items, therefore check lock time
    .add(Script._convertExpirationTimeStampToBuffer(lockTime)) // 8 lock time/height
    .add(Opcode.OP_CHECKLOCKTIMEVERIFY) // 9 if true, leave the lock time/height on the stack as the only item
    .add(Opcode.OP_ENDIF) // 10 inner if statement
    .add(Opcode.OP_ENDIF) // 11 outer if statement

  return script;
};

module.exports = Script;
