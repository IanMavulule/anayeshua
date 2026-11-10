import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BRAND } from '../../utils/constants/brand'
import { ROUTES } from '../../utils/constants/routes'
import LanguageSwitcher from './LanguageSwitcher'

/** Layout do login e registo: a luz e o retrato à esquerda, o formulário à direita. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  return (
    <main className="auth">
      <section className="auth__visual" aria-hidden="true">
        <div className="glow glow--auth" />
        <img className="auth__portrait" src="/brand/img/ana-hero.webp" width={774} height={1500} alt="" />
        <blockquote className="auth__quote">
          <p>{t('“Abide in me, and I in you.”')}</p>
          <cite>{t('John 15:4')}</cite>
        </blockquote>
      </section>
      <section className="auth__panel">
        <div className="auth__top">
          <Link to={ROUTES.landing} aria-label={`${BRAND.name}, ${t('home')}`}>
            <img src="/brand/logo-teal.webp" width={160} height={36} alt={BRAND.name} />
          </Link>
          <LanguageSwitcher />
        </div>
        <div className="auth__form">{children}</div>
        <Link className="auth__back muted" to={ROUTES.landing}>{t('Back to the site')}</Link>
      </section>
    </main>
  )
}
