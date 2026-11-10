import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { SessionUser } from '../../types/api'
import { api } from '../../utils/api/apiClient'
import { setLanguage } from '../../locales'

/**
 * Estado global da sessão (o equivalente aos atoms Recoil do semis-core).
 * A fonte de verdade é o cookie HttpOnly do servidor; aqui guardamos apenas
 * o utilizador devolvido por /api/auth/session.
 */
export interface SessionState {
  user: SessionUser | null
  loading: boolean
  setUser: (user: SessionUser | null) => void
  refresh: () => Promise<SessionUser | null>
}

export const SessionContext = createContext<SessionState | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)

  const setUser = useCallback((next: SessionUser | null) => {
    setUserState(next)
    if (next?.language) setLanguage(next.language)
  }, [])

  const refresh = useCallback(async () => {
    try {
      const { user: current } = await api.get<{ user: SessionUser | null }>('/api/auth/session')
      setUser(current)
      return current
    } catch {
      setUserState(null)
      return null
    } finally {
      setLoading(false)
    }
  }, [setUser])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const value = useMemo(() => ({ user, loading, setUser, refresh }), [user, loading, setUser, refresh])
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
