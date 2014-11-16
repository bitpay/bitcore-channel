var bitcore = require('bitcore');
var Provider = require('./Provider');

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

var Consumer = require('./Consumer');

var con = new Consumer({network: 'testnet', serverPublicKey: proKey.public, refundAddress: 'mqB4k1cqzfojmoa7PzyMSksM17gUpSTe6n', commitmentKey: conKey, fundingKey: fundingKey});
con.fundingAddress.toString();
con.commitmentTx.getAddress().toString()


var Refund = require('./transactions/Refund');

var opts = {
  multisigOut: {"address":"2NGPp3oYGmpFokw4ZWux2jJU39i8zwfmTK5","txid":"440f60fb1a76d300a62ded3c7107965e9114608bd4589a954265097c6e71002a","vout":0,"ts":1416177149,"scriptPubKey":"a914fdeaa734587dfed0090c98fbf1bf8730009ddda887","amount":0.001,"confirmationsFromCache":false},
  amount: 100000,
  refundAddress: new bitcore.Address('mrCHmWgn54hJNty2srFF4XLmkey5GnCv5m'),
  network: 'testnet',
  lockTime: 1416277466
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
