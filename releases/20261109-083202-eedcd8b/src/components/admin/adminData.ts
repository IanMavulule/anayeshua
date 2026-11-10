/* ==========================================================================
   ANA YESHUA - HOLY GHOST MINISTERING — PAINEL (tipos e utilitários)
   ========================================================================== */

/** Ids das opções configuradas em Configurações; vazio se o campo estiver desligado. */
export type Category = string
export type Level = string

/** Opção de categoria ou nível, com nome em PT e EN. */
export type FieldOption = { id: string; label: string; labelEn: string }
/** Campo do curso que se liga/desliga e cujas opções se definem em Configurações. */
export type CourseField = { enabled: boolean; options: FieldOption[] }
export type CourseStatus = 'published' | 'draft' | 'hidden' | 'scheduled'
/** Curso inteiro gratuito ou pago (Premium). Os cursos antigos sem valor contam como pagos. */
export type CourseAccess = 'free' | 'premium'
export type Plan = 'free' | 'premium'
export type MemberStatus = 'active' | 'suspended'
export type EventStatus = 'published' | 'draft'
export type TestimonyStatus = 'pending' | 'published' | 'hidden'
export type SortKey = 'recent' | 'title' | 'views'
export type ViewKey = 'table' | 'grid'

export type PanelId =
  | 'panel-overview'
  | 'panel-library'
  | 'panel-agenda'
  | 'panel-daily'
  | 'panel-testimonies'
  | 'panel-questions'
  | 'panel-members'
  | 'panel-server'
  | 'panel-settings'

export type VideoMeta = { name: string; size: number; duration: number; type: string }
/** `prayerPoints`: pontos de oração opcionais, mostrados depois da aula. */
export type Lesson = { id: string; title: string; video: VideoMeta | null; free: boolean; prayerPoints?: string[] }
export type CourseModule = { id: string; title: string; lessons: Lesson[] }

export type Course = {
  id: string
  title: string
  category: Category
  status: CourseStatus
  access?: CourseAccess
  cover: string
  level: Level
  instructor: string
  description: string
  /** Pontos de oração para todo o devocional (opcional). */
  prayerPoints?: string[]
  modules: CourseModule[]
  featured: boolean
  updated: string
  views: number
  students: number
  publishAt?: string
}

export type EventItem = {
  id: string
  title: string
  kind: string
  date: string
  place: string
  entry: string
  status: EventStatus
  description: string
  /** Foto do evento (/uploads/covers/...); '' = sem foto. */
  image: string
}

export type Testimony = {
  id: string
  name: string
  status: TestimonyStatus
  text: string
  source: string
  date: string
}

export type Member = {
  id: string
  name: string
  email: string
  role: 'admin' | 'member'
  plan: Plan
  status: MemberStatus
  since: string
  last: string
  subscriptionEndsAt: string | null
}

export type PostType = 'daily-message' | 'note' | 'prayer-point'

export type Post = {
  id: string
  type: PostType
  title: string
  body: string
  language: 'pt' | 'en'
  publishAt: string
  status: 'published' | 'draft'
  premium: boolean
  createdAt: string
}

