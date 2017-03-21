'use strict';

var expect = require('chai').expect;
var should = require('chai').should();
var bitcore = require('bitcore-lib');
var PrivateKey = bitcore.PrivateKey;
var Interpreter = bitcore.Script.Interpreter;
var Consumer = require('../lib/consumer');
var Script = require('../lib/transaction/script');
var Transaction = require('../lib/transaction/transaction');

describe('Consumer', function() {

  var providerPrivKey = new PrivateKey('cQ4BLV3itks2w6SxPb7HyfNr5SS4XB6ajqWToZV7jY8D5FeEWEn2', 'testnet');
  var consumerPrivKey = new PrivateKey('cNykpBFHwU4ZW54m7Y6rqo8NFaG47AnTUNqhQ7mvJuAHcR4xpnQc', 'testnet');
  var lockTime = Math.round(new Date('2020-02-29Z').getTime()/1000);
  var redeemScript = Script.buildCLTVRedeemScript([providerPrivKey.publicKey.toString(), consumerPrivKey.publicKey.toString()], lockTime);
  var prevTx = new Transaction(require('./testdata/previousTx.json').rawtx);

  describe('commitment tx', function() {

    var opts = {
      prevTx: prevTx,
      prevTxOutputIndex: 0,
      network: 'testnet',
      satoshis: 300000000,
      privateKey:  new PrivateKey('cQgpdm9P92YQSkvWZLATUVj4ADpgRkru8HyXDY92hPDVbFehx1bC', 'testnet'),
      changeAddress: consumerPrivKey.toAddress().toString(),
      redeemScript: redeemScript,
      fee: 100000
    };


    it('should create a valid commitment tx', function() {
      var commitmentTx = Consumer.createCommitmentTransaction(opts);
      commitmentTx.inputs[0].output = prevTx.outputs[0];
      commitmentTx.isFullySigned().should.be.true;
      commitmentTx.verify().should.be.true;
    });


    it('should create a commitment tx that cannot be spent before the time lock', function() {
      var commitmentTx = Consumer.createCommitmentTransaction(opts);
      opts.privateKey = consumerPrivKey;
      opts.commitmentTransaction = commitmentTx;
      opts.toAddress = providerPrivKey.toAddress().toString();
      var spendingCommitmentTx = Consumer.createChannelTransaction(opts);
      commitmentTx.sign(consumerPrivKey);
      var scriptSig = spendingCommitmentTx.inputs[0].script;
      var scriptPubKey = commitmentTx.outputs[0].script;
      var interpreter = new Interpreter();
      interpreter.verify(scriptSig, scriptPubKey, spendingCommitmentTx, 0,
        Interpreter.SCRIPT_VERIFY_P2SH
        | Interpreter.SCRIPT_VERIFY_STRICTENC
        | Interpreter.SCRIPT_VERIFY_MINIMALDATA
        | Interpreter.SCRIPT_VERIFY_SIGPUSHONLY
        | Interpreter.SCRIPT_CHECKLOCKTIMEVERIFY).should.be.false;
    });

    it('should allow spending of commitment tx after the lock time expires', function() {
      var commitmentTx = Consumer.createCommitmentTransaction(opts);
      var lockTime = Math.round((new Date().getTime()/1000)-30); //30 seconds ago
      var redeemScript = Script.buildCLTVRedeemScript([providerPrivKey.publicKey.toString(), consumerPrivKey.publicKey.toString()], lockTime);

      opts.redeemScript = redeemScript;

      var spendingCommitmentTx = Consumer.createChannelTransaction(opts);
      commitmentTx.sign(consumerPrivKey);
      var scriptSig = spendingCommitmentTx.inputs[0].script;
      var scriptPubKey = commitmentTx.outputs[0].script;
      var interpreter = new Interpreter();
      interpreter.verify(scriptSig, scriptPubKey, spendingCommitmentTx, 0,
        Interpreter.SCRIPT_VERIFY_P2SH
        | Interpreter.SCRIPT_VERIFY_STRICTENC
        | Interpreter.SCRIPT_VERIFY_MINIMALDATA
        | Interpreter.SCRIPT_VERIFY_SIGPUSHONLY
        | Interpreter.SCRIPT_CHECKLOCKTIMEVERIFY).should.be.true;

    });
  });
});

