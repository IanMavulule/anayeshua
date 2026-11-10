import type { ReactNode } from 'react'

/** Título de secção com descrição opcional e acção à direita. */
export default function SectionHead({ id, title, description, action }: { id?: string; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="section-head">
      <div>
        <h2 id={id}>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  )
}
