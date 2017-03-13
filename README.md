<img src="http://bitcore.io/css/images/module-channel.png" alt="bitcore payment channels" height="35">
# Payment Channels for Bitcore

[![NPM Package](https://img.shields.io/npm/v/bitcore-channel.svg?style=flat-square)](https://www.npmjs.org/package/bitcore-channel)
[![Build Status](https://img.shields.io/travis/bitpay/bitcore-channel.svg?branch=master&style=flat-square)](https://travis-ci.org/bitpay/bitcore-channel)
[![Coverage Status](https://img.shields.io/coveralls/bitpay/bitcore-channel.svg?style=flat-square)](https://coveralls.io/r/bitpay/bitcore-channel)


A module for [bitcore][bitcore] that implements [Payment Channels][channel]. Payment channels (sometimes referred as micropayment channels) are a type of smart contracts that allow rapidly adjusting bitcoin transactions.

See [the main bitcore repo][bitcore] or the [bitcore guide on Payment Channels](http://bitcore.io/guide/module/channel/index.html) for more information.

## Parties involved (One way payment channel only)

* Sender
* Receiver

## Work Flow

* Sender desires to open a payment channel with receiver.
* Sender creates a redeem script. This can be as simple as a 2-2 multisig with a CHECKLOCKTIMEVERIFY check.

## Contributing

See [CONTRIBUTING.md](https://github.com/bitpay/bitcore/blob/master/CONTRIBUTING.md) on the main bitcore repo for information about how to contribute.

## License

Code released under [the MIT license](https://github.com/bitpay/bitcore/blob/master/LICENSE).

Copyright 2013-2015 BitPay, Inc. Bitcore is a trademark maintained by BitPay, Inc.

[bitcore]: https://github.com/bitpay/bitcore
[channel]: https://bitcoin.org/en/developer-guide#micropayment-channel
