import { Router, raw } from 'express'
import type { AppContext } from '../context.ts'
import { requireAdmin } from '../middleware/authMiddleware.ts'
import { createAdminCommunityPresenter } from '../presenters/admin/adminCommunityPresenter.ts'
import { createAdminCoursePresenter } from '../presenters/admin/adminCoursePresenter.ts'
import { createAdminEventPresenter } from '../presenters/admin/adminEventPresenter.ts'
import { createAdminMemberPresenter } from '../presenters/admin/adminMemberPresenter.ts'
import { createAdminSystemPresenter } from '../presenters/admin/adminSystemPresenter.ts'
import { createAdminPlatformPresenter } from '../presenters/admin/adminPlatformPresenter.ts'
import { createAdminUploadPresenter } from '../presenters/admin/adminUploadPresenter.ts'
import { MAX_COVER_BYTES } from '../services/uploadService.ts'

/** /api/admin — todas as rotas exigem uma sessão com papel de administração. */
export function adminRoutes(context: AppContext): Router {
  const platform = createAdminPlatformPresenter(context)
  const courses = createAdminCoursePresenter(context)
  const events = createAdminEventPresenter(context)
  const members = createAdminMemberPresenter(context)
  const community = createAdminCommunityPresenter(context)
  const uploads = createAdminUploadPresenter(context)
  const system = createAdminSystemPresenter(context)

  const router = Router()
  router.use(requireAdmin)

  router.get('/state', platform.state)
  router.put('/settings', platform.updateSettings)

  router.post('/courses', courses.create)
  router.post('/courses/bulk', courses.bulk)
  router.put('/courses/:id', courses.update)
  router.delete('/courses/:id', courses.remove)

  router.post('/events', events.create)
  router.put('/events/:id', events.update)
  router.delete('/events/:id', events.remove)

  router.post('/members', members.create)
  router.put('/members/:id', members.update)
  router.delete('/members/:id', members.remove)

  router.patch('/testimonies/:id', community.moderateTestimony)
  router.delete('/testimonies/:id', community.removeTestimony)
  router.post('/posts', community.createPost)
  router.put('/posts/:id', community.updatePost)
  router.delete('/posts/:id', community.removePost)
  router.put('/questions/:id/answer', community.answerQuestion)
  router.delete('/questions/:id', community.removeQuestion)
  router.delete('/feedback/:id', community.removeFeedback)

  router.put('/uploads/video/:lessonId', uploads.video)
  router.post('/uploads/cover', raw({ type: 'image/*', limit: MAX_COVER_BYTES }), uploads.cover)

  router.get('/system', system.overview)
  router.get('/system/events', system.events)
  router.post('/system/events/resolve-all', system.resolveAllEvents)
  router.post('/system/events/:id/resolve', system.resolveEvent)
  router.post('/system/videos/recheck', system.recheckTranscoder)
  router.post('/system/videos/:lessonId/retry', system.retryVideo)
  return router
}
