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

//first round of tests will ensure the provider can spend its channel tx before the lock time
var providerLockTime = Math.round(Date.now()/1000) + 30; // 30 seconds from now
//second round of tests will create a new commitment tx, the provider drops off the face of the earth and the consumer need to generate a refund tx and spend funds back to himself
var consumerLockTime = Math.round(Date.now()/1000); // 1 second ago

var pubKeys = [providerPubKey.toString(), consumerPubKey.toString()];

var providerRedeemScript = Script.buildCLTVRedeemScript(pubKeys, providerLockTime);
var consumerRedeemScript = Script.buildCLTVRedeemScript(pubKeys, consumerLockTime);
var redeemScript = providerRedeemScript;

var walletPassphrase = 'test';
var startingSatoshis = 0;

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
  spendTx,
  switchRedeemScripts,
  getPrivateKeyWithABalance,
  generateSpendingTx,
  sendSpendingTx,
  generateSixBlocks,
  generateCommitmentTx,
  sendCommitmentTx,
  generateSixBlocks,
  generateRefundTx,
  spendTx
], function(err, results) {
  if (err) {
    return console.trace(err);
  }
  console.log('All checks completed.');
});

function switchRedeemScripts(next) {
  redeemScript = consumerRedeemScript;
  next();
}

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
    if(err && err.code !== -15) {
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
  startingSatoshis = Unit.fromBTC(utxo.amount).satoshis - fee;
  tx.from(utxo);
  tx.to(startingPrivKey.toAddress(), startingSatoshis);
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
  var commitmentTx = Consumer.createCommitmentTransaction({
    prevTx: spendingTx,
    privateKey: startingPrivKey,
    satoshis: startingSatoshis - fee,
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
  var channelTx = Consumer.createChannelTransaction({
    consumerPrivateKey: consumerPrivKey,
    network: 'testnet',
    satoshis: Math.round(startingSatoshis/4),
    toAddress: providerPrivKey.toAddress().toString(),
    redeemScript: providerRedeemScript,
    fee: fee,
    commitmentTransaction: commitmentTx,
    changeAddress: consumerPrivKey.toAddress().toString()
  });
  next(null, channelTx, commitmentTx);
}

function verifyChannelTx(channelTx, commitmentTx, next) {
  var res = Provider.verifyChannelTransaction({
    channelTx: channelTx,
    commitmentTxRedeemScript: providerRedeemScript,
    inputTxs: [commitmentTx],
    expectedOutputAmount: Math.round(startingSatoshis/4),
    expectedOutputAddress: providerPrivKey.toAddress().toString(),
    lowestAllowedFee: 1000
  });
  if (!res) {
    return next(new Error('channel tx did not verify'));
  }
  channelTx.sign(providerPrivKey);
  next(null, channelTx);
}

function spendTx(tx, next) {
  console.log('sending tx: ', tx.hash);
  //TODO: I guess we ought to be able to perform final checks
  rpc.sendRawTransaction(tx.uncheckedSerialize(), function(err, res) {
    if(err) {
      return next(err);
    }
    next();
  });
}

function generateRefundTx(commitmentTx, next) {
  var refundTx = Consumer.createCommitmentRefundTransaction({
    consumerPrivateKey: consumerPrivKey,
    network: 'testnet',
    satoshis: commitmentTx.outputs[0].satoshis - fee - 100000,
    toAddress: consumerPrivKey.toAddress().toString(),
    redeemScript: consumerRedeemScript,
    fee: fee,
    commitmentTransaction: commitmentTx,
    changeAddress: providerPrivKey.toAddress().toString()
  });
  next(null, refundTx);
}
