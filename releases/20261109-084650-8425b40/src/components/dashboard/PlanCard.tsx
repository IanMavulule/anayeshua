import { useTranslation } from 'react-i18next'
import type { SessionUser } from '../../types/api'
import { ROUTES } from '../../utils/constants/routes'
import { formatDate } from '../../utils/format/date'
import Badge from '../ui/Badge'
import { ButtonLink } from '../ui/Button'

/**
 * Estado do plano do membro: Premium (com ou sem assistência) e data de fim,
 * ou convite para subscrever. Quem tem o Premium de 200 MT vê como juntar a assistência.
 */
export default function PlanCard({ user }: { user: SessionUser }) {
  const { t } = useTranslation()
  const isAdmin = user.role === 'admin'
  const premiumUntil = isAdmin ? null : user.subscription?.expiresAt ?? null
  const assistanceUntil = isAdmin ? null : user.subscription?.assistanceExpiresAt ?? null
  const renewPlan = user.assistance ? '500' : '200'

  return (
    <article className="panel plan-card">
      <p className="plan-card__label">{t('Your plan')}</p>
      {user.premium ? (
        <>
          <h3 className="panel__title">
            {user.assistance ? t('Premium with assistance') : t('Premium')} <Badge tone="gold">{t('Active')}</Badge>
          </h3>
          <p className="muted">
            {premiumUntil ? t('Active until {{date}}', { date: formatDate(premiumUntil) }) : t('Full access as administrator')}
            {user.assistance && assistanceUntil && assistanceUntil !== premiumUntil && (
              <> · {t('Assistance until {{date}}', { date: formatDate(assistanceUntil) })}</>
            )}
          </p>
          {premiumUntil && <ButtonLink to={`${ROUTES.payment}?plan=${renewPlan}`} variant="secondary" size="sm">{t('Renew plan')}</ButtonLink>}
          {!user.assistance && (
            <ButtonLink to={`${ROUTES.payment}?plan=500`} variant="ghost" size="sm">{t('Add assistance with Ana Yeshua')}</ButtonLink>
          )}
        </>
      ) : (
        <>
          <h3 className="panel__title">{t('Free')}</h3>
          <p className="muted">{t('Follow the daily word, the free series and the sample lessons. Premium unlocks all videos, and the 500 MT plan adds assistance with Ana Yeshua.')}</p>
          <ButtonLink to={`${ROUTES.payment}?plan=200`} variant="primary" size="sm">{t('Upgrade to Premium')}</ButtonLink>
        </>
      )}
    </article>
  )
}
