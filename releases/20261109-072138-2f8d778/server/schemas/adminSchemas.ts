import { z } from 'zod'
import { ID_PATTERN } from '../utils/ids.ts'

const id = z.string().regex(ID_PATTERN)
/** Id de opção de categoria/nível: minúsculas, números e hífen. */
export const OPTION_ID = /^[a-z0-9][a-z0-9-]{0,39}$/

const courseField = z
  .object({
    enabled: z.boolean(),
    options: z
      .array(
        z.object({
          id: z.string().regex(OPTION_ID),
          label: z.string().trim().min(1).max(40),
          labelEn: z.string().trim().max(40).default(''),
        }),
      )
      .max(30),
  })
  .refine((field) => new Set(field.options.map((option) => option.id)).size === field.options.length, { message: 'duplicate_option' })
  .refine((field) => !field.enabled || field.options.length > 0, { message: 'options_required' })
const text = (max: number) => z.string().trim().max(max)

/** Data (e hora) que existe no calendário: recusa, por exemplo, 30 de Fevereiro ou 25:00. */
function isCalendarDateTime(value: string): boolean {
  const [y, mo, d, h = 0, mi = 0] = (value.match(/\d+/g) ?? []).map(Number)
  const date = new Date(Date.UTC(y, mo - 1, d, h, mi))
  return (
    date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d &&
    date.getUTCHours() === h && date.getUTCMinutes() === mi
  )
}

/** Data e hora local de um campo datetime-local ('YYYY-MM-DDTHH:MM'), sem fuso. */
const localDateTime = text(32)
  .regex(/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?)?$/, 'invalid_date')
  .refine(isCalendarDateTime, { message: 'invalid_date' })

export const videoMetaSchema = z.object({
  name: text(240),
  size: z.number().nonnegative(),
  duration: z.number().nonnegative(),
  type: text(80),
})

/** Pontos de oração: opcionais, um por item, sem linhas vazias. */
const prayerPoints = z.array(text(400).min(1)).max(30).default([])

export const courseSchema = z.object({
  title: text(160).min(1),
  // Validados contra as opções de Configurações no presenter; vazio = campo desligado.
  category: z.union([z.literal(''), z.string().regex(OPTION_ID)]).default(''),
  status: z.enum(['published', 'draft', 'hidden', 'scheduled']),
  access: z.enum(['free', 'premium']).default('premium'),
  publishAt: z.union([z.literal(''), localDateTime]).optional().default(''),
  level: z.union([z.literal(''), z.string().regex(OPTION_ID)]).default(''),
  instructor: text(80).default('Ana Yeshua'),
  cover: text(400).regex(/^\/(brand|uploads)\//, 'cover_must_be_local'),
  description: text(4000).default(''),
  prayerPoints: prayerPoints,
  featured: z.boolean().default(false),
  modules: z
    .array(
      z.object({
        id,
        title: text(160),
        lessons: z
          .array(z.object({ id, title: text(200), video: videoMetaSchema.nullable(), free: z.boolean(), prayerPoints: prayerPoints }))
          .max(200),
      }),
    )
    .max(50),
})

export const bulkSchema = z.object({
  ids: z.array(id).min(1).max(500),
  status: z.enum(['published', 'hidden']).optional(),
})

export const eventSchema = z.object({
  title: text(160).min(1),
  kind: text(80).default(''),
  // Data e hora local do campo datetime-local (guardada como timestamp sem fuso).
  date: localDateTime,
  place: text(240).default(''),
  entry: text(120).default('Livre'),
  status: z.enum(['published', 'draft']),
  description: text(4000).default(''),
  // Foto opcional: só imagens servidas pela própria plataforma.
  image: z.union([z.literal(''), text(400).regex(/^\/(brand|uploads)\//,'cover_must_be_local')]).default(''),
})

export const settingsSchema = z.object({
  name: text(120).min(1).optional(),
  email: z.union([z.literal(''), z.string().trim().email().max(160)]).optional(),
  description: text(600).optional(),
  moderation: z.boolean().optional(),
  comments: z.boolean().optional(),
  signups: z.boolean().optional(),
  maintenance: z.boolean().optional(),
  categories: courseField.optional(),
  levels: courseField.optional(),
})

export const testimonyStatusSchema = z.object({ status: z.enum(['pending', 'published', 'hidden']) })

export const memberSchema = z.object({
  name: text(80).min(2),
  email: z.string().trim().email().max(160),
  plan: z.enum(['free', 'premium']),
  status: z.enum(['active', 'suspended']),
})

export const postSchema = z.object({
  type: z.enum(['daily-message', 'note', 'prayer-point']),
  title: text(160).min(1),
  body: text(8000).min(1),
  language: z.enum(['pt', 'en']),
  publishAt: text(32).min(10),
  status: z.enum(['published', 'draft']),
  premium: z.boolean().default(false),
})

export const answerSchema = z.object({ answer: text(4000).min(1) })
