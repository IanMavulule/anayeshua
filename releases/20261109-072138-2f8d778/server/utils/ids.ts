import crypto from 'node:crypto'

// Ids usados também como nomes de ficheiro de vídeo: só [A-Za-z0-9_-].
export const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/

export function isValidId(value: unknown): value is string {
  return typeof value === 'string' && ID_PATTERN.test(value)
}

export function newId(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}${crypto.randomBytes(4).toString('hex')}`
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function maskAccount(account: string): string {
  const digits = account.replace(/\s+/g, '')
  if (digits.length <= 4) return '****'
  return `${'*'.repeat(digits.length - 4)}${digits.slice(-4)}`
}
