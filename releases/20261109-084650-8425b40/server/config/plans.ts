// Planos Premium. O preço é em MT (unidades inteiras); a duração em dias.
// As durações são um valor por omissão e devem ser confirmadas com o ministério.
// Só o plano de 500 MT inclui a assistência pessoal com Ana Yeshua.
export const PLANS = {
  '200': { id: '200', amount: 200, days: 30, label: 'Mensal', assistance: false },
  '500': { id: '500', amount: 500, days: 90, label: 'Trimestral', assistance: true },
} as const

export type PlanId = keyof typeof PLANS

export const PAYMENT_METHODS = ['mpesa', 'emola', 'mkesh', 'imali'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export function isPlanId(value: unknown): value is PlanId {
  return value === '200' || value === '500'
}
