import crypto from 'node:crypto'
import { HttpError } from '../middleware/errorMiddleware.ts'

/** Dados da conta Google que o servidor confirmou no ID token. */
export interface GoogleProfile {
  /** Identificador estável da conta Google (claim `sub`). */
  sub: string
  email: string
  name: string
}

/**
 * Entrada com Google (Google Identity Services): o navegador recebe um ID token
 * (JWT RS256) e o servidor confirma-o aqui antes de abrir sessão.
 */
export interface GoogleAuthService {
  /** OAuth Client ID público usado pelo botão; null quando o Google não está configurado. */
  clientId: string | null
  verify(credential: string): Promise<GoogleProfile>
}

const CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs'
const ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com'])
/** Tolerância para relógios ligeiramente desacertados. */
const CLOCK_SKEW_S = 60

type Jwk = crypto.JsonWebKey & { kid?: string }

function decodePart<T>(part: string): T {
  try {
    return JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as T
  } catch {
    throw new HttpError(401, 'invalid_google_token')
  }
}

/** Sem GOOGLE_CLIENT_ID o botão não aparece e o endpoint responde 503. */
export function createDisabledGoogleAuth(): GoogleAuthService {
  return {
    clientId: null,
    async verify() {
      throw new HttpError(503, 'google_not_configured')
    },
  }
}

/**
 * Verificação local do ID token com as chaves públicas da Google (guardadas em
 * memória pelo tempo indicado em Cache-Control), sem dependências extra.
 */
export function createGoogleAuth(clientId: string, fetchImpl: typeof fetch = fetch): GoogleAuthService {
  let cache: { keys: Map<string, crypto.KeyObject>; expiresAt: number } | null = null

  async function loadKeys(force = false): Promise<Map<string, crypto.KeyObject>> {
    if (!force && cache && cache.expiresAt > Date.now()) return cache.keys
    const response = await fetchImpl(CERTS_URL)
    if (!response.ok) throw new HttpError(502, 'google_unreachable')
    const body = (await response.json()) as { keys?: Jwk[] }
    const keys = new Map<string, crypto.KeyObject>()
    for (const jwk of body.keys ?? []) {
      if (jwk.kid) keys.set(jwk.kid, crypto.createPublicKey({ key: jwk, format: 'jwk' }))
    }
    const maxAge = Number(/max-age=(\d+)/.exec(response.headers.get('cache-control') ?? '')?.[1]) || 3600
    cache = { keys, expiresAt: Date.now() + maxAge * 1000 }
    return keys
  }

  return {
    clientId,
    async verify(credential) {
      const parts = credential.split('.')
      if (parts.length !== 3) throw new HttpError(401, 'invalid_google_token')
      const [headerPart, payloadPart, signaturePart] = parts
      const header = decodePart<{ alg?: string; kid?: string }>(headerPart)
      if (header.alg !== 'RS256' || !header.kid) throw new HttpError(401, 'invalid_google_token')

      let key: crypto.KeyObject | undefined
      try {
        key = (await loadKeys()).get(header.kid) ?? (await loadKeys(true)).get(header.kid)
      } catch (error) {
        if (error instanceof HttpError) throw error
        throw new HttpError(502, 'google_unreachable')
      }
      if (!key) throw new HttpError(401, 'invalid_google_token')

      const valid = crypto.verify(
        'RSA-SHA256',
        Buffer.from(`${headerPart}.${payloadPart}`),
        key,
        Buffer.from(signaturePart, 'base64url'),
      )
      if (!valid) throw new HttpError(401, 'invalid_google_token')

      const claims = decodePart<{
        iss?: string; aud?: string; exp?: number; sub?: string
        email?: string; email_verified?: boolean | string; name?: string
      }>(payloadPart)
      const now = Math.floor(Date.now() / 1000)
      if (!claims.iss || !ISSUERS.has(claims.iss)) throw new HttpError(401, 'invalid_google_token')
      if (claims.aud !== clientId) throw new HttpError(401, 'invalid_google_token')
      if (!claims.exp || claims.exp + CLOCK_SKEW_S < now) throw new HttpError(401, 'invalid_google_token')
      if (!claims.sub || !claims.email) throw new HttpError(401, 'invalid_google_token')
      // Só um e-mail confirmado pela Google pode abrir (ou ligar-se a) uma conta existente.
      if (claims.email_verified !== true && claims.email_verified !== 'true') throw new HttpError(403, 'google_email_unverified')

      return { sub: claims.sub, email: claims.email, name: (claims.name ?? '').trim() }
    },
  }
}
