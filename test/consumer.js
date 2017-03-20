'use strict';

var expect = require('chai').expect;
var should = require('chai').should();
var bitcore = require('bitcore-lib');
var Consumer = require('../lib/consumer');
var Script = require('../lib/transaction/script');

describe('Consumer', function() {
  var spendingTxJson = {
    hash: '8083c3a6a5fec418fd11c09bbbc9485e71e3992664fcdb602703d532348b6133',
    version: 1,
    inputs: [
      {
        prevTxId: '32ca9a4b1785663250fecde7892022bdd2f804a97a18ae7d1ab6f6b43980efe0',
        outputIndex: 0,
        sequenceNumber: 4294967294,
        script: '47304402206479e67a9a0688eb0290517c3b227a808c234a38b6aaac935ac296f5e312a6d402205d60dda5b36b8b0fb487582ef0991726551e254f7391867d4f056d7c39621f10012102df7c017e3812ebb8602b475ac680e15c958d20ad23b9a768c571488d37bc98b0',
        scriptString: '71 0x304402206479e67a9a0688eb0290517c3b227a808c234a38b6aaac935ac296f5e312a6d402205d60dda5b36b8b0fb487582ef0991726551e254f7391867d4f056d7c39621f1001 33 0x02df7c017e3812ebb8602b475ac680e15c958d20ad23b9a768c571488d37bc98b0'
      }
    ],
    outputs: [
      {
        satoshis: 13191799,
        script: '76a914b23a7f9cd064f15b0e6040f1ed389dd130372de888ac'
      },
      {
        satoshis: 871080,
        script: '76a914dcac0515a95bee8491766d6a7fcca4c699aceaab88ac'
      }
    ],
    nLockTime: 457671
  };
  var p1 = bitcore.PrivateKey('L3ajur44cb85aLRPtiYfqnfgsqWCWxMZmPGXgataGFiif9fhYRqG');
  var p2 = bitcore.PrivateKey('L1i39ig9sHsTss5EBX3qmTLmAHAnqT65JQkQVSNEG6zwkKd919CY');
  var spendingTx =  new bitcore.Transaction(spendingTxJson);
  var opts = {
    pubKeys: [p1.publicKey.toString(), p2.publicKey.toString()],
    spendingTx: spendingTx,
    changeAddress: p2.publicKey.toAddress().toString(),
    fee: 100000,
    amount: bitcore.Unit.fromBTC(10).toSatoshis(),
    spendingTxOutputIndex: 0,
    lockTime: Math.round(new Date('2020-01-01Z').getTime()/1000)
  };
  var consumer = new Consumer(opts);
  it('#createCommitmentTransaction', function() {
    var tx = consumer.createCommitmentTransaction();
    tx.uncheckedSerialize().should.equal('010000000133618b3432d5032760dbfc642699e3715e48c9bb9bc011fd18c4fea5a6c383800000000000ffffffff0100ca9a3b0000000017a914a7d288759ef11ee55e1ba83d413ee4a6e274407f8700000000');
  });

  it('#createChannelTransaction', function() {
    spendingTxJson.hash = '9b06a22817b61d357f1a7e5726522f930cda665e803c785c215269c961406c79';
    spendingTxJson.outputs[0].script = Script.buildCLTVRedeemScript([p1.publicKey.toString(), p2.publicKey.toString()], Math.round(new Date('2020-01-01Z').getTime()/1000)).toHex();
    opts.spendingTx = new bitcore.Transaction(spendingTxJson);
    opts.toAddress = new bitcore.PrivateKey().toAddress().toString();
    opts.changeAddress = new bitcore.PrivateKey().toAddress().toString();
    var consumer = new Consumer(opts);
    var tx = consumer.createChannelTransaction();
console.log(tx.uncheckedSerialize());
  });

});

