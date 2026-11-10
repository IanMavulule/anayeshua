import { useTranslation } from 'react-i18next'
import type { CatalogLesson, CatalogSeries } from '../../types/api'
import Icon from '../ui/Icon'

type Props = {
  series: CatalogSeries[]
  currentSeriesId: string
  currentLessonId: string
  openGroups: Record<string, boolean>
  premium: boolean
  onToggleGroup: (id: string, open: boolean) => void
  onSelect: (series: CatalogSeries, lesson: CatalogLesson) => void
  /** Abre a aula e mostra os seus pontos de oração. */
  onPrayerPoints: (series: CatalogSeries, lesson: CatalogLesson) => void
}

/** Lista de séries e aulas ao lado do player. */
export default function SeriesOutline({ series, currentSeriesId, currentLessonId, openGroups, premium, onToggleGroup, onSelect, onPrayerPoints }: Props) {
  const { t } = useTranslation()
  return (
    <div id="playlist-outline" className="outline">
      {series.map((item) => (
        <details
          key={item.id}
          className="outline__group"
          open={Boolean(openGroups[item.id])}
          onToggle={(event) => onToggleGroup(item.id, event.currentTarget.open)}
        >
          <summary>
            <span>{item.title}</span>
            <small>{t('{{count}} lessons', { count: item.lessons.length })}</small>
          </summary>
          <ol className="outline__list">
            {item.lessons.map((lesson, index) => {
              const locked = lesson.premium && !premium
              const active = currentSeriesId === item.id && currentLessonId === lesson.id
              return (
                <li key={lesson.id}>
                  <button
                    type="button"
                    className={`outline__item${locked ? ' is-locked' : ''}${active ? ' is-active' : ''}`}
                    aria-pressed={active}
                    onClick={() => onSelect(item, lesson)}
                  >
                    <span className="outline__number">{locked ? <Icon name="lock" /> : index + 1}</span>
                    <span className="outline__copy">
                      <strong>{lesson.title}</strong>
                      <small>
                        {lesson.premium ? t('Premium') : t('Free')}
                        {!lesson.available && `, ${t('coming soon')}`}
                      </small>
                    </span>
                    {active && <Icon name="play" filled />}
                  </button>
                  {lesson.hasPrayerPoints && (
                    <button
                      type="button"
                      className={`outline__sub${active ? ' is-active' : ''}`}
                      onClick={() => onPrayerPoints(item, lesson)}
                    >
                      <Icon name={locked ? 'lock' : 'sparkle'} />
                      <span>{t('Prayer points')}</span>
                    </button>
                  )}
                </li>
              )
            })}
          </ol>
        </details>
      ))}
    </div>
  )
}
