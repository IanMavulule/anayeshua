import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApiData } from '../../hooks/common/useApiData'

type GoogleId = {
  initialize(options: { client_id: string; callback: (response: { credential?: string }) => void; ux_mode?: 'popup'; auto_select?: boolean; use_fedcm_for_button?: boolean }): void
  renderButton(element: HTMLElement, options: Record<string, string | number>): void
}
declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } }
  }
}

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client'
let scriptPromise: Promise<void> | null = null

/** Carrega o script da Google uma só vez (e volta a tentar se falhar). */
function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve()
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => {
      scriptPromise = null
      script.remove()
      reject(new Error('google_script_failed'))
    }
    document.head.appendChild(script)
  })
  return scriptPromise
}

type Props = {
  /** Recebe o ID token da Google para o enviar ao servidor. */
  onCredential: (credential: string) => void
  disabled?: boolean
}

/**
 * Botão oficial "Continuar com Google" (Google Identity Services). Só aparece
 * quando o servidor tem GOOGLE_CLIENT_ID; sem ele, a página fica como estava.
 */
export default function GoogleSignIn({ onCredential, disabled }: Props) {
  const { t, i18n } = useTranslation()
  const { data } = useApiData<{ clientId: string | null }>('/api/auth/google/config')
  const clientId = data?.clientId ?? null
  const holder = useRef<HTMLDivElement>(null)
  const callback = useRef(onCredential)
  callback.current = onCredential
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!clientId) return
    let cancelled = false
    loadGoogleScript()
      .then(() => {
        const element = holder.current
        const google = window.google?.accounts.id
        if (cancelled || !element || !google) return
        google.initialize({
          client_id: clientId,
          ux_mode: 'popup',
          use_fedcm_for_button: true,
          callback: (response) => {
            if (response.credential) callback.current(response.credential)
          },
        })
        element.replaceChildren()
        google.renderButton(element, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          logo_alignment: 'center',
          width: Math.min(400, Math.max(220, Math.round(element.getBoundingClientRect().width))),
          locale: i18n.language === 'en' ? 'en' : 'pt-PT',
        })
        setFailed(false)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [clientId, i18n.language])

  if (!clientId) return null

  return (
    <div className="google-signin" aria-busy={disabled || undefined}>
      <p className="google-signin__divider"><span>{t('or')}</span></p>
      <div ref={holder} className="google-signin__button" style={disabled ? { pointerEvents: 'none', opacity: 0.6 } : undefined} />
      {failed && <p className="muted google-signin__note">{t('Google sign-in is unavailable right now.')}</p>}
    </div>
  )
}
