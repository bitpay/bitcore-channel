'use strict';

var _ = require('lodash');
var mkdirp = require('mkdirp');
var rimraf = require('rimraf');
var chai = require('chai');
var should = chai.should();
var spawn = require('child_process').spawn;
var async = require('async');
var bitcore = require('bitcore-lib');
var Unit = bitcore.Unit;
var CLTVTransaction = require('../lib/transaction/transaction');
var Transaction = bitcore.Transaction;
var PrivateKey = bitcore.PrivateKey;
var BitcoinRPC = require('bitcoind-rpc');
var Consumer = require('../lib/consumer');
var Provider = require('../lib/provider');
var Script = require('../lib/transaction/script');

var rpcConfig = {
  protocol: 'http',
  user: 'bitcoin',
  pass: 'local321',
  host: '127.0.0.1',
  port: '58332',
  rejectUnauthorized: false
};

var bitcoin = {
  options: {
    datadir: '/tmp/bitcoin',
    listen: 0,
    regtest: 1,
    server: 1,
    rpcuser: rpcConfig.user,
    rpcpassword: rpcConfig.pass,
    rpcport: rpcConfig.port
  },
  process: null
};

var fee = 100000;

var rpc = new BitcoinRPC(rpcConfig);

var startingPrivKey = new PrivateKey('testnet');

var providerPrivKey = new PrivateKey('cNZnXzQfAuDK4nBth5ViaSqgyYJUzJ5Ph2Dpmea933quEmHygN8u', 'testnet');
var consumerPrivKey = new PrivateKey('cQBAt1aBk3qQmpJMGTbu9qUY8uhwALuSVEhWnr1ytXLTrj4LJp1u', 'testnet');

var providerPubKey = providerPrivKey.publicKey;
var consumerPubKey = consumerPrivKey.publicKey;

var providerLockTime = Math.round(Date.now()/1000) + 300; // 30 seconds from now
var consumerLockTime = Math.round(Date.now()/1000); // 1 second ago

var pubKeys = [providerPubKey.toString(), consumerPubKey.toString()];

var providerRedeemScript = Script.buildCLTVRedeemScript(pubKeys, providerLockTime);
var consumerRedeemScript = Script.buildCLTVRedeemScript(pubKeys, consumerLockTime);
var redeemScript = providerRedeemScript;

var walletPassphrase = 'test';
var startingSatoshis = 0;



describe('CLTV Transaction work flow', function() {

  this.timeout(60000);
  var initialTx;

  afterEach(function(done) {
    bitcoin.process.kill();
    setTimeout(done, 2000); //we need this here to let bitcoin process clean up after itself
  });

  beforeEach(function(done) {
    async.series([
      startBitcoind,
      waitForBitcoinReady,
      unlockWallet,
      setupInitialTx //generate and send a tx that a commitment tx can be built from
    ], function(err, tx) {
      if(err) {
        return done(err);
      }
      initialTx = _.compact(tx)[0];
      done();
    });
  });

  it('should send a commitment tx', function(done) {
     generateCommitmentTx(initialTx, function(err, commitmentTx) {
       if(err) {
         return done(err);
       }
       rpc.getRawTransaction(commitmentTx.hash, function(err, txSerialized) {
         if(err) {
           return done(err);
         }
         txSerialized.result.should.equal(commitmentTx.serialize());
         done();
       });
     });
  });

  it('should create and verify a channel tx', function(done) {
    generateCommitmentTx(initialTx, function(err, commitmentTx) {
      if(err) {
        return done(err);
      }
      var channelTx = generateChannelTx(commitmentTx);
      channelTx.should.be.instanceof(Transaction);
      verifyChannelTx(channelTx, commitmentTx).should.be.true;
      done();
    });
  });

  it('should allow provider to sign a raw, hexadecimal channel tx and send it', function(done) {
    generateCommitmentTx(initialTx, function(err, commitmentTx) {
      if(err) {
        return done(err);
      }
      var channelTx = generateChannelTx(commitmentTx);
      var rawChannelTx = channelTx.serialize();
      verifyChannelTx(rawChannelTx, commitmentTx).should.be.true;
      var signedChannelTx = Provider.signChannelTransaction({
        channelTx: rawChannelTx,
        inputTxs: [commitmentTx],
        privateKey: providerPrivKey
      });
      signedChannelTx.isFullySigned().should.be.true;
      sendTx(signedChannelTx, done);
    });
  });

  it('should allow the provider to increase the miner fee without any action by the consumer', function(done) {
    generateCommitmentTx(initialTx, function(err, commitmentTx) {
      if(err) {
        return done(err);
      }
      var channelTx = generateChannelTx(commitmentTx);
      verifyChannelTx(channelTx, commitmentTx).should.be.true;
      //increase miner fee by taking some satoshis away from provider output
      var feeIncrease = 100000;
      var oldFee = channelTx.getFee();

      //our output must be index 1
      var providerOutput = channelTx.outputs[1];
      var oldProviderOutputAmount = providerOutput.satoshis;
      var newProviderOutputAmount = oldProviderOutputAmount - (oldFee + feeIncrease);
      providerOutput.satoshis = newProviderOutputAmount;

      var consumerOutputAmount = channelTx.outputs[0].satoshis;

      var signedChannelTx = Provider.signChannelTransaction({
        channelTx: channelTx,
        inputTxs: [commitmentTx],
        privateKey: providerPrivKey
      });

      signedChannelTx.isFullySigned().should.be.true;
      sendTx(signedChannelTx, function(err, tx) {
        if(err) {
          return done(err);
        }
        rpc.getRawTransaction(tx.hash, function(err, rawTx) {
          if(err) {
            return done(err);
          }
          var txToVerify = new Transaction(rawTx.result);
          txToVerify.outputs[1].satoshis.should.equal(newProviderOutputAmount);
          txToVerify.outputs[0].satoshis.should.equal(consumerOutputAmount);
          done();
        });
      });
    });
  });

  it('consumer should not be allowed to spend the commitment tx back to himself before the lock time expires and the provider has not signed', function(done) {
    generateCommitmentTx(initialTx, function(err, commitmentTx) {
      if(err) {
        return done(err);
      }
      var refundTx = generateRefundTx(commitmentTx);
      sendTx(refundTx, function(err, tx) {
        err.message.should.equal('64: non-final');
        done();
      });
    });
  });

  it('should allow the consumer to create/spend a commitment refund tx to recover funds', function(done) {
    switchRedeemScripts();
    generateCommitmentTx(initialTx, function(err, commitmentTx) {
      if(err) {
        return done(err);
      }
      var refundTx = generateRefundTx(commitmentTx);
      sendTx(refundTx, function(err, tx) {
        if(err) {
          return done(err);
        }
        rpc.getRawTransaction(tx.hash, 1, function(err, jsonTx) {
          if(err) {
            return done(err);
          }
          jsonTx.result.hex.should.equal(tx.serialize());
          jsonTx.result.confirmations.should.equal(6);
          Unit.fromBTC(jsonTx.result.vout[0].value).satoshis.should.equal(commitmentTx.outputs[0].satoshis - fee);
          jsonTx.result.vout[0].scriptPubKey.addresses[0].should.equal(consumerPrivKey.toAddress().toString());
          done();
        });
      });
    });
  });

});

