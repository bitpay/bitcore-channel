'use strict';

var CommitmentTransaction = require('../lib/commitmenttx');
var expect = require('chai').expect;
var should = require('chai').should();
var bitcore = require('bitcore-lib');

describe('Commitment Transaction'), function() {
  var senderPrivateKey = new bitcore.PrivateKey();
  var receiverPrivateKey = new bitcore.PrivateKey();
  var pubKeys = [receiverPrivateKey.publicKey.toString(),
        senderPrivateKey.publicKey.toString()];
  var past2038 = new Date('2040-01-01Z');
  var tx = new CommitmentTransaction();

  it('should create a redeem script', function() {
    var expected = 'OP_IF 33 0x' + receiverPrivateKey.publicKey.toString() +
      ' OP_CHECKSIG OP_ELSE 5 0x807eaa8300 OP_NOP2 OP_DROP OP_ENDIF 33 0x' +
      senderPrivateKey.publicKey.toString() + ' OP_CHECKSIG';
    tx.createRedeemScript(pubKeys, Math.round(past2038.getTime()/1000));
    tx._redeemScript.toString().should.equal(expected);
  });

  it('should convert expiration time stamp', function() {
    tx._convertExpirationTimeStamp(Math.round(new Date('2020-02-29Z').getTime()/1000))
      .toString('hex')
      .should.deep.equal('80a9595e00');
  });

  it('should not allow invalid input to create redeem script', function() {
    expect(tx.createRedeemScript.bind(tx)).to.throw(/Public keys needs to be a list/);
    expect(tx.createRedeemScript.bind(tx, pubKeys)).to.throw(/Lock time is expected to be a positive integer/);
    expect(tx.createRedeemScript.bind(tx, pubKeys, -1)).to.throw(/Lock time is expected to be a positive integer/);
  });

  it('should be able to create an address from a redeem script', function() {
    var pk = bitcore.PrivateKey('KyBSmb4a9ADesGjvgXgyheLXXkwfW8iTj6uzmPcnWPHwERPqeF8Y');
    var pubKeys = [pk.publicKey.toString(), pk.publicKey.toString()];
    tx.createRedeemScript(pubKeys, Math.round(past2038.getTime()/1000));
    tx._getAddressFromRedeemScript().toString().should.be.equal('34Xg6HCS1ZCfRKLALYHFQrXJnF3fH3e7Nq');
  });

  it('should be able to create a hash of a redeem script', function() {
    var pk = bitcore.PrivateKey('KyBSmb4a9ADesGjvgXgyheLXXkwfW8iTj6uzmPcnWPHwERPqeF8Y');
    var pubKeys = [pk.publicKey.toString(), pk.publicKey.toString()];
    tx.createRedeemScript(pubKeys, Math.round(past2038.getTime()/1000));
    tx._getHashFromRedeemScript().toString('hex').should.be.equal('1f24142361011f3902a5653bc6b864c08333eeb7');
  });
});
