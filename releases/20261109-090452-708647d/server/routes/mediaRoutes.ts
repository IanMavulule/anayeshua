import { Router } from 'express'
import type { AppContext } from '../context.ts'
import { requireAuth } from '../middleware/authMiddleware.ts'
import { createMediaPresenter } from '../presenters/mediaPresenter.ts'

/** /api/media-token */
export function mediaApiRoutes(context: AppContext): Router {
  const presenter = createMediaPresenter(context)
  const router = Router()
  router.post('/media-token', requireAuth, presenter.createToken)
  return router
}

/** /media/:videoId (vídeo e legendas por Range) e /uploads/covers/:name */
export function mediaFileRoutes(context: AppContext): Router {
  const presenter = createMediaPresenter(context)
  const router = Router()
  router.get('/media/:videoId', presenter.serveVideo)
  router.head('/media/:videoId', presenter.serveVideo)
  router.all('/media/:videoId', presenter.methodNotAllowed)
  for (const route of ['/media/:videoId/hls/:file', '/media/:videoId/hls/:quality/:file']) {
    router.get(route, presenter.serveHls)
    router.head(route, presenter.serveHls)
    router.all(route, presenter.methodNotAllowed)
  }
  router.get('/uploads/covers/:name', presenter.serveCover)
  return router
}
