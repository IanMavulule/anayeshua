import type { NextFunction, Request, Response } from 'express'
import type { Database } from '../models/store/database.ts'
import { SESSION_TTL_MS, type TokenService } from '../services/tokenService.ts'
import type { User } from '../models/entities.ts'
import { HttpError } from './errorMiddleware.ts'

export const SESSION_COOKIE = 'ana_sess'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User
    }
  }
}

// Parse manual do cabeçalho `cookie` (sem cookie-parser).
export function parseCookies(header: unknown): Record<string, string> {
  const cookies: Record<string, string> = {}
  if (typeof header !== 'string' || header.length === 0) return cookies
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq < 1) continue
    const key = part.slice(0, eq).trim()
    if (!key) continue
    const raw = part.slice(eq + 1).trim()
    try {
      cookies[key] = decodeURIComponent(raw)
    } catch {
      cookies[key] = raw
    }
  }
  return cookies
}

export function sessionCookie(value: string, secure: boolean): string {
  const flags = `Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`
  return `${SESSION_COOKIE}=${value}; ${flags}${secure ? '; Secure' : ''}`
}

export function expiredSessionCookie(secure: boolean): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`
}

/**
 * Lê a sessão do cookie e carrega o utilizador da base de dados em cada pedido,
 * para que suspensões, mudanças de papel e expiração do plano tenham efeito
 * imediato.
 */
export function attachUser(db: Database, tokens: TokenService) {
  return async (request: Request, _response: Response, next: NextFunction) => {
    try {
      const session = tokens.readSession(parseCookies(request.headers.cookie)[SESSION_COOKIE])
      if (session) {
        const user = await db.users.get(session.uid)
        if (user && user.status === 'active') request.user = user
      }
      next()
    } catch (error) {
      next(error)
    }
  }
}

export function requireAuth(request: Request, _response: Response, next: NextFunction): void {
  if (!request.user) return next(new HttpError(401, 'unauthorized'))
  next()
}

export function requireAdmin(request: Request, _response: Response, next: NextFunction): void {
  if (!request.user) return next(new HttpError(401, 'unauthorized'))
  if (request.user.role !== 'admin') return next(new HttpError(403, 'forbidden'))
  next()
}

/**
 * Protecção CSRF: pedidos que alteram estado em /api têm de trazer o
 * cabeçalho `X-Ana-Client`. Um site de terceiros não o consegue enviar sem
 * um preflight CORS, que este servidor não autoriza. O webhook do iMaliWay
 * fica de fora porque é autenticado pela assinatura.
 */
export function requireClientHeader(exempt: string[] = []) {
  return (request: Request, _response: Response, next: NextFunction) => {
    const safe = request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS'
    if (safe || exempt.includes(request.path)) return next()
    if (request.get('x-ana-client') !== 'web') return next(new HttpError(403, 'missing_client_header'))
    next()
  }
}
