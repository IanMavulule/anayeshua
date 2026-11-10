/* ==========================================================================
   ANA YESHUA - HOLY GHOST MINISTERING — PAINEL (store React)
   O estado é carregado de /api/admin/state e cada acção chama a API REST;
   o estado local só é actualizado com a resposta do servidor.
   ========================================================================== */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthActions, useSession } from '../../hooks/auth/useSession'
import { adminApi } from '../../utils/api/adminApi'
import { ApiError } from '../../utils/api/apiClient'
import { ROUTES } from '../../utils/constants/routes'
import {
  DEFAULT_COVER,
  EMPTY_DATA,
  MAX_COVER_BYTES,
  MAX_VIDEO_BYTES,
  PANEL_NAMES,
  cleanPrayerPoints,
  libraryList,
  nowInput,
  plusOneDay,
  type AdminData,
  type AdminSettings,
  type Category,
  type ContentDraft,
  type Course,
  type CourseStatus,
  type EventDraft,
  type EventStatus,
  type Lesson,
  type LibFilters,
  type MemberDraft,
  type MemberFilters,
  type MemberStatus,
  type PanelId,
  type Plan,
  type PostDraft,
  type SortKey,
  type TestimonyStatus,
  type ViewKey,
} from './adminData'

export type DrawerType = 'content' | 'event' | 'member' | 'post'

export type PlayerState = { open: boolean; kicker: string; title: string; src?: string }
export type ToastItem = { id: number; title: string; message: string; error: boolean; leaving: boolean }

type ConfirmOptions = { title: string; text: string; label: string }
type Token = { value: string; resolve: (value: boolean) => void }

export type AdminStore = {
  data: AdminData
  loading: boolean
  loadError: string | null
  reload: () => void
  userName: string
  currentUserId: string

  // Navegação
  panel: PanelId
  showPanel: (id: PanelId, opts?: { focusSearch?: boolean; hash?: boolean }) => void
  sidebarOpen: boolean
  toggleSidebar: () => void
  closeSidebar: () => void
  signOut: () => void

  // Biblioteca
  lib: LibFilters
  libraryList: Course[]
  setLibQuery: (v: string) => void
  setLibCategory: (v: 'all' | Category) => void
  setLibSort: (v: SortKey) => void
  setLibStatus: (v: 'all' | CourseStatus) => void
  setLibView: (v: ViewKey) => void
  toggleSelect: (id: string, checked: boolean) => void
  selectAllVisible: (checked: boolean) => void
  bulkPublish: () => void
  bulkHide: () => void
  bulkDelete: () => void
  bulkClear: () => void

  // Testemunhos
  mod: 'all' | TestimonyStatus
  setMod: (v: 'all' | TestimonyStatus) => void

  // Membros
  memberFilters: MemberFilters
  setMemberQuery: (v: string) => void
  setMemberPlan: (v: 'all' | Plan) => void
  setMemberStatus: (v: 'all' | MemberStatus) => void

  // Drawer
  drawerType: DrawerType | null
  contentDraft: ContentDraft | null
  eventDraft: EventDraft | null
  memberDraft: MemberDraft | null
  postDraft: PostDraft | null
  drawerStatus: string
  saving: boolean
  uploads: Record<string, number>
  media: Map<string, string>
  openContent: (id?: string | null) => void
  openEvent: (id?: string | null) => void
  openMember: (id?: string | null) => void
  openPost: (id?: string | null) => void
  closeDrawer: () => void
  saveActive: () => void
  updateContent: (patch: Partial<ContentDraft>) => void
  addModule: () => void
  removeModule: (moduleId: string) => void
  moveModule: (moduleId: string, dir: -1 | 1) => void
  addLesson: (moduleId: string) => void
  removeLesson: (moduleId: string, lessonId: string) => void
  moveLesson: (moduleId: string, lessonId: string, dir: -1 | 1) => void
  updateLesson: (moduleId: string, lessonId: string, patch: Partial<Lesson>) => void
  uploadVideo: (moduleId: string, lessonId: string, file: File) => void
  handleCoverFile: (file: File) => void
  handleEventImageFile: (file: File) => void
  eventImageBusy: boolean
  updateEvent: (patch: Partial<EventDraft>) => void
  updateMember: (patch: Partial<MemberDraft>) => void
  updatePost: (patch: Partial<PostDraft>) => void

  // Confirmação
  confirm: ConfirmOptions | null
  askConfirm: (options: ConfirmOptions) => Promise<boolean>
  settleConfirm: (value: boolean) => void

  // Toasts
  toasts: ToastItem[]
  toast: (title: string, message: string, type?: 'error') => void

  // Player
  player: PlayerState
  closePlayer: () => void
  playCourse: (course: Course) => void
  previewLesson: (moduleId: string, lessonId: string) => void

  // Pesquisa global
  globalQuery: string
  setGlobalQuery: (v: string) => void
  searchOpen: boolean
  closeSearch: () => void
  submitGlobalSearch: () => void

  // Acções de domínio
  toggleStatus: (id: string) => void
  toggleFeatured: (id: string) => void
  duplicateContent: (id: string) => void
  deleteContent: (id: string) => void
  toggleEventStatus: (id: string) => void
  deleteEvent: (id: string) => void
  publishTestimony: (id: string) => void
  hideTestimony: (id: string) => void
  deleteTestimony: (id: string) => void
  toggleMemberStatus: (id: string) => void
  deleteMember: (id: string) => void
  deletePost: (id: string) => void
  answerQuestion: (id: string, answer: string) => Promise<boolean>
  deleteQuestion: (id: string) => void
  deleteFeedback: (id: string) => void
  saveSettings: (patch: Partial<AdminSettings>) => void

  // Refs
  globalSearchRef: RefObject<HTMLInputElement | null>
  libSearchRef: RefObject<HTMLInputElement | null>
  contentTitleRef: RefObject<HTMLInputElement | null>
  contentDateRef: RefObject<HTMLInputElement | null>
  modulesListRef: RefObject<HTMLDivElement | null>
  eventTitleRef: RefObject<HTMLInputElement | null>
  eventDateRef: RefObject<HTMLInputElement | null>
  memberNameRef: RefObject<HTMLInputElement | null>
  memberEmailRef: RefObject<HTMLInputElement | null>
  postTitleRef: RefObject<HTMLInputElement | null>
}

const AdminContext = createContext<AdminStore | null>(null)

