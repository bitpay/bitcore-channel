// Setup errors
require('./lib/errors');

module.exports = {
  Consumer: require('./lib/Consumer'),
  Provider: require('./lib/Provider'),
  Transactions: {
    Commitment: require('./lib/transactions/Commitment'),
    Refund: require('./lib/transactions/Refund'),
    Payment: require('./lib/transactions/Payment')
  }
};
