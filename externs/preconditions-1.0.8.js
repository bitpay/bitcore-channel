/**
 * @fileoverview Externs for Precondition 1.0.8
 *
 * @see https://github.com/corybill/Preconditions
 * @externs
 */

/**
 * @constructor
 */
var preconditions = function() {};

/**
 * @returns preconditions
 */
preconditions.singleton = function() {};

/**
 * @param {*} arg
 * @param {string=} msg
 */
preconditions.prototype.checkArgument = function(arg, msg) {};

/**
 * @param {*} arg
 * @param {string=} msg
 */
preconditions.prototype.checkState = function(arg, msg) {};
