import type { Course } from '../models/entities.ts'
import { courseLessons, isLessonFree } from '../models/courseModel.ts'

export interface CatalogLesson {
  id: string
  title: string
  premium: boolean
  captions: boolean
  available: boolean
  /** Há versões em várias qualidades (HLS) prontas; senão o leitor usa o MP4. */
  hls: boolean
  duration: number
  /** Há pontos de oração para esta aula; o texto pede-se em /api/lessons/:id/prayer-points. */
  hasPrayerPoints: boolean
}

export interface CatalogSeries {
  id: string
  title: string
  category: string
  description: string
  poster: string
  featured: boolean
  access: 'free' | 'premium'
  video: string | null
  /** Pontos de oração para todo o devocional. */
  prayerPoints: string[]
  lessons: CatalogLesson[]
}

/** Curso tal como aparece no catálogo público. */
export function toCatalogSeries(course: Course, hasFile: (name: string) => boolean): CatalogSeries {
  const lessons = courseLessons(course)
  return {
    id: course.id,
    title: course.title,
    category: course.category,
    description: course.description,
    poster: course.cover,
    featured: course.featured,
    access: course.access ?? 'premium',
    video: lessons[0]?.id ?? null,
    prayerPoints: course.prayerPoints ?? [],
    lessons: lessons.map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      premium: !isLessonFree(course, lesson),
      captions: hasFile(`${lesson.id}.vtt`),
      available: hasFile(`${lesson.id}.mp4`),
      hls: hasFile(`hls/${lesson.id}/master.m3u8`),
      duration: lesson.video?.duration ?? 0,
      hasPrayerPoints: (lesson.prayerPoints ?? []).length > 0,
    })),
  }
}