export function useAdmin(): AdminStore {
  const store = useContext(AdminContext)
  if (!store) throw new Error('useAdmin deve ser usado dentro de <AdminProvider>')
  return store
}

/* --- Utilitários locais -------------------------------------------------- */

function readDuration(file: File): Promise<{ duration: number; url: string }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const probe = document.createElement('video')
    let settled = false
    const finish = (duration: number) => {
      if (settled) return
      settled = true
      resolve({ duration, url })
    }
    probe.preload = 'metadata'
    probe.onloadedmetadata = () => finish(isFinite(probe.duration) ? probe.duration : 0)
    probe.onerror = () => finish(0)
    probe.src = url
    window.setTimeout(() => finish(0), 3500)
  })
}

/** Recorta uma imagem para 16:9 (1120×630) e devolve-a em JPEG. */
function cropCover(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 1120
      canvas.height = 630
      const context = canvas.getContext('2d')
      if (!context) return reject(new Error('canvas'))
      const scale = Math.max(canvas.width / image.width, canvas.height / image.height)
      const width = image.width * scale
      const height = image.height * scale
      context.drawImage(image, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height)
      URL.revokeObjectURL(url)
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('blob'))), 'image/jpeg', 0.82)
    }
    image.onerror = () => reject(new Error('image'))
    image.src = url
  })
}

// Ids de módulos e aulas também são nomes de ficheiro de vídeo: só [A-Za-z0-9_-].
const newLocalId = (prefix: string) => prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)

function apiErrorText(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Não foi possível contactar o servidor.'
  switch (error.code) {
    case 'unauthorized':
      return 'A sessão expirou. Entre novamente.'
    case 'forbidden':
      return 'Esta conta não tem acesso de administração.'
    case 'email_taken':
      return 'Já existe uma conta com este e-mail.'
    case 'invalid_body':
      return 'Verifique os campos: ' + (Array.isArray(error.details) ? error.details.join(', ') : 'dados inválidos') + '.'
    case 'cannot_delete_self':
      return 'Não pode eliminar a sua própria conta.'
    case 'cannot_suspend_self':
      return 'Não pode suspender a sua própria conta.'
    case 'file_too_large':
      return 'O ficheiro excede o limite permitido.'
    case 'unsupported_image':
      return 'Use uma imagem JPG, PNG ou WebP.'
    case 'option_in_use':
      return 'Há cursos a usar uma opção que tentou remover. Mude primeiro esses cursos.'
    case 'invalid_category':
      return 'Escolha uma categoria da lista configurada.'
    case 'invalid_level':
      return 'Escolha um nível da lista configurada.'
    case 'network_error':
      return 'Servidor indisponível. Inicie-o com `npm run dev`.'
    default:
      return 'O servidor recusou o pedido (' + error.code + ').'
  }
}

