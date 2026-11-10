import crypto from 'node:crypto'
import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { HttpError } from '../../server/middleware/errorMiddleware.ts'
import { createGoogleAuth, type GoogleAuthService, type GoogleProfile } from '../../server/services/googleAuthService.ts'
import { ADMIN, createClient, startTestServer } from './helpers.ts'

const CLIENT_ID = 'test-client.apps.googleusercontent.com'

/** Verificador falso: o "token" é o JSON do perfil; 'bad' é recusado. */
function fakeGoogle(): GoogleAuthService {
  return {
    clientId: CLIENT_ID,
    async verify(credential): Promise<GoogleProfile> {
      if (credential.startsWith('bad')) throw new HttpError(401, 'invalid_google_token')
      return JSON.parse(Buffer.from(credential, 'base64url').toString('utf8'))
    },
  }
}
const token = (profile: GoogleProfile) => Buffer.from(JSON.stringify(profile)).toString('base64url').padEnd(24, 'A')

describe('Google sign-in endpoint', () => {
  let server: Awaited<ReturnType<typeof startTestServer>>
  before(async () => {
    server = await startTestServer({ seed: false, googleAuth: fakeGoogle() })
  })
  after(async () => {
    await server.close()
  })

  test('exposes the public client id', async () => {
    const result = await createClient(server.base).get('/api/auth/google/config')
    assert.deepEqual(result.json, { clientId: CLIENT_ID })
  })

  test('creates a member without password, then signs the same account in again', async () => {
    const client = createClient(server.base)
    const first = await client.post('/api/auth/google', { credential: token({ sub: 'g-1', email: 'Maria@Example.com', name: 'Maria' }), language: 'en' })
    assert.equal(first.status, 201)
    assert.equal(first.json.user.email, 'maria@example.com')
    assert.equal(first.json.user.language, 'en')
    assert.equal(first.json.user.googleId, undefined)
    assert.equal(first.json.user.passwordHash, undefined)
    assert.equal((await client.get('/api/auth/session')).json.authenticated, true)

    const stored = await server.db.users.find((user) => user.email === 'maria@example.com')
    assert.equal(stored?.googleId, 'g-1')
    assert.equal(stored?.passwordHash, '')
    // Sem palavra-passe, o login normal nunca entra.
    assert.equal((await createClient(server.base).login('maria@example.com', '')).status, 400)

    const again = await createClient(server.base).post('/api/auth/google', { credential: token({ sub: 'g-1', email: 'maria@example.com', name: 'Maria' }) })
    assert.equal(again.status, 200)
    assert.equal(again.json.user.id, first.json.user.id)
  })

  test('links an existing e-mail account and refuses a different Google account later', async () => {
    const client = createClient(server.base)
    await client.post('/api/auth/register', { name: 'Joana', email: 'joana@example.com', password: 'password-123' })
    const linked = await createClient(server.base).post('/api/auth/google', { credential: token({ sub: 'g-2', email: 'joana@example.com', name: 'J' }) })
    assert.equal(linked.status, 200)
    assert.equal(linked.json.user.name, 'Joana')
    assert.equal((await createClient(server.base).login('joana@example.com', 'password-123')).status, 200)

    const other = await createClient(server.base).post('/api/auth/google', { credential: token({ sub: 'g-3', email: 'joana@example.com', name: 'J' }) })
    assert.equal(other.status, 409)
    assert.equal(other.json.error, 'google_account_mismatch')
  })

  test('rejects invalid tokens, suspended members and new accounts when signups are closed', async () => {
    const client = createClient(server.base)
    assert.equal((await client.post('/api/auth/google', { credential: 'bad-token-xxxxxxxxxxxxxxxx' })).json.error, 'invalid_google_token')
    assert.equal((await client.post('/api/auth/google', {}, { 'X-Ana-Client': '' })).status, 403)

    const suspended = await server.db.users.find((user) => user.email === 'maria@example.com')
    await server.db.users.update(suspended!.id, { status: 'suspended' })
    const blocked = await client.post('/api/auth/google', { credential: token({ sub: 'g-1', email: 'maria@example.com', name: 'Maria' }) })
    assert.equal(blocked.json.error, 'account_suspended')

    await server.db.settings.write({ signups: false })
    const closed = await client.post('/api/auth/google', { credential: token({ sub: 'g-9', email: 'nova@example.com', name: 'Nova' }) })
    assert.equal(closed.status, 403)
    assert.equal(closed.json.error, 'signups_closed')
    await server.db.settings.write({ signups: true })
  })

  test('is unavailable without GOOGLE_CLIENT_ID', async () => {
    const plain = await startTestServer({ seed: false, config: { googleClientId: '' } })
    try {
      const client = createClient(plain.base)
      assert.deepEqual((await client.get('/api/auth/google/config')).json, { clientId: null })
      const result = await client.post('/api/auth/google', { credential: token({ sub: 'x', email: ADMIN.email, name: '' }) })
      assert.equal(result.status, 503)
      assert.equal(result.json.error, 'google_not_configured')
    } finally {
      await plain.close()
    }
  })
})

describe('Google ID token verification', () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' }
  let fetches = 0
  const fakeFetch = (async () => {
    fetches += 1
    return new Response(JSON.stringify({ keys: [jwk] }), { headers: { 'cache-control': 'public, max-age=600' } })
  }) as typeof fetch

  function sign(claims: Record<string, unknown>, kid = 'k1', key = privateKey): string {
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
    const data = `${encode({ alg: 'RS256', kid, typ: 'JWT' })}.${encode(claims)}`
    return `${data}.${crypto.sign('RSA-SHA256', Buffer.from(data), key).toString('base64url')}`
  }
  const now = () => Math.floor(Date.now() / 1000)
  const valid = () => ({ iss: 'https://accounts.google.com', aud: CLIENT_ID, exp: now() + 300, sub: '123', email: 'a@example.com', email_verified: true, name: 'Ana' })

  async function code(promise: Promise<unknown>): Promise<string> {
    try {
      await promise
      return 'ok'
    } catch (error) {
      return (error as HttpError).code
    }
  }

  test('accepts a token signed by a Google key for this client and caches the keys', async () => {
    const google = createGoogleAuth(CLIENT_ID, fakeFetch)
    assert.deepEqual(await google.verify(sign(valid())), { sub: '123', email: 'a@example.com', name: 'Ana' })
    await google.verify(sign(valid()))
    assert.equal(fetches, 1)
  })

  test('rejects wrong audience, issuer, expiry, signature and unverified e-mail', async () => {
    const google = createGoogleAuth(CLIENT_ID, fakeFetch)
    const other = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey
    assert.equal(await code(google.verify(sign({ ...valid(), aud: 'someone-else' }))), 'invalid_google_token')
    assert.equal(await code(google.verify(sign({ ...valid(), iss: 'https://evil.example' }))), 'invalid_google_token')
    assert.equal(await code(google.verify(sign({ ...valid(), exp: now() - 600 }))), 'invalid_google_token')
    assert.equal(await code(google.verify(sign(valid(), 'k1', other))), 'invalid_google_token')
    assert.equal(await code(google.verify(sign(valid(), 'unknown'))), 'invalid_google_token')
    assert.equal(await code(google.verify('not.a.jwt')), 'invalid_google_token')
    assert.equal(await code(google.verify(sign({ ...valid(), email_verified: false }))), 'google_email_unverified')
  })
})
