import { useAdmin } from '../AdminContext'
import Icon from '../icons'
import { MEMBER_STATUS, PLANS, fmtDate, initials } from '../adminData'
import type { MemberStatus, Plan } from '../adminData'

export default function MembersPanel() {
  const {
    data,
    panel,
    memberFilters,
    setMemberQuery,
    setMemberPlan,
    setMemberStatus,
    openMember,
    toggleMemberStatus,
    deleteMember,
  } = useAdmin()

  const query = memberFilters.query.trim().toLowerCase()
  const members = data.members.filter((member) => {
    const matchesQuery = !query || member.name.toLowerCase().includes(query) || member.email.toLowerCase().includes(query)
    const matchesPlan = memberFilters.plan === 'all' || member.plan === memberFilters.plan
    const matchesStatus = memberFilters.status === 'all' || member.status === memberFilters.status
    return matchesQuery && matchesPlan && matchesStatus
  })

  return (
    <section
      className="adm-panel"
      id="panel-members"
      role="tabpanel"
      aria-labelledby="nav-members"
      tabIndex={0}
      hidden={panel !== 'panel-members'}
    >
      <div className="adm-head">
        <div>
          <span className="eyebrow">Comunidade</span>
          <h1>Membros &amp; acessos</h1>
          <p className="adm-head-sub">Acompanhe quem faz parte da plataforma, o plano activo e o último acesso de cada membro.</p>
        </div>
        <div className="adm-head-actions">
          <button className="adm-btn adm-btn--primary" type="button" onClick={() => openMember()}>Convidar membro <span aria-hidden="true">+</span></button>
        </div>
      </div>

      <div className="adm-toolbar">
        <div className="adm-search-inline">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="11" cy="11" r="6.5"></circle><path d="M16 16l4.5 4.5"></path></svg>
          <input
            className="adm-input"
            id="mem-search"
            type="search"
            placeholder="Procurar por nome ou e-mail"
            aria-label="Procurar membros"
            value={memberFilters.query}
            onChange={(event) => setMemberQuery(event.target.value)}
          />
        </div>
        <select className="adm-select" id="mem-plan" aria-label="Filtrar por plano" value={memberFilters.plan} onChange={(event) => setMemberPlan(event.target.value as 'all' | Plan)}>
          <option value="all">Todos os planos</option>
          <option value="premium">Premium</option>
          <option value="free">Gratuito</option>
        </select>
        <select className="adm-select" id="mem-status" aria-label="Filtrar por estado" value={memberFilters.status} onChange={(event) => setMemberStatus(event.target.value as 'all' | MemberStatus)}>
          <option value="all">Todos os estados</option>
          <option value="active">Activos</option>
          <option value="suspended">Suspensos</option>
        </select>
      </div>

      <div className="adm-table-wrap" id="mem-table-wrap" hidden={members.length === 0}>
        <table className="adm-table">
          <thead>
            <tr>
              <th scope="col">Membro</th>
              <th scope="col">Plano</th>
              <th scope="col">Estado</th>
              <th scope="col">Desde</th>
              <th scope="col">Último acesso</th>
              <th scope="col" className="adm-cell-actions">Acções</th>
            </tr>
          </thead>
          <tbody id="mem-body">
            {members.map((member) => (
              <tr key={member.id}>
                <td>
                  <div className="adm-member">
                    <span className="adm-ava" aria-hidden="true">{initials(member.name)}</span>
                    <div>
                      <strong>{member.name}</strong>
                      <small>{member.email}</small>
                    </div>
                  </div>
                </td>
                <td>
                  <span className={'adm-plan' + (member.plan === 'premium' ? ' adm-plan--premium' : '')}>{PLANS[member.plan]}</span>
                </td>
                <td>
                  <button
                    className={'st ' + MEMBER_STATUS[member.status].cls}
                    type="button"
                    title="Alternar estado"
                    onClick={() => toggleMemberStatus(member.id)}
                  >
                    {MEMBER_STATUS[member.status].label}
                  </button>
                </td>
                <td><span className="adm-date">{fmtDate(member.since, false)}</span></td>
                <td><span className="adm-date">{member.last ? fmtDate(member.last) : '—'}</span></td>
                <td className="adm-cell-actions">
                  <div className="adm-acts">
                    <button className="adm-ibtn" type="button" title="Editar" onClick={() => openMember(member.id)}><Icon name="edit" /></button>
                    <button className="adm-ibtn adm-ibtn--danger" type="button" title="Eliminar" onClick={() => deleteMember(member.id)}><Icon name="trash" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="adm-empty" id="mem-empty" hidden={members.length > 0}>
        <strong>Sem membros para mostrar</strong>
        <p>Experimente outro nome, plano ou estado.</p>
      </div>
    </section>
  )
}
