import { PaymentProviderError, type PaymentProvider } from './providerTypes.ts'

/**
 * Usado quando as credenciais iMaliWay não estão no .env: o checkout é recusado
 * com um código claro, em vez de simular um pagamento.
 */
export function createUnconfiguredProvider(missing: string[]): PaymentProvider {
  const fail = () =>
    new PaymentProviderError('payments_not_configured', `Pagamentos por configurar: ${missing.join(', ')}`, 503)
  return {
    name: 'unconfigured',
    async push() {
      throw fail()
    },
    async status() {
      throw fail()
    },
  }
}
