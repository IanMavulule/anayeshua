import i18n from '../../locales'

const locale = () => (i18n.language === 'en' ? 'en-GB' : 'pt-PT')

export function formatDate(value: string | null | undefined, withTime = false): string {
  if (!value) return '—'
  const date = new Date(value.length === 10 ? `${value}T00:00` : value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(locale(), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
}

export function formatEventDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const day = date.toLocaleDateString(locale(), { day: 'numeric', month: 'long' })
  const time = date.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })
  return `${day} · ${time}`
}
