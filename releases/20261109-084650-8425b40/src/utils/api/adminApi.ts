import type {
  AdminData,
  AdminSettings,
  Course,
  EventItem,
  Member,
  Post,
  Question,
  Testimony,
  TestimonyStatus,
} from '../../components/admin/adminData'
import { EMPTY_DATA } from '../../components/admin/adminData'
import type { ServerEvent, SystemOverview, TranscoderCheck } from '../../components/admin/systemTypes'
import { api, uploadWithProgress } from './apiClient'

/** Completa as definições com os valores por omissão (ex.: categorias de um servidor antigo). */
const withDefaults = (settings: Partial<AdminSettings> | undefined): AdminSettings => ({ ...EMPTY_DATA.settings, ...settings })

/** Corpo aceite pela API para criar/editar um curso (sem campos calculados). */
export function courseBody(course: Course) {
  return {
    title: course.title,
    category: course.category,
    status: course.status,
    access: course.access ?? 'premium',
    publishAt: course.publishAt ?? '',
    level: course.level,
    instructor: course.instructor,
    cover: course.cover,
    description: course.description,
    prayerPoints: course.prayerPoints ?? [],
    featured: course.featured,
    modules: course.modules,
  }
}

type EventBody = Omit<EventItem, 'id'>
type MemberBody = Pick<Member, 'name' | 'email' | 'plan' | 'status'>
type PostBody = Omit<Post, 'id' | 'createdAt'>

/** Chamadas à API de administração (/api/admin). */
export const adminApi = {
  state: () =>
    api.get<{ state: AdminData }>('/api/admin/state').then((result) => ({ ...result.state, settings: withDefaults(result.state.settings) })),

  createCourse: (course: Course) => api.post<{ course: Course }>('/api/admin/courses', courseBody(course)).then((r) => r.course),
  updateCourse: (course: Course) =>
    api.put<{ course: Course }>(`/api/admin/courses/${course.id}`, courseBody(course)).then((r) => r.course),
  deleteCourse: (id: string) => api.del(`/api/admin/courses/${id}`),
  bulkCourses: (ids: string[], status?: 'published' | 'hidden') =>
    api.post<{ courses: Course[] }>('/api/admin/courses/bulk', { ids, status }).then((r) => r.courses),

  createEvent: (event: EventBody) => api.post<{ event: EventItem }>('/api/admin/events', event).then((r) => r.event),
  updateEvent: (id: string, event: EventBody) => api.put<{ event: EventItem }>(`/api/admin/events/${id}`, event).then((r) => r.event),
  deleteEvent: (id: string) => api.del(`/api/admin/events/${id}`),

  moderateTestimony: (id: string, status: TestimonyStatus) =>
    api.patch<{ testimony: Testimony }>(`/api/admin/testimonies/${id}`, { status }).then((r) => r.testimony),
  deleteTestimony: (id: string) => api.del(`/api/admin/testimonies/${id}`),

  createMember: (member: MemberBody) =>
    api.post<{ member: Member; temporaryPassword: string }>('/api/admin/members', member),
  updateMember: (id: string, member: MemberBody) =>
    api.put<{ member: Member }>(`/api/admin/members/${id}`, member).then((r) => r.member),
  deleteMember: (id: string) => api.del(`/api/admin/members/${id}`),

  createPost: (post: PostBody) => api.post<{ post: Post }>('/api/admin/posts', post).then((r) => r.post),
  updatePost: (id: string, post: PostBody) => api.put<{ post: Post }>(`/api/admin/posts/${id}`, post).then((r) => r.post),
  deletePost: (id: string) => api.del(`/api/admin/posts/${id}`),

  answerQuestion: (id: string, answer: string) =>
    api.put<{ question: Question }>(`/api/admin/questions/${id}/answer`, { answer }).then((r) => r.question),
  deleteQuestion: (id: string) => api.del(`/api/admin/questions/${id}`),
  deleteFeedback: (id: string) => api.del(`/api/admin/feedback/${id}`),

  saveSettings: (settings: Partial<AdminSettings>) =>
    api.put<{ settings: AdminSettings }>('/api/admin/settings', settings).then((r) => withDefaults(r.settings)),

  uploadCover: (image: Blob) => api.upload<{ url: string }>('POST', '/api/admin/uploads/cover', image).then((r) => r.url),
  uploadVideo: (lessonId: string, file: File, onProgress: (percent: number) => void) =>
    uploadWithProgress<{ lessonId: string; size: number }>(`/api/admin/uploads/video/${lessonId}`, file, onProgress),

  mediaToken: (videoId: string) => api.post<{ token: string }>('/api/media-token', { videoId }).then((r) => r.token),

  system: (refresh = false) => api.get<SystemOverview>(`/api/admin/system${refresh ? '?refresh=1' : ''}`),
  systemEvents: (all = false) => api.get<{ events: ServerEvent[] }>(`/api/admin/system/events${all ? '?all=1' : ''}`).then((r) => r.events),
  resolveEvent: (id: string) => api.post(`/api/admin/system/events/${id}/resolve`),
  resolveAllEvents: () => api.post<{ resolved: number }>('/api/admin/system/events/resolve-all').then((r) => r.resolved),
  retryVideo: (lessonId: string) => api.post<{ retried: number }>(`/api/admin/system/videos/${lessonId}/retry`).then((r) => r.retried),
  recheckTranscoder: () => api.post<{ transcoder: TranscoderCheck }>('/api/admin/system/videos/recheck').then((r) => r.transcoder),
}
