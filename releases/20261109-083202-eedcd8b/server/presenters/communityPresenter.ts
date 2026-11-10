import type { Request, Response } from 'express'
import type { AppContext } from '../context.ts'
import { HttpError, parseBody } from '../middleware/errorMiddleware.ts'
import type { Question, Testimony } from '../models/entities.ts'
import { POST_TYPES, byPublishDateDesc, isPostVisible } from '../models/postModel.ts'
import { hasActiveSubscription, hasAssistance } from '../models/userModel.ts'
import { feedbackSchema, questionSchema, testimonySchema } from '../schemas/communitySchemas.ts'
import { newId, nowIso } from '../utils/ids.ts'
import { toPublicPost, toPublicTestimony } from '../views/communityView.ts'

const MAX_OPEN_QUESTIONS = 5

const queryText = (value: unknown) => (typeof value === 'string' ? value : null)
const queryLanguage = (value: unknown) => (value === 'en' ? 'en' : value === 'pt' ? 'pt' : null)

/** Testemunhos, mensagem do dia/anotações/pontos de oração, dúvidas e feedback. */
export function createCommunityPresenter({ db, catalog }: AppContext) {
  return {
    /* --- Testemunhos ------------------------------------------------------- */
    async listTestimonies(request: Request, response: Response) {
      const courseId = queryText(request.query.courseId)
      const lessonId = queryText(request.query.lessonId)
      const userId = request.user?.id
      const list = (await db.testimonies.filter((item) => (!courseId || item.courseId === courseId) && (!lessonId || item.lessonId === lessonId)))
        // Públicos para todos; o autor também vê os seus pendentes.
        .filter((item) => item.status === 'published' || (userId && item.userId === userId && item.status === 'pending'))
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 100)
        .map(toPublicTestimony)
      response.json({ testimonies: list })
    },

    async createTestimony(request: Request, response: Response) {
      const settings = await db.settings.read()
      if (!settings.comments) throw new HttpError(403, 'comments_closed')
      const body = parseBody(testimonySchema, request.body)
      const video = await catalog.findVideo(body.lessonId)
      if (!video || video.courseId !== body.courseId) throw new HttpError(404, 'lesson_not_found')
      const course = (await db.courses.get(body.courseId))!
      const user = request.user!
      const testimony: Testimony = {
        id: newId('t'),
        userId: user.id,
        name: user.name,
        text: body.text,
        courseId: body.courseId,
        lessonId: body.lessonId,
        source: `${course.title} · ${video.title}`,
        status: settings.moderation ? 'pending' : 'published',
        date: nowIso().slice(0, 10),
      }
      await db.testimonies.insert(testimony, 'start')
      response.status(201).json({ testimony: toPublicTestimony(testimony) })
    },

    /* --- Mensagem do dia, anotações e pontos de oração -------------------- */
    async listPosts(request: Request, response: Response) {
      const type = POST_TYPES.find((value) => value === request.query.type)
      const language = queryLanguage(request.query.language)
      const limit = Math.min(Number(request.query.limit) || 20, 100)
      const now = Date.now()
      const posts = (await db.posts.filter((post) => isPostVisible(post, now) && (!type || post.type === type) && (!language || post.language === language)))
        .sort(byPublishDateDesc)
        .slice(0, limit)
        .map((post) => toPublicPost(post, request.user))
      response.json({ posts })
    },

    // Preferência pela língua pedida; cai para a outra se não houver mensagem.
    async todayMessage(request: Request, response: Response) {
      const language = queryLanguage(request.query.language) ?? 'pt'
      const now = Date.now()
      const visible = (await db.posts.filter((post) => post.type === 'daily-message' && isPostVisible(post, now)))
        .sort(byPublishDateDesc)
      const post = visible.find((item) => item.language === language) ?? visible[0] ?? null
      response.json({ post: post ? toPublicPost(post, request.user) : null })
    },

    /* --- Dúvidas para a profetisa ----------------------------------------- */
    async myQuestions(request: Request, response: Response) {
      const lessonId = queryText(request.query.lessonId)
      const questions = (await db.questions.filter((item) => item.userId === request.user!.id && (!lessonId || item.lessonId === lessonId)))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      response.json({ questions })
    },

    async askQuestion(request: Request, response: Response) {
      const body = parseBody(questionSchema, request.body)
      const user = request.user!
      // A aula tem de existir num curso visível; numa aula Premium só pergunta quem tem acesso.
      const video = await catalog.findVideo(body.lessonId)
      if (!video || video.courseId !== body.courseId) throw new HttpError(404, 'lesson_not_found')
      if (video.premium && !hasActiveSubscription(user)) throw new HttpError(403, 'premium_required')
      const course = (await db.courses.get(body.courseId))!
      const open = (await db.questions.filter((item) => item.userId === user.id && item.status === 'open')).length
      if (open >= MAX_OPEN_QUESTIONS) throw new HttpError(429, 'too_many_open_questions')
      const question: Question = {
        id: newId('q'),
        userId: user.id,
        name: user.name,
        email: user.email,
        subject: body.subject || video.title,
        body: body.body,
        courseId: course.id,
        lessonId: video.id,
        courseTitle: course.title,
        lessonTitle: video.title,
        answer: '',
        status: 'open',
        createdAt: nowIso(),
        answeredAt: null,
      }
      await db.questions.insert(question, 'start')
      response.status(201).json({ question })
    },

    /* --- Feedback sobre a assistência (plano de 500 MT) ------------------- */
    async sendFeedback(request: Request, response: Response) {
      const user = request.user!
      if (!hasAssistance(user)) throw new HttpError(403, 'assistance_required')
      const body = parseBody(feedbackSchema, request.body)
      const feedback = { id: newId('f'), userId: user.id, name: user.name, ...body, createdAt: nowIso() }
      await db.feedback.insert(feedback, 'start')
      response.status(201).json({ feedback })
    },
  }
}
