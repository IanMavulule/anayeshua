import type { Payment } from '../models/entities.ts'

/** Pagamento tal como o cliente o vê (sem referências internas do gateway). */
export function toPublicPayment(payment: Payment) {
  const { userId: _user, providerRef: _ref, lastCheckedAt: _checked, ...rest } = payment
  return rest
}
