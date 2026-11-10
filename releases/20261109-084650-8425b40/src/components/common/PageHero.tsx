import type { ReactNode } from 'react'

type Props = {
  title: string
  lead?: string
  kicker?: string
  portrait?: string
  children?: ReactNode
}

/** Cabeçalho das páginas internas: título em Cinzel, texto e a luz atrás do retrato. */
export default function PageHero({ title, lead, kicker, portrait, children }: Props) {
  return (
    <section className={`page-hero${portrait ? ' page-hero--portrait' : ''}`}>
      <div className="wrap page-hero__inner">
        <div className="page-hero__copy">
          {kicker && <p className="kicker">{kicker}</p>}
          <h1 className="display">{title}</h1>
          {lead && <p className="lead">{lead}</p>}
          {children}
        </div>
        {portrait && (
          <div className="page-hero__figure" aria-hidden="true">
            <div className="glow glow--page" />
            <img src={portrait} alt="" width={600} height={900} />
          </div>
        )}
      </div>
    </section>
  )
}
