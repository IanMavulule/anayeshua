import { useTranslation } from 'react-i18next'
import { useAuthActions, useSession } from '../../hooks/auth/useSession'
import type { Language } from '../../types/api'

/** Alterna entre português e inglês; com sessão, guarda a escolha no perfil. */
export default function LanguageSwitcher() {
  const { t, i18n } = useTranslation()
  const { user } = useSession()
  const { changeLanguage } = useAuthActions()
  const current: Language = i18n.language === 'en' ? 'en' : 'pt'

  return (
    <div className="lang-switch" role="group" aria-label={t('Language')}>
      {(['pt', 'en'] as const).map((language) => (
        <button
          key={language}
          type="button"
          className={current === language ? 'active' : ''}
          aria-pressed={current === language}
          onClick={() => void changeLanguage(language, Boolean(user))}
        >
          {language.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
