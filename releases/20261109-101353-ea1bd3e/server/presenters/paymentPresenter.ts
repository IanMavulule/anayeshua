import type { Request, Response } from 'express'
import { PAYMENT_METHODS, PLANS } from '../config/plans.ts'
import type { AppContext } from '../context.ts'
import { HttpError, parseBody } from '../middleware/errorMiddleware.ts'
import { PENDING_PAYMENT_WINDOW_MS, normalizeAccount } from '../models/paymentModel.ts'
import { checkoutSchema } from '../schemas/paymentSchemas.ts'
import { parseWebhookEvent, verifyWebhookSignature } from '../services/payments/imaliwayProvider.ts'
import { PaymentProviderError } from '../services/payments/providerTypes.ts'
import { toPublicPayment } from '../views/paymentView.ts'
import { toPublicUser } from '../views/userView.ts'

/** Planos, checkout iMaliWay, estado do pagamento e webhook. */
export function createPaymentPresenter({ db, payments, webhookSecret }: AppContext) {
  return {
    plans(_request: Request, response: Response) {
      response.json({ plans: Object.values(PLANS), methods: PAYMENT_METHODS, provider: payments.providerName })
    },

    async checkout(request: Request, response: Response) {
      const body = parseBody(checkoutSchema, request.body)
      const account = normalizeAccount(body.method, body.account)
      if (!account) throw new HttpError(400, 'invalid_account')
      const user = request.user!
      const pending = await db.payments.find(
        (item) =>
          item.userId === user.id &&
          item.status === 'pending' &&
          Date.now() - Date.parse(item.createdAt) < PENDING_PAYMENT_WINDOW_MS,
      )
      if (pending) throw new HttpError(409, 'payment_in_progress', { paymentId: pending.id })
      try {
        const payment = await payments.checkout(user.id, body.plan, body.method, account)
        response.status(201).json({ payment: toPublicPayment(payment) })
      } catch (error) {
        if (error instanceof PaymentProviderError) throw new HttpError(error.httpStatus, error.code)
        throw error
      }
    },

    async mine(request: Request, response: Response) {
      const list = (await db.payments.filter((item) => item.userId === request.user!.id)).map(toPublicPayment)
      response.json({ payments: list })
    },

    // Consultado pela página de pagamento enquanto o cliente confirma no telemóvel.
    async status(request: Request, response: Response) {
      const payment = await db.payments.get(String(request.params.id))
      if (!payment || payment.userId !== request.user!.id) throw new HttpError(404, 'not_found')
      const refreshed = await payments.refresh(payment)
      const user = (await db.users.get(payment.userId))!
      response.json({ payment: toPublicPayment(refreshed), user: toPublicUser(user) })
    },

    /**
     * Webhook do iMaliWay. Recebe o corpo bruto para validar a assinatura e
     * responde 2xx a eventos válidos (mesmo repetidos) para o gateway não
     * voltar a tentar.
     */
    async webhook(request: Request, response: Response) {
      const rawBody = Buffer.isBuffer(request.body) ? request.body : Buffer.alloc(0)
      const valid = verifyWebhookSignature(
        rawBody,
        { timestamp: request.get('x-webhook-timestamp'), signature: request.get('x-webhook-signature') },
        webhookSecret,
      )
      if (!valid) throw new HttpError(401, 'invalid_signature')
      let parsed: unknown
      try {
        parsed = JSON.parse(rawBody.toString('utf8'))
      } catch {
        throw new HttpError(400, 'invalid_body')
      }
      const event = parseWebhookEvent(parsed)
      if (!event) throw new HttpError(400, 'invalid_event')
      const payment = await payments.handleWebhook(event)
      response.status(200).json({ received: true, matched: Boolean(payment) })
    },
  }
}