export type Question = {
  id: string
  name: string
  email: string
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

export type Feedback = {
  id: string
  name: string
  rating: number
  comment: string
  createdAt: string
}

export type Payment = {
  id: string
  userId: string
  plan: '200' | '500'
  amount: number
  method: string
  accountMasked: string
  status: 'pending' | 'confirmed' | 'failed' | 'expired'
  provider: string
  createdAt: string
  confirmedAt: string | null
}

export type AdminSettings = {
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

export type AdminData = {
  settings: AdminSettings
  courses: Course[]
  events: EventItem[]
  testimonies: Testimony[]
  members: Member[]
  posts: Post[]
  questions: Question[]
  feedback: Feedback[]
  payments: Payment[]
}

export const EMPTY_DATA: AdminData = {
  settings: {
    name: 'Ana Yeshua - Holy Ghost Ministering',
    email: '',
    description: '',
    moderation: true,
    comments: true,
    signups: true,
    maintenance: false,
    categories: {
      enabled: true,
      options: [
        { id: 'espirito-santo', label: 'Ministério do Espírito Santo', labelEn: 'Ministry of the Holy Spirit' },
        { id: 'profetico', label: 'Ministério Profético', labelEn: 'Prophetic ministry' },
        { id: 'mulheres', label: 'Mulheres e Propósito', labelEn: 'Women and purpose' },
        { id: 'palavra', label: 'Palavra de Deus', labelEn: 'Word of God' },
        { id: 'oracao', label: 'Oração, Intercessão e Adoração', labelEn: 'Prayer, intercession and worship' },
        { id: 'ministerial', label: 'Actividade Ministerial', labelEn: 'Ministerial activity' },
      ],
    },
    levels: {
      enabled: true,
      options: [
        { id: 'iniciante', label: 'Iniciante', labelEn: 'Beginner' },
        { id: 'intermedio', label: 'Intermédio', labelEn: 'Intermediate' },
        { id: 'avancado', label: 'Avançado', labelEn: 'Advanced' },
      ],
    },
  },
  courses: [],
  events: [],
  testimonies: [],
  members: [],
  posts: [],
  questions: [],
  feedback: [],
  payments: [],
}

export type LibFilters = {
  query: string
  category: 'all' | Category
  status: 'all' | CourseStatus
  sort: SortKey
  view: ViewKey
  selected: Set<string>
}

export type MemberFilters = {
  query: string
  plan: 'all' | Plan
  status: 'all' | MemberStatus
}

/* --- Rascunhos do drawer -------------------------------------------------- */

export type ContentDraft = {
  id: string | null
  title: string
  category: Category
  status: CourseStatus
  access: CourseAccess
  publishAt: string
  level: Level
  instructor: string
  cover: string
  coverInput: string
  description: string
  prayerPoints: string[]
  featured: boolean
  modules: CourseModule[]
}

export type EventDraft = {
  id: string | null
  title: string
  kind: string
  date: string
  place: string
  entry: string
  status: EventStatus
  description: string
  /** Foto do evento (/uploads/covers/...); '' = sem foto. */
  image: string
}

export type MemberDraft = {
  id: string | null
  name: string
  email: string
  plan: Plan
  status: MemberStatus
}

export type PostDraft = {
  id: string | null
  type: PostType
  title: string
  body: string
  language: 'pt' | 'en'
  publishAt: string
  status: 'published' | 'draft'
  premium: boolean
}

/* --- Constantes ----------------------------------------------------------- */

export const DEFAULT_COVER = '/brand/img/video-oracao.webp'
export const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024
export const MAX_COVER_BYTES = 4 * 1024 * 1024

/**
 * Nome de uma opção (categoria ou nível) a partir da configuração. Se a opção
 * já não existir, mostra o próprio id; sem valor, devolve ''.
 */
export function optionLabel(field: CourseField, id?: string | null): string {
  if (!id) return ''
  return field.options.find((option) => option.id === id)?.label || id
}

/** Id curto e estável a partir de um nome: "Jovens adultos" → "jovens-adultos". */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

export const STATUS: Record<CourseStatus, { label: string; cls: string }> = {
  published: { label: 'Publicado', cls: 'st--published' },
  draft: { label: 'Rascunho', cls: 'st--draft' },
  hidden: { label: 'Oculto', cls: 'st--hidden' },
  scheduled: { label: 'Agendado', cls: 'st--scheduled' },
}

export const PLANS: Record<Plan, string> = { free: 'Gratuito', premium: 'Premium' }

export const MEMBER_STATUS: Record<MemberStatus, { label: string; cls: string }> = {
  active: { label: 'Activo', cls: 'st--published' },
  suspended: { label: 'Suspenso', cls: 'st--hidden' },
}

export const PANEL_NAMES: Record<PanelId, string> = {
  'panel-overview': 'Visão geral',
  'panel-library': 'Cursos',
  'panel-agenda': 'Eventos',
  'panel-daily': 'Palavra do dia',
  'panel-testimonies': 'Testemunhos',
  'panel-questions': 'Dúvidas',
  'panel-members': 'Membros',
  'panel-server': 'Servidor',
  'panel-settings': 'Configurações',
}

export const COVER_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Imagens da biblioteca' },
  { value: '/brand/img/video-oracao.webp', label: 'Oração · culto' },
  { value: '/brand/img/video-oracao-2.webp', label: 'Oração · ensino' },
  { value: '/brand/img/video-louvor.webp', label: 'Louvor · harpa' },
  { value: '/brand/img/video-mulheres.webp', label: 'Mulheres · conferência' },
  { value: '/brand/img/video-mulheres-2.webp', label: 'Mulheres · culto' },
  { value: '/brand/img/video-culto.webp', label: 'Culto · domingo' },
  { value: '/brand/img/video-culto-2.webp', label: 'Culto · altar' },
  { value: '/brand/img/video-culto-3.webp', label: 'Culto · directo' },
  { value: '/brand/img/photo-seated.webp', label: 'Retrato · sentada' },
  { value: '/brand/img/photo-mint.webp', label: 'Retrato · verde' },
]

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

/* --- Utilitários ---------------------------------------------------------- */

export function parseDate(value?: string | null): Date | null {
  if (!value) return null
  const date = new Date(value.length === 10 ? value + 'T00:00' : value)
  return isNaN(date.getTime()) ? null : date
}

export function fmtDate(value?: string | null, withTime = true): string {
  const date = parseDate(value)
  if (!date) return '—'
  const day = String(date.getDate()).padStart(2, '0')
  let text = day + ' ' + MONTHS[date.getMonth()] + ' ' + date.getFullYear()
  if (withTime) {
    text += ' · ' + String(date.getHours()).padStart(2, '0') + 'h' + String(date.getMinutes()).padStart(2, '0')
  }
  return text
}

export function nowInput(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) +
    'T' + pad(date.getHours()) + ':' + pad(date.getMinutes())
  )
}

