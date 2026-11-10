import type { ReactNode } from 'react'
import Icon from './Icon'

type Props = {
  image: string
  title: string
  meta?: string
  badges?: ReactNode
  active?: boolean
  onClick: () => void
  label?: string
}

/** Cartaz 16:9 de uma série ou aula, com título sobre a imagem. */
export default function Poster({ image, title, meta, badges, active, onClick, label }: Props) {
  return (
    <button type="button" className={`poster${active ? ' poster--active' : ''}`} onClick={onClick} aria-label={label ?? title} aria-pressed={active}>
      <img className="poster__image" src={image} width={1400} height={788} alt="" loading="lazy" decoding="async" />
      {badges && <span className="poster__badges">{badges}</span>}
      <span className="poster__play"><Icon name="play" filled /></span>
      <span className="poster__body">
        <span className="poster__title">{title}</span>
        {meta && <span className="poster__meta">{meta}</span>}
      </span>
    </button>
  )
}