export function AdminProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useSession()
  const { logout } = useAuthActions()

  const [data, setData] = useState<AdminData>(EMPTY_DATA)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [panel, setPanel] = useState<PanelId>(() => {
    let initial = ''
    try {
      const requested = new URLSearchParams(location.search).get('panel')
      if (requested) initial = 'panel-' + requested
    } catch {
      /* idem */
    }
    if (!initial) initial = location.hash.replace('#', '')
    return initial in PANEL_NAMES ? (initial as PanelId) : 'panel-overview'
  })

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [lib, setLib] = useState<LibFilters>(() => ({
    query: '',
    category: 'all',
    status: 'all',
    sort: 'recent',
    view: typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches ? 'grid' : 'table',
    selected: new Set<string>(),
  }))
  const [mod, setMod] = useState<'all' | TestimonyStatus>('all')
  const [memberFilters, setMemberFilters] = useState<MemberFilters>({ query: '', plan: 'all', status: 'all' })

  const [drawerType, setDrawerType] = useState<DrawerType | null>(null)
  const [contentDraft, setContentDraft] = useState<ContentDraft | null>(null)
  const [eventDraft, setEventDraft] = useState<EventDraft | null>(null)
  const [eventImageBusy, setEventImageBusy] = useState(false)
  const [memberDraft, setMemberDraft] = useState<MemberDraft | null>(null)
  const [postDraft, setPostDraft] = useState<PostDraft | null>(null)
  const [drawerStatus, setDrawerStatus] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploads, setUploads] = useState<Record<string, number>>({})
  const [media, setMedia] = useState<Map<string, string>>(() => new Map())

  const [confirm, setConfirm] = useState<ConfirmOptions | null>(null)
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [player, setPlayer] = useState<PlayerState>({ open: false, kicker: 'Pré-visualização', title: 'Aula' })
  const [globalQuery, setGlobalQueryState] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)

  const contentDraftRef = useRef<ContentDraft | null>(null)
  const uploadingRef = useRef(0)
  const lastFocusRef = useRef<HTMLElement | null>(null)
  const toastIdRef = useRef(0)

  const globalSearchRef = useRef<HTMLInputElement | null>(null)
  const libSearchRef = useRef<HTMLInputElement | null>(null)
  const contentTitleRef = useRef<HTMLInputElement | null>(null)
  const contentDateRef = useRef<HTMLInputElement | null>(null)
  const modulesListRef = useRef<HTMLDivElement | null>(null)
  const eventTitleRef = useRef<HTMLInputElement | null>(null)
  const eventDateRef = useRef<HTMLInputElement | null>(null)
  const memberNameRef = useRef<HTMLInputElement | null>(null)
  const memberEmailRef = useRef<HTMLInputElement | null>(null)
  const postTitleRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => { contentDraftRef.current = contentDraft }, [contentDraft])

  /* --- Toasts ------------------------------------------------------------- */
  const toast = useCallback((title: string, message: string, type?: 'error') => {
    const id = ++toastIdRef.current
    setToasts((list) => [...list, { id, title, message, error: type === 'error', leaving: false }])
    window.setTimeout(() => {
      setToasts((list) => list.map((item) => (item.id === id ? { ...item, leaving: true } : item)))
      window.setTimeout(() => setToasts((list) => list.filter((item) => item.id !== id)), 260)
    }, type === 'error' ? 6000 : 3600)
  }, [])

  /** Executa uma chamada à API e mostra um toast de erro se falhar. */
  const attempt = useCallback(async <T,>(action: () => Promise<T>, failTitle = 'Não foi possível guardar'): Promise<T | null> => {
    try {
      return await action()
    } catch (error) {
      toast(failTitle, apiErrorText(error), 'error')
      return null
    }
  }, [toast])

  /* --- Carregamento ------------------------------------------------------- */
  const reload = useCallback(() => {
    setLoading(true)
    setLoadError(null)
    adminApi
      .state()
      .then((state) => setData({ ...EMPTY_DATA, ...state }))
      .catch((error) => setLoadError(apiErrorText(error)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { reload() }, [reload])

  useEffect(() => {
    document.body.classList.toggle('adm-lock', drawerType !== null || player.open)
  }, [drawerType, player.open])

  /* --- Confirmação -------------------------------------------------------- */
  const confirmRef = useRef<Token | null>(null)
  const askConfirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      confirmRef.current = { value: options.label, resolve }
      setConfirm(options)
    })
  }, [])
  const settleConfirm = useCallback((value: boolean) => {
    setConfirm(null)
    const pending = confirmRef.current
    confirmRef.current = null
    if (pending) pending.resolve(value)
  }, [])

  /* --- Navegação ---------------------------------------------------------- */
  const closeSidebar = useCallback(() => setSidebarOpen(false), [])
  const toggleSidebar = useCallback(() => setSidebarOpen((open) => !open), [])

  const showPanel = useCallback((id: PanelId, opts?: { focusSearch?: boolean; hash?: boolean }) => {
    setPanel(id)
    // Cada secção fica no histórico: o botão "voltar" do browser regressa à anterior.
    if ((!opts || opts.hash !== false) && window.location.hash !== '#' + id) {
      try {
        window.history.pushState(null, '', '#' + id)
      } catch {
        /* idem */
      }
    }
    setSearchOpen(false)
    setSidebarOpen(false)
    if (opts?.focusSearch) window.setTimeout(() => libSearchRef.current?.focus(), 120)
    window.scrollTo(0, 0)
  }, [])

  // Links directos (#panel-agenda) e voltar/avançar no browser abrem a secção certa.
  useEffect(() => {
    const sync = () => {
      const id = window.location.hash.replace('#', '')
      if (id in PANEL_NAMES) setPanel(id as PanelId)
    }
    window.addEventListener('hashchange', sync)
    window.addEventListener('popstate', sync)
    return () => {
      window.removeEventListener('hashchange', sync)
      window.removeEventListener('popstate', sync)
    }
  }, [])

  const signOut = useCallback(() => {
    void logout().then(() => navigate(ROUTES.login))
  }, [logout, navigate])

  /* --- Biblioteca --------------------------------------------------------- */
  const courses = data.courses
  const list = useMemo(
    () => libraryList(courses, { query: lib.query, category: lib.category, status: lib.status, sort: lib.sort }, data.settings),
    [courses, lib.query, lib.category, lib.status, lib.sort, data.settings],
  )

  const setLibQuery = useCallback((v: string) => setLib((f) => ({ ...f, query: v })), [])
  const setLibCategory = useCallback((v: 'all' | Category) => setLib((f) => ({ ...f, category: v })), [])
  const setLibSort = useCallback((v: SortKey) => setLib((f) => ({ ...f, sort: v })), [])
  const setLibStatus = useCallback((v: 'all' | CourseStatus) => setLib((f) => ({ ...f, status: v })), [])
  const setLibView = useCallback((v: ViewKey) => setLib((f) => ({ ...f, view: v })), [])

  const toggleSelect = useCallback((id: string, checked: boolean) => {
    setLib((f) => {
      const selected = new Set(f.selected)
      if (checked) selected.add(id)
      else selected.delete(id)
      return { ...f, selected }
    })
  }, [])

  const selectAllVisible = useCallback((checked: boolean) => {
    setLib((f) => {
      const visible = libraryList(courses, { query: f.query, category: f.category, status: f.status, sort: f.sort }, data.settings)
      const selected = new Set(f.selected)
      visible.forEach((item) => (checked ? selected.add(item.id) : selected.delete(item.id)))
      return { ...f, selected }
    })
  }, [courses])

  const bulkSetStatus = useCallback(async (status: 'published' | 'hidden') => {
    const ids = [...lib.selected]
    if (!ids.length) return
    const updated = await attempt(() => adminApi.bulkCourses(ids, status))
    if (!updated) return
    setData((prev) => ({ ...prev, courses: updated }))
    setLib((f) => ({ ...f, selected: new Set<string>() }))
    toast(status === 'published' ? 'Cursos publicados' : 'Cursos ocultos', ids.length + ' curso(s) actualizados na biblioteca.')
  }, [lib.selected, attempt, toast])

  const bulkPublish = useCallback(() => void bulkSetStatus('published'), [bulkSetStatus])
  const bulkHide = useCallback(() => void bulkSetStatus('hidden'), [bulkSetStatus])
  const bulkClear = useCallback(() => setLib((f) => ({ ...f, selected: new Set<string>() })), [])

  const bulkDelete = useCallback(() => {
    const ids = [...lib.selected]
    if (!ids.length) return
    void askConfirm({
      title: 'Eliminar ' + ids.length + ' curso(s)?',
      text: 'Os cursos seleccionados serão removidos da biblioteca. Os ficheiros de vídeo continuam no servidor.',
      label: 'Eliminar',
    }).then(async (ok) => {
      if (!ok) return
      const updated = await attempt(() => adminApi.bulkCourses(ids), 'Não foi possível eliminar')
      if (!updated) return
      setData((prev) => ({ ...prev, courses: updated }))
      setLib((f) => ({ ...f, selected: new Set<string>() }))
      toast('Cursos eliminados', ids.length + ' curso(s) removidos da biblioteca.')
    })
  }, [lib.selected, askConfirm, attempt, toast])

  /* --- Membros (filtros) -------------------------------------------------- */
  const setMemberQuery = useCallback((v: string) => setMemberFilters((f) => ({ ...f, query: v })), [])
  const setMemberPlan = useCallback((v: 'all' | Plan) => setMemberFilters((f) => ({ ...f, plan: v })), [])
  const setMemberStatusFilter = useCallback((v: 'all' | MemberStatus) => setMemberFilters((f) => ({ ...f, status: v })), [])

  /* --- Drawer ------------------------------------------------------------- */
  const closeDrawer = useCallback(() => {
    setDrawerType(null)
    setContentDraft(null)
    setEventDraft(null)
    setMemberDraft(null)
    setPostDraft(null)
    setDrawerStatus('')
    setUploads({})
    const el = lastFocusRef.current
    if (el && document.contains(el)) el.focus()
    lastFocusRef.current = null
  }, [])

  const rememberFocus = () => {
    lastFocusRef.current = document.activeElement as HTMLElement | null
    setDrawerStatus('')
  }

  const openContent = useCallback((id?: string | null) => {
    rememberFocus()
    const item = id ? data.courses.find((c) => c.id === id) : null
    setContentDraft(
      item
        ? {
          id: item.id,
          title: item.title,
          category: item.category,
          status: item.status,
          access: item.access ?? 'premium',
          publishAt: item.publishAt || plusOneDay(),
          level: item.level || '',
          instructor: item.instructor || 'Ana Yeshua',
          cover: item.cover || DEFAULT_COVER,
          coverInput: '',
          description: item.description || '',
          prayerPoints: item.prayerPoints ?? [],
          featured: Boolean(item.featured),
          modules: (item.modules || []).map((m) => ({ id: m.id, title: m.title, lessons: (m.lessons || []).map((l) => ({ ...l })) })),
        }
        : {
          id: null,
          title: '',
          category: data.settings.categories.enabled ? data.settings.categories.options[0]?.id ?? '' : '',
          // Um curso novo nasce como rascunho: só se publica quando estiver pronto.
          status: 'draft',
          access: 'premium',
          publishAt: plusOneDay(),
          level: data.settings.levels.enabled ? data.settings.levels.options[0]?.id ?? '' : '',
          instructor: 'Ana Yeshua',
          cover: DEFAULT_COVER,
          coverInput: '',
          description: '',
          prayerPoints: [],
          featured: false,
          modules: [],
        },
    )
    setDrawerType('content')
  }, [data.courses, data.settings])

  const openEvent = useCallback((id?: string | null) => {
    rememberFocus()
    const item = id ? data.events.find((e) => e.id === id) : null
    setEventDraft(
      item
        ? { id: item.id, title: item.title, kind: item.kind || '', date: item.date || '', place: item.place || '', entry: item.entry || 'Livre', status: item.status, description: item.description || '', image: item.image || '' }
        : { id: null, title: '', kind: '', date: plusOneDay(), place: '', entry: 'Livre', status: 'published', description: '', image: '' },
    )
    setDrawerType('event')
  }, [data.events])

  const openMember = useCallback((id?: string | null) => {
    rememberFocus()
    const item = id ? data.members.find((m) => m.id === id) : null
    setMemberDraft(
      item
        ? { id: item.id, name: item.name, email: item.email, plan: item.plan, status: item.status }
        : { id: null, name: '', email: '', plan: 'free', status: 'active' },
    )
    setDrawerType('member')
  }, [data.members])

  const openPost = useCallback((id?: string | null) => {
    rememberFocus()
    const item = id ? data.posts.find((p) => p.id === id) : null
    setPostDraft(
      item
        ? { id: item.id, type: item.type, title: item.title, body: item.body, language: item.language, publishAt: nowInput(new Date(item.publishAt)), status: item.status, premium: item.premium }
        : { id: null, type: 'daily-message', title: '', body: '', language: 'pt', publishAt: nowInput(), status: 'published', premium: false },
    )
    setDrawerType('post')
  }, [data.posts])

  const updateContent = useCallback((patch: Partial<ContentDraft>) => setContentDraft((d) => (d ? { ...d, ...patch } : d)), [])
  const updateEvent = useCallback((patch: Partial<EventDraft>) => setEventDraft((d) => (d ? { ...d, ...patch } : d)), [])
  const updateMember = useCallback((patch: Partial<MemberDraft>) => setMemberDraft((d) => (d ? { ...d, ...patch } : d)), [])
  const updatePost = useCallback((patch: Partial<PostDraft>) => setPostDraft((d) => (d ? { ...d, ...patch } : d)), [])

  const addModule = useCallback(() => {
    setContentDraft((d) =>
      d ? { ...d, modules: [...d.modules, { id: newLocalId('m'), title: '', lessons: [{ id: newLocalId('l'), title: '', video: null, free: false }] }] } : d,
    )
  }, [])

  const removeModule = useCallback((moduleId: string) => {
    setContentDraft((d) => (d ? { ...d, modules: d.modules.filter((m) => m.id !== moduleId) } : d))
  }, [])

  const moveModule = useCallback((moduleId: string, dir: -1 | 1) => {
    setContentDraft((d) => {
      if (!d) return d
      const index = d.modules.findIndex((m) => m.id === moduleId)
      const target = index + dir
      if (index < 0 || target < 0 || target >= d.modules.length) return d
      const modules = d.modules.slice()
      const [moved] = modules.splice(index, 1)
      modules.splice(target, 0, moved)
      return { ...d, modules }
    })
  }, [])

  const addLesson = useCallback((moduleId: string) => {
    setContentDraft((d) =>
      d
        ? { ...d, modules: d.modules.map((m) => (m.id !== moduleId ? m : { ...m, lessons: [...m.lessons, { id: newLocalId('l'), title: '', video: null, free: false }] })) }
        : d,
    )
  }, [])

  const removeLesson = useCallback((moduleId: string, lessonId: string) => {
    setContentDraft((d) =>
      d ? { ...d, modules: d.modules.map((m) => (m.id !== moduleId ? m : { ...m, lessons: m.lessons.filter((l) => l.id !== lessonId) })) } : d,
    )
  }, [])

  const moveLesson = useCallback((moduleId: string, lessonId: string, dir: -1 | 1) => {
    setContentDraft((d) => {
      if (!d) return d
      return {
        ...d,
        modules: d.modules.map((m) => {
          if (m.id !== moduleId) return m
          const index = m.lessons.findIndex((l) => l.id === lessonId)
          const target = index + dir
          if (index < 0 || target < 0 || target >= m.lessons.length) return m
          const lessons = m.lessons.slice()
          const [moved] = lessons.splice(index, 1)
          lessons.splice(target, 0, moved)
          return { ...m, lessons }
        }),
      }
    })
  }, [])

  const updateLesson = useCallback((moduleId: string, lessonId: string, patch: Partial<Lesson>) => {
    setContentDraft((d) =>
      d
        ? { ...d, modules: d.modules.map((m) => (m.id !== moduleId ? m : { ...m, lessons: m.lessons.map((l) => (l.id !== lessonId ? l : { ...l, ...patch })) })) }
        : d,
    )
  }, [])

  /* --- Upload de vídeo (streaming para videos/<lessonId>.mp4) -------------- */
  const uploadVideo = useCallback((moduleId: string, lessonId: string, file: File) => {
    const valid = file.type === 'video/mp4' || /\.(mp4|m4v)$/i.test(file.name)
    if (!valid) {
      toast('Formato não suportado', 'Use MP4 (H.264 com faststart) para que o vídeo possa ser servido por streaming.', 'error')
      return
    }
    if (file.size > MAX_VIDEO_BYTES) {
      toast('Ficheiro demasiado grande', 'O limite por aula é de 2 GB.', 'error')
      return
    }
    uploadingRef.current += 1
    setUploads((u) => ({ ...u, [lessonId]: 0 }))
    const finish = () => {
      uploadingRef.current = Math.max(0, uploadingRef.current - 1)
      setUploads((u) => {
        const next = { ...u }
        delete next[lessonId]
        return next
      })
    }
    void Promise.all([
      readDuration(file),
      adminApi.uploadVideo(lessonId, file, (percent) => setUploads((u) => ({ ...u, [lessonId]: Math.min(percent, 99) }))),
    ])
      .then(([info]) => {
        finish()
        setMedia((map) => new Map(map).set(lessonId, info.url))
        updateLesson(moduleId, lessonId, {
          video: { name: file.name, size: file.size, duration: Math.round(info.duration || 0), type: file.type || 'video/mp4' },
        })
        toast('Vídeo carregado', file.name + ' foi enviado para o servidor. Guarde o curso para o publicar.')
      })
      .catch((error) => {
        finish()
        toast('Falha no envio', apiErrorText(error), 'error')
      })
  }, [toast, updateLesson])

  /* --- Capa --------------------------------------------------------------- */
  const handleCoverFile = useCallback((file: File) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      toast('Formato não suportado', 'Escolha uma imagem JPG, PNG ou WebP.', 'error')
      return
    }
    if (file.size > MAX_COVER_BYTES * 3) {
      toast('Imagem demasiado grande', 'Escolha uma imagem até 12 MB; será reduzida para 16:9.', 'error')
      return
    }
    void cropCover(file)
      .then((blob) => adminApi.uploadCover(blob))
      .then((url) => {
        setContentDraft((d) => (d ? { ...d, cover: url, coverInput: '' } : d))
        toast('Capa carregada', 'A imagem foi recortada em 16:9 e guardada no servidor.')
      })
      .catch((error) => toast('Não foi possível carregar a capa', apiErrorText(error), 'error'))
  }, [toast])

  /** Foto do evento: o mesmo envio das capas (recorte 16:9, guardada em /uploads/covers). */
  const handleEventImageFile = useCallback((file: File) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      toast('Formato não suportado', 'Escolha uma imagem JPG, PNG ou WebP.', 'error')
      return
    }
    if (file.size > MAX_COVER_BYTES * 3) {
      toast('Imagem demasiado grande', 'Escolha uma imagem até 12 MB; será reduzida para 16:9.', 'error')
      return
    }
    setEventImageBusy(true)
    void cropCover(file)
      .then((blob) => adminApi.uploadCover(blob))
      .then((url) => {
        setEventDraft((d) => (d ? { ...d, image: url } : d))
        toast('Foto carregada', 'Guarde o evento para a publicar.')
      })
      .catch((error) => toast('Não foi possível carregar a foto', apiErrorText(error), 'error'))
      .finally(() => setEventImageBusy(false))
  }, [toast])

  /* --- Guardar ------------------------------------------------------------ */
  const fieldError = useCallback((ref: RefObject<HTMLInputElement | null>, message: string) => {
    setDrawerStatus(message)
    toast('Não foi possível guardar', message, 'error')
    ref.current?.focus()
  }, [toast])

  const saveContent = useCallback(async () => {
    const draft = contentDraftRef.current
    if (!draft) return
    const title = draft.title.trim()
    if (!title) return fieldError(contentTitleRef, 'Indique o título do curso.')
    if (uploadingRef.current > 0) {
      setDrawerStatus('Aguarde o envio do vídeo antes de guardar.')
      toast('Envio em curso', 'O vídeo ainda está a ser enviado.', 'error')
      return
    }
    if (draft.status === 'scheduled' && !draft.publishAt) return fieldError(contentDateRef, 'Defina a data de publicação do curso agendado.')

    const modules = draft.modules.map((m, moduleIndex) => ({
      id: m.id,
      title: m.title.trim() || 'Módulo ' + (moduleIndex + 1),
      lessons: m.lessons.map((l, lessonIndex) => ({
        id: l.id,
        title: l.title.trim() || 'Aula ' + (lessonIndex + 1),
        video: l.video,
        free: l.free,
        prayerPoints: cleanPrayerPoints(l.prayerPoints),
      })),
    }))
    if (!modules.reduce((sum, m) => sum + m.lessons.length, 0)) {
      setDrawerStatus('Adicione pelo menos uma aula ao curso.')
      toast('Curso sem aulas', 'Crie um módulo com pelo menos uma aula antes de guardar.', 'error')
      modulesListRef.current?.scrollIntoView({ block: 'center' })
      return
    }

    const current = draft.id ? data.courses.find((c) => c.id === draft.id) : null
    const item: Course = {
      id: current ? current.id : '',
      title,
      category: draft.category,
      status: draft.status,
      access: draft.access,
      publishAt: draft.status === 'scheduled' ? draft.publishAt : '',
      level: draft.level,
      instructor: draft.instructor.trim() || 'Ana Yeshua',
      cover: draft.cover || DEFAULT_COVER,
      description: draft.description.trim(),
      prayerPoints: cleanPrayerPoints(draft.prayerPoints),
      modules,
      featured: draft.featured,
      updated: nowInput(),
      views: current?.views ?? 0,
      students: current?.students ?? 0,
    }

    setSaving(true)
    const saved = await attempt(() => (current ? adminApi.updateCourse(item) : adminApi.createCourse(item)))
    setSaving(false)
    if (!saved) return
    setData((prev) => ({
      ...prev,
      courses: current ? prev.courses.map((entry) => (entry.id === saved.id ? saved : entry)) : [saved, ...prev.courses],
    }))
    closeDrawer()
    toast('Curso guardado', current ? 'As alterações foram aplicadas à biblioteca.' : 'O novo curso foi adicionado à biblioteca.')
  }, [data.courses, attempt, closeDrawer, toast, fieldError])

  const saveEvent = useCallback(async () => {
    const draft = eventDraft
    if (!draft) return
    const title = draft.title.trim()
    if (!title) return fieldError(eventTitleRef, 'Indique o nome do evento.')
    if (!draft.date) return fieldError(eventDateRef, 'Defina a data e hora do evento.')
    const body = {
      title,
      kind: draft.kind.trim(),
      date: draft.date,
      place: draft.place.trim(),
      entry: draft.entry.trim() || 'Livre',
      status: draft.status as EventStatus,
      description: draft.description.trim(),
      image: draft.image,
    }
    setSaving(true)
    const saved = await attempt(() => (draft.id ? adminApi.updateEvent(draft.id, body) : adminApi.createEvent(body)))
    setSaving(false)
    if (!saved) return
    setData((prev) => ({
      ...prev,
      events: draft.id ? prev.events.map((entry) => (entry.id === saved.id ? saved : entry)) : [...prev.events, saved],
    }))
    closeDrawer()
    toast('Evento guardado', draft.id ? 'O evento foi actualizado.' : 'O novo evento foi adicionado.')
  }, [eventDraft, attempt, closeDrawer, toast, fieldError])

  const saveMember = useCallback(async () => {
    const draft = memberDraft
    if (!draft) return
    const name = draft.name.trim()
    const email = draft.email.trim()
    if (!name) return fieldError(memberNameRef, 'Indique o nome do membro.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fieldError(memberEmailRef, 'Introduza um e-mail válido.')
    const body = { name, email, plan: draft.plan, status: draft.status }
    setSaving(true)
    if (draft.id) {
      const saved = await attempt(() => adminApi.updateMember(draft.id!, body))
      setSaving(false)
      if (!saved) return
      setData((prev) => ({ ...prev, members: prev.members.map((entry) => (entry.id === saved.id ? saved : entry)) }))
      closeDrawer()
      toast('Membro guardado', 'Os dados do membro foram actualizados.')
      return
    }
    const created = await attempt(() => adminApi.createMember(body))
    setSaving(false)
    if (!created) return
    setData((prev) => ({ ...prev, members: [created.member, ...prev.members] }))
    closeDrawer()
    void askConfirm({
      title: 'Conta criada',
      text: 'Partilhe com ' + name + ' a palavra-passe temporária: ' + created.temporaryPassword + ' — ela não volta a ser mostrada.',
      label: 'Já anotei',
    })
  }, [memberDraft, attempt, closeDrawer, toast, fieldError, askConfirm])

  const savePost = useCallback(async () => {
    const draft = postDraft
    if (!draft) return
    const title = draft.title.trim()
    if (!title) return fieldError(postTitleRef, 'Indique o título.')
    if (!draft.body.trim()) {
      setDrawerStatus('Escreva o texto.')
      toast('Não foi possível guardar', 'Escreva o texto da publicação.', 'error')
      return
    }
    const body = {
      type: draft.type,
      title,
      body: draft.body.trim(),
      language: draft.language,
      publishAt: new Date(draft.publishAt).toISOString(),
      status: draft.status,
      premium: draft.premium,
    }
    setSaving(true)
    const saved = await attempt(() => (draft.id ? adminApi.updatePost(draft.id, body) : adminApi.createPost(body)))
    setSaving(false)
    if (!saved) return
    setData((prev) => ({
      ...prev,
      posts: draft.id ? prev.posts.map((entry) => (entry.id === saved.id ? saved : entry)) : [saved, ...prev.posts],
    }))
    closeDrawer()
    toast('Publicação guardada', saved.status === 'published' ? 'Fica visível a partir da data indicada.' : 'Guardada como rascunho.')
  }, [postDraft, attempt, closeDrawer, toast, fieldError])

  const saveActive = useCallback(() => {
    if (saving) return
    if (drawerType === 'content') void saveContent()
    else if (drawerType === 'event') void saveEvent()
    else if (drawerType === 'member') void saveMember()
    else if (drawerType === 'post') void savePost()
  }, [saving, drawerType, saveContent, saveEvent, saveMember, savePost])

  /* --- Player (pré-visualização) ------------------------------------------ */
  const openPlayer = useCallback((opts: { kicker: string; title: string; src?: string }) => {
    setPlayer({ open: true, kicker: opts.kicker || 'Pré-visualização', title: opts.title || 'Aula', src: opts.src })
  }, [])
  const closePlayer = useCallback(() => setPlayer({ open: false, kicker: 'Pré-visualização', title: 'Aula' }), [])

  /** Usa o ficheiro local desta sessão ou pede um token de média ao servidor. */
  const previewById = useCallback(async (lessonId: string, kicker: string, title: string) => {
    const local = media.get(lessonId)
    if (local) return openPlayer({ kicker, title, src: local })
    try {
      const token = await adminApi.mediaToken(lessonId)
      openPlayer({ kicker, title, src: `/media/${encodeURIComponent(lessonId)}?t=${encodeURIComponent(token)}` })
    } catch {
      openPlayer({ kicker, title })
    }
  }, [media, openPlayer])

  const playCourse = useCallback((course: Course) => {
    const lessons = (course.modules || []).flatMap((m) => m.lessons || [])
    const playable = lessons.find((l) => media.has(l.id)) ?? lessons.find((l) => l.video)
    if (!playable) {
      toast('Curso sem vídeos', 'Carregue pelo menos uma aula para pré-visualizar o curso.', 'error')
      return
    }
    void previewById(playable.id, course.title, playable.title)
  }, [media, previewById, toast])

  const previewLesson = useCallback((moduleId: string, lessonId: string) => {
    const lesson = contentDraftRef.current?.modules.find((m) => m.id === moduleId)?.lessons.find((l) => l.id === lessonId)
    void previewById(lessonId, 'Aula', lesson?.title.trim() || 'Aula')
  }, [previewById])

  /* --- Pesquisa global ---------------------------------------------------- */
  const setGlobalQuery = useCallback((v: string) => {
    setGlobalQueryState(v)
    setSearchOpen(v.trim().length >= 2)
  }, [])
  const closeSearch = useCallback(() => setSearchOpen(false), [])
  const submitGlobalSearch = useCallback(() => {
    const query = globalQuery.trim()
    if (!query) return
    setLib((f) => ({ ...f, query, status: 'all', category: 'all' }))
    setSearchOpen(false)
    showPanel('panel-library', { focusSearch: false })
    globalSearchRef.current?.blur()
  }, [globalQuery, showPanel])

  /* --- Acções de domínio -------------------------------------------------- */
  const replaceCourse = useCallback(async (course: Course, patch: Partial<Course>) => {
    const saved = await attempt(() => adminApi.updateCourse({ ...course, ...patch }))
    if (saved) setData((prev) => ({ ...prev, courses: prev.courses.map((entry) => (entry.id === saved.id ? saved : entry)) }))
    return saved
  }, [attempt])

  const toggleStatus = useCallback((id: string) => {
    const course = data.courses.find((c) => c.id === id)
    if (!course) return
    const status: CourseStatus = course.status === 'published' ? 'hidden' : 'published'
    void replaceCourse(course, { status }).then((saved) => {
      if (saved) toast(status === 'published' ? 'Curso publicado' : 'Curso oculto', '“' + course.title + '” está agora ' + (status === 'published' ? 'visível' : 'fora do catálogo público') + '.')
    })
  }, [data.courses, replaceCourse, toast])

  const toggleFeatured = useCallback((id: string) => {
    const course = data.courses.find((c) => c.id === id)
    if (!course) return
    const featured = !course.featured
    void replaceCourse(course, { featured }).then((saved) => {
      if (saved) toast(featured ? 'Adicionado aos destaques' : 'Removido dos destaques', '“' + course.title + '” ' + (featured ? 'aparece na página inicial.' : 'já não aparece na página inicial.'))
    })
  }, [data.courses, replaceCourse, toast])

  const duplicateContent = useCallback(async (id: string) => {
    const course = data.courses.find((c) => c.id === id)
    if (!course) return
    const prefix = newLocalId('d')
    const clone: Course = {
      ...course,
      title: course.title + ' (cópia)',
      status: 'draft',
      featured: false,
      modules: course.modules.map((module, moduleIndex) => ({
        ...module,
        id: prefix + 'm' + (moduleIndex + 1),
        lessons: module.lessons.map((item, lessonIndex) => ({ ...item, id: prefix + 'm' + (moduleIndex + 1) + 'l' + (lessonIndex + 1), video: null })),
      })),
    }
    const saved = await attempt(() => adminApi.createCourse(clone))
    if (!saved) return
    setData((prev) => ({ ...prev, courses: [saved, ...prev.courses] }))
    toast('Curso duplicado', 'A cópia foi criada como rascunho, sem os ficheiros de vídeo.')
  }, [data.courses, attempt, toast])

  const deleteContent = useCallback((id: string) => {
    const course = data.courses.find((c) => c.id === id)
    if (!course) return
    void askConfirm({ title: 'Eliminar curso?', text: '“' + course.title + '” e as suas aulas serão removidos da biblioteca.', label: 'Eliminar' }).then(async (ok) => {
      if (!ok) return
      if ((await attempt(() => adminApi.deleteCourse(id), 'Não foi possível eliminar')) === null) return
      setData((prev) => ({ ...prev, courses: prev.courses.filter((item) => item.id !== id) }))
      setLib((f) => {
        const selected = new Set(f.selected)
        selected.delete(id)
        return { ...f, selected }
      })
      toast('Curso eliminado', 'A biblioteca foi actualizada.')
    })
  }, [data.courses, askConfirm, attempt, toast])

  const toggleEventStatus = useCallback(async (id: string) => {
    const event = data.events.find((e) => e.id === id)
    if (!event) return
    const { id: _id, ...body } = event
    const status: EventStatus = event.status === 'published' ? 'draft' : 'published'
    const saved = await attempt(() => adminApi.updateEvent(id, { ...body, status }))
    if (!saved) return
    setData((prev) => ({ ...prev, events: prev.events.map((entry) => (entry.id === id ? saved : entry)) }))
    toast(status === 'published' ? 'Evento confirmado' : 'Evento em rascunho', '“' + event.title + '” foi actualizado.')
  }, [data.events, attempt, toast])

  const deleteEvent = useCallback((id: string) => {
    const event = data.events.find((e) => e.id === id)
    if (!event) return
    void askConfirm({ title: 'Eliminar evento?', text: '“' + event.title + '” será removido dos eventos.', label: 'Eliminar' }).then(async (ok) => {
      if (!ok) return
      if ((await attempt(() => adminApi.deleteEvent(id), 'Não foi possível eliminar')) === null) return
      setData((prev) => ({ ...prev, events: prev.events.filter((item) => item.id !== id) }))
      toast('Evento eliminado', 'A lista de eventos foi actualizada.')
    })
  }, [data.events, askConfirm, attempt, toast])

  const moderate = useCallback(async (id: string, status: TestimonyStatus, title: string, message: string) => {
    const saved = await attempt(() => adminApi.moderateTestimony(id, status))
    if (!saved) return
    setData((prev) => ({ ...prev, testimonies: prev.testimonies.map((entry) => (entry.id === id ? { ...entry, status: saved.status } : entry)) }))
    toast(title, message)
  }, [attempt, toast])

  const publishTestimony = useCallback((id: string) => {
    const testimony = data.testimonies.find((t) => t.id === id)
    if (testimony) void moderate(id, 'published', 'Testemunho aprovado', 'A partilha de ' + testimony.name + ' está agora pública.')
  }, [data.testimonies, moderate])

  const hideTestimony = useCallback((id: string) => {
    void moderate(id, 'hidden', 'Testemunho oculto', 'A partilha deixou de estar visível na plataforma.')
  }, [moderate])

  const deleteTestimony = useCallback((id: string) => {
    const testimony = data.testimonies.find((t) => t.id === id)
    if (!testimony) return
    void askConfirm({ title: 'Eliminar testemunho?', text: 'A partilha de ' + testimony.name + ' será removida definitivamente.', label: 'Eliminar' }).then(async (ok) => {
      if (!ok) return
      if ((await attempt(() => adminApi.deleteTestimony(id), 'Não foi possível eliminar')) === null) return
      setData((prev) => ({ ...prev, testimonies: prev.testimonies.filter((item) => item.id !== id) }))
      toast('Testemunho eliminado', 'A moderação foi actualizada.')
    })
  }, [data.testimonies, askConfirm, attempt, toast])

  const toggleMemberStatus = useCallback(async (id: string) => {
    const member = data.members.find((m) => m.id === id)
    if (!member) return
    const status: MemberStatus = member.status === 'active' ? 'suspended' : 'active'
    const saved = await attempt(() => adminApi.updateMember(id, { name: member.name, email: member.email, plan: member.plan, status }))
    if (!saved) return
    setData((prev) => ({ ...prev, members: prev.members.map((entry) => (entry.id === id ? saved : entry)) }))
    toast(status === 'active' ? 'Acesso reactivado' : 'Acesso suspenso', 'O estado de ' + member.name + ' foi actualizado.')
  }, [data.members, attempt, toast])

  const deleteMember = useCallback((id: string) => {
    const member = data.members.find((m) => m.id === id)
    if (!member) return
    void askConfirm({ title: 'Eliminar membro?', text: member.name + ' perde o acesso à plataforma.', label: 'Eliminar' }).then(async (ok) => {
      if (!ok) return
      if ((await attempt(() => adminApi.deleteMember(id), 'Não foi possível eliminar')) === null) return
      setData((prev) => ({ ...prev, members: prev.members.filter((item) => item.id !== id) }))
      toast('Membro eliminado', 'A lista de membros foi actualizada.')
    })
  }, [data.members, askConfirm, attempt, toast])

  const deletePost = useCallback((id: string) => {
    const post = data.posts.find((p) => p.id === id)
    if (!post) return
    void askConfirm({ title: 'Eliminar publicação?', text: '“' + post.title + '” será removida.', label: 'Eliminar' }).then(async (ok) => {
      if (!ok) return
      if ((await attempt(() => adminApi.deletePost(id), 'Não foi possível eliminar')) === null) return
      setData((prev) => ({ ...prev, posts: prev.posts.filter((item) => item.id !== id) }))
      toast('Publicação eliminada', 'A Palavra do dia foi actualizada.')
    })
  }, [data.posts, askConfirm, attempt, toast])

  const answerQuestion = useCallback(async (id: string, answer: string) => {
    const saved = await attempt(() => adminApi.answerQuestion(id, answer))
    if (!saved) return false
    setData((prev) => ({ ...prev, questions: prev.questions.map((entry) => (entry.id === id ? { ...entry, ...saved } : entry)) }))
    toast('Resposta enviada', 'O membro vê a resposta na sua área.')
    return true
  }, [attempt, toast])

  const deleteQuestion = useCallback((id: string) => {
    void askConfirm({ title: 'Eliminar dúvida?', text: 'A dúvida e a resposta serão removidas.', label: 'Eliminar' }).then(async (ok) => {
      if (!ok) return
      if ((await attempt(() => adminApi.deleteQuestion(id), 'Não foi possível eliminar')) === null) return
      setData((prev) => ({ ...prev, questions: prev.questions.filter((item) => item.id !== id) }))
    })
  }, [askConfirm, attempt])

  const deleteFeedback = useCallback(async (id: string) => {
    if ((await attempt(() => adminApi.deleteFeedback(id), 'Não foi possível eliminar')) === null) return
    setData((prev) => ({ ...prev, feedback: prev.feedback.filter((item) => item.id !== id) }))
  }, [attempt])

  const saveSettings = useCallback(async (patch: Partial<AdminSettings>) => {
    const clean = {
      ...patch,
      ...(patch.name !== undefined ? { name: patch.name.trim() || EMPTY_DATA.settings.name } : {}),
      ...(patch.email !== undefined ? { email: patch.email.trim() } : {}),
      ...(patch.description !== undefined ? { description: patch.description.trim() } : {}),
    }
    const settings = await attempt(() => adminApi.saveSettings(clean))
    if (!settings) return
    setData((prev) => ({ ...prev, settings }))
    toast('Configurações guardadas', 'A identidade e as preferências da plataforma foram actualizadas.')
  }, [attempt, toast])

  /* --- Atalhos de teclado ------------------------------------------------- */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (player.open) return closePlayer()
        if (confirm) return settleConfirm(false)
        if (drawerType) return closeDrawer()
        if (sidebarOpen) return closeSidebar()
        if (searchOpen) return setSearchOpen(false)
      }
      if (event.key === '/' && !drawerType) {
        const tag = (document.activeElement && document.activeElement.tagName) || ''
        if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return
        event.preventDefault()
        globalSearchRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [player.open, confirm, drawerType, sidebarOpen, searchOpen, closePlayer, settleConfirm, closeDrawer, closeSidebar])

  const store: AdminStore = {
    data,
    loading,
    loadError,
    reload,
    userName: user?.name ?? data.settings.name,
    currentUserId: user?.id ?? '',
    panel,
    showPanel,
    sidebarOpen,
    toggleSidebar,
    closeSidebar,
    signOut,
    lib,
    libraryList: list,
    setLibQuery,
    setLibCategory,
    setLibSort,
    setLibStatus,
    setLibView,
    toggleSelect,
    selectAllVisible,
    bulkPublish,
    bulkHide,
    bulkDelete,
    bulkClear,
    mod,
    setMod,
    memberFilters,
    setMemberQuery,
    setMemberPlan,
    setMemberStatus: setMemberStatusFilter,
    drawerType,
    contentDraft,
    eventDraft,
    memberDraft,
    postDraft,
    drawerStatus,
    saving,
    uploads,
    media,
    openContent,
    openEvent,
    openMember,
    openPost,
    closeDrawer,
    saveActive,
    updateContent,
    addModule,
    removeModule,
    moveModule,
    addLesson,
    removeLesson,
    moveLesson,
    updateLesson,
    uploadVideo,
    handleCoverFile,
    handleEventImageFile,
    eventImageBusy,
    updateEvent,
    updateMember,
    updatePost,
    confirm,
    askConfirm,
    settleConfirm,
    toasts,
    toast,
    player,
    closePlayer,
    playCourse,
    previewLesson,
    globalQuery,
    setGlobalQuery,
    searchOpen,
    closeSearch,
    submitGlobalSearch,
    toggleStatus,
    toggleFeatured,
    duplicateContent: (id) => void duplicateContent(id),
    deleteContent,
    toggleEventStatus: (id) => void toggleEventStatus(id),
    deleteEvent,
    publishTestimony,
    hideTestimony,
    deleteTestimony,
    toggleMemberStatus: (id) => void toggleMemberStatus(id),
    deleteMember,
    deletePost,
    answerQuestion,
    deleteQuestion,
    deleteFeedback: (id) => void deleteFeedback(id),
    saveSettings: (patch) => void saveSettings(patch),
    globalSearchRef,
    libSearchRef,
    contentTitleRef,
    contentDateRef,
    modulesListRef,
    eventTitleRef,
    eventDateRef,
    memberNameRef,
    memberEmailRef,
    postTitleRef,
  }

  return <AdminContext.Provider value={store}>{children}</AdminContext.Provider>
}
