const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateInvoice, validateCharges } = require('../invoicePricing');

test('invoice includes parts, service charges, and tax without double counting', () => {
  const totals = calculateInvoice(
    [{ quantityUsed: 2, pricePerUnit: '100.25' }],
    [
      { chargeType: 'LABOR', amount: '300.00' },
      { chargeType: 'WORKSHOP', amount: '10.00' },
      { chargeType: 'CUSTOM_MODIFICATION', amount: '50.50' },
      { chargeType: 'OTHER', amount: '25.00' }
    ],
    10
  );
  assert.deepEqual(totals, {
    partsSubtotal: 200.5,
    laborCharge: 300,
    workshopFee: 10,
    otherCharges: 75.5,
    subtotal: 586,
    taxAmount: 58.6,
    grandTotal: 644.6
  });
});

test('a service with no spare parts can still have a payable invoice', () => {
  const totals = calculateInvoice([], [{ chargeType: 'CUSTOM_MODIFICATION', amount: '500.00' }], 0);
  assert.equal(totals.grandTotal, 500);
});

test('extra charges require a clear description and valid money amount', () => {
  assert.equal(validateCharges([{ chargeType: 'OTHER', description: 'Paint finish', amount: '250.00' }]), null);
  assert.notEqual(validateCharges([{ chargeType: 'OTHER', description: '', amount: '250.00' }]), null);
  assert.notEqual(validateCharges([{ chargeType: 'OTHER', description: 'Paint finish', amount: '250.123' }]), null);
  assert.notEqual(validateCharges([{ chargeType: 'OTHER', description: 'Paint finish', amount: '-2' }]), null);
});
