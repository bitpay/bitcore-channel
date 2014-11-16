bitcore-channel
==============

A library for building payment channel smart contracts.

```javascript

var Provider = require('./Provider');

var pro = new Provider({paymentAddress: 'n3vNjpQB8GUVNz5R2hSM8rq4EgMEQqS4AZ', network: 'testnet'})

var Consumer = require('./Consumer');

var con = new Consumer({network: 'testnet',
                        serverPublicKey: pro.key.public,
                        refundAddress: 'mqB4k1cqzfojmoa7PzyMSksM17gUpSTe6n'})

```
