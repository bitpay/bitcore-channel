<img src="http://bitcore.io/css/images/module-channel.png" alt="bitcore payment channels" height="35">
# Payment Channels for Bitcore

[![NPM Package](https://img.shields.io/npm/v/bitcore-channel.svg?style=flat-square)](https://www.npmjs.org/package/bitcore-channel)
[![Build Status](https://img.shields.io/travis/bitpay/bitcore-channel.svg?branch=master&style=flat-square)](https://travis-ci.org/bitpay/bitcore-channel)
[![Coverage Status](https://img.shields.io/coveralls/bitpay/bitcore-channel.svg?style=flat-square)](https://coveralls.io/r/bitpay/bitcore-channel)


A module for [bitcore][bitcore] that implements [Payment Channels][channel]. Payment channels (sometimes referred as micropayment channels) are a type of smart contracts that allow rapidly adjusting bitcoin transactions.

See [the main bitcore repo][bitcore] or the [bitcore guide on Payment Channels](http://bitcore.io/guide/module/channel/index.html) for more information.

## Parties involved (One way payment channel only)

* Consumer (party putting money into the channel)
* Provider (party accepting micropayments for goods/services)

## Work Flow

* Consumer desires to open a payment channel with provider.
* Consumer sends a json object to the Provider:

```json
{
  "lockTime": 1490813616, // time in secs when channel expires
  "satoshis": 1000000000, // 10 BTC
  "pubKey": "0310f5f2fa2f9d00c5754978183b801ee69f3586e639993d39a0fc79de7c36ac3d" // consumer's pubkey
}
```

* If the provider accepts the terms of the channel, they will reply with their own pubkey. If not, they reply with an error.
* The consumer can then construct a redeem script:

```javascript
var Consumer = require('./lib/consumer');
var redeemScript = Consumer.createRedeemScript(["0310f5f2fa2f9d00c5754978183b801ee69f3586e639993d39a0fc79de7c36ac3d", providerPubKey], 1490813616);
```

* The Consumer can then create a commitment transaction that spends their own funds to a time-locked transaction:

```javascript
var opts = {
  privateKey: consumerPrivateKey,
  satoshis: 1000000000,
  changeAddress: someChangeAddress,
  redeemScript: redeemScript,
  fee: 100000,
  prevTx: serializedPrevTx,  //we are spending funds from this tx to the commitment tx
  prevOutputIndex: index
};
var commitmentTx = Consumer.createCommitmentTransaction(opts);
```

* Consumer then broadcasts the commitment tx to the Bitcoin peer to peer network.
* In the meantime, the provider will be monitoring the Bitcoin blockchain for the commitment tx's existence.
* Once the provider is satisfied that the consumer's commitment transaction is safely in the blockchain, the consumer is free to start sending channel transactions.
* The consumer will then generate channel tranactions, incrementally increasing the amount sent over the channel. The channel transactions are not sent to the Bitcoin network, but sent over an alternate communications channel such as https. The consumer transaction will be constructed and signed by the consumer.

```javascript
var opts = {
  consumerPrivateKey: consumerPrivateKey,
  satoshis: 300000000, // this is ACCUMULATIVE, meaning the caller must keep track of what's already been sent over the channel and set this value appropriately
  toAddress: provider's address
```
## Notes

* The receiver must be careful to broadcast the latest transaction before the expiry time. Failure to do so will result in tx0 being spent by the sender after expiry time and negating all the tx's sent by the sender during the payment channel.

See [CONTRIBUTING.md](https://github.com/bitpay/bitcore/blob/master/CONTRIBUTING.md) on the main bitcore repo for information about how to contribute.

## License

Code released under [the MIT license](https://github.com/bitpay/bitcore/blob/master/LICENSE).

Copyright 2013-2017 BitPay, Inc. Bitcore is a trademark maintained by BitPay, Inc.

[bitcore]: https://github.com/bitpay/bitcore
[channel]: https://bitcoin.org/en/developer-guide#micropayment-channel
