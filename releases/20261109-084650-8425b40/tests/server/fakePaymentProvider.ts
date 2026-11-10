import type { PaymentProvider, ProviderStatus } from '../../server/services/payments/providerTypes.ts'

/**
 * Fornecedor falso, só para os testes: imita o fluxo push do iMaliWay sem dinheiro
 * real. A transacção fica PENDING durante `confirmAfterMs` e depois SUCCESS.
 * Uma conta terminada em "0000" simula um pagamento recusado.
 */
export function createFakePaymentProvider(confirmAfterMs = 4000): PaymentProvider {
  const pending = new Map<string, { createdAt: number; fails: boolean }>()

  return {
    name: 'test',

    async push({ account, partnerTransactionId }) {
      pending.set(partnerTransactionId, { createdAt: Date.now(), fails: account.endsWith('0000') })
      return {
        providerRef: `SIM-${partnerTransactionId}`,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
      }
    },

    async status(partnerTransactionId): Promise<ProviderStatus> {
      const entry = pending.get(partnerTransactionId)
      if (!entry) return 'EXPIRED'
      if (Date.now() - entry.createdAt < confirmAfterMs) return 'PENDING'
      return entry.fails ? 'FAILED' : 'SUCCESS'
    },
  }
}
