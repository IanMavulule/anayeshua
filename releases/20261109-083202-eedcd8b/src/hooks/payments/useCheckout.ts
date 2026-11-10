import { useCallback, useEffect, useRef, useState } from 'react'
import { useSession } from '../auth/useSession'
import type { PaymentMethod, PlanId, PublicPayment, SessionUser } from '../../types/api'
import { ApiError, api } from '../../utils/api/apiClient'

const POLL_INTERVAL_MS = 3000
// O pedido push do iMaliWay expira em ~2 minutos; paramos um pouco depois.
const POLL_TIMEOUT_MS = 3 * 60 * 1000

/**
 * Fluxo push do iMaliWay: cria o pagamento, o cliente confirma no telemóvel e
 * a página consulta o estado até ficar confirmado, falhado ou expirado.
 */
export function useCheckout() {
  const { setUser } = useSession()
  const [payment, setPayment] = useState<PublicPayment | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<number | null>(null)
  const startedRef = useRef(0)

  const stop = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = null
  }, [])

  const poll = useCallback(
    async (id: string) => {
      try {
        const result = await api.get<{ payment: PublicPayment; user: SessionUser }>(`/api/payments/${encodeURIComponent(id)}`)
        setPayment(result.payment)
        if (result.payment.status !== 'pending') {
          setUser(result.user)
          return
        }
      } catch {
        /* falha temporária: volta a tentar */
      }
      if (Date.now() - startedRef.current > POLL_TIMEOUT_MS) {
        setPayment((current) => (current ? { ...current, status: 'expired' } : current))
        return
      }
      timerRef.current = window.setTimeout(() => void poll(id), POLL_INTERVAL_MS)
    },
    [setUser],
  )

  const start = useCallback(
    async (plan: PlanId, method: PaymentMethod, account: string) => {
      stop()
      setSubmitting(true)
      setError(null)
      try {
        const result = await api.post<{ payment: PublicPayment }>('/api/payments/checkout', { plan, method, account })
        setPayment(result.payment)
        startedRef.current = Date.now()
        timerRef.current = window.setTimeout(() => void poll(result.payment.id), POLL_INTERVAL_MS)
        return result.payment
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.code : 'unknown_error')
        return null
      } finally {
        setSubmitting(false)
      }
    },
    [poll, stop],
  )

  const reset = useCallback(() => {
    stop()
    setPayment(null)
    setError(null)
  }, [stop])

  useEffect(() => stop, [stop])

  return { start, reset, payment, submitting, error }
}
