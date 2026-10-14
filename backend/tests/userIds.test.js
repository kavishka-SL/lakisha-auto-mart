const test = require('node:test');
const assert = require('node:assert/strict');
const { previewUserId, verifyUserIdPreview } = require('../userIds');
const { createSessionToken, readSessionToken } = require('../session');

test('user ID preview is generated for its role and cannot be altered', () => {
  const preview = previewUserId('TECHNICIAN');
  assert.match(preview.userId, /^TECH_[A-F0-9]{16}$/);
  assert.equal(verifyUserIdPreview('TECHNICIAN', preview.userId, preview.token), true);
  assert.equal(verifyUserIdPreview('MANAGER', preview.userId, preview.token), false);
  assert.equal(verifyUserIdPreview('TECHNICIAN', `${preview.userId}A`, preview.token), false);
});

test('manager session token rejects a modified signature', () => {
  const token = createSessionToken({ userId: 'MGR_TEST', role: 'MANAGER' });
  assert.equal(readSessionToken(token).userId, 'MGR_TEST');
  assert.equal(readSessionToken(`${token}changed`), null);
});
