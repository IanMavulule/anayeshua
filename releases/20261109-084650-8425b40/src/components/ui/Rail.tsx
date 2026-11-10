import { useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import Icon from './Icon'

/** Fila horizontal de cartazes com título e botões de deslocação. */
export default function Rail({ id, title, action, children }: { id: string; title: string; action?: ReactNode; children: ReactNode }) {
  const { t } = useTranslation()
  const trackRef = useRef<HTMLDivElement | null>(null)
  const scroll = (direction: -1 | 1) => {
    const track = trackRef.current
    if (track) track.scrollBy({ left: direction * track.clientWidth * 0.8, behavior: 'smooth' })
  }

  return (
    <section className="rail" aria-labelledby={id}>
      <div className="section-head">
        <h2 id={id}>{title}</h2>
        <div className="rail__controls">
          {action}
          <button type="button" className="icon-btn" aria-label={t('Previous')} onClick={() => scroll(-1)}><Icon name="arrow-left" /></button>
          <button type="button" className="icon-btn" aria-label={t('Next')} onClick={() => scroll(1)}><Icon name="arrow-right" /></button>
        </div>
      </div>
      <div className="rail__track" ref={trackRef}>{children}</div>
    </section>
  )
}
