var channel = require('../');
var buffer = require('buffer');
var Buffer = buffer.Buffer;
var Provider = channel.Provider;
var Consumer = channel.Consumer;

describe('Payment Channel', function() {

  function createAddress(key) {
    var hash = bitcore.util.sha256ripe160(key);
    var version = bitcore.networks['livenet'].addressVersion;
    var addr = new bitcore.Address(version, hash);
    return addr.data;
  }

  var ADDRESS_CONSUMER = '1HuDSwqZ5h2jWkjMmhnLDXTWHYENPpL6BL';
  var ADDRESS_PROVIDER = '1B41MtYwYyjZyLB97g9mdb7nWgUANdu5Rv';

  var _CONSUMER_PRIVKEY = '6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b';
  var _CONSUMER_FUNDING_PRIVKEY = '4e07408562bedb8b60ce05c1decfe3ad16b72230967de01f640b7e4729b49fce';
  var _PROVIDER_PRIVKEY = 'd4735e3a265e16eee03f59718b9b5d03019c07d8b6c51f90da3a666eec13ab35';

  var CONSUMER_KEY = new bitcore.Key();
  CONSUMER_KEY.private = new Buffer(_CONSUMER_PRIVKEY, 'hex');
  CONSUMER_KEY.regenerateSync();

  var CONSUMER_FUNDING_KEY = new bitcore.Key();
  CONSUMER_FUNDING_KEY.private = new Buffer(_CONSUMER_FUNDING_PRIVKEY, 'hex');
  CONSUMER_FUNDING_KEY.regenerateSync();

  var FUNDING_ADDRESS = createAddress(CONSUMER_FUNDING_KEY.public);

  var UTXO = {
    valueSats: 100000000,
    n: 1,
    scriptPubKey: {
      asm: "OP_DUP OP_HASH160 " + bitcore.util.ripe160(key) + " OP_EQUALVERIFY OP_CHECKSIG",
      reqSigs: 1,
      type: "pubkeyhash",
      addresses: [FUNDING_ADDRESS]
    }
  };

  var PROVIDER_KEY = new bitcore.Key();
  PROVIDER_KEY.private = new Buffer(_PROVIDER_PRIVKEY, 'hex');
  PROVIDER_KEY.regenerateSync();

  var isCompressedPubkey = function isCompressedPubkey(str) {
    return _.isString(str) && isHexa(str) && _.size(str) === 33;
  };

  describe('funding process', function() {

    it('provides you an address where you can fund the channel', function() {
      var consumer = new Consumer();
      assert(new bitcore.Address(consumer.getFundingAddress()).isValid());
    });

  });

  describe('refund/change address', function() {

    it('gives you a private key and address for refund/change', function() {
      var consumer = new Consumer();
      assert(_.isString(consumer.getRefundAddress()));
      assert(new bitcore.Address(consumer.getRefundAddress()).isValid());
    });

    it('allows you to set up an address you\'d like your refund/change funds', function() {
      var address = ADDRESS_CONSUMER;
      var consumer = new Consumer({refundAddress: address});
      assert(address === consumer.getRefundAddress());
    });

  });

  describe('funding the channel', function() {

    it('receives utxos that it can spend', function() {
      var consumer = new Consumer();
      consumer.useUtxo({});
      assert(_.size(consumer.inputs) > 0);
      // TODO: Better validation
    });

    it('validates that utxos can be signed with fundingKey', function() {
      // TODO: Validate utxo's pubkeyhash with fundingKey's pubkey
    });
  });

  describe('creating the commitment transaction', function() {

    it('provider returns a valid public key', function() {
      var provider = new Provider({paymentAddress: ADDRESS_PROVIDER});
      assert(isCompressedPubkey(provider.getPublicKey()));
    });

    it('consumer creates a valid commitment transaction', function() {
      var consumer = new Consumer({
        commitmentKey: CONSUMER_KEY,
        fundingKey: CONSUMER_FUNDING_KEY
      });
      consumer.useUtxo(UTXO);
      var tx = consumer.createCommitmentTx();
      assert(_.isString(tx));
    });
  });

  describe('creating the refund transaction', function() {

    it('creates a valid refund transaction', function() {
      var consumer = new Consumer({
        commitmentKey: CONSUMER_KEY,
        fundingKey: CONSUMER_FUNDING_KEY
      });
      consumer.useUtxo(UTXO);

    });
  });

  describe('getting the refund transaction signed', function() {
  });

  describe('emitting the commitment transaction', function() {
  });

  describe('validating the commitment transaction', function() {
  });

  describe('sending a new payment', function() {
  });

  describe('validating a payment', function() {
  });

  describe('finishing a channel', function() {
  });

});
