import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generatePassword, hashPassword, verifyPassword } from '../../server/services/passwordService.ts'
import { createTokenService } from '../../server/services/tokenService.ts'
import { extendSubscription, hasActiveSubscription, hasAssistance } from '../../server/models/userModel.ts'
import { createFailureLimiter } from '../../server/middleware/rateLimiter.ts'

test('hashPassword produces salted scrypt hashes that verify', () => {
  const first = hashPassword('segredo-123')
  const second = hashPassword('segredo-123')
  assert.notEqual(first, second)
  assert.ok(verifyPassword('segredo-123', first))
  assert.ok(!verifyPassword('errado', first))
  assert.ok(!verifyPassword('segredo-123', 'plain-text'))
  assert.ok(generatePassword().length >= 10)
})

test('session tokens cannot be used as media tokens and vice versa', () => {
  const tokens = createTokenService('secret')
  const session = tokens.createSession('u1', 'member')
  const media = tokens.createMediaToken('vid', 'u1').token
  assert.equal(tokens.readSession(session)?.uid, 'u1')
  assert.equal(tokens.readMediaToken(session), null)
  assert.equal(tokens.readSession(media), null)
  assert.equal(createTokenService('other').readSession(session), null)
})

test('extendSubscription adds the plan days on top of an active subscription', () => {
  const now = new Date('2026-11-01T00:00:00Z')
  const first = extendSubscription(null, '200', 'p1', now)
  assert.equal(first.expiresAt, '2026-12-01T00:00:00.000Z')
  const second = extendSubscription(first, '500', 'p2', now)
  assert.equal(second.expiresAt, '2027-03-01T00:00:00.000Z')
  assert.equal(second.startedAt, first.startedAt)
  assert.ok(hasActiveSubscription({ role: 'member', subscription: first }, now.getTime()))
  assert.ok(!hasActiveSubscription({ role: 'member', subscription: first }, Date.parse('2026-12-02')))
  assert.ok(hasActiveSubscription({ role: 'admin', subscription: null }))
})

test('only the 500 MT plan grants assistance, and a 200 MT renewal keeps what was paid', () => {
  const now = new Date('2026-11-01T00:00:00Z')
  const member = (subscription: ReturnType<typeof extendSubscription> | null) => ({ role: 'member' as const, subscription })

  const monthly = extendSubscription(null, '200', 'p1', now)
  assert.equal(monthly.assistanceExpiresAt, null)
  assert.ok(!hasAssistance(member(monthly), now.getTime()))

  const quarterly = extendSubscription(null, '500', 'p2', now)
  assert.equal(quarterly.assistanceExpiresAt, '2027-01-30T00:00:00.000Z')
  assert.ok(hasAssistance(member(quarterly), now.getTime()))

  // Renovar com 200 MT prolonga o Premium mas a assistência acaba quando foi paga.
  const renewed = extendSubscription(quarterly, '200', 'p3', now)
  assert.equal(renewed.expiresAt, '2027-03-01T00:00:00.000Z')
  assert.equal(renewed.assistanceExpiresAt, '2027-01-30T00:00:00.000Z')
  assert.ok(hasAssistance(member(renewed), Date.parse('2027-01-29')))
  assert.ok(!hasAssistance(member(renewed), Date.parse('2027-02-15')))
  assert.ok(hasActiveSubscription(member(renewed), Date.parse('2027-02-15')))

  // Subscrições antigas, sem o campo, seguem o plano gravado.
  const legacy500 = { plan: '500' as const, startedAt: now.toISOString(), expiresAt: '2027-01-30T00:00:00.000Z', paymentId: null }
  const legacy200 = { ...legacy500, plan: '200' as const }
  assert.ok(hasAssistance(member(legacy500), now.getTime()))
  assert.ok(!hasAssistance(member(legacy200), now.getTime()))
  assert.ok(hasAssistance({ role: 'admin', subscription: null }))
})

test('failure limiter blocks after the configured number of failures', () => {
  const limiter = createFailureLimiter(2, 1000)
  limiter.hit('k', 0)
  assert.ok(!limiter.blocked('k', 10))
  limiter.hit('k', 20)
  assert.ok(limiter.blocked('k', 30))
  assert.ok(!limiter.blocked('k', 2000))
})
