import type { Request, Response } from 'express'
import type { AppContext } from '../../context.ts'
import { HttpError, parseBody } from '../../middleware/errorMiddleware.ts'
import { settingsSchema } from '../../schemas/adminSchemas.ts'
import { toAdminMember } from '../../views/memberView.ts'

/** Estado inicial do painel e configurações da plataforma. */
export function createAdminPlatformPresenter({ db }: AppContext) {
  return {
    async state(_request: Request, response: Response) {
      const [settings, courses, events, testimonies, users, payments, posts, questions, feedback] = await Promise.all([
        db.settings.read(),
        db.courses.all(),
        db.events.all(),
        db.testimonies.all(),
        db.users.all(),
        db.payments.all(),
        db.posts.all(),
        db.questions.all(),
        db.feedback.all(),
      ])
      response.json({
        state: {
          settings,
          courses,
          events,
          testimonies,
          members: users.map(toAdminMember),
          payments: payments.slice(0, 500),
          posts,
          questions,
          feedback,
        },
      })
    },

    // Uma opção de categoria/nível só pode ser removida se nenhum curso a usar.
    async updateSettings(request: Request, response: Response) {
      const body = parseBody(settingsSchema, request.body)
      const inUse: string[] = []
      const checks = [
        ['categories', body.categories, 'category'],
        ['levels', body.levels, 'level'],
      ] as const
      const courses = await db.courses.all()
      for (const [, field, key] of checks) {
        if (!field) continue
        const kept = new Set(field.options.map((option) => option.id))
        for (const course of courses) {
          const value = course[key]
          if (value && !kept.has(value)) inUse.push(`${key}:${value}`)
        }
      }
      if (inUse.length) throw new HttpError(409, 'option_in_use', [...new Set(inUse)])
      response.json({ settings: await db.settings.write(body) })
    },
  }
}
