import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import PageHero from '../../components/common/PageHero'
import PageShell from '../../components/layout/PageShell'
import Badge from '../../components/ui/Badge'
import { ButtonLink } from '../../components/ui/Button'
import EmptyState from '../../components/ui/EmptyState'
import { usePageMeta } from '../../hooks/common/usePageMeta'
import { useQuestions } from '../../hooks/community/useQuestions'
import type { Question } from '../../types/api'
import { ROUTES } from '../../utils/constants/routes'
import { formatDate } from '../../utils/format/date'

/** Endereço da aula de uma dúvida, para voltar ao vídeo e à conversa. */
function lessonHref(question: Question): string | null {
  if (!question.courseId || !question.lessonId) return null
  const params = new URLSearchParams({ list: question.courseId, video: question.lessonId })
  return `${ROUTES.devotionals}?${params.toString()}`
}

/**
 * As minhas dúvidas: todas as perguntas do membro, cada uma ligada à aula onde
 * foi feita. As perguntas novas fazem-se dentro de cada aula.
 */
export default function QuestionsPage() {
  const { t } = useTranslation()
  usePageMeta(t('My questions'))
  const { questions, loading } = useQuestions()
  const open = questions.filter((question) => question.status === 'open').length

  return (
    <PageShell>
      <PageHero
        title={t('My questions')}
        lead={t('Questions are asked inside each lesson, below the video. Here you find all of them, with the answers from Ana Yeshua.')}
      />
      <div className="wrap questions">
        <aside className="panel panel--gold questions__form">
          <h2 className="panel__title">{t('Have a question?')}</h2>
          <p className="muted">{t('Open the lesson you are watching and write in “Questions about this lesson”. That way Ana Yeshua knows exactly which message you mean.')}</p>
          <ButtonLink to={ROUTES.devotionals} variant="primary" block>{t('Go to the devotionals')}</ButtonLink>
          {open > 0 && <p className="form-note">{t('{{count}} awaiting answer', { count: open })}</p>}
        </aside>

        <section className="questions__list" aria-labelledby="my-questions">
          <h2 className="post-list__title" id="my-questions">{t('All my questions')}</h2>
          {!loading && questions.length === 0 && <EmptyState title={t('You have not sent any questions yet.')} />}
          {questions.map((question) => {
            const href = lessonHref(question)
            return (
              <article key={question.id} className="post">
                <p className="question__lesson">
                  {href ? (
                    <Link className="text-link" to={href}>
                      {question.courseTitle} · {question.lessonTitle}
                    </Link>
                  ) : (
                    <span>{t('General question')} · {question.subject}</span>
                  )}
                </p>
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
            )
          })}
        </section>
      </div>
    </PageShell>
  )
}
