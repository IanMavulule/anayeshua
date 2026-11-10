import type { ReactNode } from 'react'
import { ROUTES } from '../../../utils/constants/routes'
import { useAdmin } from '../AdminContext'
import Icon from '../icons'
import {
  STATUS,
  type CourseStatus,
  type PanelId,
  fmtDate,
  greetingText,
  missingVideos,
  moduleLessons,
  optionLabel,
  parseDate,
  plural,
  todayText,
} from '../adminData'

type Attention = {
  icon: 'alert' | 'film' | 'clock' | 'check' | 'chat'
  tone?: 'teal'
  title: string
  text: string
  action?: { label: string; run: () => void }
}

/** Percentagem inteira, segura para totais a zero. */
function pct(part: number, total: number): number {
  return total ? Math.round((part / total) * 100) : 0
}

/** Barra de progresso com legenda: só números reais, nunca dados de exemplo. */
function Meter({ label, value, total, detail }: { label: string; value: number; total: number; detail: ReactNode }) {
  const percent = pct(value, total)
  return (
    <div className="adm-meter">
      <div className="adm-meter-head">
        <span>{label}</span>
        <strong>{percent}%</strong>
      </div>
      <div className="adm-meter-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
        <i style={{ width: `${percent}%` }} />
      </div>
      <small>{detail}</small>
    </div>
  )
}

