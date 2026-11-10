import type { PaymentMethod, PlanId } from '../config/plans.ts'

export type Role = 'admin' | 'member'
export type Language = 'pt' | 'en'

export interface Subscription {
  plan: PlanId
  startedAt: string
  expiresAt: string
  paymentId: string | null
  /** Fim da assistência pessoal (só os planos com assistência a dão). Ausente nos registos antigos. */
  assistanceExpiresAt?: string | null
}

export interface User {
  id: string
  name: string
  email: string
  /** Vazio numa conta criada só com Google. */
  passwordHash: string
  /** Conta Google ligada (claim `sub`), se o membro entrou com Google. */
  googleId?: string
  role: Role
  status: 'active' | 'suspended'
  language: Language
  subscription: Subscription | null
  createdAt: string
  lastLoginAt: string | null
}

export type PublicUser = Omit<User, 'passwordHash' | 'googleId'> & { premium: boolean; assistance: boolean }

/** Id de uma opção configurada em Configurações (ex.: 'oracao'). Vazio se o campo estiver desligado. */
export type Category = string
export type CourseStatus = 'published' | 'draft' | 'hidden' | 'scheduled'
export type Level = string
/** Acesso ao curso inteiro: gratuito para todos os membros ou pago (Premium). */
export type CourseAccess = 'free' | 'premium'

export interface VideoMeta {
  name: string
  size: number
  duration: number
  type: string
}

export interface Lesson {
  id: string
  title: string
  video: VideoMeta | null
  free: boolean
  /** Pontos de oração depois da aula (opcional). Só os vê quem pode ver a aula. */
  prayerPoints?: string[]
}

export interface CourseModule {
  id: string
  title: string
  lessons: Lesson[]
}

export interface Course {
  id: string
  title: string
  category: Category
  status: CourseStatus
  /** Ausente nos cursos antigos: conta como 'premium' (só as aulas marcadas como gratuitas são livres). */
  access?: CourseAccess
  publishAt?: string
  level: Level
  instructor: string
  cover: string
  description: string
  /** Pontos de oração para todo o devocional (opcional). */
  prayerPoints?: string[]
  modules: CourseModule[]
  featured: boolean
  updated: string
  views: number
  students: number
}

export interface EventItem {
  id: string
  title: string
  kind: string
  date: string
  place: string
  entry: string
  status: 'published' | 'draft'
  description: string
  /** Foto do evento (/uploads/covers/... ou /brand/...); '' = sem foto. */
  image: string
}

export type TestimonyStatus = 'pending' | 'published' | 'hidden'

export interface Testimony {
  id: string
  userId: string | null
  name: string
  text: string
  courseId: string | null
  lessonId: string | null
  source: string
  status: TestimonyStatus
  date: string
}

// Conteúdo diário da profetisa: mensagem do dia, anotação ou ponto de oração.
export type PostType = 'daily-message' | 'note' | 'prayer-point'

export interface Post {
  id: string
  type: PostType
  title: string
  body: string
  language: Language
  publishAt: string
  status: 'published' | 'draft'
  premium: boolean
  createdAt: string
}

export interface Question {
  id: string
  userId: string
  name: string
  email: string
  subject: string
  body: string
  /** Aula a que a dúvida se refere. Ausente nas dúvidas gerais, anteriores a esta ligação. */
  courseId?: string | null
  lessonId?: string | null
  /** Títulos no momento da pergunta, para o painel mesmo que o curso mude. */
  courseTitle?: string | null
  lessonTitle?: string | null
  answer: string
  status: 'open' | 'answered'
  createdAt: string
  answeredAt: string | null
}

export interface AssistanceFeedback {
  id: string
  userId: string
  name: string
  rating: number
  comment: string
  createdAt: string
}

export type PaymentStatus = 'pending' | 'confirmed' | 'failed' | 'expired'

export interface Payment {
  id: string
  /** null quando a conta foi apagada (o histórico do pagamento mantém-se). */
  userId: string | null
  plan: PlanId
  amount: number
  method: PaymentMethod
  accountMasked: string
  status: PaymentStatus
  provider: string
  // Id de 12 caracteres alfanuméricos enviado ao iMaliWay (partner_transaction_id).
  partnerTransactionId: string
  // transaction_id devolvido pelo iMaliWay.
  providerRef: string | null
  failureReason: string | null
  createdAt: string
  expiresAt: string | null
  confirmedAt: string | null
  lastCheckedAt: string | null
}

/** Opção de um campo do curso (categoria ou nível), com nome em PT e EN. */
export interface FieldOption {
  id: string
  label: string
  labelEn: string
}

/** Um campo do curso que a administração pode ligar/desligar e cujas opções define. */
export interface CourseField {
  enabled: boolean
  options: FieldOption[]
}

export interface Settings {
  name: string
  email: string
  description: string
  moderation: boolean
  comments: boolean
  signups: boolean
  maintenance: boolean
  categories: CourseField
  levels: CourseField
}
