import { useTranslation } from 'react-i18next'
import { ROUTES } from '../../utils/constants/routes'
import Badge from '../ui/Badge'
import { ButtonLink } from '../ui/Button'
import Icon from '../ui/Icon'

/** O que a conta gratuita, o Premium e o Premium com assistência incluem. */
export default function PlansSection() {
  const { t } = useTranslation()
  const free = [t('Message of the day'), t('Prayer points'), t('Free series and sample lessons')]
  const premium = [t('Everything in the free account'), t('All videos in every series'), t('Notes from every lesson')]
  const assistance = [
    t('Everything in Premium'),
    t('Personal assistance with Ana Yeshua'),
    t('Book your session at the available times'),
  ]

  return (
    <section className="wrap plans" aria-labelledby="plans-title">
      <div className="section-head">
        <div>
          <h2 id="plans-title">{t('Walk with us')}</h2>
          <p>{t('Start for free and unlock the full teaching when you are ready.')}</p>
        </div>
      </div>
      <div className="plans__grid">
        <article className="panel plan-tier">
          <h3 className="panel__title">{t('Free account')}</h3>
          <p className="panel__meta">{t('0 MT, no time limit')}</p>
          <ul className="check-list">
            {free.map((item) => <li key={item}><Icon name="check" />{item}</li>)}
          </ul>
          <ButtonLink to={ROUTES.register} variant="secondary" block>{t('Create a free account')}</ButtonLink>
        </article>
        <article className="panel panel--gold plan-tier">
          <h3 className="panel__title">{t('Premium')}</h3>
          <p className="panel__meta">{t('200 MT for 30 days')}</p>
          <ul className="check-list">
            {premium.map((item) => <li key={item}><Icon name="check" />{item}</li>)}
          </ul>
          <ButtonLink to={`${ROUTES.payment}?plan=200`} variant="primary" block>{t('Choose Premium')}</ButtonLink>
        </article>
        <article className="panel panel--gold plan-tier plan-tier--featured">
          <h3 className="panel__title">{t('Premium with assistance')}</h3>
          <p className="panel__meta">{t('500 MT for 30 days')}</p>
          <ul className="check-list">
            {assistance.map((item) => <li key={item}><Icon name="check" />{item}</li>)}
          </ul>
          <ButtonLink to={`${ROUTES.payment}?plan=500`} variant="primary" block>{t('Choose assistance')}</ButtonLink>
        </article>
      </div>
    </section>
  )
}
