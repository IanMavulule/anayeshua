/* Tipos das respostas da API (espelham server/views). */

export type Language = 'pt' | 'en'
export type PlanId = '200' | '500'
export type PaymentMethod = 'mpesa' | 'emola' | 'mkesh' | 'imali'

export interface Subscription {
  plan: PlanId
  startedAt: string
  expiresAt: string
  paymentId: string | null
  assistanceExpiresAt?: string | null
}

export interface SessionUser {
  id: string
  name: string
  email: string
  role: 'admin' | 'member'
  status: 'active' | 'suspended'
  language: Language
  subscription: Subscription | null
  premium: boolean
  /** Assistência pessoal com Ana Yeshua (plano de 500 MT). */
  assistance: boolean
  createdAt: string
  lastLoginAt: string | null
}

export interface CatalogLesson {
  id: string
  title: string
  premium: boolean
  captions: boolean
  available: boolean
  /** Há versões em várias qualidades (HLS); senão o leitor usa o MP4. */
  hls: boolean
  duration: number
  /** A aula tem pontos de oração (o texto pede-se à parte, com sessão). */
  hasPrayerPoints: boolean
}

/** Categoria configurada no painel; a lista vem vazia se o campo estiver desligado. */
export interface CategoryOption {
  id: string
  label: string
  labelEn: string
}

export interface CatalogSeries {
  id: string
  title: string
  category: string
  description: string
  poster: string
  featured: boolean
  /** 'free': todas as aulas abertas a membros com conta; 'premium': exige plano (salvo aulas de amostra). */
  access: 'free' | 'premium'
  video: string | null
  /** Pontos de oração para todo o devocional. */
  prayerPoints: string[]
  lessons: CatalogLesson[]
}

export interface PublicEvent {
  id: string
  title: string
  kind: string
  date: string
  place: string
  entry: string
  description: string
  image: string
}

export interface PublicTestimony {
  id: string
  name: string
  text: string
  courseId: string | null
  lessonId: string | null
  source: string
  status: 'pending' | 'published' | 'hidden'
  date: string
}

export type PostType = 'daily-message' | 'note' | 'prayer-point'

export interface PublicPost {
  id: string
  type: PostType
  title: string
  body: string
  language: Language
  publishAt: string
  premium: boolean
  locked: boolean
}

export interface Question {
  id: string
  subject: string
  body: string
  /** Aula da dúvida; ausente nas dúvidas gerais antigas. */
  courseId?: string | null
  lessonId?: string | null
  courseTitle?: string | null
  lessonTitle?: string | null
  answer: string
  status: 'open' | 'answered'
  createdAt: string
  answeredAt: string | null
}

export type PaymentStatus = 'pending' | 'confirmed' | 'failed' | 'expired'

export interface PublicPayment {
  id: string
  plan: PlanId
  amount: number
  method: PaymentMethod
  accountMasked: string
  status: PaymentStatus
  provider: string
  partnerTransactionId: string
  failureReason: string | null
  createdAt: string
  expiresAt: string | null
  confirmedAt: string | null
}

export interface PlanInfo {
  id: PlanId
  amount: number
  days: number
  label: string
  /** Inclui a assistência pessoal com Ana Yeshua (plano de 500 MT). */
  assistance: boolean
}
