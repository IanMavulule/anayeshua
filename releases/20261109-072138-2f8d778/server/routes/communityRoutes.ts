import { Router } from 'express'
import type { AppContext } from '../context.ts'
import { requireAuth } from '../middleware/authMiddleware.ts'
import { createCommunityPresenter } from '../presenters/communityPresenter.ts'

/** /api/testimonies, /api/posts, /api/questions, /api/feedback */
export function communityRoutes(context: AppContext): Router {
  const presenter = createCommunityPresenter(context)
  const router = Router()
  router.get('/testimonies', presenter.listTestimonies)
  router.post('/testimonies', requireAuth, presenter.createTestimony)
  router.get('/posts', presenter.listPosts)
  router.get('/posts/today', presenter.todayMessage)
  router.get('/questions/mine', requireAuth, presenter.myQuestions)
  router.post('/questions', requireAuth, presenter.askQuestion)
  router.post('/feedback', requireAuth, presenter.sendFeedback)
  return router
}
