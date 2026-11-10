import type { Course } from '../models/entities.ts'
import type { Rendition } from '../models/repositories/videoRenditionRepository.ts'

export interface VideoJobView {
  lessonId: string
  lessonTitle: string | null
  courseTitle: string | null
  quality: Rendition['quality']
  status: Rendition['status']
  attempts: number
  lastError: string | null
  nextAttemptAt: string
  updatedAt: string
}

/** Junta o título da aula e do curso a cada tarefa de conversão, para o painel Servidor. */
export function toVideoJobs(renditions: Rendition[], courses: Course[]): VideoJobView[] {
  const titles = new Map<string, { lesson: string; course: string }>()
  for (const course of courses) {
    for (const module of course.modules ?? []) {
      for (const lesson of module.lessons ?? []) titles.set(lesson.id, { lesson: lesson.title, course: course.title })
    }
  }
  return renditions.map((item) => ({
    lessonId: item.lessonId,
    lessonTitle: titles.get(item.lessonId)?.lesson ?? null,
    courseTitle: titles.get(item.lessonId)?.course ?? null,
    quality: item.quality,
    status: item.status,
    attempts: item.attempts,
    lastError: item.lastError,
    nextAttemptAt: item.nextAttemptAt,
    updatedAt: item.updatedAt,
  }))
}