function toArgs(opts) {
  return Object.keys(opts).map(function(key) {
    return '-' + key + '=' + opts[key];
  });
}

function waitForBitcoinReady(next) {
  async.retry({ times: 10, interval: 1000 }, function(next) {
    rpc.generate(150, function(err, res) {
      if (err || (res && res.error)) {
        return next('keep trying');
      }
      next();
    });
  }, function(err) {
    if(err) {
      return next(err);
    }
    next();
  });
}

function startBitcoind(next) {
  rimraf(bitcoin.options.datadir, function(err) {
    if(err) {
      return next(err);
    }
    mkdirp(bitcoin.options.datadir, function(err) {
      if(err) {
        return next(err);
      }
      bitcoin.process = spawn('bitcoind', toArgs(bitcoin.options));
      next();
    });
  });
}

function getinfo(next) {
  rpc.getInfo(function(err, res) {
    if(err) {
      return next(err);
    }
    // means we won't have any spendable bitcoins to work with
    if (res.blocks < 150) {
      return rpc.generate(150, next);
    }
    next();
  });
}

function switchRedeemScripts() {
  if (providerRedeemScript.toHex() === redeemScript.toHex()) {
    redeemScript = consumerRedeemScript;
  } else {
    redeemScript = providerRedeemScript;
  }
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

function generateSpendingTx(privKey, utxo) {
  var tx = new Transaction();
  startingSatoshis = Unit.fromBTC(utxo.amount).satoshis - fee;
  tx.from(utxo);
  tx.to(startingPrivKey.toAddress(), startingSatoshis);
  tx.fee(fee);
  tx.sign(privKey);
  return tx;
}

function setupInitialTx(next) {
  getPrivateKeyWithABalance(function(err, privKey, utxo) {
    if(err) {
      return next(err);
    }
    var tx = generateSpendingTx(privKey, utxo);
    sendTx(tx, next);
  });
}

function sendTx(tx, next) {
  rpc.sendRawTransaction(tx.serialize(), function(err, res) {
    if(err) {
      return next(err);
    }
    rpc.generate(6, function(err) {
      if(err) {
        return next(err);
      }
      next(null, tx);
    });
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
  sendTx(commitmentTx, function(err, tx) {
    if(err) {
      return next(err);
    }
    next(null, commitmentTx);
  });
}

function generateChannelTx(commitmentTx) {
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
  return channelTx;
}

function verifyChannelTx(channelTx, commitmentTx) {
  return Provider.verifyChannelTransaction({
    channelTx: channelTx,
    commitmentTxRedeemScript: providerRedeemScript,
    inputTxs: [commitmentTx],
    expectedOutputAmount: Math.round(startingSatoshis/4),
    expectedOutputAddress: providerPrivKey.toAddress().toString(),
    lowestAllowedFee: 1000
  });
}

function generateRefundTx(commitmentTx) {
  return Consumer.createCommitmentRefundTransaction({
    consumerPrivateKey: consumerPrivKey,
    network: 'testnet',
    satoshis: commitmentTx.outputs[0].satoshis - fee,
    toAddress: consumerPrivKey.toAddress().toString(),
    redeemScript: redeemScript,
    fee: fee,
    commitmentTransaction: commitmentTx,
    changeAddress: null
  });
}
