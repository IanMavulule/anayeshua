import type { Request, Response } from 'express'
import type { AppContext } from '../../context.ts'
import { HttpError, parseBody, requireIdParam } from '../../middleware/errorMiddleware.ts'
import type { Course, CourseField } from '../../models/entities.ts'
import { bulkSchema, courseSchema } from '../../schemas/adminSchemas.ts'
import { newId, nowIso } from '../../utils/ids.ts'

const localMinute = () => nowIso().slice(0, 16)

/**
 * Com o campo ligado, o valor tem de ser uma das opções configuradas (ou o que o
 * curso já tinha, para não obrigar a mexer em cursos antigos). Desligado, aceita-se
 * vazio ou uma opção existente (a base de dados liga o curso à opção).
 */
function checkOption(field: CourseField, value: string, current: string | undefined, code: string) {
  const known = field.options.some((option) => option.id === value) || value === current
  if (field.enabled ? value && known : !value || known) return
  throw new HttpError(400, code)
}

/** Ids de módulo/aula repetidos, ou de uma aula que já é de outro curso. */
async function saving<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work()
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('duplicate_id:')) throw new HttpError(409, 'duplicate_id')
    throw error
  }
}

/** Biblioteca de cursos: criar, editar, eliminar e acções em lote. */
export function createAdminCoursePresenter({ db }: AppContext) {
  return {
    async create(request: Request, response: Response) {
      const body = parseBody(courseSchema, request.body)
      const settings = await db.settings.read()
      checkOption(settings.categories, body.category, undefined, 'invalid_category')
      checkOption(settings.levels, body.level, undefined, 'invalid_level')
      const course: Course = { id: newId('c'), ...body, updated: localMinute(), views: 0, students: 0 }
      await saving(() => db.courses.insert(course, 'start'))
      response.status(201).json({ course })
    },

    async update(request: Request, response: Response) {
      const id = requireIdParam(request.params.id)
      const body = parseBody(courseSchema, request.body)
      const existing = await db.courses.get(id)
      if (!existing) throw new HttpError(404, 'not_found')
      const settings = await db.settings.read()
      checkOption(settings.categories, body.category, existing.category, 'invalid_category')
      checkOption(settings.levels, body.level, existing.level, 'invalid_level')
      const course = await saving(() => db.courses.update(id, (current) => ({ ...current, ...body, id, updated: localMinute() })))
      if (!course) throw new HttpError(404, 'not_found')
      response.json({ course })
    },

    async remove(request: Request, response: Response) {
      if (!await db.courses.remove(requireIdParam(request.params.id))) throw new HttpError(404, 'not_found')
      response.status(204).end()
    },

    // Com `status` publica/oculta os cursos seleccionados; sem `status` elimina-os.
    async bulk(request: Request, response: Response) {
      const { ids, status } = parseBody(bulkSchema, request.body)
      if (status) {
        await db.courses.updateMany(ids, (course) => ({ ...course, status, updated: localMinute() }))
      } else {
        await db.courses.removeMany(ids)
      }
      response.json({ courses: await db.courses.all() })
    },
  }
}
