'use strict';

var should = require('chai').should();
var bitcore = require('bitcore');
var Networks = require('bitcore/lib/networks');

describe('Simple Payment Channel usage', function() {

  describe('a simple consumer', function() {

    it('correctly gets created', function() {
      var consumer = getConsumer().consumer;
      should.exist(consumer.fundingKey.toString());
      // No assertions...? Just checking that no compile errors occur
    });

    it('Commitment toObject', function() {
      var consumer = getFundedConsumer().consumer;
      var obj = consumer.commitmentTx.toObject();
      var expected = {
        'transaction': {
          'version': 1,
          'inputs': [{
            'prevTxId': '787ef38932601aa6d22b844770121f713b0afb6c13fdd52e512c6165508f47cd',
            'outputIndex': 1,
            'sequenceNumber': 4294967295,
            'script': '483045022100e6986ad788edfc55bf84b45d747e5d9991bc925abdc1f06a5656bfb388d2098b0220043c4752b64a4f1a5a8de1de9191800ac79a018dcad92d10b099a7762a3deba7012103bca86b6a422d1ffec9fd0a1e8d37feaef4e41f76bbdde68852251b7ae8ca6fab',
            'scriptString': '72 0x3045022100e6986ad788edfc55bf84b45d747e5d9991bc925abdc1f06a5656bfb388d2098b0220043c4752b64a4f1a5a8de1de9191800ac79a018dcad92d10b099a7762a3deba701 33 0x03bca86b6a422d1ffec9fd0a1e8d37feaef4e41f76bbdde68852251b7ae8ca6fab',
            'output': {
              'satoshis': 50000000,
              'script': '76a91469b678f36c91bf635ff6e9479edd3253a5dfd41a88ac'
            }
          }, {
            'prevTxId': 'c1003b5e2c9f5eca65bde73463035e5dffcfbd3c234e55e069cfeebb513293e4',
            'outputIndex': 0,
            'sequenceNumber': 4294967295,
            'script': '483045022100a8e1e58dde652735c7e30a4080249ea31b7756a72052cb68a393f0fc94191f0c02203fe5b13c3b3bcc0ddbc0b480f7ff54f774edc0b66d300f05b785db9eb5502b31012103bca86b6a422d1ffec9fd0a1e8d37feaef4e41f76bbdde68852251b7ae8ca6fab',
            'scriptString': '72 0x3045022100a8e1e58dde652735c7e30a4080249ea31b7756a72052cb68a393f0fc94191f0c02203fe5b13c3b3bcc0ddbc0b480f7ff54f774edc0b66d300f05b785db9eb5502b3101 33 0x03bca86b6a422d1ffec9fd0a1e8d37feaef4e41f76bbdde68852251b7ae8ca6fab',
            'output': {
              'satoshis': 10000000,
              'script': '76a91469b678f36c91bf635ff6e9479edd3253a5dfd41a88ac'
            }
          }],
          'outputs': [{
            'satoshis': 0,
            'script': 'a914fdeaa734587dfed0090c98fbf1bf8730009ddda887'
          }],
          'nLockTime': 0
        },
        'publicKeys': ['027f10e67bea70f847b3ab92c18776c6a97a78f84def158afc31fd98513d42912e', '023bc028f67697712efeb0216ef1bc7208e2c9156bf0731204d79328f4c8ef643a'],
        'network': 'testnet'
      };
      obj.should.deep.equal(expected);
    });

    it('processes an output', function() {
      var consumer = getFundedConsumer().consumer;
      consumer.commitmentTx.amount.should.equal(60000000);
    });

    it('validates a refund correctly', function() {
      var consumer = getValidatedConsumer().consumer;
      consumer.refundTx.isFullySigned().should.equal(true);
    });

    it('has no false positive on refund validation', function() {
      var consumer = getFundedConsumer().consumer;
      consumer.setupRefund();

      var failed = false;
      try {
        consumer.validateRefund({
          refund: consumer.refundTx.toObject(),
          paymentAddress: 'mgeLZRkELTysge5dvpo2ixGNgG2biWwRXC'
        });
      } catch (e) {
        failed = true;
      } finally {
        failed.should.equal(true);
      }
    });

    it('can increment a payment', function() {
      var consumer = getValidatedConsumer().consumer;
      consumer.incrementPaymentBy(1000);
      consumer.paymentTx.paid.should.equal(1000);
      consumer.incrementPaymentBy(1000);
      consumer.paymentTx.paid.should.equal(2000);
    });
  });

  describe('a simple provider', function() {

    it('gets created correctly', function() {
      // TODO: no assertions?
      return getProvider();
    });

    it('signs a refund', function() {
      var consumer = getValidatedConsumer().consumer;
      consumer.refundTx.isFullySigned().should.equal(true);
    });

    it('validates a payment', function() {
      var provider = getProvider();
      var consumer = getValidatedConsumer().consumer;
      provider.validPayment(consumer.incrementPaymentBy(1000));
      provider.currentAmount.should.equal(1000);
      provider.validPayment(consumer.incrementPaymentBy(1000));
      provider.validPayment(consumer.incrementPaymentBy(1000));
      provider.validPayment(consumer.incrementPaymentBy(1000));
      provider.currentAmount.should.equal(4000);
    });
  });
});

