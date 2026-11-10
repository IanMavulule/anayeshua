import { useTranslation } from 'react-i18next'
import PageHero from '../../components/common/PageHero'
import TodayMessageCard from '../../components/daily/TodayMessageCard'
import PageShell from '../../components/layout/PageShell'
import { usePageMeta } from '../../hooks/common/usePageMeta'

/**
 * Palavra do dia: mensagem sobre a visitação do Espírito Santo.
 * É a parte gratuita da plataforma.
 */
export default function DailyWordPage() {
  const { t } = useTranslation()
  usePageMeta(t('Word of the day'))

  return (
    <PageShell>
      <PageHero
        title={t('Word of the day')}
        lead={t('The message of the day about the visitation of the Holy Spirit.')}
        portrait="/brand/img/ana-floral.webp"
      />
      <div className="wrap daily">
        <TodayMessageCard />
      </div>
    </PageShell>
  )
}
