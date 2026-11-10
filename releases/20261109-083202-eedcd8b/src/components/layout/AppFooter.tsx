import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BRAND, SOCIAL_LINKS } from '../../utils/constants/brand'
import { ROUTES } from '../../utils/constants/routes'

/** Rodapé único do site e da área de membros. */
export default function AppFooter() {
  const { t } = useTranslation()
  const year = new Date().getFullYear()
  return (
    <footer className="app-footer">
      <div className="wrap app-footer__inner">
        <div className="app-footer__brand">
          <img src="/brand/logo-teal.webp" width={200} height={46} alt={BRAND.name} loading="lazy" />
          <p>{t('Prophetic ministry · Holy Spirit · Women and purpose')}</p>
        </div>
        <nav aria-label={t('Browse the site')}>
          <h2>{t('Browse')}</h2>
          <Link to={`${ROUTES.landing}#ministerio`}>{t('Ministry')}</Link>
          <Link to={ROUTES.devotionals}>{t('Devotionals')}</Link>
          <Link to={ROUTES.daily}>{t('Word of the day')}</Link>
          <Link to={`${ROUTES.landing}#eventos`}>{t('Events')}</Link>
        </nav>
        <nav aria-label={t('Follow the ministry')}>
          <h2>{t('Follow')}</h2>
          <a href={SOCIAL_LINKS.instagram} target="_blank" rel="noreferrer">Instagram</a>
          <a href={SOCIAL_LINKS.youtube} target="_blank" rel="noreferrer">YouTube</a>
          <a href={SOCIAL_LINKS.whatsapp} target="_blank" rel="noreferrer">WhatsApp</a>
          <a href={SOCIAL_LINKS.facebook} target="_blank" rel="noreferrer">Facebook</a>
        </nav>
      </div>
      <div className="wrap app-footer__legal">
        <span>© {year} {BRAND.name}</span>
        <span>{t('Video content from the official Siloé Betel Missions channel')}</span>
      </div>
    </footer>
  )
}