export function plusOneDay(): string {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  date.setHours(19, 0, 0, 0)
  return nowInput(date)
}

export function initials(name?: string): string {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '—'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function plural(count: number, one: string, many: string): string {
  return count + ' ' + (count === 1 ? one : many)
}

export function fmtDuration(seconds?: number): string {
  const total = Math.round(Number(seconds) || 0)
  if (!total) return '—'
  const hours = Math.floor(total / 3600)
  const minutes = Math.round((total % 3600) / 60)
  if (hours) return hours + ' h ' + String(minutes).padStart(2, '0')
  return minutes + ' min'
}

export function fmtSize(bytes?: number): string {
  const value = Number(bytes) || 0
  if (!value) return '—'
  if (value >= 1024 * 1024 * 1024) return (value / (1024 * 1024 * 1024)).toFixed(1).replace('.', ',') + ' GB'
  return Math.round(value / (1024 * 1024)) + ' MB'
}

export function fmtViews(value?: number): string {
  const views = Number(value) || 0
  if (views < 1000) return views + (views === 1 ? ' vista' : ' vistas')
  const thousands = views / 1000
  const text = thousands >= 10
    ? String(Math.round(thousands))
    : thousands.toFixed(1).replace('.', ',').replace(',0', '')
  return text + ' mil vistas'
}

export function moduleLessons(course: Course): number {
  return (course.modules || []).reduce((sum, module) => sum + (module.lessons ? module.lessons.length : 0), 0)
}

export function courseDuration(course: Course): number {
  return (course.modules || []).reduce(
    (sum, module) => sum + (module.lessons || []).reduce((inner, item) => inner + (item.video && item.video.duration ? item.video.duration : 0), 0),
    0,
  )
}

export function missingVideos(course: Course): number {
  return (course.modules || []).reduce(
    (sum, module) => sum + (module.lessons || []).filter((item) => !item.video || !item.video.name).length,
    0,
  )
}

export function courseMeta(course: Course): string {
  const modules = (course.modules || []).length
  const lessons = moduleLessons(course)
  const duration = courseDuration(course)
  return (
    plural(modules, 'módulo', 'módulos') + ' · ' + plural(lessons, 'aula', 'aulas') +
    (duration ? ' · ' + fmtDuration(duration) : '')
  )
}

export function greetingText(name = 'Ana', date = new Date()): string {
  const hour = date.getHours()
  const greeting = hour < 12 ? 'Bom dia' : hour < 19 ? 'Boa tarde' : 'Boa noite'
  return greeting + ', ' + (name.split(' ')[0] || 'Ana') + '.'
}

export const POST_TYPES: Record<PostType, string> = {
  'daily-message': 'Mensagem do dia',
  note: 'Anotação',
  'prayer-point': 'Ponto de oração',
}

export function todayText(date = new Date()): string {
  const label = date.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/** Pontos de oração limpos para gravar: sem espaços a mais nem linhas vazias. */
export function cleanPrayerPoints(points?: string[]): string[] {
  return (points ?? []).map((point) => point.trim()).filter(Boolean).slice(0, 30)
}

export function libraryList(
  courses: Course[],
  f: { query: string; category: string; status: string; sort: SortKey },
  settings: Pick<AdminSettings, 'categories' | 'levels'> = EMPTY_DATA.settings,
): Course[] {
  const query = f.query.trim().toLowerCase()
  const list = courses.filter((course) => {
    const matchesStatus = f.status === 'all' || course.status === f.status
    const matchesCategory = f.category === 'all' || course.category === f.category
    const haystack = [
      course.title,
      course.description || '',
      optionLabel(settings.categories, course.category),
      optionLabel(settings.levels, course.level),
    ].concat(
      (course.modules || []).reduce<string[]>((all, module) => all.concat(
        [module.title || ''],
        (module.lessons || []).map((item) => item.title || ''),
      ), []),
    ).join(' ').toLowerCase()
    return matchesStatus && matchesCategory && (!query || haystack.indexOf(query) !== -1)
  })
  if (f.sort === 'title') list.sort((a, b) => a.title.localeCompare(b.title, 'pt'))
  else if (f.sort === 'views') list.sort((a, b) => (b.views || 0) - (a.views || 0))
  else list.sort((a, b) => (parseDate(b.updated)?.getTime() || 0) - (parseDate(a.updated)?.getTime() || 0))
  return list
}
