var bitcore = require('bitcore');
var _ = require('lodash');
var Address = bitcore.Address;

function createAddress(key, network) {
  var address = Address.fromPubKey(key, network || 'livenet');
  return address.toString();
}

function isCompressedPubkey(str) {
  return _.isString(str) && isHexa(str) && _.size(str) === 66;
}

function isHexa(str) {
  return /[0-9a-fA-F]+/.test(str);
}

module.exports = {
  createAddress: createAddress,
  isHexa: isHexa,
  isCompressedPubkey: isCompressedPubkey
};
