import type { User } from '../entities.ts'
import type { Queryable } from '../store/pgStore.ts'
import { isoInstant, TableRepository } from './tableRepository.ts'

/** Subscrição actual (tabela subscriptions, 1:1) como objecto, ou null. */
const subscriptionSql = `CASE WHEN s.user_id IS NULL THEN NULL ELSE json_build_object(
  'plan', s.plan,
  'startedAt', ${isoInstant('s.started_at')},
  'expiresAt', ${isoInstant('s.expires_at')},
  'paymentId', s.payment_id,
  'assistanceExpiresAt', ${isoInstant('s.assistance_expires_at')}
) END`

/** Membros e administração; a subscrição Premium vive em `subscriptions`. */
export const createUserRepository = (exec: Queryable) =>
  new TableRepository<User>(exec, {
    table: 'users',
    joins: 'LEFT JOIN subscriptions s ON s.user_id = t.id',
    columns: [
      { key: 'id', column: 'id' },
      { key: 'name', column: 'name' },
      { key: 'email', column: 'email' },
      { key: 'passwordHash', column: 'password_hash' },
      { key: 'googleId', column: 'google_id', optional: true },
      { key: 'role', column: 'role' },
      { key: 'status', column: 'status' },
      { key: 'language', column: 'language' },
      { key: 'subscription', column: '', read: subscriptionSql },
      { key: 'createdAt', column: 'created_at', read: isoInstant('t.created_at') },
      { key: 'lastLoginAt', column: 'last_login_at', read: isoInstant('t.last_login_at') },
    ],
    async afterWrite(exec, user) {
      const subscription = user.subscription
      if (!subscription) {
        await exec.query('DELETE FROM subscriptions WHERE user_id = $1', [user.id])
        return
      }
      await exec.query(
        `INSERT INTO subscriptions (user_id, plan, started_at, expires_at, assistance_expires_at, payment_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id) DO UPDATE SET
           plan = EXCLUDED.plan, started_at = EXCLUDED.started_at, expires_at = EXCLUDED.expires_at,
           assistance_expires_at = EXCLUDED.assistance_expires_at, payment_id = EXCLUDED.payment_id`,
        [
          user.id,
          subscription.plan,
          subscription.startedAt,
          subscription.expiresAt,
          // Ausente (registo antigo) segue a regra de assistanceEnd: o plano com assistência dá-a até ao fim.
          subscription.assistanceExpiresAt !== undefined
            ? subscription.assistanceExpiresAt || null
            : subscription.plan === '500'
              ? subscription.expiresAt
              : null,
          subscription.paymentId || null,
        ],
      )
    },
  })
