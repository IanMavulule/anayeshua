import { z } from 'zod'
import { ID_PATTERN } from '../utils/ids.ts'

export const mediaTokenSchema = z.object({ videoId: z.string().min(1).max(64) })

export const testimonySchema = z.object({
  courseId: z.string().regex(ID_PATTERN),
  lessonId: z.string().regex(ID_PATTERN),
  text: z.string().trim().min(3).max(1200),
})

// Cada dúvida pertence a uma aula; o assunto é opcional (por omissão, o título da aula).
export const questionSchema = z.object({
  courseId: z.string().regex(ID_PATTERN),
  lessonId: z.string().regex(ID_PATTERN),
  subject: z.string().trim().min(3).max(160).optional(),
  body: z.string().trim().min(3).max(3000),
})

export const feedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).default(''),
})
