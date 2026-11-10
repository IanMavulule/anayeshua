import { Router } from 'express'
import type { AppContext } from '../context.ts'
import { requireAuth } from '../middleware/authMiddleware.ts'
import { createCatalogPresenter } from '../presenters/catalogPresenter.ts'

/** /api/catalog, /api/events, /api/settings (públicos) e /api/lessons/:id/prayer-points */
export function catalogRoutes(context: AppContext): Router {
  const presenter = createCatalogPresenter(context)
  const router = Router()
  router.get('/catalog', presenter.catalog)
  router.get('/events', presenter.events)
  router.get('/settings', presenter.settings)
  router.get('/lessons/:lessonId/prayer-points', requireAuth, presenter.lessonPrayerPoints)
  return router
}
