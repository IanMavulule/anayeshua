import crypto from 'node:crypto'
import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { newPartnerTransactionId, normalizeAccount } from '../../server/models/paymentModel.ts'
import {
  buildBearerKey,
  createImaliWayProvider,
  parseWebhookEvent,
  verifyWebhookSignature,
  type ImaliWayConfig,
} from '../../server/services/payments/imaliwayProvider.ts'
import { createFakePaymentProvider } from './fakePaymentProvider.ts'
import { createClient, startTestServer } from './helpers.ts'

describe('account normalization', () => {
  test('accepts the right prefixes per wallet and strips +258', () => {
    assert.equal(normalizeAccount('mpesa', '+258 84 123 4567'), '841234567')
    assert.equal(normalizeAccount('mpesa', '86 123 4567'), null)
    assert.equal(normalizeAccount('emola', '871234567'), '871234567')
    assert.equal(normalizeAccount('mkesh', '821234567'), '821234567')
    assert.equal(normalizeAccount('imali', '123456789'), '123456789')
    assert.equal(normalizeAccount('imali', '12345'), null)
  })

  test('partner transaction ids have exactly 12 alphanumeric characters', () => {
    for (let index = 0; index < 50; index++) assert.match(newPartnerTransactionId(), /^[A-Z0-9]{12}$/)
  })
})

