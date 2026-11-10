import type { Request, Response } from 'express'
import type { AppContext } from '../../context.ts'
import { HttpError, parseBody, requireIdParam } from '../../middleware/errorMiddleware.ts'
import type { EventItem } from '../../models/entities.ts'
import { eventSchema } from '../../schemas/adminSchemas.ts'
import { newId } from '../../utils/ids.ts'

/** Agenda de eventos. */
export function createAdminEventPresenter({ db }: AppContext) {
  return {
    async create(request: Request, response: Response) {
      const event: EventItem = { id: newId('e'), ...parseBody(eventSchema, request.body) }
      await db.events.insert(event)
      response.status(201).json({ event })
    },

    async update(request: Request, response: Response) {
      const event = await db.events.update(requireIdParam(request.params.id), parseBody(eventSchema, request.body))
      if (!event) throw new HttpError(404, 'not_found')
      response.json({ event })
    },

    async remove(request: Request, response: Response) {
      if (!await db.events.remove(requireIdParam(request.params.id))) throw new HttpError(404, 'not_found')
      response.status(204).end()
    },
  }
}
