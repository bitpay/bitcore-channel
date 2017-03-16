'use strict';

var Sender = require('../lib/sender');
var should = require('chai').should();
var bitcore = require('bitcore-lib');

describe('Sender (party who wants to open a payment channel)', function() {
  var senderPrivateKey = new bitcore.PrivateKey();
  var receiverPrivateKey = new bitcore.PrivateKey();
console.log(senderPrivateKey.toWIF());
console.log(receiverPrivateKey.toWIF());
console.log(senderPrivateKey.publicKey);
console.log(receiverPrivateKey.publicKey);
  var past2038 = new Date('2040-01-01Z');
  var sender = new Sender({
    expirationTime: past2038,
    amount: 10,
    receiverPublicKeys: [receiverPrivateKey.publicKey],
    senderPublicKeys: [senderPrivateKey.publicKey]
  });

  it('should convert expiration time stamp', function() {
    sender._convertExpirationTimeStamp().should.deep.equal(new Buffer('d0c4aa8300', 'hex'));
  });

  it('should generate a checklocktimeverify redeemscript', function() {
    var expected = '6321' + receiverPrivateKey.publicKey.toString() +
      'ac6705d0c4aa8300b1756821' + senderPrivateKey.publicKey.toString() +
      'ac';
console.log(expected);
console.log(new bitcore.Address(bitcore.crypto.Hash.sha256ripemd160(new Buffer(expected, 'hex')), 'testnet', bitcore.Address.PayToScriptHash));
    sender._buildRedeemScript();
    sender._redeemScript.toBuffer().toString('hex').should.equal(expected);
  });
});
