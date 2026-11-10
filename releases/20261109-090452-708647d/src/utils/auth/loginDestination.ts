import { ROUTES } from '../constants/routes'

/**
 * Destino seguro depois do login: só caminhos internos (começados por uma
 * única "/"). Impede redireccionamentos para outros sites via `?next=`.
 */
export function loginDestination(search: string): string {
  const requested = new URLSearchParams(search).get('next')
  if (!requested || !requested.startsWith('/') || requested.startsWith('//') || requested.includes('\\')) {
    return ROUTES.dashboard
  }
  return requested
}

export function loginUrl(next: string): string {
  return `${ROUTES.login}?next=${encodeURIComponent(next)}`
}
