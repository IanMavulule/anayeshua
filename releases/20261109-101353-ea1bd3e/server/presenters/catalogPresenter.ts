import type { Request, Response } from 'express'
import type { AppContext } from '../context.ts'
import { HttpError } from '../middleware/errorMiddleware.ts'
import { hasActiveSubscription } from '../models/userModel.ts'

const DAY_MS = 24 * 60 * 60 * 1000

/** Conteúdo público: catálogo, agenda e identidade da plataforma. */
export function createCatalogPresenter({ db, catalog }: AppContext) {
  return {
    async catalog(_request: Request, response: Response) {
      // As categorias activas acompanham o catálogo; desligadas, o site esconde-as.
      const { categories } = await db.settings.read()
      response.json({ series: await catalog.list(), categories: categories.enabled ? categories.options : [] })
    },

    // Pontos de oração de uma aula: com as mesmas regras de acesso que o vídeo.
    async lessonPrayerPoints(request: Request, response: Response) {
      const user = request.user!
      const lesson = await catalog.findVideo(request.params.lessonId, { includeHidden: user.role === 'admin' })
      if (!lesson) throw new HttpError(404, 'lesson_not_found')
      if (lesson.premium && !hasActiveSubscription(user)) throw new HttpError(403, 'premium_required')
      response.json({ prayerPoints: lesson.prayerPoints })
    },

    // Eventos publicados a partir de ontem, por ordem de data.
    async events(_request: Request, response: Response) {
      const now = Date.now()
      const events = (await db.events.filter((event) => event.status === 'published'))
        .filter((event) => {
          const at = Date.parse(event.date)
          return !Number.isFinite(at) || at >= now - DAY_MS
        })
        .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
      response.json({ events })
    },

    async settings(_request: Request, response: Response) {
      const { name, description, signups, maintenance } = await db.settings.read()
      response.json({ settings: { name, description, signups, maintenance } })
    },
  }
}
