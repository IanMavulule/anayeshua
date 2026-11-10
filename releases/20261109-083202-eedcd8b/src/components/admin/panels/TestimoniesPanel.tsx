import { useAdmin } from '../AdminContext'
import { fmtDate } from '../adminData'
import type { TestimonyStatus } from '../adminData'

const LABELS: Record<TestimonyStatus, string> = {
  pending: 'Pendente',
  published: 'Aprovado',
  hidden: 'Oculto',
}

const CLS: Record<TestimonyStatus, string> = {
  pending: 'st--pending',
  published: 'st--published',
  hidden: 'st--hidden',
}

const CHIPS: { key: 'all' | TestimonyStatus; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'pending', label: 'Pendentes' },
  { key: 'published', label: 'Aprovados' },
  { key: 'hidden', label: 'Ocultos' },
]

export default function TestimoniesPanel() {
  const { data, panel, mod, setMod, publishTestimony, hideTestimony, deleteTestimony } = useAdmin()

  const testimonies = data.testimonies
  const counts = {
    all: testimonies.length,
    pending: testimonies.filter((item) => item.status === 'pending').length,
    published: testimonies.filter((item) => item.status === 'published').length,
    hidden: testimonies.filter((item) => item.status === 'hidden').length,
  }
  const list = mod === 'all' ? testimonies : testimonies.filter((item) => item.status === mod)

  return (
    <section
      className="adm-panel"
      id="panel-testimonies"
      role="tabpanel"
      aria-labelledby="nav-testimonies"
      tabIndex={0}
      hidden={panel !== 'panel-testimonies'}
    >
      <div className="adm-head">
        <div>
          <span className="eyebrow">Partilhas da comunidade</span>
          <h1>Testemunhos &amp; moderação</h1>
          <p className="adm-head-sub">Reveja as partilhas enviadas pelos membros antes de as tornar públicas na plataforma.</p>
        </div>
      </div>

      <div className="adm-chips" role="group" aria-label="Filtrar testemunhos">
        {CHIPS.map((chip) => (
          <button
            className={'adm-chip' + (mod === chip.key ? ' is-active' : '')}
            type="button"
            key={chip.key}
            aria-pressed={mod === chip.key}
            onClick={() => setMod(chip.key)}
          >
            {chip.label} <b>{counts[chip.key]}</b>
          </button>
        ))}
      </div>

      <div className="adm-mods" id="mods">
        {list.map((testimony) => (
          <article className="adm-mod" data-status={testimony.status} key={testimony.id}>
            <div className="adm-mod-head">
              <strong>{testimony.name}</strong>
              <span className={'st ' + CLS[testimony.status]}>{LABELS[testimony.status]}</span>
            </div>
            <p className="adm-mod-quote">{testimony.text}</p>
            <span className="adm-mod-meta">{testimony.source} · {fmtDate(testimony.date, false)}</span>
            <div className="adm-mod-acts">
              {testimony.status !== 'published' ? (
                <button className="adm-btn" type="button" onClick={() => publishTestimony(testimony.id)}>Aprovar</button>
              ) : null}
              {testimony.status !== 'hidden' ? (
                <button className="adm-btn" type="button" onClick={() => hideTestimony(testimony.id)}>Ocultar</button>
              ) : null}
              <button className="adm-btn adm-btn--danger" type="button" onClick={() => deleteTestimony(testimony.id)}>Eliminar</button>
            </div>
          </article>
        ))}
      </div>

      <div className="adm-empty" id="mods-empty" hidden={list.length > 0}>
        <strong>Nada por aqui</strong>
        <p>Não existem testemunhos com este estado.</p>
      </div>
    </section>
  )
}
