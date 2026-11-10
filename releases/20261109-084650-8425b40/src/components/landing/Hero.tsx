import { useTranslation } from 'react-i18next'
import { useSession } from '../../hooks/auth/useSession'
import { ROUTES } from '../../utils/constants/routes'
import { ButtonLink } from '../ui/Button'

/** Hero da página inicial: a Ana de braços abertos dentro da luz. */
export default function Hero() {
  const { t } = useTranslation()
  const { user } = useSession()
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="wrap hero__inner">
        <div className="hero__copy">
          <h1 className="display" id="hero-title">{t('A journey of intimacy with the Holy Spirit')}</h1>
          <p className="lead">{t('The Word of God, the prophetic ministry and prayer, so that every woman may know her identity in God and live her purpose.')}</p>
          <div className="hero__actions">
            {user ? (
              <ButtonLink to={ROUTES.dashboard} variant="primary">{t('Go to my area')}</ButtonLink>
            ) : (
              <ButtonLink to={ROUTES.register} variant="primary">{t('Create a free account')}</ButtonLink>
            )}
            <ButtonLink to={ROUTES.devotionals} variant="secondary">{t('Watch the devotionals')}</ButtonLink>
          </div>
        </div>
        <div className="hero__figure" aria-hidden="true">
          <div className="glow glow--hero" />
          <img src="/brand/img/ana-open.webp" width={1202} height={1200} alt="" fetchPriority="high" />
        </div>
      </div>
    </section>
  )
}
