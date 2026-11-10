// Ícones SVG do painel.

export type IconName =
  | 'edit'
  | 'copy'
  | 'trash'
  | 'play'
  | 'star'
  | 'chat'
  | 'clock'
  | 'alert'
  | 'check'
  | 'film'
  | 'upload'
  | 'up'
  | 'down'

export default function Icon({ name }: { name: IconName }) {
  switch (name) {
    case 'edit':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
          <path d="M4 20h4l11-11-4-4L4 16v4Z" />
          <path d="M13.5 5.5l4 4" />
        </svg>
      )
    case 'copy':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
          <rect x="8.5" y="8.5" width={11} height={11} />
          <path d="M15.5 5.5v-2h-11v11h2" />
        </svg>
      )
    case 'trash':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
          <path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13" />
        </svg>
      )
    case 'play':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M8 5.2 19 12 8 18.8z" />
        </svg>
      )
    case 'star':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z" />
        </svg>
      )
    case 'chat':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
          <path d="M20.5 12a8 8 0 0 1-8 8H4.5l2-3.2A8 8 0 1 1 20.5 12Z" />
          <path d="M8.5 12h.01M12 12h.01M15.5 12h.01" />
        </svg>
      )
    case 'clock':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7.5V12l3 2" />
        </svg>
      )
    case 'alert':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
          <path d="M12 4l9 16H3z" />
          <path d="M12 9.5v4M12 16.5h.01" />
        </svg>
      )
    case 'check':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      )
    case 'film':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
          <rect x="3.5" y="5" width={17} height={14} />
          <path d="M3.5 9.5h17M8 5v14M16 5v14" />
        </svg>
      )
    case 'upload':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
          <path d="M12 16V5M7.5 9.5 12 5l4.5 4.5" />
          <path d="M4.5 15v3.5h15V15" />
        </svg>
      )
    case 'up':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
          <path d="M6 14.5 12 8.5l6 6" />
        </svg>
      )
    case 'down':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
          <path d="M6 9.5 12 15.5l6-6" />
        </svg>
      )
    default:
      return null
  }
}
