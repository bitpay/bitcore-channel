var bitcore = require('bitcore');
var _ = require('lodash');

function createAddress(key, network) {
  var address = bitcore.Address.fromPubKey(key, network || 'livenet');
  return address.toString();
}

function isCompressedPubkey(str) {
  return _.isString(str) && isHexa(str) && _.size(str) === 66;
}

function isHexa(str) {
  return /[0-9a-fA-F]+/.test(str);
}

function assertUsesSatoshis(output) {
  if (!output.amountSat && !output.amountSatStr) {
    output.amountSat = Math.round(output.amount * bitcore.util.COIN);
    output.amountSatStr = Math.round(output.amount * bitcore.util.COIN);
  }
}

module.exports = {
  STANDARD_FEE: 10000,

  assertUsesSatoshis: assertUsesSatoshis,
  createAddress: createAddress,
  isHexa: isHexa,
  isCompressedPubkey: isCompressedPubkey
};
