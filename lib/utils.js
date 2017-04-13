'use strict';

var bitcore = require('bitcore-lib');
var Script = require('./transaction/script');
var PublicKey = bitcore.PublicKey;
var Hash = bitcore.crypto.Hash;
var Opcode = bitcore.Opcode;
var utils = {};

//Given a redeem script and a tx, return the output index
utils.findCommitmentTransactionOutputIndex = function(redeemScript, tx) {

  var script = new Script(redeemScript);
  var hash160 = Hash.sha256ripemd160(script.toBuffer());

  var scriptPubKey = new Script();
  scriptPubKey.add(Opcode.OP_HASH160)
  scriptPubKey.add(hash160)
  scriptPubKey.add(Opcode.OP_EQUAL);

  for(var i = 0; i < tx.outputs.length; i++) {

    if (tx.outputs[i].script.toHex() === scriptPubKey.toHex()) {
      return i;
    }

  }

  return -1;

};

utils.getRefundTxLockTime = function(script) {
  //this determines the earliest time/height, given a redeem script that a spending tx can be spent
  script = new Script(script);
  var params = Script.getParamsFromCLTVRedeemScript(script.toBuffer());
  var redeemScriptLockTime = params.lockTime;
  //CLTV logic says that if redeemScriptLockTime <= the spending Tx's nLockTime value (with other checks also passing),
  //evaluate to true, for safety, we will go one block or second more
  return redeemScriptLockTime;
};

var createRedeemScript = function(publicKeys, lockTime) {
  return Script.buildCLTVRedeemScript(publicKeys, lockTime);
};

/*
  timeLength: in seconds, the max length of time the channel should remain open
*/
utils.getChannelParameters = function(satoshis, timeLength, publicKey, network) {
  var timeNow = Math.round(Date.now() / 1000); // this is seconds since EPOCH at UTC timezone
  var lockTime = timeNow + timeLength;
  return {
    satoshis: satoshis,
    locktime: lockTime,
    pubkey: new PublicKey(publicKey).toString(),
    network: (network || 'livenet')
  };
};

module.exports = utils;
