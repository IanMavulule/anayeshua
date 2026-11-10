import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Common = { variant?: Variant; size?: 'md' | 'sm'; block?: boolean; children: ReactNode; className?: string }

function classes({ variant = 'secondary', size = 'md', block, className }: Omit<Common, 'children'>): string {
  return ['btn', `btn--${variant}`, size === 'sm' ? 'btn--sm' : '', block ? 'btn--block' : '', className ?? ''].filter(Boolean).join(' ')
}

/** Botão da interface. Para navegação use <ButtonLink>. */
export function Button({ variant, size, block, className, children, type = 'button', ...rest }: Common & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={classes({ variant, size, block, className })} {...rest}>
      {children}
    </button>
  )
}

/** Ligação com aspecto de botão (rotas internas ou URLs externos). */
export function ButtonLink({ to, external = false, variant, size, block, className, children }: Common & { to: string; external?: boolean }) {
  const cls = classes({ variant, size, block, className })
  if (external) {
    return (
      <a className={cls} href={to} target="_blank" rel="noreferrer">
        {children}
      </a>
    )
  }
  return (
    <Link className={cls} to={to}>
      {children}
    </Link>
  )
}
