import { z } from 'zod'

const language = z.enum(['pt', 'en'])

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(160),
  password: z.string().min(8).max(200),
  language: language.default('pt'),
})

export const loginSchema = z.object({
  email: z.string().trim().min(3).max(160),
  password: z.string().min(1).max(200),
})

export const profileSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    language: language.optional(),
    currentPassword: z.string().max(200).optional(),
    newPassword: z.string().min(8).max(200).optional(),
  })
  .refine((value) => !value.newPassword || value.currentPassword, { path: ['currentPassword'] })