export default function OverviewPanel() {
  const { data, panel, showPanel, openContent, openEvent, openPost, userName } = useAdmin()

  const courses = data.courses
  const countBy = (status: CourseStatus) => courses.filter((course) => course.status === status).length
  const published = countBy('published')
  const draftCount = countBy('draft')
  const scheduled = countBy('scheduled')
  const hidden = countBy('hidden')
  const lessons = courses.reduce((sum, course) => sum + moduleLessons(course), 0)
  const missing = courses.reduce((sum, course) => sum + missingVideos(course), 0)

  const members = data.members.filter((member) => member.role !== 'admin')
  const activeMembers = members.filter((member) => member.status === 'active').length
  const suspended = members.filter((member) => member.status === 'suspended').length
  const premium = members.filter((member) => member.plan === 'premium').length

  const pendingTestimonies = data.testimonies.filter((item) => item.status === 'pending').length
  const openQuestions = data.questions.filter((item) => item.status === 'open').length

  const now = Date.now()
  const upcoming = data.events
    .filter((item) => item.status === 'published' && (parseDate(item.date)?.getTime() ?? 0) >= now)
    .sort((a, b) => (parseDate(a.date)?.getTime() ?? 0) - (parseDate(b.date)?.getTime() ?? 0))
    .slice(0, 3)

  const recent = courses
    .slice()
    .sort((a, b) => (parseDate(b.updated)?.getTime() || 0) - (parseDate(a.updated)?.getTime() || 0))
    .slice(0, 5)

  const attention: Attention[] = []
  if (openQuestions) {
    attention.push({
      icon: 'chat',
      title: plural(openQuestions, 'dúvida por responder', 'dúvidas por responder'),
      text: 'Membros à espera de uma resposta.',
      action: { label: 'Responder', run: () => showPanel('panel-questions') },
    })
  }
  if (pendingTestimonies) {
    attention.push({
      icon: 'alert',
      title: plural(pendingTestimonies, 'testemunho pendente', 'testemunhos pendentes'),
      text: 'Aguardam revisão antes de ficarem públicos.',
      action: { label: 'Rever', run: () => showPanel('panel-testimonies') },
    })
  }
  if (missing) {
    attention.push({
      icon: 'film',
      tone: 'teal',
      title: plural(missing, 'aula sem vídeo', 'aulas sem vídeo'),
      text: 'Cursos com aulas por carregar.',
      action: { label: 'Abrir cursos', run: () => showPanel('panel-library') },
    })
  }
  if (scheduled) {
    attention.push({
      icon: 'clock',
      title: plural(scheduled, 'curso agendado', 'cursos agendados'),
      text: 'Serão publicados automaticamente na data definida.',
      action: { label: 'Ver', run: () => showPanel('panel-library') },
    })
  }

  const kpis: { label: string; value: number; foot: string; panel: PanelId; accent?: boolean }[] = [
    { label: 'Cursos publicados', value: published, foot: plural(draftCount, 'rascunho', 'rascunhos'), panel: 'panel-library' },
    { label: 'Aulas de vídeo', value: lessons, foot: missing ? `${missing} sem vídeo` : 'Todas com vídeo', panel: 'panel-library' },
    { label: 'Membros activos', value: activeMembers, foot: suspended ? plural(suspended, 'suspenso', 'suspensos') : 'Nenhum suspenso', panel: 'panel-members' },
    { label: 'Assinaturas Premium', value: premium, foot: `${pct(premium, members.length)}% dos membros`, panel: 'panel-members', accent: true },
  ]

  const quick: { title: string; text: string; run: () => void }[] = [
    { title: 'Novo curso', text: 'Módulos, aulas e vídeos', run: () => openContent() },
    { title: 'Palavra do dia', text: 'Publicar uma mensagem', run: () => { showPanel('panel-daily'); openPost() } },
    { title: 'Novo encontro', text: 'Adicionar aos eventos', run: () => { showPanel('panel-agenda'); openEvent() } },
    { title: 'Dúvidas', text: openQuestions ? plural(openQuestions, 'por responder', 'por responder') : 'Tudo respondido', run: () => showPanel('panel-questions') },
  ]

  const segments: { status: CourseStatus; value: number }[] = [
    { status: 'published', value: published },
    { status: 'scheduled', value: scheduled },
    { status: 'draft', value: draftCount },
    { status: 'hidden', value: hidden },
  ]

  return (
    <section
      className="adm-panel"
      id="panel-overview"
      role="tabpanel"
      aria-labelledby="nav-overview"
      tabIndex={0}
      hidden={panel !== 'panel-overview'}
    >
      <div className="adm-head adm-head--hero">
        <div>
          <span className="eyebrow" id="today">{todayText()}</span>
          <h1 id="greeting">{greetingText(userName)}</h1>
          <p className="adm-head-sub">Aqui está o pulso da plataforma e o que precisa da sua atenção.</p>
        </div>
        <div className="adm-head-actions">
          <a className="adm-btn adm-btn--ghost" href={ROUTES.dashboard} target="_blank" rel="noreferrer">Ver plataforma <span aria-hidden="true">↗</span></a>
          <button className="adm-btn adm-btn--primary" type="button" onClick={() => openContent()}>Novo curso <span aria-hidden="true">+</span></button>
        </div>
      </div>

      <div className="adm-quick" aria-label="Acções rápidas">
        {quick.map((item, index) => (
          <button key={item.title} className="adm-quick-item" type="button" onClick={item.run}>
            <span className="adm-quick-num" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
            <span className="adm-quick-copy">
              <strong>{item.title}</strong>
              <small>{item.text}</small>
            </span>
            <span className="adm-quick-arrow" aria-hidden="true">→</span>
          </button>
        ))}
      </div>

      <div className="adm-kpis">
        {kpis.map((kpi) => (
          <button
            key={kpi.label}
            type="button"
            className={'adm-kpi' + (kpi.accent ? ' adm-kpi--accent' : '')}
            onClick={() => showPanel(kpi.panel)}
          >
            <span className="adm-kpi-label">{kpi.label}</span>
            <strong>{kpi.value}</strong>
            <span className="adm-kpi-foot">{kpi.foot}</span>
          </button>
        ))}
      </div>

      <div className="adm-split">
        <div className="adm-card">
          <div className="adm-card-head">
            <div>
              <h2>Estado do catálogo</h2>
              <span className="adm-card-meta">{plural(courses.length, 'curso', 'cursos')} · {plural(lessons, 'aula', 'aulas')}</span>
            </div>
            <button className="adm-card-link" type="button" onClick={() => showPanel('panel-library')}>Abrir cursos →</button>
          </div>

          <div className="adm-stack" role="img" aria-label={segments.map((s) => `${s.value} ${STATUS[s.status].label.toLowerCase()}`).join(', ')}>
            {segments.filter((s) => s.value > 0).map((s) => (
              <i key={s.status} className={'adm-stack-seg adm-stack-seg--' + s.status} style={{ flexGrow: s.value }} />
            ))}
            {!courses.length && <i className="adm-stack-seg adm-stack-seg--empty" style={{ flexGrow: 1 }} />}
          </div>
          <ul className="adm-legend">
            {segments.map((s) => (
              <li key={s.status}><i className={'adm-stack-seg--' + s.status} aria-hidden="true" />{STATUS[s.status].label}<b>{s.value}</b></li>
            ))}
          </ul>

          <div className="adm-meters">
            <Meter label="Aulas com vídeo" value={lessons - missing} total={lessons} detail={`${lessons - missing} de ${lessons} aulas`} />
            <Meter label="Membros Premium" value={premium} total={members.length} detail={`${premium} de ${members.length} membros`} />
          </div>
        </div>

        <div className="adm-card">
          <div className="adm-card-head">
            <div>
              <h2>Precisa de atenção</h2>
              <span className="adm-card-meta">Hoje</span>
            </div>
          </div>
          {attention.length ? (
            <div className="adm-attn" id="attention">
              {attention.map((item, index) => (
                <div className="adm-attn-item" key={index}>
                  <span className={'adm-attn-ico' + (item.tone === 'teal' ? ' adm-attn-ico--teal' : '')}><Icon name={item.icon} /></span>
                  <div className="adm-attn-copy">
                    <strong>{item.title}</strong>
                    <small>{item.text}</small>
                  </div>
                  {item.action && <button className="adm-mini" type="button" onClick={item.action.run}>{item.action.label}</button>}
                </div>
              ))}
            </div>
          ) : (
            <div className="adm-calm">
              <span className="adm-attn-ico adm-attn-ico--teal"><Icon name="check" /></span>
              <strong>Tudo em ordem</strong>
              <small>Não há nada pendente neste momento.</small>
            </div>
          )}

          <div className="adm-card-sub">
            <div className="adm-card-head adm-card-head--sub">
              <h3>Próximos encontros</h3>
              <button className="adm-card-link" type="button" onClick={() => showPanel('panel-agenda')}>Eventos →</button>
            </div>
            {upcoming.length ? (
              <ul className="adm-upcoming">
                {upcoming.map((item) => {
                  const date = parseDate(item.date)
                  return (
                    <li key={item.id}>
                      <button type="button" onClick={() => { showPanel('panel-agenda'); openEvent(item.id) }}>
                        <span className="adm-upcoming-date" aria-hidden="true">
                          <b>{date ? String(date.getDate()).padStart(2, '0') : '–'}</b>
                          {date ? date.toLocaleDateString('pt-PT', { month: 'short' }).replace('.', '') : ''}
                        </span>
                        <span className="adm-upcoming-copy">
                          <strong>{item.title}</strong>
                          <small>{fmtDate(item.date)}{item.place ? ` · ${item.place}` : ''}</small>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="adm-muted">Sem encontros publicados para os próximos dias.</p>
            )}
          </div>
        </div>
      </div>

      <section className="adm-card adm-card--flush adm-section" aria-labelledby="recent-title">
        <div className="adm-card-head">
          <div>
            <h2 id="recent-title">Cursos recentes</h2>
            <span className="adm-card-meta">Últimas actualizações · clique numa linha para editar</span>
          </div>
          <button className="adm-card-link" type="button" onClick={() => showPanel('panel-library')}>Ver cursos →</button>
        </div>
        <div className="adm-table-wrap">
          <table className="adm-table adm-table--rows">
            <thead>
              <tr>
                <th scope="col">Curso</th>
                {data.settings.categories.enabled && <th scope="col">Categoria</th>}
                <th scope="col">Estado</th>
                <th scope="col">Actualizado</th>
                <th scope="col" className="adm-cell-actions"><span className="visually-hidden">Editar</span></th>
              </tr>
            </thead>
            <tbody id="recent-body">
              {recent.map((course) => (
                <tr key={course.id} onClick={() => openContent(course.id)}>
                  <td>
                    <div className="adm-course-cell">
                      <img className="adm-thumb" src={course.cover} alt="" width={70} height={40} />
                      <div>
                        <strong>{course.title}</strong>
                        <small>{plural(moduleLessons(course), 'aula', 'aulas')}</small>
                      </div>
                    </div>
                  </td>
                  {data.settings.categories.enabled && <td><span className={'cat cat--' + course.category}>{optionLabel(data.settings.categories, course.category) || '—'}</span></td>}
                  <td><span className={'st ' + STATUS[course.status].cls}>{STATUS[course.status].label}</span></td>
                  <td><span className="adm-date">{fmtDate(course.updated)}</span></td>
                  <td className="adm-cell-actions">
                    <button
                      className="adm-ibtn"
                      type="button"
                      title="Editar"
                      aria-label={`Editar ${course.title}`}
                      onClick={(event) => { event.stopPropagation(); openContent(course.id) }}
                    >
                      <Icon name="edit" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  )
}
