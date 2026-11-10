import type { ReactNode } from 'react'

type Tone = 'neutral' | 'gold' | 'success' | 'warning' | 'danger'

export default function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`badge${tone === 'neutral' ? '' : ` badge--${tone}`}`}>{children}</span>
}