describe('iMaliWay provider', () => {
  const { publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
  const config: ImaliWayConfig = {
    baseUrl: 'https://gateway.test/api/partners/imaliway/v2',
    clientId: 'client-1',
    apiKey: 'api-key-1',
    publicKey: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    storeAccountNumber: '900000001',
    webhookSecret: 'whsec',
    timeoutMs: 1000,
  }

  test('sends a signed push C2B request with the documented fields', async () => {
    const calls: { url: string; init: RequestInit }[] = []
    const fakeFetch = (async (url: string, init: RequestInit) => {
      calls.push({ url, init })
      return new Response(
        JSON.stringify({ data: { transaction_id: 77, status: 'PENDING', expiration_datetime: '2026-11-05 12:02:00' } }),
        { status: 200 },
      )
    }) as typeof fetch
    const provider = createImaliWayProvider(config, fakeFetch)
    const result = await provider.push({ account: '841234567', amount: 200, method: 'mpesa', partnerTransactionId: 'ABCDEFGHJK23' })

    assert.equal(result.providerRef, '77')
    assert.equal(result.expiresAt, '2026-11-05T10:02:00.000Z')
    assert.equal(calls[0].url, `${config.baseUrl}/payments`)
    const headers = calls[0].init.headers as Record<string, string>
    assert.equal(headers['X-Client-ID'], 'client-1')
    // RSA-ES-PKCS1 com chave de 2048 bits: 256 bytes, diferente em cada pedido (padding aleatório).
    const bearer = Buffer.from(headers.Authorization.replace('Bearer ', ''), 'base64')
    assert.equal(bearer.length, 256)
    assert.notEqual(buildBearerKey(config.apiKey, config.publicKey), buildBearerKey(config.apiKey, config.publicKey))
    assert.deepEqual(JSON.parse(String(calls[0].init.body)), {
      client_account_number: '841234567',
      amount: 200,
      store_account_number: '900000001',
      partner_transaction_id: 'ABCDEFGHJK23',
      payment_method: 'mpesa',
      payment_type: 'push',
      transaction_type: 'C2B',
    })
  })

  test('maps gateway error codes to stable error codes', async () => {
    const fakeFetch = (async () => new Response('{}', { status: 407 })) as unknown as typeof fetch
    const provider = createImaliWayProvider(config, fakeFetch)
    await assert.rejects(
      provider.push({ account: '841234567', amount: 200, method: 'mpesa', partnerTransactionId: 'ABCDEFGHJK23' }),
      (error: Error & { code?: string }) => error.code === 'insufficient_balance',
    )
  })

  test('verifies webhook signatures and rejects stale or forged ones', () => {
    const body = Buffer.from(JSON.stringify({ id: 'evt', type: 'PAYMENT.SUCCESS', data: { payment_id: 77, status: 'SUCCESS' } }))
    const now = Date.now()
    const timestamp = String(Math.floor(now / 1000))
    const signature = crypto.createHmac('sha256', 'whsec').update(`${timestamp}.`).update(body).digest('hex')
    assert.ok(verifyWebhookSignature(body, { timestamp, signature: `sha256=${signature}` }, 'whsec', now))
    assert.ok(verifyWebhookSignature(body, { timestamp, signature }, 'whsec', now))
    assert.ok(!verifyWebhookSignature(body, { timestamp, signature: 'sha256=00' }, 'whsec', now))
    assert.ok(!verifyWebhookSignature(body, { timestamp, signature }, 'whsec', now + 10 * 60 * 1000))
    assert.equal(parseWebhookEvent(JSON.parse(body.toString()))?.status, 'SUCCESS')
    assert.equal(parseWebhookEvent({ type: 'payment.failed', data: { payment_id: 1 } })?.status, 'FAILED')
  })
})

describe('checkout flow', () => {
  let server: Awaited<ReturnType<typeof startTestServer>>

  before(async () => {
    server = await startTestServer({ paymentProvider: createFakePaymentProvider(0), webhookSecret: 'whsec' })
  })

  after(async () => {
    await server.close()
  })

  test('a confirmed payment activates premium access', async () => {
    const client = createClient(server.base)
    await client.post('/api/auth/register', { name: 'Compradora', email: 'compra@example.com', password: 'password-123' })

    assert.equal((await client.post('/api/payments/checkout', { plan: '200', method: 'mpesa', account: '86 000 0000' })).status, 400)

    const checkout = await client.post('/api/payments/checkout', { plan: '200', method: 'mpesa', account: '84 123 4567' })
    assert.equal(checkout.status, 201)
    assert.equal(checkout.json.payment.status, 'pending')
    assert.equal(checkout.json.payment.accountMasked, '*****4567')

    const status = await client.get(`/api/payments/${checkout.json.payment.id}`)
    assert.equal(status.json.payment.status, 'confirmed')
    assert.equal(status.json.user.premium, true)
    assert.equal((await client.post('/api/media-token', { videoId: 'ncts5aoifN0' })).status, 200)

    const other = createClient(server.base)
    await other.post('/api/auth/register', { name: 'Outra', email: 'outra@example.com', password: 'password-123' })
    assert.equal((await other.get(`/api/payments/${checkout.json.payment.id}`)).status, 404)
  })

  test('the webhook confirms a pending payment once', async () => {
    const { db, payments } = server.context
    const user = (await db.users.find((item) => item.email === 'outra@example.com'))!
    const payment = await payments.checkout(user.id, '500', 'emola', '871234567')
    const body = JSON.stringify({ id: 'evt-1', type: 'PAYMENT.SUCCESS', data: { payment_id: payment.providerRef, status: 'SUCCESS' } })
    const timestamp = String(Math.floor(Date.now() / 1000))
    const signature = crypto.createHmac('sha256', 'whsec').update(`${timestamp}.${body}`).digest('hex')
    const send = (sig: string) =>
      fetch(`${server.base}/api/payments/imaliway/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Webhook-Timestamp': timestamp, 'X-Webhook-Signature': `sha256=${sig}` },
        body,
      })

    assert.equal((await send('bad')).status, 401)
    assert.equal((await send(signature)).status, 200)
    assert.equal((await send(signature)).status, 200)
    assert.equal((await db.payments.get(payment.id))?.status, 'confirmed')
    const expires = Date.parse((await db.users.get(user.id))!.subscription!.expiresAt)
    const days = Math.round((expires - Date.now()) / 86400000)
    assert.equal(days, 90)
  })
})
