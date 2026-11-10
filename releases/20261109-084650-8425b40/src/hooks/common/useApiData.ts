import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, api } from '../../utils/api/apiClient'

/**
 * GET genérico com `{ data, loading, error, refetch }`. Cancela o pedido
 * anterior quando o URL muda ou o componente desmonta. `url = null` não pede nada.
 */
export function useApiData<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(Boolean(url))
  const [error, setError] = useState<string | null>(null)
  const controllerRef = useRef<AbortController | null>(null)

  const refetch = useCallback(async () => {
    if (!url) return null
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    setLoading(true)
    setError(null)
    try {
      const result = await api.get<T>(url, controller.signal)
      if (!controller.signal.aborted) setData(result)
      return result
    } catch (caught) {
      if ((caught as Error)?.name === 'AbortError') return null
      setError(caught instanceof ApiError ? caught.code : 'unknown_error')
      return null
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [url])

  useEffect(() => {
    void refetch()
    return () => controllerRef.current?.abort()
  }, [refetch])

  return { data, loading, error, refetch, setData }
}
