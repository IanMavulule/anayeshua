import type { Payment } from '../entities.ts'
import type { Queryable } from '../store/pgStore.ts'
import { isoInstant, TableRepository } from './tableRepository.ts'

/** Pagamentos; `userId` fica null se a conta for apagada (o histórico mantém-se). */
export const createPaymentRepository = (exec: Queryable) =>
  new TableRepository<Payment>(exec, {
    table: 'payments',
    columns: [
      { key: 'id', column: 'id' },
      { key: 'userId', column: 'user_id' },
      { key: 'plan', column: 'plan' },
      { key: 'amount', column: 'amount' },
      { key: 'method', column: 'method' },
      { key: 'accountMasked', column: 'account_masked' },
      { key: 'status', column: 'status' },
      { key: 'provider', column: 'provider' },
      { key: 'partnerTransactionId', column: 'partner_transaction_id' },
      { key: 'providerRef', column: 'provider_ref' },
      { key: 'failureReason', column: 'failure_reason' },
      { key: 'createdAt', column: 'created_at', read: isoInstant('t.created_at') },
      { key: 'expiresAt', column: 'expires_at', read: isoInstant('t.expires_at') },
      { key: 'confirmedAt', column: 'confirmed_at', read: isoInstant('t.confirmed_at') },
      { key: 'lastCheckedAt', column: 'last_checked_at', read: isoInstant('t.last_checked_at') },
    ],
  })
