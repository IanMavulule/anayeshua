import { useEffect, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import Icon from './Icon'

/** Diálogo modal com fecho por Escape, clique fora e foco inicial no painel. */
export default function Dialog({ open, labelledBy, onClose, children }: { open: boolean; labelledBy: string; onClose: () => void; children: ReactNode }) {
  const { t } = useTranslation()
  const panelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    panelRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      previous?.focus?.()
    }
  }, [open, onClose])

  return (
    <div className="dialog" hidden={!open}>
      <button className="dialog__scrim" type="button" aria-label={t('Close')} onClick={onClose} />
      <div className="dialog__panel" role="dialog" aria-modal="true" aria-labelledby={labelledBy} tabIndex={-1} ref={panelRef}>
        <button className="icon-btn dialog__close" type="button" aria-label={t('Close')} onClick={onClose}><Icon name="close" /></button>
        {children}
      </div>
    </div>
  )
}
