import { PLANS, type PaymentMethod, type PlanId } from '../../config/plans.ts'
import type { Database } from '../../models/store/database.ts'
import type { Payment, PaymentStatus } from '../../models/entities.ts'
import { newPartnerTransactionId } from '../../models/paymentModel.ts'
import { extendSubscription } from '../../models/userModel.ts'
import { maskAccount, newId, nowIso } from '../../utils/ids.ts'
import { PaymentProviderError, type PaymentProvider, type ProviderStatus } from './providerTypes.ts'

const STATUS_FROM_PROVIDER: Record<ProviderStatus, PaymentStatus> = {
  PENDING: 'pending',
  SUCCESS: 'confirmed',
  FAILED: 'failed',
  EXPIRED: 'expired',
}

// Intervalo mínimo entre consultas de estado ao gateway para o mesmo pagamento.
const STATUS_POLL_INTERVAL_MS = 3000

export function createPaymentService(db: Database, provider: PaymentProvider) {
  /**
   * Aplica um estado do gateway. Idempotente e seguro em concorrência: a mudança
   * de estado é decidida dentro da transacção, com a linha bloqueada, por isso um
   * webhook e uma consulta em simultâneo nunca activam o plano duas vezes.
   */
  async function applyStatus(payment: Payment, status: ProviderStatus, reason: string | null = null): Promise<Payment> {
    const next = STATUS_FROM_PROVIDER[status]
    // Uma só transacção: o pagamento fica bloqueado (SELECT … FOR UPDATE) até o
    // plano estar activado, e se a activação falhar a mudança de estado é desfeita.
    const updated = await db.transaction(async (tx) => {
      let transitioned = false
      const saved = await tx.payments.update(payment.id, (current) => {
        if (current.status !== 'pending' || next === 'pending') return { ...current, lastCheckedAt: nowIso() }
        transitioned = true
        return {
          ...current,
          status: next,
          confirmedAt: next === 'confirmed' ? nowIso() : null,
          failureReason: next === 'confirmed' ? null : reason ?? next,
          lastCheckedAt: nowIso(),
        }
      })
      if (saved && transitioned && next === 'confirmed' && saved.userId) {
        await tx.users.update(saved.userId, (user) => ({
          ...user,
          subscription: extendSubscription(user.subscription, saved.plan, saved.id),
        }))
      }
      return saved
    })
    return updated ?? payment
  }

  return {
    providerName: provider.name,

    async checkout(userId: string, plan: PlanId, method: PaymentMethod, account: string): Promise<Payment> {
      const payment: Payment = {
        id: newId('pay'),
        userId,
        plan,
        amount: PLANS[plan].amount,
        method,
        accountMasked: maskAccount(account),
        status: 'pending',
        provider: provider.name,
        partnerTransactionId: newPartnerTransactionId(),
        providerRef: null,
        failureReason: null,
        createdAt: nowIso(),
        expiresAt: null,
        confirmedAt: null,
        lastCheckedAt: null,
      }
      await db.payments.insert(payment, 'start')
      try {
        const result = await provider.push({
          account,
          amount: payment.amount,
          method,
          partnerTransactionId: payment.partnerTransactionId,
        })
        const saved = (await db.payments.update(payment.id, { providerRef: result.providerRef, expiresAt: result.expiresAt }))!
        return result.status === 'PENDING' ? saved : applyStatus(saved, result.status)
      } catch (error) {
        const code = error instanceof PaymentProviderError ? error.code : 'provider_error'
        await db.payments.update(payment.id, { status: 'failed', failureReason: code })
        throw error
      }
    },

    /** Consulta o gateway quando o pagamento ainda está pendente. */
    async refresh(payment: Payment): Promise<Payment> {
      if (payment.status !== 'pending') return payment
      const last = payment.lastCheckedAt ? Date.parse(payment.lastCheckedAt) : 0
      if (Date.now() - last < STATUS_POLL_INTERVAL_MS) return payment
      try {
        return await applyStatus(payment, await provider.status(payment.partnerTransactionId))
      } catch {
        // Falha temporária do gateway: o pagamento continua pendente.
        return (await db.payments.update(payment.id, { lastCheckedAt: nowIso() })) ?? payment
      }
    },

    /** Evento de webhook já validado. */
    async handleWebhook(event: { paymentId: string; partnerTransactionId: string | null; status: ProviderStatus }): Promise<Payment | null> {
      const payment = await db.payments.find(
        (item) =>
          item.providerRef === event.paymentId ||
          item.partnerTransactionId === event.paymentId ||
          (event.partnerTransactionId !== null && item.partnerTransactionId === event.partnerTransactionId),
      )
      if (!payment) return null
      return applyStatus(payment, event.status)
    },

    applyStatus,
  }
}

export type PaymentService = ReturnType<typeof createPaymentService>
