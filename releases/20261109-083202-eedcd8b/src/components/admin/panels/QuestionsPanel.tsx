import { useState } from 'react'
import { ROUTES } from '../../../utils/constants/routes'
import { useAdmin } from '../AdminContext'
import Icon from '../icons'
import { fmtDate, initials, type Question } from '../adminData'

type Filter = 'open' | 'answered' | 'all'

/** Endereço da aula na plataforma, para a Ana ver o vídeo a que a dúvida se refere. */
function lessonHref(question: Question): string | null {
  if (!question.courseId || !question.lessonId) return null
  return `${ROUTES.devotionals}?${new URLSearchParams({ list: question.courseId, video: question.lessonId }).toString()}`
}

/** Dúvidas enviadas à profetisa e feedback sobre a assistência. */
export default function QuestionsPanel() {
  const { data, panel, answerQuestion, deleteQuestion, deleteFeedback } = useAdmin()
  const [filter, setFilter] = useState<Filter>('open')
  const [course, setCourse] = useState<string>('all')
  const [answers, setAnswers] = useState<Record<string, string>>({})

  // Cursos que têm dúvidas, para o filtro; "general" agrupa as antigas sem aula.
  const courseOptions = Array.from(
    new Map(data.questions.filter((q) => q.courseId).map((q) => [q.courseId as string, q.courseTitle || q.courseId])).entries(),
  ).sort((a, b) => String(a[1]).localeCompare(String(b[1])))
  const hasGeneral = data.questions.some((q) => !q.courseId)
  const inCourse = (question: Question) => course === 'all' || (course === 'general' ? !question.courseId : question.courseId === course)

  const questions = data.questions
    .filter((question) => inCourse(question) && (filter === 'all' || question.status === filter))
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const count = (value: Filter) => data.questions.filter((question) => inCourse(question) && (value === 'all' || question.status === value)).length
  const feedback = data.feedback.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const average = feedback.length ? (feedback.reduce((sum, item) => sum + item.rating, 0) / feedback.length).toFixed(1).replace('.', ',') : '—'

  async function submit(id: string) {
    const answer = (answers[id] ?? '').trim()
    if (!answer) return
    if (await answerQuestion(id, answer)) setAnswers((current) => ({ ...current, [id]: '' }))
  }

  return (
    <section className="adm-panel" id="panel-questions" role="tabpanel" aria-labelledby="nav-questions" tabIndex={0} hidden={panel !== 'panel-questions'}>
      <div className="adm-head">
        <div>
          <span className="eyebrow">Comunidade</span>
          <h1>Dúvidas &amp; feedback</h1>
          <p className="adm-head-sub">Cada dúvida é feita dentro de uma aula. Responda aqui: a resposta aparece por baixo do vídeo e em "As minhas dúvidas" do membro. Abaixo, o feedback das assistências.</p>
        </div>
      </div>

      <div className="adm-toolbar">
        <select className="adm-select adm-question-course" aria-label="Filtrar por curso" value={course} onChange={(event) => setCourse(event.target.value)}>
          <option value="all">Todos os cursos</option>
          {courseOptions.map(([id, title]) => <option key={id} value={id}>{title}</option>)}
          {hasGeneral && <option value="general">Dúvidas gerais (antigas)</option>}
        </select>
      </div>

      <div className="adm-chips" role="group" aria-label="Filtrar dúvidas">
        {(
          [
            ['open', 'Por responder'],
            ['answered', 'Respondidas'],
            ['all', 'Todas'],
          ] as const
        ).map(([value, label]) => (
          <button key={value} className={'adm-chip' + (filter === value ? ' is-active' : '')} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>
            {label} <b>{count(value)}</b>
          </button>
        ))}
      </div>

      <div className="adm-question-list">
        {questions.map((question) => {
          const href = lessonHref(question)
          return (
          <article className="adm-question" key={question.id}>
            <div className="adm-question-lesson">
              <Icon name="film" />
              {href ? (
                <>
                  <span><b>{question.courseTitle}</b> · {question.lessonTitle}</span>
                  <a className="adm-card-link" href={href} target="_blank" rel="noreferrer">Abrir aula ↗</a>
                </>
              ) : (
                <span>Dúvida geral (sem aula)</span>
              )}
            </div>
            <header>
              <span className="adm-ava" aria-hidden="true">{initials(question.name)}</span>
              <div>
                <strong>{question.name}</strong>
                <small>{question.email} · {fmtDate(question.createdAt)}</small>
              </div>
              <button className="adm-ibtn adm-ibtn--danger" type="button" title="Eliminar" onClick={() => deleteQuestion(question.id)}><Icon name="trash" /></button>
            </header>
            <p>{question.body}</p>
            {question.status === 'answered' ? (
              <div className="adm-answer">
                <span className="eyebrow">Resposta · {fmtDate(question.answeredAt)}</span>
                <p>{question.answer}</p>
              </div>
            ) : (
              <form className="adm-answer-form" onSubmit={(event) => { event.preventDefault(); void submit(question.id) }}>
                <label className="adm-label" htmlFor={'answer-' + question.id}>Resposta</label>
                <textarea
                  className="adm-textarea"
                  id={'answer-' + question.id}
                  maxLength={4000}
                  value={answers[question.id] ?? ''}
                  onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))}
                />
                <button className="adm-btn adm-btn--primary" type="submit">Enviar resposta</button>
              </form>
            )}
          </article>
          )
        })}
      </div>
      <div className="adm-empty" hidden={questions.length > 0}>
        <strong>{filter === 'open' ? 'Sem dúvidas por responder' : 'Sem dúvidas'}</strong>
        <p>As dúvidas enviadas pelos membros aparecem aqui.</p>
      </div>

      <div className="adm-head adm-head--sub">
        <div>
          <span className="eyebrow">Assistência</span>
          <h2>Feedback das sessões · média {average} / 5</h2>
        </div>
      </div>
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th scope="col">Membro</th>
              <th scope="col">Avaliação</th>
              <th scope="col">Comentário</th>
              <th scope="col">Data</th>
              <th scope="col" className="adm-cell-actions">Acções</th>
            </tr>
          </thead>
          <tbody>
            {feedback.map((item) => (
              <tr key={item.id}>
                <td><strong>{item.name}</strong></td>
                <td aria-label={item.rating + ' de 5'}>{'★'.repeat(item.rating)}{'☆'.repeat(5 - item.rating)}</td>
                <td>{item.comment || '—'}</td>
                <td><span className="adm-date">{fmtDate(item.createdAt)}</span></td>
                <td className="adm-cell-actions">
                  <button className="adm-ibtn adm-ibtn--danger" type="button" title="Eliminar" onClick={() => deleteFeedback(item.id)}><Icon name="trash" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="adm-empty" hidden={feedback.length > 0}>
        <strong>Sem feedback</strong>
        <p>Os membros Premium avaliam a assistência no separador "Assistência" do devocional.</p>
      </div>
    </section>
  )
}
