const { createHmac, randomBytes, timingSafeEqual } = require('crypto');

const secret = process.env.SESSION_SECRET || randomBytes(32).toString('hex');
const lifetimeMs = 12 * 60 * 60 * 1000;

function signature(payload) {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function createSessionToken(user) {
  const payload = Buffer.from(JSON.stringify({
    userId: user.userId,
    role: user.role,
    supplierId: user.supplierId || null,
    expires: Date.now() + lifetimeMs
  })).toString('base64url');
  return `${payload}.${signature(payload)}`;
}

function readSessionToken(token) {
  if (typeof token !== 'string') return null;
  const [payload, suppliedSignature] = token.split('.');
  if (!payload || !suppliedSignature) return null;
  const expected = Buffer.from(signature(payload));
  const actual = Buffer.from(suppliedSignature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof session.userId === 'string' && Number.isSafeInteger(session.expires) && session.expires > Date.now()
      ? session : null;
  } catch { return null; }
}

function requireRole(role) {
  return (req, res, next) => {
    const token = /^Bearer (.+)$/i.exec(req.headers.authorization || '')?.[1];
    const session = readSessionToken(token);
    if (!session || session.role !== role) return res.status(401).json({ error: `Sign in as ${role.toLowerCase().replace('_', ' ')} to continue.` });
    req.auth = session;
    next();
  };
}

module.exports = { createSessionToken, readSessionToken, requireRole };
