import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useSession } from '../../hooks/auth/useSession'
import { useApiData } from '../../hooks/common/useApiData'
import type { CatalogLesson } from '../../types/api'
import { loginUrl } from '../../utils/auth/loginDestination'

type Props = {
  lesson: CatalogLesson
  /** A aula é Premium e o membro ainda não tem acesso. */
  locked: boolean
}

/**
 * Pontos de oração mostrados depois da aula. São só da aula (pedidos ao servidor,
 * com as regras de acesso do vídeo). Sem pontos, não aparece.
 */
export default function PrayerPoints({ lesson, locked }: Props) {
  const { t } = useTranslation()
  const location = useLocation()
  const { user } = useSession()
  const canRead = Boolean(user) && !locked && lesson.hasPrayerPoints
  const { data } = useApiData<{ prayerPoints: string[] }>(canRead ? `/api/lessons/${encodeURIComponent(lesson.id)}/prayer-points` : null)
  const points = canRead ? data?.prayerPoints ?? [] : []

  if (!lesson.hasPrayerPoints) return null

  return (
    <section id="prayer-points" className="prayer-points" aria-labelledby="prayer-points-title">
      <div className="section-head">
        <div>
          <h2 id="prayer-points-title">{t('Prayer points')}</h2>
          <p>{t('Take a moment to pray after the message.')}</p>
        </div>
      </div>
      <article className="panel panel--gold prayer-points__card">
        {!user ? (
          <p className="muted">
            <Link className="text-link" to={loginUrl(location.pathname + location.search)}>{t('Sign in')}</Link> {t('to see the prayer points of this lesson.')}
          </p>
        ) : locked ? (
          <p className="muted">{t('The prayer points of this lesson are for members with access to the lesson.')}</p>
        ) : (
          <ol className="prayer-points__list">
            {points.map((point, index) => <li key={index}>{point}</li>)}
          </ol>
        )}
      </article>
    </section>
  )
}
