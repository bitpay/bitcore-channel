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

  describe('Commitment Transaction', function() {


    it('should create a valid commitment tx', function() {
      var commitmentTx = Consumer.createCommitmentTransaction(commitOpts);
      commitmentTx.inputs[0].output = prevTx.outputs[0];
      commitmentTx.isFullySigned().should.be.true;
      commitmentTx.verify().should.be.true;
    });


    it('should create a commitment tx that cannot be spent before the time lock', function() {
      var commitmentTx = Consumer.createCommitmentTransaction(commitOpts);
      var opts = {
        prevTx: prevTx,
        prevTxOutputIndex: 0,
        network: 'testnet',
        satoshis: 300000000,
        consumerPrivateKey: consumerPrivKey,
        commitmentTransaction: commitmentTx,
        toAddress: providerPrivKey.toAddress().toString(),
        changeAddress: consumerPrivKey.toAddress().toString(),
        redeemScript: redeemScript,
        fee: 100000
      };
      var spendingCommitmentTx = Consumer.createChannelTransaction(opts);
      var scriptSig = spendingCommitmentTx.inputs[0].script;
      var scriptPubKey = commitmentTx.outputs[0].script;
      var interpreter = new Interpreter();
      var res = interpreter.verify(scriptSig, scriptPubKey, spendingCommitmentTx, 0, flags);
      res.should.be.false
      interpreter.errstr.should.equal('SCRIPT_ERR_UNSATISFIED_LOCKTIME');
    });

    it('should allow spending of commitment tx after the lock time expires using default time lock setting', function() {
      var commitmentTx = Consumer.createCommitmentTransaction(commitOpts);
      var opts = {
        prevTx: prevTx,
        prevTxOutputIndex: 0,
        network: 'testnet',
        satoshis: 300000000,
        consumerPrivateKey: consumerPrivKey,
        providerPrivateKey: null,
        commitmentTransaction: commitmentTx,
        toAddress: consumerPrivKey.toAddress().toString(),
        redeemScript: redeemScript,
        fee: 100000
      };

      var spendingCommitmentTx = Consumer.createCommitmentRefundTransaction(opts);
      var scriptSig = spendingCommitmentTx.inputs[0].script;
      var scriptPubKey = commitmentTx.outputs[0].script;
      var interpreter = new Interpreter();
      var res = interpreter.verify(scriptSig, scriptPubKey, spendingCommitmentTx, 0, flags);
      res.should.be.true;
    });

    it('should allow spending of commitment tx after the lock time expires using default time lock setting', function() {
      var commitmentTx = Consumer.createCommitmentTransaction(commitOpts);
      var opts = {
        prevTx: prevTx,
        prevTxOutputIndex: 0,
        network: 'testnet',
        satoshis: 300000000,
        consumerPrivateKey: consumerPrivKey,
        providerPrivateKey: null,
        commitmentTransaction: commitmentTx,
        toAddress: consumerPrivKey.toAddress().toString(),
        redeemScript: redeemScript,
        fee: 100000
      };

      var spendingCommitmentTx = Consumer.createCommitmentRefundTransaction(opts);
      var scriptSig = spendingCommitmentTx.inputs[0].script;
      var scriptPubKey = commitmentTx.outputs[0].script;
      var hash = Script.buildCLTVRedeemScript(pubKeys, lockTime);

      var interpreter = new Interpreter();
      var res = interpreter.verify(scriptSig, scriptPubKey, spendingCommitmentTx, 0, flags);
      console.log(interpreter.errstr);
      res.should.be.true;
    });

    it('should not allow spending of commitment tx if manually setting time lock setting', function() {
      var commitmentTx = Consumer.createCommitmentTransaction(commitOpts);
      var opts = {
        prevTx: prevTx,
        prevTxOutputIndex: 0,
        network: 'testnet',
        satoshis: 300000000,
        consumerPrivateKey: consumerPrivKey,
        providerPrivateKey: null,
        commitmentTransaction: commitmentTx,
        toAddress: consumerPrivKey.toAddress().toString(),
        redeemScript: redeemScript,
        fee: 100000,
        lockTime: (lockTime - 86400) //1 more day than the operand to CHECKLOCKTIMEVERIFY
      };

      var spendingCommitmentTx = Consumer.createCommitmentRefundTransaction(opts);
      var scriptSig = spendingCommitmentTx.inputs[0].script;
      var scriptPubKey = commitmentTx.outputs[0].script;
      var interpreter = new Interpreter();
      var res = interpreter.verify(scriptSig, scriptPubKey, spendingCommitmentTx, 0, flags);
      res.should.be.false
      interpreter.errstr.should.equal('SCRIPT_ERR_UNSATISFIED_LOCKTIME');
    });

    it('should not allow spending of commitment tx if spending tx input is finalized', function() {
      var commitmentTx = Consumer.createCommitmentTransaction(commitOpts);
      var opts = {
        prevTx: prevTx,
        prevTxOutputIndex: 0,
        network: 'testnet',
        satoshis: 300000000,
        consumerPrivateKey: consumerPrivKey,
        providerPrivateKey: null,
        commitmentTransaction: commitmentTx,
        toAddress: consumerPrivKey.toAddress().toString(),
        redeemScript: redeemScript,
        fee: 100000,
        sequenceNumber: 0xffffffff
      };

      var spendingCommitmentTx = Consumer.createCommitmentRefundTransaction(opts);
      var scriptSig = spendingCommitmentTx.inputs[0].script;
      var scriptPubKey = commitmentTx.outputs[0].script;
      var interpreter = new Interpreter();
      var res = interpreter.verify(scriptSig, scriptPubKey, spendingCommitmentTx, 0, flags);
      res.should.be.false
      interpreter.errstr.should.equal('SCRIPT_ERR_UNSATISFIED_LOCKTIME');
    });

    it('should not allow spending of a commitment tx if there are 2 signatures, one valid, the other invalid, but also after lock time.', function() {
      var commitmentTx = Consumer.createCommitmentTransaction(commitOpts);
      var opts = {
        prevTx: prevTx,
        prevTxOutputIndex: 0,
        network: 'testnet',
        satoshis: 300000000,
        consumerPrivateKey: consumerPrivKey,
        commitmentTransaction: commitmentTx,
        toAddress: consumerPrivKey.toAddress().toString(),
        redeemScript: redeemScript,
        fee: 100000,
      };

      var spendingCommitmentTx = Consumer.createCommitmentRefundTransaction(opts);
      var scriptSig = spendingCommitmentTx.inputs[0].script;
      scriptSig.chunks[0] = scriptSig.chunks[1];
      scriptSig.prepend(bitcore.Opcode.OP_0);
      var scriptPubKey = commitmentTx.outputs[0].script;
      var interpreter = new Interpreter();
      var res = interpreter.verify(scriptSig, scriptPubKey, spendingCommitmentTx, 0, flags);
      res.should.be.false
      interpreter.errstr.should.equal('SCRIPT_ERR_EVAL_FALSE_IN_P2SH_STACK');

    });

    it('should allow spending of a commitment tx if there are 2 valid signatures and an invalid locktime.', function() {
      var commitmentTx = Consumer.createCommitmentTransaction(commitOpts);
      var opts = {
        prevTx: prevTx,
        prevTxOutputIndex: 0,
        network: 'testnet',
        satoshis: 300000000,
        consumerPrivateKey: consumerPrivKey,
        providerPrivateKey: providerPrivKey,
        commitmentTransaction: commitmentTx,
        toAddress: consumerPrivKey.toAddress().toString(),
        redeemScript: redeemScript,
        fee: 100000,
        lockTime: 0,
        sequenceNumber: 0xffffffff - 1
      };

      var spendingCommitmentTx = Consumer.createCommitmentRefundTransaction(opts);
      var scriptSig = spendingCommitmentTx.inputs[0].script;
      scriptSig.chunks[0] = scriptSig.chunks[1];
      scriptSig.prepend(bitcore.Opcode.OP_0);
      var scriptPubKey = commitmentTx.outputs[0].script;
      var interpreter = new Interpreter();
      var res = interpreter.verify(scriptSig, scriptPubKey, spendingCommitmentTx, 0, flags);
      res.should.be.true

    });


  });

  describe('Channel Transaction', function() {


    it('should create a valid channel tx', function() {
      var commitmentTx = Consumer.createCommitmentTransaction(commitOpts);
      var opts = {
        prevTx: prevTx,
        prevTxOutputIndex: 0,
        network: 'testnet',
        satoshis: 300000000,
        consumerPrivateKey: consumerPrivKey,
        providerPrivateKey: null,
        commitmentTransaction: commitmentTx,
        toAddress: consumerPrivKey.toAddress().toString(),
        redeemScript: redeemScript,
        fee: 100000,
        sequenceNumber: 0xffffffff
      };

      var spendingCommitmentTx = Consumer.createChannelTransaction(opts);
      var scriptSig = spendingCommitmentTx.inputs[0].script;
      var scriptPubKey = commitmentTx.outputs[0].script;
      var interpreter = new Interpreter();
      var res = interpreter.verify(scriptSig, scriptPubKey, spendingCommitmentTx, 0, flags);
      res.should.be.false;
      //this also means that the providers key was not supplied and therefore did not sign
      interpreter.errstr.should.equal('SCRIPT_ERR_UNSATISFIED_LOCKTIME');
      //this ensures that this transaction is a true 2 of 2, protecting both consumer and provider
      spendingCommitmentTx.inputs[0].sequenceNumber.should.equal(0xffffffff);
      spendingCommitmentTx.nLockTime.should.equal(0);
      var sh = bitcore.Transaction.sighash;
      var sig = bitcore.crypto.Signature.fromTxFormat(spendingCommitmentTx.inputs[0].script.chunks[1].buf);
      sh.verify(spendingCommitmentTx, sig, consumerPrivKey.publicKey, 0, scriptPubKey);
    });

    it('should create a valid channel tx that can only be spent by signing with the consumer private key and the provider private key, but lock time considerations are not done', function() {
      var commitmentTx = Consumer.createCommitmentTransaction(commitOpts);
      var opts = {
        prevTx: prevTx,
        prevTxOutputIndex: 0,
        network: 'testnet',
        satoshis: 300000000,
        consumerPrivateKey: consumerPrivKey,
        providerPrivateKey: providerPrivKey,
        commitmentTransaction: commitmentTx,
        toAddress: consumerPrivKey.toAddress().toString(),
        redeemScript: redeemScript,
        fee: 100000
      };

      var spendingCommitmentTx = Consumer.createChannelTransaction(opts);
      var scriptSig = spendingCommitmentTx.inputs[0].script;
      var scriptPubKey = commitmentTx.outputs[0].script;
      var interpreter = new Interpreter();
      var res = interpreter.verify(scriptSig, scriptPubKey, spendingCommitmentTx, 0, flags);
      res.should.be.true;
      spendingCommitmentTx.inputs[0].sequenceNumber.should.equal(0xffffffff);
      spendingCommitmentTx.nLockTime.should.equal(0);

    });

  });
});
