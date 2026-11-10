import { useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useSession } from '../../hooks/auth/useSession'
import { useQuestions } from '../../hooks/community/useQuestions'
import { loginUrl } from '../../utils/auth/loginDestination'
import { formatDate } from '../../utils/format/date'
import { errorMessage } from '../../utils/format/errorMessage'
import Badge from '../ui/Badge'
import { Button } from '../ui/Button'
import EmptyState from '../ui/EmptyState'
import { TextAreaField } from '../ui/Field'

type Props = {
  courseId: string
  lessonId: string
  lessonTitle: string
  /** A aula é Premium e o membro ainda não tem acesso. */
  locked: boolean
  onUnlock: () => void
}

/** Dúvidas sobre a aula actual: o membro pergunta aqui e vê as respostas da Ana Yeshua. */
export default function LessonQuestions({ courseId, lessonId, lessonTitle, locked, onUnlock }: Props) {
  const { t } = useTranslation()
  const location = useLocation()
  const { user } = useSession()
  const { questions, loading, ask, sending, error } = useQuestions(lessonId, Boolean(user))
  const [body, setBody] = useState('')
  const [sent, setSent] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSent(false)
    if (await ask(courseId, lessonId, body.trim())) {
      setBody('')
      setSent(true)
    }
  }

  const failure = errorMessage(error)

  return (
    <section className="lesson-questions" aria-labelledby="lesson-questions-title">
      <div className="section-head">
        <div>
          <h2 id="lesson-questions-title">{t('Questions about this lesson')}</h2>
          <p>{t('Ask Ana Yeshua about what you watched. Only you see your questions and the answers.')}</p>
        </div>
      </div>
      <div className="testimonies__layout">
        <div className="panel">
          {!user ? (
            <p className="muted">
              <Link className="text-link" to={loginUrl(location.pathname + location.search)}>{t('Sign in')}</Link> {t('to ask a question about this lesson.')}
            </p>
          ) : locked ? (
            <div className="lesson-questions__locked">
              <p className="muted">{t('Questions about Premium lessons are for members with access to the lesson.')}</p>
              <Button variant="primary" onClick={onUnlock}>{t('Unlock Premium')}</Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <TextAreaField
                id="lesson-question"
                label={t('Your question about “{{lesson}}”', { lesson: lessonTitle })}
                rows={4}
                minLength={3}
                maxLength={3000}
                required
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder={t('What would you like to understand better?')}
              />
              <Button type="submit" variant="primary" disabled={sending || body.trim().length < 3}>{t('Send question')}</Button>
              <div aria-live="polite">
                {sent && <p className="form-success">{t('Question sent. The answer will appear here and in “My questions”.')}</p>}
                {failure && <p className="form-error">{failure}</p>}
              </div>
            </form>
          )}
        </div>

        <div className="testimonies__feed" aria-live="polite">
          {user && !loading && questions.length === 0 && <EmptyState title={t('You have not asked anything about this lesson yet.')} />}
          {questions.map((question) => (
            <article key={question.id} className="post">
              <header>
                <h3>{t('Your question')}</h3>
                <time dateTime={question.createdAt}>{formatDate(question.createdAt)}</time>
              </header>
              <p className="prose">{question.body}</p>
              {question.status === 'answered' ? (
                <div className="answer">
                  <p className="answer__label">{t('Answer from Ana Yeshua')}<span>{formatDate(question.answeredAt)}</span></p>
                  <p className="prose">{question.answer}</p>
                </div>
              ) : (
                <Badge tone="warning">{t('Awaiting answer')}</Badge>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
