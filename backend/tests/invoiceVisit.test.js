const test = require('node:test');
const assert = require('node:assert/strict');
const { groupInvoiceWork } = require('../invoiceVisit');

const repair = {
  jobCardId: 'REPAIR', requestId: 'VISIT', jobStatus: 'COMPLETED',
  requestStatus: 'COMPLETED', qualityCheckStatus: 'PASS',
  createdDate: '2026-10-14T09:00:00', registrationNo: 'ABC-1234'
};
const modification = {
  ...repair, jobCardId: 'MOD', stageName: 'Custom Mod', createdDate: '2026-10-14T10:00:00'
};

test('a ready repair visit with modification work has one pending payment', () => {
  const result = groupInvoiceWork([repair, modification]);
  assert.equal(result.pending.length, 1);
  assert.equal(result.pending[0].jobCardId, 'REPAIR');
  assert.equal(result.pending[0].jobCount, 2);
});

test('payment waits for modification work and release approval', () => {
  assert.equal(groupInvoiceWork([repair, { ...modification, jobStatus: 'IN_PROGRESS' }]).pending.length, 0);
  assert.equal(groupInvoiceWork([{ ...repair, qualityCheckStatus: 'NOT_CHECKED' }, modification]).pending.length, 0);
  assert.equal(groupInvoiceWork([{ ...repair, pendingModifications: 1 }, modification]).pending.length, 0);
});

test('one invoice covering both jobs appears only once in paid work', () => {
  const paid = { invoiceId: 'INV_1', billingJobId: 'REPAIR', grandTotal: 1500, issueDate: '2026-10-14T12:00:00' };
  const result = groupInvoiceWork([{ ...repair, ...paid }, { ...modification, ...paid }]);
  assert.equal(result.pending.length, 0);
  assert.equal(result.completed.length, 1);
});

test('an earlier paid repair is kept separate from later unpaid modifications', () => {
  const result = groupInvoiceWork([
    { ...repair, invoiceId: 'OLD', billingJobId: 'REPAIR', grandTotal: 1000 },
    modification,
    { ...modification, jobCardId: 'MOD_2', createdDate: '2026-10-14T11:00:00' }
  ]);
  assert.equal(result.pending.length, 1);
  assert.equal(result.pending[0].jobCount, 2);
  assert.equal(result.pending[0].previouslyPaid, 1000);
});