var providerKey = new bitcore.PrivateKey('58e78db594be551a8f4c7070fd8695363992bd1eb37d01cd4a4da608f3dc5c2d', bitcore.Networks.testnet);
var fundingKey = new bitcore.PrivateKey('79b0630419ad72397d211db4988c98ffcb5955b14f6ec5c5651eec5c98d7e557', bitcore.Networks.testnet);
var commitmentKey = new bitcore.PrivateKey('17bc93ac93f4a26599d3af49e59206e8276259febba503434eacb871f9bbad75', bitcore.Networks.testnet);
var providerAddress = providerKey.toAddress(Networks.testnet);

var getConsumer = function() {

  var Consumer = require('../').Consumer;
  var refundAddress = 'mzCXqcsLBerwyoRZzBFQELHaJ1ZtBSxxe6';

  var consumer = new Consumer({
    network: 'testnet',
    fundingKey: fundingKey,
    commitmentKey: commitmentKey,
    providerPublicKey: providerKey.publicKey,
    providerAddress: providerKey.toAddress(),
    refundAddress: refundAddress
  });

  return {
    consumer: consumer,
    serverPublicKey: providerKey.publicKey,
    refundAddress: refundAddress
  };
};

var getFundedConsumer = function() {
  var result = getConsumer();
  result.consumer.processFunding([{
    'address': 'mq9uqc4W8phHXRPt3ZWUdRpoZ9rkR67Dw1',
    'txid': '787ef38932601aa6d22b844770121f713b0afb6c13fdd52e512c6165508f47cd',
    'vout': 1,
    'ts': 1416205164,
    'scriptPubKey': '76a91469b678f36c91bf635ff6e9479edd3253a5dfd41a88ac',
    'amount': 0.5,
    'confirmationsFromCache': false
  }, {
    'address': 'mq9uqc4W8phHXRPt3ZWUdRpoZ9rkR67Dw1',
    'txid': 'c1003b5e2c9f5eca65bde73463035e5dffcfbd3c234e55e069cfeebb513293e4',
    'vout': 0,
    'ts': 1416196853,
    'scriptPubKey': '76a91469b678f36c91bf635ff6e9479edd3253a5dfd41a88ac',
    'amount': 0.1,
    'confirmations': 18,
    'confirmationsFromCache': false
  }]);
  result.consumer.commitmentTx.sign(fundingKey);
  return result;
};

var getValidatedConsumer = function() {
  var funded = getFundedConsumer().consumer;
  funded.setupRefund();
  funded.refundTx.sign(providerKey);
  var refund = funded.refundTx.toObject();
  funded.validateRefund(refund);
  return {
    consumer: funded
  };
};

var getProvider = function() {
  var Provider = require('../').Provider;
  return new Provider({
    key: providerKey,
    paymentAddress: providerAddress,
    network: 'testnet'
  });
};
