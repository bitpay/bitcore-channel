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
channel. The first one is to send bitcoins to an address that is provided by
the Consumer instance (a private key is created for this purpose). A second way
(which could be thought of as an "advanced" usage) is to provide a set of
unspent outputs and the corresponding private keys.

```javascript
console.info('Send bitcoins to ' + consumer.fundingAddress.toString() ' to fund the channel');

// As an alternative way, inputs and private keys can be added to the commitment transaction
consumer.commitmentTx.addInput({txid: "...", vout: 0, scriptPubKey: "...", ...});
consumer.commitmentTx.addKey('01234567...');
```

Once funded, we'll need the server to sign the refund transaction that allows
us to reclaim our funds in case the server vanishes.

```javascript
var messageToServer = consumer.getRefundTxToSign();
```


