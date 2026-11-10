import crypto from 'node:crypto'
import fs from 'node:fs'
import {
  PaymentProviderError,
  type PaymentProvider,
  type ProviderStatus,
  type PushRequest,
  type PushResult,
} from './providerTypes.ts'

/**
 * Integração com o gateway iMaliWay (Paytek Africa), modo "push C2B":
 * o cliente recebe no telemóvel o pedido de confirmação do pagamento.
 * Documentação: https://imaliway.co.mz/doc2/doc.html
 */
export interface ImaliWayConfig {
  baseUrl: string
  clientId: string
  apiKey: string
  publicKey: string
  storeAccountNumber: string
  webhookSecret: string
  timeoutMs: number
}

export const DEFAULT_IMALIWAY_BASE_URL = 'https://paytek-africa.net:11901/api/partners/imaliway/v2'

function buildImaliWayConfig(env: NodeJS.ProcessEnv): ImaliWayConfig {
  const publicKey = env.IMALIWAY_PUBLIC_KEY_FILE
    ? safeRead(env.IMALIWAY_PUBLIC_KEY_FILE)
    : (env.IMALIWAY_PUBLIC_KEY || '').replace(/\\n/g, '\n')
  const config: ImaliWayConfig = {
    baseUrl: (env.IMALIWAY_BASE_URL || DEFAULT_IMALIWAY_BASE_URL).replace(/\/+$/, ''),
    clientId: env.IMALIWAY_CLIENT_ID || '',
    apiKey: env.IMALIWAY_API_KEY || '',
    publicKey,
    storeAccountNumber: env.IMALIWAY_STORE_ACCOUNT || '',
    webhookSecret: env.IMALIWAY_WEBHOOK_SECRET || '',
    timeoutMs: Number(env.IMALIWAY_TIMEOUT_MS) || 20000,
  }
  return config
}

/** Lê a configuração do ambiente; devolve null se faltar algum campo obrigatório. */
export function readImaliWayConfig(env: NodeJS.ProcessEnv = process.env): ImaliWayConfig | null {
  const config = buildImaliWayConfig(env)
  return missingImaliWayFields(config).length ? null : config
}

/** Configuração tal como está, mesmo incompleta (para mensagens de erro). */
readImaliWayConfig.partial = (env: NodeJS.ProcessEnv = process.env): ImaliWayConfig => buildImaliWayConfig(env)

export function missingImaliWayFields(config: ImaliWayConfig): string[] {
  const required: [keyof ImaliWayConfig, string][] = [
    ['clientId', 'IMALIWAY_CLIENT_ID'],
    ['apiKey', 'IMALIWAY_API_KEY'],
    ['publicKey', 'IMALIWAY_PUBLIC_KEY ou IMALIWAY_PUBLIC_KEY_FILE'],
    ['storeAccountNumber', 'IMALIWAY_STORE_ACCOUNT'],
  ]
  return required.filter(([key]) => !config[key]).map(([, name]) => name)
}

function safeRead(file: string): string {
  try {
    return fs.readFileSync(file, 'utf8')
  } catch {
    return ''
  }
}

/** api_key cifrada com a chave pública da Paytek (RSA-ES-PKCS1), em base64. */
export function buildBearerKey(apiKey: string, publicKey: string): string {
  return crypto
    .publicEncrypt({ key: publicKey, padding: crypto.constants.RSA_PKCS1_PADDING }, Buffer.from(apiKey, 'utf8'))
    .toString('base64')
}

// Mensagens dos códigos de erro documentados pelo gateway.
const ERROR_CODES: Record<number, { code: string; message: string }> = {
  400: { code: 'invalid_reference', message: 'Referência da transacção inválida.' },
  401: { code: 'payment_rejected', message: 'O pagamento não foi aceite ou expirou.' },
  402: { code: 'invalid_amount', message: 'Valor inválido.' },
  404: { code: 'invalid_account', message: 'Conta do cliente ou da loja inválida.' },
  406: { code: 'duplicate_reference', message: 'Referência da transacção já utilizada.' },
  407: { code: 'insufficient_balance', message: 'Saldo insuficiente.' },
  408: { code: 'account_blocked', message: 'Conta ou loja bloqueada.' },
  409: { code: 'amount_unavailable', message: 'Valor indisponível.' },
  422: { code: 'malformed_request', message: 'Pedido mal formado.' },
  500: { code: 'provider_auth', message: 'Credenciais do iMaliWay inválidas.' },
  501: { code: 'client_kyc_limit', message: 'Limite KYC do cliente atingido.' },
  502: { code: 'store_kyc_limit', message: 'Limite KYC da loja atingido.' },
}

