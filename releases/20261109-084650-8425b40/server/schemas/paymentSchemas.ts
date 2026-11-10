import { z } from 'zod'
import { PAYMENT_METHODS } from '../config/plans.ts'

export const checkoutSchema = z.object({
  plan: z.enum(['200', '500']),
  method: z.enum(PAYMENT_METHODS),
  account: z.string().trim().min(6).max(32),
})
