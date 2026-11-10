import { useRef } from 'react'
import { Link } from 'react-router-dom'
import BrandLogo from '../brand/BrandLogo'
import { ROUTES } from '../../utils/constants/routes'
import { useAdmin } from './AdminContext'
import { initials, type PanelId } from './adminData'
import { useServerStatus } from './useServerStatus'

const ORDER: PanelId[] = [
  'panel-overview',
  'panel-library',
  'panel-agenda',
  'panel-daily',
  'panel-testimonies',
  'panel-questions',
  'panel-members',
  'panel-server',
  'panel-settings',
]

export default function AdminSidebar() {
  const { data, panel, showPanel, sidebarOpen, closeSidebar, signOut, userName } = useAdmin()
  const navRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  const pending = data.testimonies.filter((item) => item.status === 'pending').length
  const openQuestions = data.questions.filter((item) => item.status === 'open').length
  const openErrors = useServerStatus().overview?.openErrors ?? 0
  const name = userName || 'Ana Yeshua'

  const onNavKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (!/^(ArrowDown|ArrowUp|ArrowLeft|ArrowRight)$/.test(event.key)) return
    const index = ORDER.findIndex((id) => navRefs.current[id] === document.activeElement)
    if (index === -1) return
    event.preventDefault()
    const delta = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1
    const nextIndex = (index + delta + ORDER.length) % ORDER.length
    const nextId = ORDER[nextIndex]
    navRefs.current[nextId]?.focus()
    showPanel(nextId)
  }

  const navButton = (id: PanelId, label: string, icon: React.ReactNode, badge?: React.ReactNode) => (
    <button
      className="adm-nav-item"
      type="button"
      role="tab"
      id={id === 'panel-overview' ? 'nav-overview' : 'nav-' + id.replace('panel-', '')}
      aria-selected={panel === id}
      aria-controls={id}
      ref={(el) => { navRefs.current[id] = el }}
      onClick={() => showPanel(id)}
    >
      {icon}
      <span>{label}</span>
      {badge}
    </button>
  )

  // O véu fica fora da barra: dentro dela (com transform) cobria o próprio menu no telemóvel.
  return (
    <>
    <aside className={'adm-side' + (sidebarOpen ? ' is-open' : '')} id="adm-side" aria-label="Navegação do painel">
      <div className="adm-brand">
        <Link to={ROUTES.dashboard} aria-label="Ana Yeshua - Holy Ghost Ministering, plataforma">
          <BrandLogo tone="teal" />
        </Link>
        <span>Painel de administração</span>
      </div>

      <nav
        className="adm-nav"
        role="tablist"
        aria-label="Secções do painel"
        aria-orientation="vertical"
        onKeyDown={onNavKeyDown}
      >
        <span className="adm-nav-group" role="presentation">Principal</span>
        {navButton(
          'panel-overview',
          'Visão geral',
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true"><rect x="3.5" y="3.5" width={7} height={7} /><rect x="13.5" y="3.5" width={7} height={7} /><rect x="3.5" y="13.5" width={7} height={7} /><rect x="13.5" y="13.5" width={7} height={7} /></svg>,
        )}

        <span className="adm-nav-group" role="presentation">Cursos</span>
        {navButton(
          'panel-library',
          'Cursos',
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true"><rect x="3.5" y="4.5" width={17} height={15} /><path d="M10 9l5 3-5 3z" /></svg>,
          <span className="adm-nav-badge" id="badge-library">{data.courses.length}</span>,
        )}
        {navButton(
          'panel-agenda',
          'Eventos',
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true"><rect x="3.5" y="5.5" width={17} height={15} /><path d="M3.5 10h17M8 3.5v4M16 3.5v4" /></svg>,
          <span className="adm-nav-badge" id="badge-agenda">{data.events.length}</span>,
        )}
        {navButton(
          'panel-daily',
          'Palavra do dia',
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true"><path d="M5 4.5h10.5L19 8v11.5H5z" /><path d="M8.5 10h7M8.5 13.5h7M8.5 17h4" /></svg>,
          <span className="adm-nav-badge">{data.posts.length}</span>,
        )}
        {navButton(
          'panel-testimonies',
          'Testemunhos',
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true"><path d="M20.5 12a8 8 0 0 1-8 8H4.5l2-3.2A8 8 0 1 1 20.5 12Z" /><path d="M8.5 12h.01M12 12h.01M15.5 12h.01" /></svg>,
          <span className="adm-nav-badge" id="badge-testimonies" hidden={pending === 0}>{pending}</span>,
        )}

        <span className="adm-nav-group" role="presentation">Comunidade</span>
        {navButton(
          'panel-questions',
          'Dúvidas',
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.6M12 16.8h.01" /></svg>,
          <span className="adm-nav-badge" hidden={openQuestions === 0}>{openQuestions}</span>,
        )}
        {navButton(
          'panel-members',
          'Membros',
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true"><circle cx="9" cy="8.5" r="3" /><path d="M3.5 20c.6-3.2 2.7-5 5.5-5s4.9 1.8 5.5 5" /><path d="M16 5.7a3 3 0 0 1 0 5.6M18 20c-.2-2.2-1-3.8-2.3-4.7" /></svg>,
          <span className="adm-nav-badge" id="badge-members">{data.members.length}</span>,
        )}

        <span className="adm-nav-group" role="presentation">Sistema</span>
        {navButton(
          'panel-server',
          'Servidor',
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true"><rect x="4" y="4.5" width={16} height={6} /><rect x="4" y="13.5" width={16} height={6} /><path d="M7.5 7.5h.01M7.5 16.5h.01M11 7.5h5M11 16.5h5" /></svg>,
          <span className="adm-nav-badge adm-nav-badge--alert" hidden={openErrors === 0} aria-label={`${openErrors} erro(s) por resolver`}>{openErrors}</span>,
        )}
        {navButton(
          'panel-settings',
          'Configurações',
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></svg>,
        )}
      </nav>

      <div className="adm-side-foot">
        <p className="adm-side-note">As alterações são guardadas no servidor e ficam visíveis na plataforma.</p>
        <div className="adm-user">
          <span className="adm-user-ava js-user-ava" aria-hidden="true">{initials(name)}</span>
          <div>
            <strong id="side-user-name">{name}</strong>
            <small>Administração</small>
          </div>
          <button
            className="adm-user-out"
            id="sign-out"
            type="button"
            aria-label="Terminar sessão"
            title="Terminar sessão"
            onClick={signOut}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true"><path d="M15 4.5h4.5v15H15" /><path d="M10 8l-4 4 4 4M6 12h9" /></svg>
          </button>
        </div>
      </div>
    </aside>
    <button className="adm-scrim" type="button" aria-label="Fechar menu" onClick={closeSidebar} hidden={!sidebarOpen} />
    </>
  )
}
