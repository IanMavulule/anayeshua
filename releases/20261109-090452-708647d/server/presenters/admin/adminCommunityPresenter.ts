import type { Request, Response } from 'express'
import type { AppContext } from '../../context.ts'
import { HttpError, parseBody, requireIdParam } from '../../middleware/errorMiddleware.ts'
import type { Post } from '../../models/entities.ts'
import { answerSchema, postSchema, testimonyStatusSchema } from '../../schemas/adminSchemas.ts'
import { newId, nowIso } from '../../utils/ids.ts'

function parsePublishAt(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw new HttpError(400, 'invalid_date')
  return date.toISOString()
}

/** Moderação de testemunhos, conteúdo diário, respostas às dúvidas e feedback. */
export function createAdminCommunityPresenter({ db }: AppContext) {
  return {
    async moderateTestimony(request: Request, response: Response) {
      const patch = parseBody(testimonyStatusSchema, request.body)
      const testimony = await db.testimonies.update(requireIdParam(request.params.id), patch)
      if (!testimony) throw new HttpError(404, 'not_found')
      response.json({ testimony })
    },

    async removeTestimony(request: Request, response: Response) {
      if (!await db.testimonies.remove(requireIdParam(request.params.id))) throw new HttpError(404, 'not_found')
      response.status(204).end()
    },

    async createPost(request: Request, response: Response) {
      const body = parseBody(postSchema, request.body)
      const post: Post = { id: newId('p'), ...body, publishAt: parsePublishAt(body.publishAt), createdAt: nowIso() }
      await db.posts.insert(post, 'start')
      response.status(201).json({ post })
    },

    async updatePost(request: Request, response: Response) {
      const body = parseBody(postSchema, request.body)
      const post = await db.posts.update(requireIdParam(request.params.id), { ...body, publishAt: parsePublishAt(body.publishAt) })
      if (!post) throw new HttpError(404, 'not_found')
      response.json({ post })
    },

    async removePost(request: Request, response: Response) {
      if (!await db.posts.remove(requireIdParam(request.params.id))) throw new HttpError(404, 'not_found')
      response.status(204).end()
    },

    async answerQuestion(request: Request, response: Response) {
      const { answer } = parseBody(answerSchema, request.body)
      const question = await db.questions.update(requireIdParam(request.params.id), {
        answer,
        status: 'answered',
        answeredAt: nowIso(),
      })
      if (!question) throw new HttpError(404, 'not_found')
      response.json({ question })
    },

    async removeQuestion(request: Request, response: Response) {
      if (!await db.questions.remove(requireIdParam(request.params.id))) throw new HttpError(404, 'not_found')
      response.status(204).end()
    },

    async removeFeedback(request: Request, response: Response) {
      if (!await db.feedback.remove(requireIdParam(request.params.id))) throw new HttpError(404, 'not_found')
      response.status(204).end()
    },
  }
}
