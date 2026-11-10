import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import TodayMessageCard from '../../components/daily/TodayMessageCard'
import PlanCard from '../../components/dashboard/PlanCard'
import SeriesPoster from '../../components/devotionals/SeriesPoster'
import PageShell from '../../components/layout/PageShell'
import { ButtonLink } from '../../components/ui/Button'
import Icon from '../../components/ui/Icon'
import Loader from '../../components/ui/Loader'
import Rail from '../../components/ui/Rail'
import { useSession } from '../../hooks/auth/useSession'
import { useCatalog } from '../../hooks/catalog/useCatalog'
import { usePageMeta } from '../../hooks/common/usePageMeta'
import type { CatalogSeries } from '../../types/api'
import { categoryLabel } from '../../utils/constants/categories'
import { ROUTES } from '../../utils/constants/routes'

/** Início do membro: série em destaque, o estado do plano, a palavra do dia e as filas por categoria. */
export default function DashboardPage() {
  const { t } = useTranslation()
  usePageMeta(t('Dashboard'))
  const navigate = useNavigate()
  const { user } = useSession()
  const { series, categories: categoryOptions, loading } = useCatalog()
  const featured = series.find((item) => item.featured) ?? series[0]
  const firstName = user?.name.split(' ')[0] ?? ''
  const open = (item: CatalogSeries) => navigate(`${ROUTES.devotionals}?list=${item.id}`)
  // Uma fila por categoria configurada; com o campo desligado, uma só fila com tudo.
  const categories = categoryOptions.map((option) => option.id).filter((id) => series.some((item) => item.category === id))
  const uncategorised = series.filter((item) => !categories.includes(item.category))

  return (
    <PageShell overlayHeader>
      <section className="billboard" aria-labelledby="billboard-title">
        {featured && <img className="billboard__image" src={featured.poster} width={1400} height={788} alt="" fetchPriority="high" />}
        <div className="wrap billboard__inner">
          <p className="kicker">{t('Welcome, {{name}}', { name: firstName })}</p>
          {featured ? (
            <>
              <h1 className="display" id="billboard-title">{featured.title}</h1>
              <p className="billboard__meta">{categoryLabel(featured.category)}, {t('{{count}} lessons', { count: featured.lessons.length })}</p>
              <p className="lead">{featured.description}</p>
              <div className="hero__actions">
                <ButtonLink to={`${ROUTES.devotionals}?list=${featured.id}`} variant="primary"><Icon name="play" filled />{t('Watch now')}</ButtonLink>
                <ButtonLink to={ROUTES.devotionals} variant="secondary">{t('See library')}</ButtonLink>
              </div>
            </>
          ) : (
            <h1 className="display" id="billboard-title">{t('Your space')}</h1>
          )}
        </div>
      </section>

      <section className="wrap overview" aria-label={t('Your space')}>
        {user && <PlanCard user={user} />}
        <TodayMessageCard compact />
        <article className="panel">
          <p className="plan-card__label">{t('Community')}</p>
          <h3 className="panel__title">{t('Talk to the prophetess')}</h3>
          <p className="muted">{t('Ask about each lesson below the video; the answers are gathered in “My questions”.')}</p>
          <ButtonLink to={ROUTES.questions} variant="secondary" size="sm">{t('My questions')}</ButtonLink>
        </article>
      </section>

      <div className="wrap rails">
        {loading && <Loader />}
        {categories.map((category) => (
          <Rail key={category} id={`rail-${category}`} title={categoryLabel(category)}>
            {series.filter((item) => item.category === category).map((item) => (
              <SeriesPoster key={item.id} series={item} onOpen={open} />
            ))}
          </Rail>
        ))}
        {uncategorised.length > 0 && (
          <Rail id="rail-all" title={categories.length ? t('More devotionals') : t('Devotionals')}>
            {uncategorised.map((item) => <SeriesPoster key={item.id} series={item} onOpen={open} />)}
          </Rail>
        )}
      </div>
    </PageShell>
  )
}
