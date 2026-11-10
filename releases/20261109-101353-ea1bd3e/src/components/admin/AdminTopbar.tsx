import { ROUTES } from '../../utils/constants/routes'
import { useAdmin } from './AdminContext'
import { PANEL_NAMES, initials, moduleLessons, optionLabel } from './adminData'

export default function AdminTopbar() {
  const {
    data,
    panel,
    sidebarOpen,
    toggleSidebar,
    globalSearchRef,
    globalQuery,
    setGlobalQuery,
    searchOpen,
    closeSearch,
    submitGlobalSearch,
    openContent,
    userName,
  } = useAdmin()

  const name = userName || 'Ana Yeshua'
  const query = globalQuery.trim().toLowerCase()
  const results = query.length >= 2
    ? data.courses.filter((course) => (course.title + ' ' + (course.description || '')).toLowerCase().includes(query)).slice(0, 6)
    : []

  return (
    <header className="adm-topbar">
      <button
        className="adm-burger"
        id="burger"
        type="button"
        aria-label="Abrir menu"
        aria-expanded={sidebarOpen}
        aria-controls="adm-side"
        onClick={toggleSidebar}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"></path></svg>
      </button>
      <nav className="adm-crumb" aria-label="Localização">
        <span>Painel</span>
        <span className="sep" aria-hidden="true">/</span>
        <strong id="crumb">{PANEL_NAMES[panel]}</strong>
      </nav>

      <div className="adm-search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="11" cy="11" r="6.5"></circle><path d="M16 16l4.5 4.5"></path></svg>
        <input
          id="global-search"
          ref={globalSearchRef}
          type="search"
          placeholder="Procurar cursos e aulas…"
          aria-label="Procurar cursos e aulas"
          autoComplete="off"
          spellCheck="false"
          value={globalQuery}
          onChange={(event) => setGlobalQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submitGlobalSearch()
            if (event.key === 'Escape') closeSearch()
          }}
        />
        <kbd>/</kbd>
        <div className="adm-search-results" id="search-results" hidden={!searchOpen}>
          {results.length === 0 ? (
            <p className="adm-search-empty">Sem resultados para “{globalQuery}”.</p>
          ) : (
            results.map((course) => (
              <button
                type="button"
                key={course.id}
                onClick={() => {
                  openContent(course.id)
                  closeSearch()
                }}
              >
                <img src={course.cover} alt="" width={52} height={30} />
                <span>
                  <strong>{course.title}</strong>
                  <small>{[optionLabel(data.settings.categories, course.category), moduleLessons(course) + ' aulas'].filter(Boolean).join(' · ')}</small>
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="adm-top-actions">
        <a className="adm-site-link" href={ROUTES.dashboard} target="_blank" rel="noreferrer">Ver plataforma <span aria-hidden="true">↗</span></a>
        <span className="adm-avatar js-user-ava" title={name + ' — Administradora'} aria-hidden="true">{initials(name)}</span>
      </div>
    </header>
  )
}
