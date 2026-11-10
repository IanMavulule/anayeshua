import crypto from 'node:crypto'
import type { Role } from '../models/entities.ts'

export const SESSION_TTL_MS = 12 * 60 * 60 * 1000 // 12h
export const MEDIA_TOKEN_TTL_MS = 5 * 60 * 1000 // 5 min

export interface SessionPayload {
  uid: string
  role: Role
  exp: number
}

export interface MediaPayload {
  v: string
  uid: string
  exp: number
}

type Payload = Record<string, unknown>

/**
 * Tokens sem estado: base64url(JSON) + '.' + HMAC-SHA256.
 * O mesmo segredo assina sessões e tokens de média; o campo `k` impede que
 * um tipo de token seja aceite no lugar do outro.
 */
export function createTokenService(secret: string) {
  const mac = (body: string) => crypto.createHmac('sha256', secret).update(body).digest('base64url')

  function sign(payload: Payload): string {
    const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
    return `${body}.${mac(body)}`
  }

  function verify(token: unknown, kind: string): Payload | null {
    if (typeof token !== 'string') return null
    const dot = token.indexOf('.')
    if (dot < 1 || dot === token.length - 1) return null
    const body = token.slice(0, dot)
    const given = Buffer.from(token.slice(dot + 1), 'utf8')
    const expected = Buffer.from(mac(body), 'utf8')
    if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null
    let payload: unknown
    try {
      payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    } catch {
      return null
    }
    if (!payload || typeof payload !== 'object') return null
    const candidate = payload as Payload
    if (candidate.k !== kind) return null
    if (typeof candidate.exp !== 'number' || candidate.exp <= Date.now()) return null
    return candidate
  }

  return {
    createSession(uid: string, role: Role): string {
      return sign({ k: 'session', uid, role, exp: Date.now() + SESSION_TTL_MS })
    },
    readSession(token: unknown): SessionPayload | null {
      const payload = verify(token, 'session')
      if (!payload || typeof payload.uid !== 'string') return null
      const role: Role = payload.role === 'admin' ? 'admin' : 'member'
      return { uid: payload.uid, role, exp: payload.exp as number }
    },
    createMediaToken(videoId: string, uid: string): { token: string; expiresAt: number } {
      const expiresAt = Date.now() + MEDIA_TOKEN_TTL_MS
      return { token: sign({ k: 'media', v: videoId, uid, exp: expiresAt }), expiresAt }
    },
    readMediaToken(token: unknown): MediaPayload | null {
      const payload = verify(token, 'media')
      if (!payload || typeof payload.v !== 'string' || typeof payload.uid !== 'string') return null
      return { v: payload.v, uid: payload.uid, exp: payload.exp as number }
    },
  }
}

export type TokenService = ReturnType<typeof createTokenService>
