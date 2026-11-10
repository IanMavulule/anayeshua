import express, { Router } from 'express'
import type { AppContext } from '../context.ts'
import { requireClientHeader } from '../middleware/authMiddleware.ts'
import { notFound } from '../middleware/errorMiddleware.ts'
import { adminRoutes } from './adminRoutes.ts'
import { authRoutes } from './authRoutes.ts'
import { catalogRoutes } from './catalogRoutes.ts'
import { communityRoutes } from './communityRoutes.ts'
import { mediaApiRoutes, mediaFileRoutes } from './mediaRoutes.ts'
import { WEBHOOK_PATH, paymentRoutes, paymentWebhookRoutes } from './paymentRoutes.ts'

/** Router montado em /api. A ordem importa: o webhook precisa do corpo bruto. */
export function apiRouter(context: AppContext): Router {
  const api = Router()
  api.use(paymentWebhookRoutes(context))
  api.use(express.json({ limit: '1mb' }))
  api.use(requireClientHeader([WEBHOOK_PATH]))
  api.use('/auth', authRoutes(context))
  api.use(catalogRoutes(context))
  api.use(mediaApiRoutes(context))
  api.use(paymentRoutes(context))
  api.use(communityRoutes(context))
  api.use('/admin', adminRoutes(context))
  api.use(notFound)
  return api
}

/** Ficheiros servidos fora de /api (vídeos protegidos e capas). */
export { mediaFileRoutes as fileRouter }
