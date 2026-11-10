import crypto from 'node:crypto'

const KEY_LENGTH = 64
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1 }

// Formato: scrypt$<salt base64url>$<hash base64url>
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16)
  const hash = crypto.scryptSync(password, salt, KEY_LENGTH, SCRYPT_OPTIONS)
  return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltText, hashText] = String(stored || '').split('$')
  if (scheme !== 'scrypt' || !saltText || !hashText) return false
  const expected = Buffer.from(hashText, 'base64url')
  const actual = crypto.scryptSync(password, Buffer.from(saltText, 'base64url'), expected.length, SCRYPT_OPTIONS)
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected)
}

export function generatePassword(): string {
  return crypto.randomBytes(9).toString('base64url')
}
