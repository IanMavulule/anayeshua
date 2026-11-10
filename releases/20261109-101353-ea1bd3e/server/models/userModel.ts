import { PLANS, type PlanId } from '../config/plans.ts'
import type { Subscription, User } from './entities.ts'

/** Regras de domínio do utilizador e da subscrição Premium. */

export function normalizeEmail(email: unknown): string {
  return String(email || '').trim().toLowerCase()
}

export function hasActiveSubscription(user: Pick<User, 'subscription' | 'role'>, now = Date.now()): boolean {
  if (user.role === 'admin') return true
  const subscription = user.subscription
  return Boolean(subscription && Date.parse(subscription.expiresAt) > now)
}

/** Fim da assistência; os registos antigos de um plano com assistência usam o fim da subscrição. */
function assistanceEnd(subscription: Subscription | null): number {
  if (!subscription) return 0
  if (subscription.assistanceExpiresAt !== undefined) {
    return subscription.assistanceExpiresAt ? Date.parse(subscription.assistanceExpiresAt) : 0
  }
  return PLANS[subscription.plan]?.assistance ? Date.parse(subscription.expiresAt) : 0
}

/** A assistência pessoal com Ana Yeshua é só para quem tem um plano que a inclui (500 MT). */
export function hasAssistance(user: Pick<User, 'subscription' | 'role'>, now = Date.now()): boolean {
  if (user.role === 'admin') return true
  return hasActiveSubscription(user, now) && assistanceEnd(user.subscription) > now
}

/**
 * Activa (ou prolonga) a subscrição. Se ainda houver tempo em curso, os dias
 * do novo plano somam-se à data de fim actual.
 */
export function extendSubscription(
  current: Subscription | null,
  plan: PlanId,
  paymentId: string | null,
  now = new Date(),
): Subscription {
  const currentEnd = current ? Date.parse(current.expiresAt) : 0
  const base = currentEnd > now.getTime() ? new Date(currentEnd) : now
  const expires = new Date(base.getTime() + PLANS[plan].days * 24 * 60 * 60 * 1000)
  // Um plano com assistência estende-a até ao novo fim; um plano sem assistência
  // mantém a que já estava paga (renovar com 200 MT não a corta antes do tempo).
  const previousAssistance = assistanceEnd(current)
  const assistanceExpiresAt = PLANS[plan].assistance
    ? expires.toISOString()
    : previousAssistance > now.getTime()
      ? new Date(previousAssistance).toISOString()
      : null
  return {
    plan,
    startedAt: current && currentEnd > now.getTime() ? current.startedAt : now.toISOString(),
    expiresAt: expires.toISOString(),
    paymentId,
    assistanceExpiresAt,
  }
}
