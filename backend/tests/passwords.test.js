const assert = require('node:assert/strict');
const test = require('node:test');
const { hashPassword, verifyPassword } = require('../passwords');

test('new passwords are salted and verified', async () => {
  const first = await hashPassword('example-password');
  const second = await hashPassword('example-password');
  assert.notEqual(first, second);
  assert.equal((await verifyPassword('example-password', first)).valid, true);
  assert.equal((await verifyPassword('wrong-password', first)).valid, false);
});

test('existing plain text passwords are accepted for migration', async () => {
  assert.deepEqual(await verifyPassword('old-password', 'old-password'), {
    valid: true,
    needsUpgrade: true
  });
  assert.equal((await verifyPassword('wrong-password', 'old-password')).valid, false);
});

test('malformed hashes are rejected', async () => {
  assert.equal((await verifyPassword('anything', 'scrypt$broken')).valid, false);
});
