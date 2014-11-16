var Provider = require('..').Provider;
var Consumer = require('..').Consumer;
var request = require('request');
var bitcore = require('bitcore');
var Key = bitcore.Key;

var pro = new Provider({
  paymentAddress: 'n3vNjpQB8GUVNz5R2hSM8rq4EgMEQqS4AZ',
  network: 'testnet'
});


var fundingKey = Key.generateSync();
fundingKey.private = new Buffer(
  'f3f8f8290b21bceca32a9c3e688a9e97cf6453eecf54206676a70dba781acb80', 'hex');
fundingKey.regenerateSync();

var con = new Consumer({
  network: 'testnet',
  serverPublicKey: pro.key.public,
  fundingKey: fundingKey,
  refundAddress: 'mqB4k1cqzfojmoa7PzyMSksM17gUpSTe6n'
});
var fundingAddress = con.fundingAddress.toString();

var delta = 500;


var checkPayment = function() {
  request('https://test-insight.bitpay.com/api/addr/' + fundingAddress + '/utxo',
    function(error, response, body) {
      if (!error && response.statusCode === 200) {
        var utxos = JSON.parse(body);
        if (utxos.length === 0) {
          console.log('Waiting for a payment to address ' + fundingAddress);
          setTimeout(checkPayment, delta);
        } else {
          con.addUtxo(utxos[0]);
          con.commitmentTx.build();
        }
      } else {
        setTimeout(checkPayment, delta);
      }
    });
};

checkPayment();
