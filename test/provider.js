'use strict';

var Provider = require('../lib/provider');
var Consumer = require('../lib/consumer');
var should = require('chai').should();
var bitcore = require('bitcore-lib');
var Script = require('../lib/transaction/script')
var Interpreter = bitcore.Script.Interpreter;
var PrivateKey = bitcore.PrivateKey;
var path = require('path');
var Transaction = require('../lib/transaction/transaction');

/*
1. consumer request payment channel by sending provider the following:
  {
    amount: 10000,
    lockTime: time (this is locktime from the time that this request is sent to the server)
    consumerPubKey:  so that the provider can compute the address the commit address is spent to.
}
2. provider responds, yes or no, if yes, then responds with a pub key.
  if no, responds why (too low fee, too high amount, too long or short lock time
3. consumer builds commit tx because they now have the provider's pub key and broadcasts it to the bitcoin network
4. the provider then begins looking for the commitment tx on the network since it can compute what address the funds when to
*/

describe('Provider', function() {
  var providerPrivKey = new PrivateKey('cQ4BLV3itks2w6SxPb7HyfNr5SS4XB6ajqWToZV7jY8D5FeEWEn2', 'testnet');
  var consumerPrivKey = new PrivateKey('cNykpBFHwU4ZW54m7Y6rqo8NFaG47AnTUNqhQ7mvJuAHcR4xpnQc', 'testnet');
  var pubKeys = [providerPrivKey.publicKey.toString(), consumerPrivKey.publicKey.toString()];
  var lockTime = Math.round(new Date('2020-02-29Z').getTime()/1000);
  var redeemScript = Script.buildCLTVRedeemScript(pubKeys, lockTime);
  var prevTx = new Transaction(require('./testdata/previousTx.json').rawtx);
  var flags = Interpreter.SCRIPT_VERIFY_P2SH
  | Interpreter.SCRIPT_VERIFY_STRICTENC
  | Interpreter.SCRIPT_VERIFY_DERSIG
  | Interpreter.SCRIPT_VERIFY_LOW_S
  | Interpreter.SCRIPT_VERIFY_MINIMALDATA
  | Interpreter.SCRIPT_VERIFY_SIGPUSHONLY
  | Interpreter.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY;

  var commitOpts = {
    prevTx: prevTx,
    prevTxOutputIndex: 0,
    network: 'testnet',
    satoshis: 300000000,
    privateKey:  new PrivateKey('cQgpdm9P92YQSkvWZLATUVj4ADpgRkru8HyXDY92hPDVbFehx1bC', 'testnet'),
    changeAddress: consumerPrivKey.toAddress().toString(),
    redeemScript: redeemScript,
    fee: 100000
  };

  var commitmentTx = Consumer.createCommitmentTransaction(commitOpts);

  var chanOpts = {
    prevTx: prevTx,
    prevTxOutputIndex: 0,
    network: 'testnet',
    satoshis: 150000000,
    consumerPrivateKey: consumerPrivKey,
    commitmentTransaction: commitmentTx,
    toAddress: providerPrivKey.toAddress('testnet').toString(),
    changeAddress: consumerPrivKey.toAddress('testnet').toString(),
    redeemScript: redeemScript,
    fee: 100000
  };

  var channelTx = Consumer.createChannelTransaction(chanOpts);

  it('should verify a channel transaction', function() {
    var chanOpts = {
      channelTx: channelTx,
      commitmentTxRedeemScript: redeemScript,
      inputTxs: [commitmentTx],
      expectedOutputAmount: 150000000,
      expectedOutputAddress: providerPrivKey.publicKey.toAddress().toString(),
      lowestAllowedFee: 100000
    };
    Provider.verifyChannelTransaction(chanOpts).should.be.true;
  });

  it('should not verify a channel transaction that has a bad signature', function() {
    var badTx = new Transaction();
    var ctx = new Transaction(commitmentTx);
    var p1 = providerPrivKey.publicKey.toString();
    var p2 = consumerPrivKey.publicKey.toString();
    var redeemScript = Script.buildCLTVRedeemScript([p1, p2], 158293440);

    var utxo = {
      txId: ctx.hash,
      address: ctx.outputs[0].script.toAddress().toString(),
      satoshis: ctx.outputs[0].satoshis,
      script: ctx.outputs[0].script.toHex(),
      outputIndex: 0
    };

    badTx.from(utxo, redeemScript);
    badTx.to('n4THG9YHpVXizYgPFhVTZeJo2UttqXNcWD', 150000000);
    badTx.sign(providerPrivKey); //this is the wrong private key to be signing a channel tx
    var chanOpts = {
      channelTx: badTx,
      commitmentTxRedeemScript: redeemScript,
      inputTxs: [commitmentTx],
      expectedOutputAmount: 150000000,
      expectedOutputAddress: providerPrivKey.publicKey.toAddress().toString(),
      lowestAllowedFee: 100000
    };

    Provider.verifyChannelTransaction(chanOpts).should.be.false;
  });

  it('should be able to sign a channel tx', function() {
    var opts = {
      channelTx: channelTx.serialize(),
      inputTxs: [commitmentTx.serialize()],
      privateKey: providerPrivKey.toWIF()
    };
    channelTx = Provider.signChannelTransaction(opts);
    channelTx.isFullySigned().should.be_true;
    channelTx.inputs[0].signatures.length.should.equal(2);
  });
});


