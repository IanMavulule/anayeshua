import crypto from 'node:crypto'
import type { PaymentMethod } from '../config/plans.ts'

/** Regras de domínio dos pagamentos. */

// Prefixos móveis em Moçambique por carteira; iMali usa conta de 9 dígitos.
const METHOD_PREFIXES: Record<PaymentMethod, string[] | null> = {
  mpesa: ['84', '85'],
  emola: ['86', '87'],
  mkesh: ['82', '83'],
  imali: null,
}

/** Normaliza e valida o número de telemóvel/conta para o método escolhido. */
export function normalizeAccount(method: PaymentMethod, raw: string): string | null {
  let digits = String(raw || '').replace(/[\s-]/g, '')
  if (method !== 'imali') digits = digits.replace(/^(\+?258)/, '')
  if (!/^\d{9}$/.test(digits)) return null
  const prefixes = METHOD_PREFIXES[method]
  if (prefixes && !prefixes.some((prefix) => digits.startsWith(prefix))) return null
  return digits
}

/** partner_transaction_id do iMaliWay: exactamente 12 caracteres alfanuméricos. */
export function newPartnerTransactionId(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let id = ''
  for (const byte of crypto.randomBytes(12)) id += alphabet[byte % alphabet.length]
  return id
}

/** Janela durante a qual um pagamento pendente bloqueia um novo checkout. */
export const PENDING_PAYMENT_WINDOW_MS = 2 * 60 * 1000
