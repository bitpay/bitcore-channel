var inherits = require('inherits');
var event = require('event');
var bitcore = require('bitcore');

/**
 * @param {Object} opts
 * @param {number} opts.expires - unix timestamp in millis since epoch
 * @param {string} opts.network - 'livenet' or 'testnet'
 * @param {number} opts.amount - amount to be commited in the payment channel
 * @param {number*} opts.feePerTransaction - fees to pay on each transaction (defaults to 100 bits)
 *
 * @param {bitcore.Key*} opts.commitmentKey - optional, key to use when negotiating the channel
 * @param {bitcore.Address*} opts.refundAddress - optional, address to use for refund/change
 *
 * @param {Status*} opts.status - initial state (used for deserialization)
 * @param {number*} opts.amountPaid - amount from which to start (used for deserialization)
 */
function Client(opts) {
  this.network = opts.network || 'livenet';
  this.status = opts.status || Status.DISCONNECTED;
  this.expires = opts.expires;

  this.paymentKey = opts.paymentKey || new bitcore.key();
  this.commitmentKey = opts.commitmentKey || new bitcore.Key();

  this.amountPaid = opts.amountPaid || 0;

  if (opts.refundAddress) {
    this.refundAddress = opts.refundAddress;
  } else {
    this.refundKey = new bitcore.Key();
    this.refundAddress = createAddress(this.refundKey);
  }
}
inherits(Client, event.EventEmitter);

function createAddress(key) {
  var hash = bitcore.util.sha256ripe160(key.public);
  var version = bitcore.networks['livenet'].addressVersion;
  var addr = new bitcore.Address(version, hash);
  return addr.data;
}

/**
 * @enum Status
 */
var Status = {
  DISCONNECTED: 'disconnected',
  ESTABLISHED: 'established',
  ERRORED: 'errored',
  FINISHED: 'finished'
};

/**
 * @typedef PrivkeyAndInput
 * @property {string} input - hexa encoded input for a transaction
 * @property {string} privkey - hexa encoded private key to sign the input
 */

/**
 * Use this endpoint to provide a set of inputs to be spent in the channel.
 * If this isn't called before the channel is created, an address to pay will be provided.
 *
 * @param {PrivkeyAndInput[]} signedInputs
 */
// Client.prototype.useInputs = function useInputs(signedInputs) {
//   TODO
// };

// callback will receive (error, paymentAddress)
// client will emit payment info as Insight reports transactions
Client.prototype.setup = function setup(callback) {
};

// check that there are enough funds
Client.prototype.connect = function connect(opts, callback) {
};

Client.prototype.pay = function pay(satoshis, opts, callback) {
};

Client.prototype.sendError = function sendError(callback) {
};

Client.prototype.sendFinish = function sendFinish() {
};

function createCommitment(inputs, myKey, serverKey) {

  var outputPubkeys = [myKey.privKey.public, serverKey.public];
  return new bitcore.TransactionBuilder()
    .setUnspent(inputs)
    .setOutputs([bitcore.Script.createMultisig(2, outputPubkeys)])
    .sign(myKey.privKey)
    .build()
  ;
}

// TODO: Get inputs from commitment transaction (beware of tx malleability)
function createRefund(input, myKey, serverKey, address) {

  return new bitcore.TransactionBuilder()
    .setUnspent([input])
    .setOutputs([{
      amount: input.amount,
      address: address
    }])
    .sign(myKey.privKey)
    .build()
  ;
}
