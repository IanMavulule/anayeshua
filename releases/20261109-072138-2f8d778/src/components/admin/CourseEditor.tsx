import type { ChangeEvent } from 'react'
import { useAdmin } from './AdminContext'
import Icon from './icons'
import { LessonPrayerPoints } from './PrayerPointsField'
import {
  COVER_OPTIONS,
  DEFAULT_COVER,
  type CourseAccess,
  type CourseStatus,
  fmtDuration,
  fmtSize,
  optionLabel,
  plural,
} from './adminData'

const DESCRIPTION_MAX = 240

const STATUS_OPTIONS: { value: CourseStatus; label: string; hint: string }[] = [
  { value: 'draft', label: 'Rascunho', hint: 'Só visível aqui no painel.' },
  { value: 'published', label: 'Publicado', hint: 'Aparece já na plataforma.' },
  { value: 'scheduled', label: 'Agendado', hint: 'Publica-se na data escolhida.' },
  { value: 'hidden', label: 'Oculto', hint: 'Retirado da plataforma.' },
]

const ACCESS_OPTIONS: { value: CourseAccess; label: string; hint: string }[] = [
  { value: 'free', label: 'Gratuito', hint: 'Todas as aulas abertas a qualquer membro com conta.' },
  { value: 'premium', label: 'Pago (Premium)', hint: 'Exige um plano activo; pode abrir aulas de amostra.' },
]

/** Texto do botão principal do editor, conforme o estado escolhido. */
export function courseSaveLabel(status: CourseStatus, isNew: boolean): string {
  if (status === 'published') return isNew ? 'Publicar curso' : 'Guardar e publicar'
  if (status === 'scheduled') return 'Agendar publicação'
  if (status === 'draft') return 'Guardar rascunho'
  return 'Guardar'
}

/**
 * Editor de curso: quatro passos (informação, capa, módulos e aulas, pontos de
 * oração do devocional) e, ao lado,
 * a pré-visualização do cartão, a publicação e uma lista do que falta.
 */
