import { useAdmin } from '../AdminContext'
import Icon from '../icons'
import { fmtDate, parseDate } from '../adminData'

export default function AgendaPanel() {
  const { data, panel, openEvent, toggleEventStatus, deleteEvent } = useAdmin()

  const events = data.events
    .slice()
    .sort((a, b) => (parseDate(a.date)?.getTime() || 0) - (parseDate(b.date)?.getTime() || 0))

  return (
    <section
      className="adm-panel"
      id="panel-agenda"
      role="tabpanel"
      aria-labelledby="nav-agenda"
      tabIndex={0}
      hidden={panel !== 'panel-agenda'}
    >
      <div className="adm-head">
        <div>
          <span className="eyebrow">Encontros</span>
          <h1>Eventos</h1>
          <p className="adm-head-sub">Publique os encontros que aparecem no site e mantenha datas, locais e estados sempre actualizados.</p>
        </div>
        <div className="adm-head-actions">
          <button className="adm-btn adm-btn--primary" type="button" onClick={() => openEvent()}>Novo evento <span aria-hidden="true">+</span></button>
        </div>
      </div>

      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th scope="col">Evento</th>
              <th scope="col">Data</th>
              <th scope="col">Local</th>
              <th scope="col">Estado</th>
              <th scope="col" className="adm-cell-actions">Acções</th>
            </tr>
          </thead>
          <tbody id="event-body">
            {events.map((event) => (
              <tr key={event.id}>
                <td>
                  <div className="adm-contt">
                    {event.image ? <img className="adm-thumb" src={event.image} alt="" width={70} height={40} /> : null}
                    <div>
                      <strong>{event.title}</strong>
                      <small>{event.kind}{event.entry ? ' · ' + event.entry : ''}</small>
                    </div>
                  </div>
                </td>
                <td><span className="adm-date">{fmtDate(event.date)}</span></td>
                <td>
                  {event.place || '—'}
                  {event.description ? <small>{event.description}</small> : null}
                </td>
                <td>
                  <button
                    className={'st ' + (event.status === 'published' ? 'st--published' : 'st--draft')}
                    type="button"
                    title="Alternar estado"
                    onClick={() => toggleEventStatus(event.id)}
                  >
                    {event.status === 'published' ? 'Confirmado' : 'Rascunho'}
                  </button>
                </td>
                <td className="adm-cell-actions">
                  <div className="adm-acts">
                    <button className="adm-ibtn" type="button" title="Editar" onClick={() => openEvent(event.id)}><Icon name="edit" /></button>
                    <button className="adm-ibtn adm-ibtn--danger" type="button" title="Eliminar" onClick={() => deleteEvent(event.id)}><Icon name="trash" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="adm-empty" hidden={events.length > 0}>
        <strong>Sem eventos agendados</strong>
        <p>Crie um novo encontro para o publicar nos eventos da plataforma.</p>
      </div>
    </section>
  )
}
