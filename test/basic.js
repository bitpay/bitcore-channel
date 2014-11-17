describe('Simple Payment Channel example from README', function() {

  describe('a simple consumer', function() {

    it('correctly gets created', function() {
      var Consumer = require('bitcore-channel').Consumer;
      var serverPublicKey = '027f10e67bea70f847b3ab92c18776c6a97a78f84def158afc31fd98513d42912e';
      var refundAddress = 'mzCXqcsLBerwyoRZzBFQELHaJ1ZtBSxxe6';

      var consumer = new Consumer({
        network: 'testnet',
        serverPublicKey: serverPublicKey,
        refundAddress: refundAddress
      });
      // No assertions...? Just checking that no compile errors occur
    });

    it('processes an output', function() {
    });

    it('validates a refund correctly', function() {
    });

    it('has no false positive on refund validation', function() {
    });

    it('has no false negatives on refund validation', function() {
    });

    it('can increment a payment', function() {
    });
  });

  describe('a simple provider', function() {

    it('gets created correctly', function() {
    });

    it('signs a refund', function() {
    });

    it('validates a payment', function() {
    });

    it('outputs a transaction from the last payment transaction', function() {
    });
  });

  describe('interaction between provider and consumer', function() {

    it('works correctly', function() {
    });

  });
});
