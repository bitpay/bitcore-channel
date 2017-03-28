'use strict';

var async = require('async');
var bitcore = require('bitcore-lib');
var Unit = bitcore.Unit;
var Transaction = require('../lib/transaction/transaction');
var PrivateKey = bitcore.PrivateKey;
var BitcoinRPC = require('bitcoind-rpc');
var Consumer = require('../lib/consumer');
var Provider = require('../lib/provider');
var Script = require('../lib/transaction/script');

var config = {
  protocol: 'http',
  user: 'bitcoin',
  pass: 'local321',
  host: '127.0.0.1',
  port: '58332',
  network: 'testnet'
};

var fee = 100000;

var rpc = new BitcoinRPC(config);

var startingPrivKey = new PrivateKey('testnet');

var providerPrivKey = new PrivateKey('cNZnXzQfAuDK4nBth5ViaSqgyYJUzJ5Ph2Dpmea933quEmHygN8u', 'testnet');
var consumerPrivKey = new PrivateKey('cQBAt1aBk3qQmpJMGTbu9qUY8uhwALuSVEhWnr1ytXLTrj4LJp1u', 'testnet');
var providerPubKey = providerPrivKey.publicKey;
var consumerPubKey = consumerPrivKey.publicKey;
var lockTime = Math.round(Date.now()/1000) + 30; // 30 seconds from now
var pubKeys = [providerPubKey.toString(), consumerPubKey.toString()];
var redeemScript = Script.buildCLTVRedeemScript(pubKeys, lockTime);
var walletPassphrase = 'test';

async.waterfall([
  unlockWallet,
  getPrivateKeyWithABalance,
  generateSpendingTx,
  sendSpendingTx,
  generateSixBlocks,
  generateCommitmentTx,
  sendCommitmentTx,
  generateSixBlocks,
  generateChannelTx,
  verifyChannelTx,
  spendChannelTx
], function(err, results) {
  if (err) {
    return console.trace(err);
  }
  console.log(results);
});

function generateSixBlocks(tx, next) {
  rpc.generate(6, function(err, res) {
    if(err) {
      return next(err);
    }
    next(null, tx);
  });
}

function unlockWallet(next) {
  rpc.walletPassPhrase(walletPassphrase, 3000, function(err, res) {
    if(err) {
      return next(err);
    }
    next();
  });
}

function getPrivateKeyWithABalance(next) {
  rpc.listUnspent(function(err, res) {
    if(err) {
      return next(err);
    }

    var utxo;
    for(var i = 0; i < res.result.length; i++) {
      if (res.result[i].amount > 1) {
        utxo = res.result[i];
        break;
      }
    }
    if (!utxo) {
      return next(new Error('no utxos available'));
    }
    rpc.dumpPrivKey(utxo.address, function(err, res) {
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
  tx.to(startingPrivKey.toAddress(), Unit.fromBTC(utxo.amount).satoshis - fee);
  tx.fee(fee);
  tx.sign(privKey);
  next(null, tx);
}

function sendSpendingTx(tx, next) {
  console.log('sending starting tx: ', tx.hash);
  rpc.sendRawTransaction(tx.serialize(), function(err, res) {
    if(err) {
      return next(err);
    }
    next(null, tx);
  });
}

function generateCommitmentTx(spendingTx, next) {
  var redeemScript = Script.buildCLTVRedeemScript(pubKeys, lockTime);
  var commitmentTx = Consumer.createCommitmentTransaction({
    prevTx: spendingTx,
    privateKey: startingPrivKey,
    satoshis: spendingTx.outputs[0].satoshis - fee,
    redeemScript: redeemScript,
    prevTxOutputIndex: 0,
    changeAddress: consumerPrivKey.toAddress().toString(),
    network: 'testnet',
    fee: fee
  });
  next(null, commitmentTx);
}

function sendCommitmentTx(commitmentTx, next) {
  console.log('sending commmitment tx: ', commitmentTx.hash);
  rpc.sendRawTransaction(commitmentTx.serialize(), function(err, res) {
    if(err) {
      return next(err);
    }
    next(null, commitmentTx);
  });
}

function generateChannelTx(commitmentTx, next) {
  var redeemScript = Script.buildCLTVRedeemScript(pubKeys, lockTime);
  var channelTx = Consumer.createChannelTransaction({
    consumerPrivateKey: consumerPrivKey,
    network: 'testnet',
    satoshis: 1000,
    toAddress: providerPrivKey.toAddress().toString(),
    redeemScript: redeemScript,
    fee: 100000,
    commitmentTransaction: commitmentTx,
    changeAddress: consumerPrivKey.toAddress().toString()
  });
  next(null, channelTx, commitmentTx);
}

function verifyChannelTx(channelTx, commitmentTx, next) {
  var res = Provider.verifyChannelTransaction({
    channelTx: channelTx,
    commitmentTxRedeemScript: redeemScript,
    inputTxs: [commitmentTx],
    expectedOutputAmount: 1000,
    expectedOutputAddress: providerPrivKey.toAddress().toString(),
    lowestAllowedFee: 1000
  });
  if (!res) {
    return next(new Error('channel tx did not verify'));
  }
  next(null, channelTx);
}

function spendChannelTx(channelTx, next) {
  channelTx.sign(providerPrivKey);
  rpc.sendRawTransaction(channelTx.serialize(), function(err, res) {
    if(err) {
      return next(new Error(err));
    }
    next(null, 'done: spent channel tx to: ' + res.result);
  });
}

