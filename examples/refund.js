var bitcore = require('bitcore');
var Provider = require('../lib/Provider');

var fundingKey = new bitcore.Key();
fundingKey.private = new Buffer('79b0630419ad72397d211db4988c98ffcb5955b14f6ec5c5651eec5c98d7e557', 'hex');
fundingKey.regenerateSync();
var proKey = new bitcore.Key();
proKey.private = new Buffer('58e78db594be551a8f4c7070fd8695363992bd1eb37d01cd4a4da608f3dc5c2d', 'hex');
proKey.regenerateSync();
var conKey = new bitcore.Key();
conKey.private = new Buffer('17bc93ac93f4a26599d3af49e59206e8276259febba503434eacb871f9bbad75', 'hex');
conKey.regenerateSync();


var pro = new Provider({
    key: proKey,
      paymentAddress: 'n3vNjpQB8GUVNz5R2hSM8rq4EgMEQqS4AZ',
        network: 'testnet'
})

var Consumer = require('../lib/Consumer');

var con = new Consumer({network: 'testnet', serverPublicKey: proKey.public, refundAddress: 'mqB4k1cqzfojmoa7PzyMSksM17gUpSTe6n', commitmentKey: conKey, fundingKey: fundingKey});
con.fundingAddress.toString();
con.commitmentTx.getAddress().toString()


var Refund = require('../lib/transactions/Refund');

var opts = {
  multisigOut: {"address":"2NGPp3oYGmpFokw4ZWux2jJU39i8zwfmTK5","txid":"17bb6b3f8f90a3aa7abd2ee4c3db7bc95a01bc9acd6cd919b2ac8eac367cfc7a","vout":1,"ts":1416181250,"scriptPubKey":"a914fdeaa734587dfed0090c98fbf1bf8730009ddda887","amount":0.009,"confirmationsFromCache":false},
  amount: 100000,
  refundAddress: new bitcore.Address('mrCHmWgn54hJNty2srFF4XLmkey5GnCv5m'),
  network: 'testnet',
  pubKeys: con.commitmentTx.pubkeys,
  lockTime: 1
}
var e = new Refund(opts);

var conWalletKey = new bitcore.WalletKey({
  privKey: conKey,
  network: bitcore.networks['testnet']
});

var proWalletKey = new bitcore.WalletKey({
  privKey: proKey,
  network: bitcore.networks['testnet']
});

e.sign([conWalletKey]);
e.sign([proWalletKey]);
console.log(e.build());
