import { useCallback, useContext, useState } from 'react'
import { SessionContext } from '../../schemas/session/sessionState'
import type { Language, SessionUser } from '../../types/api'
import { ApiError, api } from '../../utils/api/apiClient'
import { setLanguage } from '../../locales'

export function useSession() {
  const context = useContext(SessionContext)
  if (!context) throw new Error('useSession deve ser usado dentro de <SessionProvider>')
  return context
}

/** Acções de autenticação com estado de carregamento e erro (padrão dos hooks do semis-core). */
export function useAuthActions() {
  const { setUser } = useSession()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(
    async (action: () => Promise<{ user: SessionUser }>) => {
      setLoading(true)
      setError(null)
      try {
        const { user } = await action()
        setUser(user)
        return user
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.code : 'unknown_error')
        return null
      } finally {
        setLoading(false)
      }
    },
    [setUser],
  )

  const login = useCallback(
    (email: string, password: string) => run(() => api.post('/api/auth/login', { email, password })),
    [run],
  )

  const register = useCallback(
    (name: string, email: string, password: string, language: Language) =>
      run(() => api.post('/api/auth/register', { name, email, password, language })),
    [run],
  )

  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout')
    } finally {
      setUser(null)
    }
  }, [setUser])

  /** Muda a língua da interface e, com sessão, guarda-a no perfil. */
  const changeLanguage = useCallback(
    async (language: Language, signedIn: boolean) => {
      setLanguage(language)
      if (!signedIn) return
      try {
        const { user } = await api.patch<{ user: SessionUser }>('/api/auth/me', { language })
        setUser(user)
      } catch {
        /* a preferência local já foi aplicada */
      }
    },
    [setUser],
  )

  return { login, register, logout, changeLanguage, loading, error, setError }
}
