import { useTranslation } from 'react-i18next'
import { useEvents } from '../../hooks/catalog/useCatalog'
import Icon from '../ui/Icon'

function dateParts(value: string, language: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const locale = language === 'en' ? 'en-GB' : 'pt-PT'
  return {
    day: date.toLocaleDateString(locale, { day: '2-digit' }),
    month: date.toLocaleDateString(locale, { month: 'short' }).replace('.', ''),
    time: date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
    weekday: date.toLocaleDateString(locale, { weekday: 'long' }),
  }
}

/** Eventos: próximos encontros publicados no painel. */
export default function NextEvent() {
  const { t, i18n } = useTranslation()
  const { events, loading } = useEvents()
  if (loading || events.length === 0) return <div id="eventos" />

  return (
    <div className="band band--mist">
    <section className="wrap agenda" id="eventos" aria-labelledby="agenda-title">
      <div className="section-head">
        <h2 id="agenda-title">{t('Upcoming gatherings')}</h2>
      </div>
      <div className="agenda__list">
        {events.slice(0, 4).map((event, index) => {
          const parts = dateParts(event.date, i18n.language)
          return (
            <article key={event.id} className={`event${index === 0 ? ' event--next' : ''}${event.image ? ' event--photo' : ''}`}>
              {event.image && <img className="event__photo" src={event.image} alt="" width={1400} height={788} loading="lazy" />}
              {parts && (
                <div className="event__date">
                  <strong>{parts.day}</strong>
                  <span>{parts.month}</span>
                </div>
              )}
              <div className="event__body">
                <h3>{event.title}</h3>
                {event.description && <p>{event.description}</p>}
                <ul className="event__meta">
                  {parts && <li><Icon name="calendar" />{parts.weekday}, {parts.time}</li>}
                  {event.place && <li><Icon name="pin" />{event.place}</li>}
                  <li><Icon name="sparkle" />{event.entry || t('Free')}</li>
                </ul>
              </div>
            </article>
          )
        })}
      </div>
    </section>
    </div>
  )
}
