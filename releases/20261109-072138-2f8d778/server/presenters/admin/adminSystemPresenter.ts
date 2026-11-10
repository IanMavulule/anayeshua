import type { Request, Response } from 'express'
import type { AppContext } from '../../context.ts'
import { HttpError } from '../../middleware/errorMiddleware.ts'
import { isValidId } from '../../utils/ids.ts'
import { toVideoJobs } from '../../views/systemView.ts'

/** Painel Servidor: CPU, memória, espaço, fila de conversão dos vídeos e erros. */
export function createAdminSystemPresenter({ db, monitor, videos }: AppContext) {
  return {
    async overview(request: Request, response: Response) {
      const [storage, counts, unfinished, courses, openErrors] = await Promise.all([
        monitor.storage(request.query.refresh === '1'),
        db.renditions.counts(),
        db.renditions.unfinished(),
        db.courses.all(),
        db.serverEvents.openErrorCount(),
      ])
      const status = videos.status()
      response.json({
        system: monitor.snapshot(),
        storage,
        videos: {
          transcoder: status.transcoder,
          current: status.current,
          counts,
          jobs: toVideoJobs(unfinished, courses),
        },
        openErrors,
      })
    },

    async events(request: Request, response: Response) {
      const events = await db.serverEvents.list({ includeResolved: request.query.all === '1', limit: 200 })
      response.json({ events })
    },

    async resolveEvent(request: Request, response: Response) {
      if (!(await db.serverEvents.resolve(String(request.params.id)))) throw new HttpError(404, 'not_found')
      response.json({ ok: true })
    },

    async resolveAllEvents(_request: Request, response: Response) {
      response.json({ resolved: await db.serverEvents.resolveAll() })
    },

    async retryVideo(request: Request, response: Response) {
      const lessonId = String(request.params.lessonId)
      if (!isValidId(lessonId)) throw new HttpError(404, 'not_found')
      response.json({ retried: await videos.retry(lessonId) })
    },

    async recheckTranscoder(_request: Request, response: Response) {
      response.json({ transcoder: await videos.recheck() })
    },
  }
}
