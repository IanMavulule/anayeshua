import { useAdmin } from '../AdminContext'
import Icon from '../icons'
import {
  DEFAULT_COVER,
  STATUS,
  courseMeta,
  fmtDate,
  moduleLessons,
  missingVideos,
  optionLabel,
} from '../adminData'
import type { Category, CourseStatus, SortKey, ViewKey } from '../adminData'

const CHIPS: { key: 'all' | CourseStatus; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'published', label: 'Publicados' },
  { key: 'draft', label: 'Rascunhos' },
  { key: 'hidden', label: 'Ocultos' },
  { key: 'scheduled', label: 'Agendados' },
]

export default function CoursesPanel() {
  const {
    data,
    panel,
    lib,
    libraryList,
    setLibQuery,
    setLibCategory,
    setLibSort,
    setLibStatus,
    setLibView,
    toggleSelect,
    selectAllVisible,
    bulkPublish,
    bulkHide,
    bulkDelete,
    bulkClear,
    openContent,
    toggleStatus,
    toggleFeatured,
    duplicateContent,
    deleteContent,
    playCourse,
    libSearchRef,
  } = useAdmin()
  const { categories, levels } = data.settings

  const courses = data.courses
  const counts = {
    all: courses.length,
    published: courses.filter((course) => course.status === 'published').length,
    draft: courses.filter((course) => course.status === 'draft').length,
    hidden: courses.filter((course) => course.status === 'hidden').length,
    scheduled: courses.filter((course) => course.status === 'scheduled').length,
  }

  const selectedCount = lib.selected.size
  const allVisibleSelected = libraryList.length > 0 && libraryList.every((course) => lib.selected.has(course.id))
  const isTable = lib.view === 'table'

  return (
    <section
      className="adm-panel"
      id="panel-library"
      role="tabpanel"
      aria-labelledby="nav-library"
      tabIndex={0}
      hidden={panel !== 'panel-library'}
    >
      <div className="adm-head">
        <div>
          <span className="eyebrow">Catálogo</span>
          <h1>Biblioteca de cursos</h1>
          <p className="adm-head-sub">Crie cursos com módulos e aulas, carregue os vídeos e controle o que fica visível na plataforma.</p>
        </div>
        <div className="adm-head-actions">
          <button className="adm-btn adm-btn--primary" type="button" onClick={() => openContent()}>Novo curso <span aria-hidden="true">+</span></button>
        </div>
      </div>

      <div className="adm-chips" role="group" aria-label="Filtrar por estado">
        {CHIPS.map((chip) => (
          <button
            className={'adm-chip' + (lib.status === chip.key ? ' is-active' : '')}
            type="button"
            key={chip.key}
            aria-pressed={lib.status === chip.key}
            onClick={() => setLibStatus(chip.key)}
          >
            {chip.label} <b>{counts[chip.key]}</b>
          </button>
        ))}
      </div>

      <div className="adm-toolbar">
        <div className="adm-search-inline">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="11" cy="11" r="6.5"></circle><path d="M16 16l4.5 4.5"></path></svg>
          <input
            className="adm-input"
            id="lib-search"
            ref={libSearchRef}
            type="search"
            placeholder="Procurar por curso, módulo ou aula"
            aria-label="Procurar cursos"
            value={lib.query}
            onChange={(event) => setLibQuery(event.target.value)}
          />
        </div>
        {categories.enabled && (
          <select className="adm-select" id="lib-category" aria-label="Filtrar por categoria" value={lib.category} onChange={(event) => setLibCategory(event.target.value as 'all' | Category)}>
            <option value="all">Todas as categorias</option>
            {categories.options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        )}
        <select className="adm-select" id="lib-sort" aria-label="Ordenar cursos" value={lib.sort} onChange={(event) => setLibSort(event.target.value as SortKey)}>
          <option value="recent">Mais recentes</option>
          <option value="title">Título (A–Z)</option>
          <option value="views">Mais vistos</option>
        </select>
        <div className="adm-viewtoggle" role="group" aria-label="Vista da biblioteca">
          <button type="button" aria-pressed={isTable} aria-label="Vista de tabela" title="Tabela" onClick={() => setLibView('table' as ViewKey)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="3.5" y="4.5" width={17} height={15}></rect><path d="M3.5 9.5h17M9 9.5v10"></path></svg>
          </button>
          <button type="button" aria-pressed={!isTable} aria-label="Vista de cartões" title="Cartões" onClick={() => setLibView('grid' as ViewKey)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="3.5" y="3.5" width={7} height={7}></rect><rect x="13.5" y="3.5" width={7} height={7}></rect><rect x="3.5" y="13.5" width={7} height={7}></rect><rect x="13.5" y="13.5" width={7} height={7}></rect></svg>
          </button>
        </div>
      </div>

      <div className="adm-bulk" id="bulk-bar" hidden={selectedCount === 0}>
        <strong><span id="bulk-count">{selectedCount}</span> seleccionados</strong>
        <button className="adm-btn" type="button" onClick={bulkPublish}>Publicar</button>
        <button className="adm-btn" type="button" onClick={bulkHide}>Ocultar</button>
        <button className="adm-btn" type="button" onClick={bulkDelete}>Eliminar</button>
        <button className="adm-btn adm-bulk-clear" type="button" onClick={bulkClear}>Limpar selecção</button>
      </div>

      <div className="adm-table-wrap" id="lib-table-wrap" hidden={!isTable}>
        <table className="adm-table" id="lib-table">
          <thead>
            <tr>
              <th scope="col">
                <input
                  className="adm-check"
                  id="select-all"
                  type="checkbox"
                  aria-label="Seleccionar todos os cursos visíveis"
                  checked={allVisibleSelected}
                  onChange={(event) => selectAllVisible(event.target.checked)}
                />
              </th>
              <th scope="col">Curso</th>
              <th scope="col">Categoria</th>
              <th scope="col">Aulas</th>
              <th scope="col">Estado</th>
              <th scope="col">Actualizado</th>
              <th scope="col" className="adm-cell-actions">Acções</th>
            </tr>
          </thead>
          <tbody id="lib-body">
            {libraryList.map((course) => {
              const missing = missingVideos(course)
              return (
                <tr key={course.id} className={lib.selected.has(course.id) ? 'is-checked' : undefined}>
                  <td>
                    <input
                      className="adm-check"
                      type="checkbox"
                      aria-label={'Seleccionar ' + course.title}
                      checked={lib.selected.has(course.id)}
                      onChange={(event) => toggleSelect(course.id, event.target.checked)}
                    />
                  </td>
                  <td>
                    <div className="adm-contt">
                      <img className="adm-thumb" src={course.cover || DEFAULT_COVER} alt="" width={70} height={40} />
                      <div>
                        <strong>{course.title}</strong>
                        <small>{courseMeta(course)}{missing ? ' · ' + missing + ' sem vídeo' : ''}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    {categories.enabled && <span className={'cat cat--' + course.category}>{optionLabel(categories, course.category) || '—'}</span>}
                    {levels.enabled && <small>{optionLabel(levels, course.level)}</small>}
                  </td>
                  <td><span className="adm-num">{moduleLessons(course)}</span></td>
                  <td>
                    <button className={'st ' + STATUS[course.status].cls} type="button" onClick={() => toggleStatus(course.id)} title="Alternar visibilidade">
                      {STATUS[course.status].label}
                    </button>
                  </td>
                  <td><span className="adm-date">{fmtDate(course.updated)}</span></td>
                  <td className="adm-cell-actions">
                    <div className="adm-acts">
                      <button className="adm-ibtn" type="button" title="Pré-visualizar" onClick={() => playCourse(course)}><Icon name="play" /></button>
                      <button className="adm-ibtn" type="button" title={course.featured ? 'Remover destaque' : 'Destacar'} onClick={() => toggleFeatured(course.id)}><Icon name="star" /></button>
                      <button className="adm-ibtn" type="button" title="Editar" onClick={() => openContent(course.id)}><Icon name="edit" /></button>
                      <button className="adm-ibtn" type="button" title="Duplicar" onClick={() => duplicateContent(course.id)}><Icon name="copy" /></button>
                      <button className="adm-ibtn adm-ibtn--danger" type="button" title="Eliminar" onClick={() => deleteContent(course.id)}><Icon name="trash" /></button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="adm-grid" id="lib-grid" hidden={isTable}>
        {libraryList.map((course) => (
          <article className="adm-ccard" key={course.id}>
            <div className="adm-ccard-media">
              <img src={course.cover || DEFAULT_COVER} alt="" width={1280} height={720} />
              <span className={'st ' + STATUS[course.status].cls}>{STATUS[course.status].label}</span>
              <button className="adm-star" type="button" title={course.featured ? 'Remover destaque' : 'Destacar'} onClick={() => toggleFeatured(course.id)}><Icon name="star" /></button>
              <button className="adm-ccard-play" type="button" title="Pré-visualizar" onClick={() => playCourse(course)}><Icon name="play" /></button>
            </div>
            <div className="adm-ccard-body">
              <h3>{course.title}</h3>
              <p>{course.description || 'Sem descrição.'}</p>
              <div className="adm-ccard-foot">
                <span className="adm-ccard-meta">{[categories.enabled ? optionLabel(categories, course.category) : '', moduleLessons(course) + ' aulas'].filter(Boolean).join(' · ')}</span>
                <div className="adm-acts">
                  <button className="adm-ibtn" type="button" title="Editar" onClick={() => openContent(course.id)}><Icon name="edit" /></button>
                  <button className="adm-ibtn adm-ibtn--danger" type="button" title="Eliminar" onClick={() => deleteContent(course.id)}><Icon name="trash" /></button>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="adm-empty" id="lib-empty" hidden={libraryList.length > 0}>
        <strong>Sem cursos para mostrar</strong>
        <p>Experimente outro filtro ou crie um novo curso para a biblioteca.</p>
      </div>
    </section>
  )
}
