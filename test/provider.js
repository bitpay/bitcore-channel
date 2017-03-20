'use strict';

var Provider = require('../lib/provider');
var should = require('chai').should();
var bitcore = require('bitcore-lib');
var Script = require('../lib/transaction/script')
var PrivateKey = bitcore.PrivateKey;
var path = require('path');

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
  var providerPrivKey = new PrivateKey('KzBkxNrZghHVqoj7nrANtubwyz1CLJA54zctjoW4DGQj5USpNXhP');
  var consumerPrivKey = new PrivateKey('L5mzCbb3hzcWXS45f8FiV38oHTR5bQXaHaTk84yVZUmEb5x7JAZf');
  var expectedAddressPrivKey = new bitcore.PrivateKey('L1i39ig9sHsTss5EBX3qmTLmAHAnqT65JQkQVSNEG6zwkKd919CY');

  var address = expectedAddressPrivKey.publicKey.toAddress('testnet').toString();
  var amount = 10000000;
  var testdir = path.resolve(__dirname, './testdata');
  var channelTx = require(testdir + '/channeltx.json').rawtx;
  var commitmentTx = require(testdir + '/commitmenttx.json').rawtx;
  var redeemScript = new bitcore.Transaction(channelTx).inputs[0].script.chunks[2].buf;

  var opts = {
    channelTx: channelTx,
    commitmentTxRedeemScript: redeemScript,
    inputTxs: [commitmentTx],
    expectedOutputAmount: amount,
    expectedOutputAddress: address,
    lowestAllowedFee: 1000
  };

  it('should verify a channel transaction', function() {
    Provider.verifyChannelTransaction(opts).should.be.true;
  });
});