export default function CourseEditor() {
  const {
    data,
    contentDraft,
    uploads,
    media,
    updateContent,
    addModule,
    removeModule,
    moveModule,
    addLesson,
    removeLesson,
    moveLesson,
    updateLesson,
    uploadVideo,
    handleCoverFile,
    contentTitleRef,
    contentDateRef,
    modulesListRef,
    previewLesson,
  } = useAdmin()

  if (!contentDraft) return null
  const draft = contentDraft
  // Categoria e nível só aparecem se estiverem ligados em Configurações.
  const { categories, levels } = data.settings
  // Um curso antigo pode ter um valor que já não está na lista: continua a aparecer para não se perder.
  const withCurrent = (options: typeof categories.options, current: string) =>
    current && !options.some((option) => option.id === current) ? [...options, { id: current, label: current, labelEn: '' }] : options
  const posterMeta = [optionLabel(categories, categories.enabled ? draft.category : ''), optionLabel(levels, levels.enabled ? draft.level : '')]
    .filter(Boolean)
    .join(' · ')

  const lessons = draft.modules.reduce((sum, module) => sum + module.lessons.length, 0)
  const withVideo = draft.modules.reduce((sum, module) => sum + module.lessons.filter((lesson) => lesson.video).length, 0)
  const uploading = Object.keys(uploads).length > 0
  const cover = draft.cover || DEFAULT_COVER

  const checklist = [
    { done: draft.title.trim().length > 0, label: 'Título do curso' },
    { done: draft.description.trim().length > 0, label: 'Descrição' },
    { done: lessons > 0, label: 'Pelo menos uma aula' },
    { done: lessons > 0 && withVideo === lessons, label: lessons ? `Vídeos carregados (${withVideo} de ${lessons})` : 'Vídeos das aulas' },
  ]
  const ready = checklist.filter((item) => item.done).length

  const setModuleTitle = (moduleId: string, title: string) => {
    updateContent({ modules: draft.modules.map((module) => (module.id === moduleId ? { ...module, title } : module)) })
  }

  const videoPicker = (moduleId: string, lessonId: string) => (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) uploadVideo(moduleId, lessonId, file)
    event.target.value = ''
  }

  const coverPicker = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) handleCoverFile(file)
    event.target.value = ''
  }

  return (
    <form className="adm-form adm-course" id="form-content" noValidate onSubmit={(event) => event.preventDefault()}>
      <div className="adm-course-main">
        {/* 1. Informação ------------------------------------------------------ */}
        <section className="adm-step" aria-labelledby="step-info">
          <header className="adm-step-head">
            <span className="adm-step-num" aria-hidden="true">01</span>
            <div>
              <h3 id="step-info">Informação</h3>
              <p>O que os membros vêem no cartão e na página do curso.</p>
            </div>
          </header>

          <div className="adm-field">
            <label htmlFor="c-title">Título do curso</label>
            <input
              className="adm-input adm-input--lg"
              id="c-title"
              ref={contentTitleRef}
              type="text"
              maxLength={90}
              placeholder="Ex.: Fundamentos da oração"
              autoComplete="off"
              value={draft.title}
              onChange={(event) => updateContent({ title: event.target.value })}
            />
          </div>

          <div className="adm-field">
            <div className="adm-label-row">
              <label htmlFor="c-description">Descrição</label>
              <span className="adm-count" aria-live="polite">{draft.description.length}/{DESCRIPTION_MAX}</span>
            </div>
            <textarea
              className="adm-textarea"
              id="c-description"
              maxLength={DESCRIPTION_MAX}
              placeholder="Uma ou duas frases que resumam o curso e o que a pessoa vai viver."
              value={draft.description}
              onChange={(event) => updateContent({ description: event.target.value })}
            />
          </div>

          {categories.enabled && (
            <fieldset className="adm-field adm-fieldset">
              <legend className="adm-label">Categoria</legend>
              <div className="adm-segmented">
                {withCurrent(categories.options, draft.category).map((option) => (
                  <label key={option.id} className={'adm-seg' + (draft.category === option.id ? ' is-active' : '')}>
                    <input type="radio" name="c-category" value={option.id} checked={draft.category === option.id} onChange={() => updateContent({ category: option.id })} />
                    <i className={'adm-seg-dot cat--' + option.id} aria-hidden="true" />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <div className={levels.enabled ? 'adm-row' : ''}>
            {levels.enabled && (
              <fieldset className="adm-field adm-fieldset">
                <legend className="adm-label">Nível</legend>
                <div className="adm-segmented">
                  {withCurrent(levels.options, draft.level).map((option) => (
                    <label key={option.id} className={'adm-seg' + (draft.level === option.id ? ' is-active' : '')}>
                      <input type="radio" name="c-level" value={option.id} checked={draft.level === option.id} onChange={() => updateContent({ level: option.id })} />
                      {option.label}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            <div className="adm-field">
              <label htmlFor="c-instructor">Formadora</label>
              <input className="adm-input" id="c-instructor" type="text" maxLength={80} autoComplete="off" value={draft.instructor} onChange={(event) => updateContent({ instructor: event.target.value })} />
            </div>
          </div>
        </section>

        {/* 2. Capa ------------------------------------------------------------ */}
        <section className="adm-step" aria-labelledby="step-cover">
          <header className="adm-step-head">
            <span className="adm-step-num" aria-hidden="true">02</span>
            <div>
              <h3 id="step-cover">Capa</h3>
              <p>Imagem 16:9. Carregue uma sua ou escolha uma da biblioteca.</p>
            </div>
          </header>

          <div className="adm-cover-stage">
            <img src={cover} width={1400} height={788} alt="Capa escolhida" />
            <label className="adm-cover-upload">
              <input type="file" id="cover-file" accept="image/jpeg,image/png,image/webp" hidden onChange={coverPicker} />
              <Icon name="upload" />
              Carregar imagem
            </label>
          </div>
          <p className="adm-hint">JPG, PNG ou WebP · é recortada automaticamente para 16:9.</p>

          <div className="adm-cover-gallery" role="radiogroup" aria-label="Capas da biblioteca">
            {COVER_OPTIONS.filter((option) => option.value).map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={cover === option.value}
                className={'adm-cover-tile' + (cover === option.value ? ' is-active' : '')}
                title={option.label}
                onClick={() => updateContent({ cover: option.value })}
              >
                <img src={option.value} alt={option.label} loading="lazy" width={160} height={90} />
              </button>
            ))}
          </div>
        </section>

        {/* 3. Módulos e aulas ---------------------------------------------------- */}
        <section className="adm-step" aria-labelledby="step-modules">
          <header className="adm-step-head">
            <span className="adm-step-num" aria-hidden="true">03</span>
            <div>
              <h3 id="step-modules">Módulos e aulas</h3>
              <p>{plural(draft.modules.length, 'módulo', 'módulos')} · {plural(lessons, 'aula', 'aulas')} · vídeos em MP4 (H.264), até 2 GB por aula.</p>
            </div>
            {draft.modules.length > 0 && (
              <button className="adm-btn adm-btn--sm" type="button" onClick={addModule}>Adicionar módulo +</button>
            )}
          </header>

          <div className="adm-modules-list" id="modules-list" ref={modulesListRef}>
            {draft.modules.length === 0 && (
              <div className="adm-modules-empty">
                <strong>Comece pelo primeiro módulo</strong>
                <p>Um módulo agrupa aulas. Depois, em cada aula, carregue o vídeo.</p>
                <button className="adm-btn adm-btn--primary" type="button" onClick={addModule}>Adicionar o primeiro módulo</button>
              </div>
            )}

            {draft.modules.map((module, moduleIndex) => (
              <div className="adm-module" key={module.id}>
                <div className="adm-module-head">
                  <span className="adm-module-num">Módulo {String(moduleIndex + 1).padStart(2, '0')}</span>
                  <input className="adm-input" type="text" placeholder="Título do módulo" aria-label={'Título do módulo ' + (moduleIndex + 1)} value={module.title} onChange={(event) => setModuleTitle(module.id, event.target.value)} />
                  <div className="adm-row-tools">
                    <button className="adm-ibtn" type="button" title="Mover para cima" aria-label="Mover módulo para cima" disabled={moduleIndex === 0} onClick={() => moveModule(module.id, -1)}><Icon name="up" /></button>
                    <button className="adm-ibtn" type="button" title="Mover para baixo" aria-label="Mover módulo para baixo" disabled={moduleIndex === draft.modules.length - 1} onClick={() => moveModule(module.id, 1)}><Icon name="down" /></button>
                    <button className="adm-ibtn adm-ibtn--danger" type="button" title="Remover módulo" aria-label="Remover módulo" onClick={() => removeModule(module.id)}><Icon name="trash" /></button>
                  </div>
                </div>
                <div className="adm-module-body">
                  {module.lessons.map((lesson, lessonIndex) => {
                    const isUploading = uploads[lesson.id] !== undefined
                    const playable = media.has(lesson.id)
                    return (
                      <div className="adm-lesson-row" key={lesson.id}>
                        <div className="adm-lesson-copy">
                          <input className="adm-input" type="text" placeholder={'Aula ' + (lessonIndex + 1)} aria-label={'Título da aula ' + (lessonIndex + 1)} value={lesson.title} onChange={(event) => updateLesson(module.id, lesson.id, { title: event.target.value })} />
                          <div className="adm-lesson-media">
                            {isUploading ? (
                              <div className="adm-progress" role="progressbar" aria-valuenow={uploads[lesson.id]} aria-valuemin={0} aria-valuemax={100}>
                                <i style={{ width: uploads[lesson.id] + '%' }}></i>
                                <span className="adm-progress-label">A carregar… {uploads[lesson.id]}%</span>
                              </div>
                            ) : lesson.video ? (
                              <div className={'adm-file' + (playable ? ' is-playable' : '')}>
                                <span className="adm-file-ico"><Icon name="film" /></span>
                                <div className="adm-file-copy">
                                  <strong>{lesson.video.name}</strong>
                                  <small>{fmtSize(lesson.video.size)} · {fmtDuration(lesson.video.duration)}</small>
                                </div>
                                {playable && <button className="adm-file-act" type="button" onClick={() => previewLesson(module.id, lesson.id)}>Ver</button>}
                                <label className="adm-file-act" style={{ cursor: 'pointer' }}>
                                  Substituir
                                  <input type="file" accept="video/mp4,.mp4,.m4v" hidden onChange={videoPicker(module.id, lesson.id)} />
                                </label>
                              </div>
                            ) : (
                              <label className="adm-drop adm-drop--mini">
                                <Icon name="upload" />
                                <span><strong>Carregar vídeo</strong><small>MP4 (H.264) · até 2 GB</small></span>
                                <input type="file" accept="video/mp4,.mp4,.m4v" hidden onChange={videoPicker(module.id, lesson.id)} />
                              </label>
                            )}
                          </div>
                          <LessonPrayerPoints
                            lessonId={lesson.id}
                            points={lesson.prayerPoints ?? []}
                            onChange={(prayerPoints) => updateLesson(module.id, lesson.id, { prayerPoints })}
                          />
                        </div>
                        {draft.access === 'premium' ? (
                          <label className="adm-free" title="Num curso pago, esta aula fica aberta a todos os membros como amostra.">
                            <input className="adm-check" type="checkbox" checked={lesson.free} onChange={(event) => updateLesson(module.id, lesson.id, { free: event.target.checked })} />
                            Amostra gratuita
                          </label>
                        ) : (
                          <span className="adm-free adm-free--all">Gratuita</span>
                        )}
                        <div className="adm-row-tools adm-row-tools--vertical">
                          <button className="adm-ibtn" type="button" title="Mover para cima" aria-label="Mover aula para cima" disabled={lessonIndex === 0} onClick={() => moveLesson(module.id, lesson.id, -1)}><Icon name="up" /></button>
                          <button className="adm-ibtn" type="button" title="Mover para baixo" aria-label="Mover aula para baixo" disabled={lessonIndex === module.lessons.length - 1} onClick={() => moveLesson(module.id, lesson.id, 1)}><Icon name="down" /></button>
                          <button className="adm-ibtn adm-ibtn--danger" type="button" title="Remover aula" aria-label="Remover aula" onClick={() => removeLesson(module.id, lesson.id)}><Icon name="trash" /></button>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <button className="adm-add-line" type="button" onClick={() => addLesson(module.id)}>Adicionar aula +</button>
              </div>
            ))}
          </div>
        </section>
      </div>

      <aside className="adm-course-side" aria-label="Pré-visualização e publicação">
        <div className="adm-side-card">
          <h3 className="adm-side-title">Pré-visualização</h3>
          <div className="adm-course-poster">
            <img src={cover} alt="" width={1400} height={788} />
            {lessons > 0 && <span className="adm-course-poster-badge">{plural(lessons, 'aula', 'aulas')}</span>}
            <div className="adm-course-poster-body">
              <strong>{draft.title.trim() || 'Título do curso'}</strong>
              {posterMeta && <small>{posterMeta}</small>}
            </div>
          </div>
          <p className="adm-hint">Assim aparece o cartão na biblioteca de devocionais.</p>
        </div>

        <div className="adm-side-card">
          <h3 className="adm-side-title">Acesso</h3>
          <div className="adm-status-options" role="radiogroup" aria-label="Acesso ao curso">
            {ACCESS_OPTIONS.map((option) => (
              <label key={option.value} className={'adm-status-option' + (draft.access === option.value ? ' is-active' : '')}>
                <input type="radio" name="c-access" value={option.value} checked={draft.access === option.value} onChange={() => updateContent({ access: option.value })} />
                <span className={'adm-status-dot adm-status-dot--' + (option.value === 'free' ? 'published' : 'scheduled')} aria-hidden="true" />
                <span>
                  <strong>{option.label}</strong>
                  <small>{option.hint}</small>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="adm-side-card">
          <h3 className="adm-side-title">Publicação</h3>
          <div className="adm-status-options" role="radiogroup" aria-label="Estado do curso">
            {STATUS_OPTIONS.map((option) => (
              <label key={option.value} className={'adm-status-option' + (draft.status === option.value ? ' is-active' : '')}>
                <input type="radio" name="c-status" value={option.value} checked={draft.status === option.value} onChange={() => updateContent({ status: option.value })} />
                <span className={'adm-status-dot adm-status-dot--' + option.value} aria-hidden="true" />
                <span>
                  <strong>{option.label}</strong>
                  <small>{option.hint}</small>
                </span>
              </label>
            ))}
          </div>
          <div className="adm-field" id="c-schedule-field" hidden={draft.status !== 'scheduled'}>
            <label htmlFor="c-date">Data e hora de publicação</label>
            <input className="adm-input" id="c-date" ref={contentDateRef} type="datetime-local" value={draft.publishAt} onChange={(event) => updateContent({ publishAt: event.target.value })} />
          </div>
          <label className="adm-toggle-row" htmlFor="c-featured">
            <span>
              <strong>Destacar na página inicial</strong>
              <small>Aparece em primeiro lugar nos devocionais.</small>
            </span>
            <input className="adm-toggle" id="c-featured" type="checkbox" role="switch" checked={draft.featured} onChange={(event) => updateContent({ featured: event.target.checked })} />
          </label>
        </div>

        <div className="adm-side-card">
          <div className="adm-ready-head">
            <h3 className="adm-side-title">Pronto para publicar</h3>
            <span>{ready}/{checklist.length}</span>
          </div>
          <ul className="adm-ready">
            {checklist.map((item) => (
              <li key={item.label} className={item.done ? 'is-done' : ''}>
                <span className="adm-ready-mark" aria-hidden="true">{item.done ? <Icon name="check" /> : null}</span>
                {item.label}
                <span className="visually-hidden">{item.done ? '— feito' : '— em falta'}</span>
              </li>
            ))}
          </ul>
          {uploading && <p className="adm-hint">Há vídeos a carregar: espere que terminem antes de guardar.</p>}
        </div>
      </aside>
    </form>
  )
}
