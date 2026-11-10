import { useEffect, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthActions, useSession } from '../../hooks/auth/useSession'
import { BRAND } from '../../utils/constants/brand'
import { ROUTES } from '../../utils/constants/routes'
import { initialsOf } from '../../utils/format/text'
import { ButtonLink } from '../ui/Button'
import Icon from '../ui/Icon'
import LanguageSwitcher from './LanguageSwitcher'

/**
 * Cabeçalho único do site e da área de membros. Com `overlay` fica
 * transparente sobre o hero e ganha fundo quando a página desce.
 */
export default function AppHeader({ overlay = false }: { overlay?: boolean }) {
  const { t } = useTranslation()
  const { user } = useSession()
  const { logout } = useAuthActions()
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(!overlay)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    // Sem hero por baixo (ex.: ao abrir uma aula nos devocionais), o cabeçalho é sempre sólido.
    if (!overlay) {
      setScrolled(true)
      return
    }
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [overlay])

  useEffect(() => {
    document.body.classList.toggle('menu-open', menuOpen)
    return () => document.body.classList.remove('menu-open')
  }, [menuOpen])

  // Início é sempre a página pública; o Painel é a área de quem tem sessão.
  const links = user
    ? [
        { to: ROUTES.landing, label: t('Home') },
        { to: ROUTES.dashboard, label: t('Dashboard') },
        { to: ROUTES.devotionals, label: t('Devotionals') },
        { to: ROUTES.daily, label: t('Word of the day') },
      ]
    : [
        { to: ROUTES.landing, label: t('Home') },
        { to: `${ROUTES.landing}#ministerio`, label: t('Ministry') },
        { to: ROUTES.devotionals, label: t('Devotionals') },
        { to: ROUTES.daily, label: t('Word of the day') },
        { to: `${ROUTES.landing}#eventos`, label: t('Events') },
      ]

  async function signOut() {
    setMenuOpen(false)
    await logout()
    navigate(ROUTES.landing)
  }

  return (
    <header className={`app-header${scrolled ? ' is-solid' : ''}${menuOpen ? ' is-open' : ''}`}>
      <div className="wrap app-header__inner">
        <Link className="app-header__brand" to={ROUTES.landing} aria-label={`${BRAND.name}, ${t('home')}`}>
          <img src="/brand/logo-teal.webp" width={176} height={40} alt={BRAND.name} />
        </Link>

        <nav className="app-nav" aria-label={t('Main navigation')}>
          {links.map((link) =>
            link.to.includes('#') ? (
              // âncoras da página inicial não marcam estado activo
              <a key={link.to} href={link.to} className="app-nav__link" onClick={() => setMenuOpen(false)}>
                {link.label}
              </a>
            ) : (
              <NavLink key={link.to} to={link.to} end className="app-nav__link" onClick={() => setMenuOpen(false)}>
                {link.label}
              </NavLink>
            ),
          )}
          {user?.role === 'admin' && (
            <NavLink to={ROUTES.admin} className="app-nav__link app-nav__link--admin" onClick={() => setMenuOpen(false)}>
              {t('Admin')}
            </NavLink>
          )}
          {/* No telemóvel a conta (e o terminar sessão) também fica no menu. */}
          <div className="app-nav__account">
            {user ? (
              <>
                <p className="app-nav__who"><strong>{user.name}</strong> <span>{user.premium ? t('Premium') : t('Free account')}</span></p>
                {!user.premium && (
                  <Link to={`${ROUTES.payment}?plan=200`} className="app-nav__link" onClick={() => setMenuOpen(false)}>{t('Upgrade to Premium')}</Link>
                )}
                <Link to={ROUTES.questions} className="app-nav__link" onClick={() => setMenuOpen(false)}>{t('My questions')}</Link>
                <button type="button" className="app-nav__link app-nav__logout" onClick={() => void signOut()}>
                  <Icon name="logout" /> {t('Sign out')}
                </button>
              </>
            ) : (
              <Link to={ROUTES.login} className="app-nav__link" onClick={() => setMenuOpen(false)}>{t('Sign in')}</Link>
            )}
          </div>
          {/* No telemóvel o seletor sai do cabeçalho e fica no fim do menu. */}
          <div className="app-nav__lang">
            <span>{t('Language')}</span>
            <LanguageSwitcher />
          </div>
        </nav>

        <div className="app-header__actions">
          <LanguageSwitcher />
          {user ? (
            <details className="account-menu">
              <summary aria-label={t('Account')}>
                <span className="avatar" aria-hidden="true">{initialsOf(user.name)}</span>
              </summary>
              <div className="account-menu__panel">
                <strong>{user.name}</strong>
                <span className="muted">{user.premium ? t('Premium') : t('Free account')}</span>
                {!user.premium && <Link className="text-link" to={`${ROUTES.payment}?plan=200`}>{t('Upgrade to Premium')}</Link>}
                {/* As dúvidas fazem-se em cada aula; aqui fica só o acesso a todas as respostas. */}
                <Link className="text-link" to={ROUTES.questions}>{t('My questions')}</Link>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => void signOut()}>
                  <Icon name="logout" /> {t('Sign out')}
                </button>
              </div>
            </details>
          ) : (
            <>
              <ButtonLink to={ROUTES.login} variant="ghost" size="sm" className="hide-mobile">{t('Sign in')}</ButtonLink>
              <ButtonLink to={ROUTES.register} variant="primary" size="sm">{t('Start free')}</ButtonLink>
            </>
          )}
          <button type="button" className="icon-btn app-header__menu" aria-expanded={menuOpen} aria-label={t('Open navigation menu')} onClick={() => setMenuOpen((open) => !open)}>
            <Icon name={menuOpen ? 'close' : 'menu'} />
          </button>
        </div>
      </div>
    </header>
  )
}
