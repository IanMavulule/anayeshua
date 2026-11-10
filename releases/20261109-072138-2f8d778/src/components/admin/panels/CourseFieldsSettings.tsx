import { useEffect, useState, type FormEvent } from 'react'
import { useAdmin } from '../AdminContext'
import Icon from '../icons'
import { type CourseField, type FieldOption, plural, slugify } from '../adminData'

type FieldKey = 'categories' | 'levels'

const FIELDS: { key: FieldKey; courseKey: 'category' | 'level'; title: string; text: string; addLabel: string; placeholder: string }[] = [
  {
    key: 'categories',
    courseKey: 'category',
    title: 'Categoria',
    text: 'Agrupa os cursos no site (filtros, filas e etiquetas).',
    addLabel: 'Nova categoria',
    placeholder: 'Ex.: Jovens',
  },
  {
    key: 'levels',
    courseKey: 'level',
    title: 'Nível',
    text: 'Indica a quem o curso se destina. Aparece no painel e no editor.',
    addLabel: 'Novo nível',
    placeholder: 'Ex.: Liderança',
  },
]

const sameField = (a: CourseField, b: CourseField) => JSON.stringify(a) === JSON.stringify(b)

/** Um campo: ligar/desligar e gerir as opções. As alterações só valem ao guardar. */
function FieldEditor({ field }: { field: (typeof FIELDS)[number] }) {
  const { data, saveSettings } = useAdmin()
  const saved = data.settings[field.key]
  const [draft, setDraft] = useState<CourseField>(saved)
  const [newLabel, setNewLabel] = useState('')

  useEffect(() => setDraft(saved), [saved])

  const usage = (id: string) => data.courses.filter((course) => course[field.courseKey] === id).length
  const dirty = !sameField(draft, saved)
  const emptyLabels = draft.options.some((option) => !option.label.trim())
  const noOptions = draft.enabled && draft.options.length === 0

  const updateOption = (id: string, patch: Partial<FieldOption>) =>
    setDraft((current) => ({ ...current, options: current.options.map((option) => (option.id === id ? { ...option, ...patch } : option)) }))

  const removeOption = (id: string) =>
    setDraft((current) => ({ ...current, options: current.options.filter((option) => option.id !== id) }))

  const moveOption = (index: number, dir: -1 | 1) =>
    setDraft((current) => {
      const options = current.options.slice()
      const target = index + dir
      if (target < 0 || target >= options.length) return current
      ;[options[index], options[target]] = [options[target], options[index]]
      return { ...current, options }
    })

  const addOption = (event: FormEvent) => {
    event.preventDefault()
    const label = newLabel.trim()
    if (!label) return
    // O id deriva do nome e fica fixo, mesmo que o nome mude depois.
    const base = slugify(label) || 'opcao'
    let id = base
    for (let n = 2; draft.options.some((option) => option.id === id); n++) id = `${base}-${n}`.slice(0, 40)
    setDraft((current) => ({ ...current, options: [...current.options, { id, label, labelEn: '' }] }))
    setNewLabel('')
  }

  const save = () => {
    if (emptyLabels || noOptions) return
    saveSettings({ [field.key]: { ...draft, options: draft.options.map((o) => ({ ...o, label: o.label.trim(), labelEn: o.labelEn.trim() })) } })
  }

  const coursesWithValue = data.courses.filter((course) => course[field.courseKey]).length

  return (
    <section className={'adm-fieldcfg' + (draft.enabled ? '' : ' is-off')} aria-labelledby={`cfg-${field.key}`}>
      <header className="adm-fieldcfg-head">
        <div>
          <h3 id={`cfg-${field.key}`}>{field.title}</h3>
          <p>{field.text}</p>
        </div>
        <label className="adm-fieldcfg-switch">
          <span>{draft.enabled ? 'Faz parte do curso' : 'Não faz parte'}</span>
          <input
            className="adm-toggle"
            type="checkbox"
            role="switch"
            aria-label={`${field.title}: faz parte do curso`}
            checked={draft.enabled}
            onChange={(event) => setDraft((current) => ({ ...current, enabled: event.target.checked }))}
          />
        </label>
      </header>

      {!draft.enabled ? (
        <p className="adm-fieldcfg-note">
          O campo deixa de aparecer no editor de cursos e no site.
          {coursesWithValue > 0 && ` ${plural(coursesWithValue, 'curso guarda', 'cursos guardam')} o valor actual, caso volte a ligá-lo.`}
        </p>
      ) : (
        <>
          <ul className="adm-fieldcfg-list">
            <li className="adm-fieldcfg-labels" aria-hidden="true">
              <span>Nome (PT)</span>
              <span>Nome (EN)</span>
              <span>Uso</span>
              <span />
            </li>
            {draft.options.map((option, index) => {
              const used = usage(option.id)
              return (
                <li key={option.id} className="adm-fieldcfg-row">
                  <input
                    className="adm-input"
                    type="text"
                    maxLength={40}
                    aria-label={`Nome em português de ${option.label || option.id}`}
                    value={option.label}
                    onChange={(event) => updateOption(option.id, { label: event.target.value })}
                  />
                  <input
                    className="adm-input"
                    type="text"
                    maxLength={40}
                    placeholder={option.label}
                    aria-label={`Nome em inglês de ${option.label || option.id}`}
                    value={option.labelEn}
                    onChange={(event) => updateOption(option.id, { labelEn: event.target.value })}
                  />
                  <span className="adm-fieldcfg-usage">{used ? plural(used, 'curso', 'cursos') : 'Sem uso'}</span>
                  <div className="adm-row-tools">
                    <button className="adm-ibtn" type="button" title="Subir" aria-label={`Subir ${option.label}`} disabled={index === 0} onClick={() => moveOption(index, -1)}><Icon name="up" /></button>
                    <button className="adm-ibtn" type="button" title="Descer" aria-label={`Descer ${option.label}`} disabled={index === draft.options.length - 1} onClick={() => moveOption(index, 1)}><Icon name="down" /></button>
                    <button
                      className="adm-ibtn adm-ibtn--danger"
                      type="button"
                      title={used ? `Em uso por ${plural(used, 'curso', 'cursos')}: mude esses cursos primeiro` : 'Remover'}
                      aria-label={`Remover ${option.label}`}
                      disabled={used > 0}
                      onClick={() => removeOption(option.id)}
                    >
                      <Icon name="trash" />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>

          <form className="adm-fieldcfg-add" onSubmit={addOption}>
            <input
              className="adm-input"
              type="text"
              maxLength={40}
              aria-label={field.addLabel}
              placeholder={field.placeholder}
              value={newLabel}
              onChange={(event) => setNewLabel(event.target.value)}
            />
            <button className="adm-btn" type="submit" disabled={!newLabel.trim()}>{field.addLabel} +</button>
          </form>
        </>
      )}

      {dirty && (
        <div className="adm-fieldcfg-foot" aria-live="polite">
          <span>
            {noOptions ? 'Acrescente pelo menos uma opção.' : emptyLabels ? 'Todas as opções precisam de nome.' : 'Alterações por guardar.'}
          </span>
          <button className="adm-btn adm-btn--ghost adm-btn--sm" type="button" onClick={() => setDraft(saved)}>Desfazer</button>
          <button className="adm-btn adm-btn--primary adm-btn--sm" type="button" disabled={emptyLabels || noOptions} onClick={save}>Guardar {field.title.toLowerCase()}</button>
        </div>
      )}
    </section>
  )
}

/** Configurações: que campos fazem parte do curso e com que opções. */
export default function CourseFieldsSettings() {
  return (
    <div className="adm-card adm-card--wide">
      <div className="adm-card-head">
        <div>
          <h2>Campos do curso</h2>
          <span className="adm-card-meta">Escolha o que faz parte de cada curso e as opções disponíveis</span>
        </div>
      </div>
      <div className="adm-fieldcfg-grid">
        {FIELDS.map((field) => <FieldEditor key={field.key} field={field} />)}
      </div>
    </div>
  )
}
