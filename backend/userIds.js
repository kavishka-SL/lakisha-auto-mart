const { createHmac, randomBytes, timingSafeEqual } = require('crypto');

const prefixes = Object.freeze({
  TECHNICIAN: 'TECH',
  SERVICE_ADVISOR: 'ADV',
  OFFICE_MANAGEMENT: 'OFF',
  MANAGER: 'MGR',
  SUPPLIER: 'SUP'
});

const signingKey = process.env.SESSION_SECRET || randomBytes(32);
const previewLifetimeMs = 60 * 60 * 1000;

function previewUserId(role) {
  const prefix = prefixes[role];
  if (!prefix) return null;
  const userId = `${prefix}_${randomBytes(8).toString('hex').toUpperCase()}`;
  const expires = Date.now() + previewLifetimeMs;
  const signature = createHmac('sha256', signingKey)
    .update(`${role}:${userId}:${expires}`).digest('hex');
  return { userId, token: `${expires}.${signature}` };
}

function verifyUserIdPreview(role, userId, token) {
  if (!prefixes[role] || typeof userId !== 'string' || typeof token !== 'string' ||
      !new RegExp(`^${prefixes[role]}_[A-F0-9]{16}$`).test(userId)) return false;
  const [expiresText, signature] = token.split('.');
  const expires = Number(expiresText);
  if (!Number.isSafeInteger(expires) || expires < Date.now() || expires > Date.now() + previewLifetimeMs ||
      !/^[a-f0-9]{64}$/.test(signature || '')) return false;
  const expected = createHmac('sha256', signingKey)
    .update(`${role}:${userId}:${expires}`).digest();
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}

module.exports = { previewUserId, verifyUserIdPreview };
