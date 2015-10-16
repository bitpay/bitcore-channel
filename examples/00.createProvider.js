var channel = require('../');
var bitcore = require('bitcore-lib');


var providerKey = new bitcore.PrivateKey(bitcore.Networks.testnet);

console.log('provider key: ' + providerKey.toString());
