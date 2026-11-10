import { useTranslation } from 'react-i18next'
import { useTodayMessage } from '../../hooks/community/usePosts'
import { ROUTES } from '../../utils/constants/routes'
import { formatDate } from '../../utils/format/date'
import { truncate } from '../../utils/format/text'
import { ButtonLink } from '../ui/Button'
import Loader from '../ui/Loader'

/** Mensagem do dia sobre a visitação do Espírito Santo. */
export default function TodayMessageCard({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation()
  const { post, loading } = useTodayMessage()
  if (loading) return <article className={`panel panel--gold today${compact ? ' today--compact' : ''}`} aria-busy="true"><Loader /></article>

  return (
    <article className={`panel panel--gold today${compact ? ' today--compact' : ''}`}>
      <p className="today__label">{t('Message of the day')}{post && <span>{formatDate(post.publishAt)}</span>}</p>
      {post ? (
        <>
          <h2 className="today__title">{post.title}</h2>
          {post.locked ? (
            <p className="today__body muted">{t('This message is Premium.')}</p>
          ) : (
            <p className="today__body">{compact ? truncate(post.body, 220) : post.body}</p>
          )}
        </>
      ) : (
        <p className="today__body muted">{t('The message of the day will be published here soon.')}</p>
      )}
      {compact && <ButtonLink to={ROUTES.daily} variant="ghost" size="sm" className="today__more">{t('Read the word of the day')}</ButtonLink>}
    </article>
  )
}
