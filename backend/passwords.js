const { randomBytes, scrypt, timingSafeEqual } = require('crypto');
const { promisify } = require('util');

const deriveKey = promisify(scrypt);
const KEY_LENGTH = 64;

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await deriveKey(password, salt, KEY_LENGTH);
  return `scrypt$${salt}$${key.toString('hex')}`;
}

async function verifyPassword(password, storedHash) {
  if (!storedHash) return { valid: false, needsUpgrade: false };

  if (!storedHash.startsWith('scrypt$')) {
    return { valid: password === storedHash, needsUpgrade: password === storedHash };
  }

  const [, salt, hexKey] = storedHash.split('$');
  if (!/^[0-9a-f]{32}$/.test(salt || '') || !/^[0-9a-f]{128}$/.test(hexKey || '')) {
    return { valid: false, needsUpgrade: false };
  }

  const storedKey = Buffer.from(hexKey, 'hex');
  const candidateKey = await deriveKey(password, salt, storedKey.length);
  return { valid: timingSafeEqual(storedKey, candidateKey), needsUpgrade: false };
}

module.exports = { hashPassword, verifyPassword };
