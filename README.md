bitcore-channel
==============

A library for building payment channel smart contracts.

This is a first working prototype. Expect this API to change considerably, and
will be more similar to `bitcoinj`'s implementation of Payment Channels.

Getting Started
---------------

The library has two sides to it: the Consumer and the Provider of the service
or good that is being transacted.

Let's start with an overview of how to use the Consumer aspect. Let's asume
that we know the server's public key and that we have it in a string, encoded
in hexa ascii values, in compressed format.

We also have a final address that we'll use as a "change" address (sending here
any funds that we didn't transact with the Provider). We'll call this the
"refund" address, as it will also be the address where the refund will get to
in case the contract is cancelled.

```javascript
var Consumer = require('bitcore-channel').Consumer;
var serverPublicKey = '027f10e67bea70f847b3ab92c18776c6a97a78f84def158afc31fd98513d42912e';
var refundAddress = 'mzCXqcsLBerwyoRZzBFQELHaJ1ZtBSxxe6';

var consumer = new Consumer({
  network: 'testnet',
  serverPublicKey: serverPublicKey,
  refundAddress: refundAddress
});
```

Now that we have instantiated our object, we have two ways of funding the
channel. The basic one is to send bitcoins to an address that is provided by
the Consumer instance (a private key is created for this purpose).

```javascript
console.info('Send bitcoins to ' + consumer.fundingAddress.toString() ' to fund the channel');

consumer.processFunding([{...}, {...}, {...}]);
```

The objects that the consumer can understand are those returned by the Insight API:
[https://github.com/bitpay/insight-api#unspent-outputs]

Once funded, we'll need the server to sign the refund transaction that allows
us to reclaim our funds in case the server vanishes.

```javascript
var messageToProvider = consumer.getRefundTxToSign();
```

Now let's take a look at the Provider side. We'll need to specify a final
address where to send our funds.

```javascript
var Provider = require('bitcore-channel').Provider;
var paymentAddress = 'mig4mc6q7PTQ2YZ9ax5YtR4gjARfoqJSZd';

var provider = new Provider({
  network: 'testnet',
  paymentAddress: paymentAddress
});
console.info('Share this public key with potential consumers: ' + provider.getPublicKey());
```

So when we receive a refund transaction from a consumer, we can easily sign it
and return it back.

```javascript
var messageToConsumer = provider.signRefund(receivedRefund);
```

As a consumer, we'd like to validate that the refund received is valid. If it
is valid, we can start paying the Provider.

```javascript
assert(consumer.validateRefund(messageFromProvider));

consumer.incrementPaymentBy(400 * SATOSHIS);
sendToProvider(consumer.getPayment());
consumer.incrementPaymentBy(4 * BITS);
sendToProvider(consumer.getPayment());
```

The Provider will like to verify that the transaction is indeed valid and the
expected value is being received:

```javascript
assert(provider.validPayment(messageFromConsumer));
assert(provider.currentAmount === 8 * BITS);
```

Of course, he can also interrupt the channel and broadcast the transaction.

```javascript
provider.getPaymentTx();
```
