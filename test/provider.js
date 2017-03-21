'use strict';

var Provider = require('../lib/provider');
var should = require('chai').should();
var bitcore = require('bitcore-lib');
var Script = require('../lib/transaction/script')
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
  var providerPrivKey = new PrivateKey('cQ4BLV3itks2w6SxPb7HyfNr5SS4XB6ajqWToZV7jY8D5FeEWEn2');
  var consumerPrivKey = new PrivateKey('cNykpBFHwU4ZW54m7Y6rqo8NFaG47AnTUNqhQ7mvJuAHcR4xpnQc');

  var expectedOutputAddress = 'n4THG9YHpVXizYgPFhVTZeJo2UttqXNcWD';
  var testdir = path.resolve(__dirname, './testdata');
  var channelTx = require(testdir + '/channeltx.json').rawtx;
  var commitmentTx = require(testdir + '/commitmenttx.json').rawtx;
  var redeemScript = new bitcore.Transaction(channelTx).inputs[0].script.chunks[2].buf;

  var opts = {
    channelTx: channelTx,
    commitmentTxRedeemScript: redeemScript,
    inputTxs: [commitmentTx],
    expectedOutputAmount: 150000000,
    expectedOutputAddress: expectedOutputAddress,
    lowestAllowedFee: 100000
  };

  it('should verify a channel transaction', function() {
    Provider.verifyChannelTransaction(opts).should.be.true;
  });

  it('should not verify a channel transaction that has a bad signature', function() {
    var badTx = new Transaction();
    var ctx = new Transaction(commitmentTx);
    var p1 = providerPrivKey.publicKey.toString();
    var p2 = consumerPrivKey.publicKey.toString();

    var utxo = {
      txId: ctx.hash,
      address: ctx.outputs[0].script.toAddress().toString(),
      satoshis: ctx.outputs[0].satoshis,
      script: ctx.outputs[0].script.toHex(),
      outputIndex: 0
    };

    badTx.from(utxo, [p1, p2], 1582934400);
    badTx.to('n4THG9YHpVXizYgPFhVTZeJo2UttqXNcWD', 150000000);
    badTx.sign(providerPrivKey); //this is the wrong private key to be signing a channel tx
    opts.channelTx = badTx;
    Provider.verifyChannelTransaction(opts).should.be.false;
  });
});


