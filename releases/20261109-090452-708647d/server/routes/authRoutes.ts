import { Router } from 'express'
import type { AppContext } from '../context.ts'
import { requireAuth } from '../middleware/authMiddleware.ts'
import { createAuthPresenter } from '../presenters/authPresenter.ts'

/** /api/auth */
export function authRoutes(context: AppContext): Router {
  const presenter = createAuthPresenter(context)
  const router = Router()
  router.get('/session', presenter.session)
  router.post('/register', presenter.register)
  router.post('/login', presenter.login)
  router.get('/google/config', presenter.googleConfig)
  router.post('/google', presenter.google)
  router.post('/logout', presenter.logout)
  router.patch('/me', requireAuth, presenter.updateProfile)
  return router
}
