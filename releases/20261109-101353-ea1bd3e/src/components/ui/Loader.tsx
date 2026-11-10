import { useTranslation } from 'react-i18next'

type LoaderProps = {
  /** `page` ocupa o ecrã (rotas e páginas inteiras); `block` fica no lugar da secção que espera dados. */
  variant?: 'page' | 'block' | 'inline'
  label?: string
  className?: string
}

/** Indicador de carregamento da marca: um halo dourado que gira devagar, com a legenda por baixo. */
export default function Loader({ variant = 'block', label, className = '' }: LoaderProps) {
  const { t } = useTranslation()
  const text = label ?? t('Loading…')
  return (
    <div className={`loader loader--${variant}${className ? ` ${className}` : ''}`} role="status" aria-live="polite">
      <span className="loader__halo" aria-hidden="true">
        <span className="loader__ring" />
        <span className="loader__core" />
      </span>
      <span className={variant === 'inline' ? 'visually-hidden' : 'loader__label'}>{text}</span>
    </div>
  )
}
