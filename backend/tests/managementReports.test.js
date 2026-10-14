const assert = require('node:assert/strict');
const test = require('node:test');
const { reportPeriod } = require('../routes/managementReports');

test('inventory report periods start on the correct calendar boundary', () => {
  assert.deepEqual(reportPeriod('daily', '2026-09-10'), { start: '2026-09-10', end: '2026-09-10' });
  assert.deepEqual(reportPeriod('weekly', '2026-09-30'), { start: '2026-09-28', end: '2026-10-04' });
  assert.deepEqual(reportPeriod('monthly', '2026-09-10'), { start: '2026-09-01', end: '2026-09-30' });
  assert.deepEqual(reportPeriod('yearly', '2025-06-10'), { start: '2025-01-01', end: '2025-12-31' });
});

test('inventory report dates reject invalid and future values', () => {
  assert.equal(reportPeriod('daily', '2026-02-30'), null);
  assert.equal(reportPeriod('daily', '2099-01-01'), null);
});