function normalizeStatus(value: unknown): ProviderStatus {
  const status = String(value || '').toUpperCase()
  if (status === 'SUCCESS' || status === 'FAILED' || status === 'EXPIRED') return status
  return 'PENDING'
}

/** "Y-m-d H:i:s" (hora de Maputo, como no gateway) → ISO. */
function parseGatewayDate(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) return null
  const date = new Date(`${value.replace(' ', 'T')}+02:00`)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function createImaliWayProvider(config: ImaliWayConfig, fetchImpl: typeof fetch = fetch): PaymentProvider {
  async function request(method: 'GET' | 'POST', path: string, body?: unknown): Promise<Record<string, unknown>> {
    let response: Response
    try {
      response = await fetchImpl(`${config.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${buildBearerKey(config.apiKey, config.publicKey)}`,
          'X-Client-ID': config.clientId,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(config.timeoutMs),
      })
    } catch {
      throw new PaymentProviderError('provider_unreachable', 'Não foi possível contactar o iMaliWay.', 503)
    }
    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>
    if (!response.ok) {
      const known = ERROR_CODES[response.status]
      const providerMessage = typeof payload.message === 'string' ? payload.message : ''
      throw new PaymentProviderError(
        known?.code ?? 'provider_error',
        known?.message ?? (providerMessage || `Erro ${response.status} do iMaliWay.`),
        response.status >= 500 ? 502 : 400,
      )
    }
    return payload
  }

  return {
    name: 'imaliway',

    async push({ account, amount, method, partnerTransactionId }: PushRequest): Promise<PushResult> {
      const payload = await request('POST', '/payments', {
        client_account_number: account,
        amount,
        store_account_number: config.storeAccountNumber,
        partner_transaction_id: partnerTransactionId,
        payment_method: method,
        payment_type: 'push',
        transaction_type: 'C2B',
      })
      const data = (payload.data ?? {}) as Record<string, unknown>
      return {
        providerRef: data.transaction_id != null ? String(data.transaction_id) : null,
        status: normalizeStatus(data.status),
        expiresAt: parseGatewayDate(data.expiration_datetime),
      }
    },

    async status(partnerTransactionId: string): Promise<ProviderStatus> {
      const query = new URLSearchParams({ payment_type: 'push', partner_transaction_id: partnerTransactionId })
      const payload = await request('GET', `/payments/status?${query.toString()}`)
      const data = (payload.data ?? {}) as Record<string, unknown>
      return normalizeStatus(data.status)
    },
  }
}

export interface WebhookEvent {
  id: string
  type: string
  paymentId: string
  partnerTransactionId: string | null
  status: ProviderStatus
}

/**
 * Valida a assinatura do webhook: HMAC-SHA256(timestamp + "." + corpo bruto)
 * com o webhook_secret. Aceita a assinatura com ou sem o prefixo "sha256=" e
 * rejeita eventos com mais de 5 minutos.
 */
export function verifyWebhookSignature(
  rawBody: Buffer,
  headers: { timestamp?: string; signature?: string },
  secret: string,
  now = Date.now(),
): boolean {
  if (!secret || !headers.timestamp || !headers.signature) return false
  const timestamp = Number(headers.timestamp)
  if (!Number.isFinite(timestamp)) return false
  const timestampMs = timestamp > 1e12 ? timestamp : timestamp * 1000
  if (Math.abs(now - timestampMs) > 5 * 60 * 1000) return false
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${headers.timestamp}.`)
    .update(rawBody)
    .digest('hex')
  const given = headers.signature.replace(/^sha256=/i, '').trim().toLowerCase()
  const a = Buffer.from(given, 'utf8')
  const b = Buffer.from(expected, 'utf8')
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

export function parseWebhookEvent(body: unknown): WebhookEvent | null {
  if (!body || typeof body !== 'object') return null
  const event = body as Record<string, unknown>
  const data = (event.data ?? {}) as Record<string, unknown>
  const paymentId = data.payment_id ?? data.transaction_id
  if (paymentId == null) return null
  const typeStatus = String(event.type || '').split('.').pop()
  return {
    id: String(event.id ?? ''),
    type: String(event.type ?? ''),
    paymentId: String(paymentId),
    partnerTransactionId: data.partner_transaction_id != null ? String(data.partner_transaction_id) : null,
    status: normalizeStatus(data.status ?? typeStatus),
  }
}
