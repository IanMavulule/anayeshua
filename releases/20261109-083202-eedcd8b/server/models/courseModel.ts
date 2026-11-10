import type { Course, Lesson } from './entities.ts'

/** Regras de domínio dos cursos. */

/** Um curso é público quando está publicado ou quando a data agendada já passou. */
export function isCourseVisible(course: Course, now = Date.now()): boolean {
  if (course.status === 'published') return true
  if (course.status === 'scheduled' && course.publishAt) {
    const at = Date.parse(course.publishAt)
    return Number.isFinite(at) && at <= now
  }
  return false
}

export function courseLessons(course: Course): Lesson[] {
  return course.modules.flatMap((module) => module.lessons)
}

/**
 * Uma aula é livre quando o curso inteiro é gratuito ou quando, num curso pago,
 * está marcada como amostra gratuita.
 */
export function isLessonFree(course: Course, lesson: Lesson): boolean {
  return course.access === 'free' || lesson.free
}

export function findLesson(course: Course, lessonId: string): Lesson | undefined {
  return courseLessons(course).find((lesson) => lesson.id === lessonId)
}
