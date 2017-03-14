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
* Sender creates a redeem script and a desired bitcoin amount. The simplest version of this is a 2-2 multisig with a CHECKLOCKTIMEVERIFY check.
  - e.g. IF (receiver public key) OP_CHECKSIG ELSE (time expiry) OP_CHECKLOCKTIMEVERIFY DROP ENDIF (sender public key) OP_CHECKSIG
* Sender sends the redeem script and the amount for the payment channel to the receiver.
* If the receiver agrees to the redeem script and the amount, it will reply with a list of public keys needed to populate the redeem script fully. In the above example, only one public key will be needed from the receiver.
* If the receiver does not agree to the redeem script and/or the amount, it will reply with an error telling the sender what was wrong.
  - e.g. { message: 'expiration time too soon' }, or { message: 'amount too large.' }.
* When the sender gets a successful response from the receiver (public keys to use), it will:
  - Populate the redeem script with the sender's public keys
  - Create a hash from the fully populated redeem script (script hash)
  - Create a new bitcoin transaction (tx0), spending the agreed upon amount of bitcoin to the address of the script hash (p2sh)
  - Broadcast the transaction to the Bitcoin network
* When the receiver determines the transaction previously broadcasted to the bitcoin network by the sender is confirmed (possibly 6 confirmations), it will then allow the sender to start sending payments through the payment channel.
* The sender can then send any number of transactions that spend the output amount from tx0.
* Sender creates tx1, input uses utxo from tx0, output0 pays receiver a desired amount, output1 (if needed) is a change address to sender. The sender signs tx1 and sends tx1 to the receiver. e.g.: utxo from tx0 = 10 BTC
  - tx1: output 0: 1 BTC to receiver, output 1: 8.999 BTC as change, output 2: OP_RETURN receiver data, 100,000 satoshis miner fee.
  - tx2: output 0: 2 BTC to receiver, output 1: 7.999 BTC as change, output 2: OP_RETURN receiver data, 100,000 satoshis miner fee.
* Each time the receiver receives a transaction from the sender, it will validate the receiver data with respect to the new amount sent. The difference between the new amount and the last tx amount received should equal the amount needed by the receiver.
* Should the sender need to close the payment channel for any reason, the sender should send the receiver a close payment channel request.
* The receiver will broadcast the latest signed tx from the sender to the Bitcoin network and respond to the sender with the txid on the network.
* Should the receiver wish to close the payment channel early, the receiver will broadcast the sender's latest tx to the bitcoin network and signal the sender that the payment channel is closed.
* If the receiver goes dark or is unreachable, the sender can wait until the expiry time of tx0 and spend the funds back to himself.

## Notes

* The receiver must be careful to broadcast the latest transaction before the expiry time. Failure to do so will result in tx0 being spent by the sender after expiry time and negating all the tx's sent by the sender during the payment channel.

See [CONTRIBUTING.md](https://github.com/bitpay/bitcore/blob/master/CONTRIBUTING.md) on the main bitcore repo for information about how to contribute.

## License

Code released under [the MIT license](https://github.com/bitpay/bitcore/blob/master/LICENSE).

Copyright 2013-2015 BitPay, Inc. Bitcore is a trademark maintained by BitPay, Inc.

[bitcore]: https://github.com/bitpay/bitcore
[channel]: https://bitcoin.org/en/developer-guide#micropayment-channel
