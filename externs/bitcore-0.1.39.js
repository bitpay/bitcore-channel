/**
 * @fileoverview Externs for bitcore 0.1.39
 *
 * @see https://github.com/bitpay/bitcore
 * @externs
 */

/**
 * @type Object
 */
var bitcore;

/**
 * @constructor
 */
bitcore.Key = function () {};

/**
 * @returns {bitcore.Key}
 */
bitcore.Key.generateSync = function() {};

/**
 * @param {buffer.Buffer|string} sigHash
 * @param {buffer.Buffer} signature
 * @returns {boolean}
 */
bitcore.Key.prototype.verifySignatureSync = function(sigHash, signature) {};

/**
 * @constructor
 */
bitcore.Transaction = function () {};

/**
 * @type string
 */
bitcore.Transaction.SIGHASH_ALL = '';

/**
 * @returns {buffer.Buffer}
 */
bitcore.Transaction.prototype.serialize = function () {};

/**
 * @returns {buffer.Buffer}
 */
bitcore.Transaction.prototype.getHash = function () {};

/**
 * TODO: Check if this can really be anything
 * @param {bitcore.Script} scriptPubKey
 * @param {number} position
 * @param {string} type
 * @returns {string}
 */
bitcore.Transaction.prototype.hashForSignature = function (scriptPubKey, position, type) {};

/**
 * @type Array.<bitcore.Transaction.Out>
 */
bitcore.Transaction.prototype.outs = [];

/**
 * @type Array.<bitcore.Transaction.In>
 */
bitcore.Transaction.prototype.ins = [];

/**
 * TODO: Type info
 * @constructor
 * @param {Object} info
 */
bitcore.Transaction.In = function (info) {};

/**
 * @returns {buffer.Buffer}
 */
bitcore.Transaction.In.prototype.getBuffer = function () {};

/**
 * TODO: Type info
 * @constructor
 * @param {Object} info
 */
bitcore.Transaction.Out = function (info) {};

/**
 * @returns {buffer.Buffer}
 */
bitcore.Transaction.Out.prototype.getBuffer = function () {};

/**
 * @constructor
 */
bitcore.TransactionBuilder = function () {};

/**
 * TODO: Type object
 * @param {Object} obj
 * @returns {bitcore.TransactionBuilder}
 */
bitcore.TransactionBuilder.fromObj = function(obj) {};

/**
 * @returns bitcore.Transaction
 */
bitcore.TransactionBuilder.prototype.build = function () {};

/**
 * @param {Array.<bitcore.WalletKey>} keys
 * @returns bitcore.TransactionBuilder
 */
bitcore.TransactionBuilder.prototype.sign = function (keys) {};

/**
 * @constructor
 * @param {Object} opts
 */
bitcore.Script = function (opts) {};

/**
 * @param {buffer.Buffer} buffer
 * @returns bitcore.Script
 */
bitcore.Script.createPubKeyHashOut = function (buffer) {};

/**
 * @param {number} required
 * @param {Array.<buffer.Buffer>} pubkeys
 * @returns bitcore.Script
 */
bitcore.Script.createMultisig = function (required, pubkeys) {};

/**
 * @method
 */
bitcore.Script.prototype.updateBuffer = function () {};

/**
 * @constructor
 * @param {string|buffer.Buffer} address
 * @param {string} network
 */
bitcore.Address = function (address, network) {};

/**
 * @param {buffer.Buffer} key
 * @param {string} network
 * @returns bitcore.Address
 */
bitcore.Address.fromPubKey = function (key, network) {};

/**
 * @param {buffer.Buffer} script
 * @param {string} network
 * @returns bitcore.Address
 */
bitcore.Address.fromScript = function (script, network) {};

/**
 * @returns buffer.Buffer
 */
bitcore.Address.prototype.payload = function () {};

/**
 * @constructor
 * @param {Object} opts
 */
bitcore.WalletKey = function(opts) {};
