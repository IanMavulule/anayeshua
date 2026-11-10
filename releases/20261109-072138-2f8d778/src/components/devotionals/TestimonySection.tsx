import { useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useSession } from '../../hooks/auth/useSession'
import { useTestimonies } from '../../hooks/community/useTestimonies'
import { loginUrl } from '../../utils/auth/loginDestination'
import { errorMessage } from '../../utils/format/errorMessage'
import { initialsOf } from '../../utils/format/text'
import Badge from '../ui/Badge'
import { Button } from '../ui/Button'
import EmptyState from '../ui/EmptyState'
import { TextAreaField } from '../ui/Field'

/** Testemunhos da aula actual, guardados no servidor e moderados no painel. */
export default function TestimonySection({ courseId, lessonId }: { courseId: string; lessonId: string }) {
  const { t } = useTranslation()
  const location = useLocation()
  const { user } = useSession()
  const { testimonies, share, saving, error } = useTestimonies(courseId, lessonId)
  const [text, setText] = useState('')
  const [status, setStatus] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const created = await share(text.trim())
    if (!created) return
    setText('')
    setStatus(
      created.status === 'pending'
        ? t('Thank you! Your testimony will appear after it is reviewed.')
        : t('Thank you! Your testimony has been published.'),
    )
  }

  const failure = errorMessage(error)

  return (
    <section className="testimonies" aria-labelledby="testimonies-title">
      <div className="section-head">
        <div>
          <h2 id="testimonies-title">{t('Testimonies for this lesson')}</h2>
          <p>{t('Share how this message spoke to you.')}</p>
        </div>
      </div>
      <div className="testimonies__layout">
        <div className="panel">
          {user ? (
            <form onSubmit={handleSubmit}>
              <TextAreaField
                id="testimony-text"
                label={t('Your testimony about this lesson')}
                hint={t('Published as {{name}}.', { name: user.name })}
                rows={4}
                minLength={3}
                maxLength={1200}
                required
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder={t('Tell us how this message spoke to you…')}
              />
              <Button type="submit" variant="primary" disabled={saving || !lessonId}>{t('Share testimony')}</Button>
              <div aria-live="polite">
                {status && <p className="form-success">{status}</p>}
                {failure && <p className="form-error">{failure}</p>}
              </div>
            </form>
          ) : (
            <p className="muted">
              <Link className="text-link" to={loginUrl(location.pathname + location.search)}>{t('Sign in')}</Link> {t('to share a testimony.')}
            </p>
          )}
        </div>
        <div className="testimonies__feed" aria-live="polite">
          {testimonies.length === 0 && <EmptyState title={t('There are no testimonies for this lesson yet.')} />}
          {testimonies.map((entry) => (
            <article key={entry.id} className="testimony">
              <span className="avatar" aria-hidden="true">{initialsOf(entry.name)}</span>
              <div>
                <p className="testimony__name">
                  <strong>{entry.name}</strong>
                  {entry.status === 'pending' && <Badge tone="warning">{t('Awaiting review')}</Badge>}
                </p>
                <p className="prose">{entry.text}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
