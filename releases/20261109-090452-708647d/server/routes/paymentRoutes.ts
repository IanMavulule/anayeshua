import express, { Router } from 'express'
import type { AppContext } from '../context.ts'
import { requireAuth } from '../middleware/authMiddleware.ts'
import { createPaymentPresenter } from '../presenters/paymentPresenter.ts'

export const WEBHOOK_PATH = '/payments/imaliway/webhook'

/** /api/payments */
export function paymentRoutes(context: AppContext): Router {
  const presenter = createPaymentPresenter(context)
  const router = Router()
  router.get('/payments/plans', presenter.plans)
  router.post('/payments/checkout', requireAuth, presenter.checkout)
  router.get('/payments', requireAuth, presenter.mine)
  router.get('/payments/:id', requireAuth, presenter.status)
  return router
}

/**
 * Webhook do iMaliWay. Precisa do corpo bruto para validar a assinatura, por
 * isso é montado antes do parser JSON e fica fora da verificação CSRF.
 */
export function paymentWebhookRoutes(context: AppContext): Router {
  const presenter = createPaymentPresenter(context)
  const router = Router()
  router.post(WEBHOOK_PATH, express.raw({ type: '*/*', limit: '64kb' }), presenter.webhook)
  return router
}
