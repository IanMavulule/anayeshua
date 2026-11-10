import { useTranslation } from 'react-i18next'
import type { CatalogSeries } from '../../types/api'
import { categoryLabel } from '../../utils/constants/categories'
import Badge from '../ui/Badge'
import Poster from '../ui/Poster'

/** Cartaz de uma série: categoria, número de aulas e se é gratuita ou tem aulas de amostra. */
export default function SeriesPoster({ series, onOpen }: { series: CatalogSeries; onOpen: (series: CatalogSeries) => void }) {
  const { t } = useTranslation()
  const lessons = series.lessons.length
  const free = series.lessons.filter((lesson) => !lesson.premium).length
  return (
    <Poster
      image={series.poster}
      title={series.title}
      meta={[categoryLabel(series.category), t('{{count}} lessons', { count: lessons })].filter(Boolean).join(', ')}
      badges={
        series.access === 'free' ? <Badge tone="success">{t('Free series')}</Badge>
          : free > 0 ? <Badge tone="gold">{t('Free lesson')}</Badge>
            : undefined
      }
      onClick={() => onOpen(series)}
      label={`${t('Open devotional')} ${series.title}`}
    />
  )
}
