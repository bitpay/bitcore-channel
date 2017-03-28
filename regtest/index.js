'use strict';

var async = require('async');
var bitcore = require('bitcore-lib');
var Transaction = require('../lib/transaction/transaction');
var PrivateKey = bitcore.PrivateKey;
var BitcoinRPC = require('bitcoind-rpc');
var Consumer = require('../lib/consumer');

var config = {
  protocol: 'http',
  user: 'bitcoin',
  pass: 'local321',
  host: '127.0.0.1',
  port: '38332',
  network: 'testnet'
};

var fee = 100000;

var rpc = new BitcoinRPC(config);

var startingPrivKey = new PrivateKey('testnet');

var providerPrivKey = new PrivateKey('cNZnXzQfAuDK4nBth5ViaSqgyYJUzJ5Ph2Dpmea933quEmHygN8u', 'testnet');
var consumerPrivKey = new PrivateKey('cQBAt1aBk3qQmpJMGTbu9qUY8uhwALuSVEhWnr1ytXLTrj4LJp1u', 'testnet');
var lockTime = Math.round(Date.now()/1000) + 3; // 3 seconds from now

var providerPubKey = providerPrivKey.publicKey;
var consumerPubKey = consumerPrivKey.publicKey;
var pubKeys = [providerPubKey.toString(), consumerPubKey.toString()];

async.waterfall([
  getPrivateKeyWithABalance,
  generateSpendingTx,
  sendSpendingTx,
  generateCommitmentTx,
  sendCommitmentTx,
  generateChannelTx,
  sendChannelTx
], function(err, results) {
});


function getPrivateKeyWithABalance(next) {
  rpc.listUnspent(function(err, res) {
    if(err) {
      return next(err);
    }
    var utxo = res.result[0];
    rpc.dumpPrivKey(function(err, res) {
      if(err) {
        return next(err);
      }
      var privKey = res.result;
      next(null, privKey, utxo);
    });
  });
}

function generateSpendingTx(privKey, utxo,  next) {
  var tx = new Transaction();
  tx.from(utxo);
  tx.to(startingPrivKey.toAddress(), utxo.amount - fee);
  tx.fee(fee);
  tx.sign(privKey);
  next(tx);
}

function sendSpendingTx(tx, next) {
  rpc.sendRawTransaction(tx.serialize(), function(err, res) {
    if(err) {
      return next(err);
    }
    next(tx);
  });
}

function generateCommitmentTx(spendingTx, next) {
  var redeemScript = Script.buildCLTVRedeemScript(pubKeys, lockTime);
}

function sendCommitmentTx(commitmentTx, next) {
}

function generateChannelTx(commitmentTx, next) {
}

function sendChannelTx(channelTx, next) {
}











//Consumer.createCommitmentTransaction({
//  privateKey: new PrivateKey('cPDA4jccaeviiEJiHbJcp5W5WFyvNrkuxAaTP9Tguh15ySS8v7nL', 'testnet')
//  satoshis: 100000000,
//  changeAddress: 'mtFiUJW1y4makhWPFpxiiY6fH3M2nFzY7m',
//  redeemScript: Script.buildCLTVRedeemScript([providerPubKey.toString(), consumerPrivKey.toString()], lockTime)
//  fee: 100000,

