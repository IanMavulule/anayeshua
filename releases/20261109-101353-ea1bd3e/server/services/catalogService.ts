import fs from 'node:fs'
import path from 'node:path'
import { isCourseVisible, isLessonFree } from '../models/courseModel.ts'
import type { Database } from '../models/store/database.ts'
import { isValidId } from '../utils/ids.ts'
import { toCatalogSeries, type CatalogSeries } from '../views/catalogView.ts'

export interface VideoEntry {
  id: string
  title: string
  premium: boolean
  courseId: string
  prayerPoints: string[]
}

/** Catálogo público e resolução de vídeos para autorização. */
export function createCatalogService(db: Database, videosDir: string) {
  const hasFile = (name: string) => {
    try {
      return fs.statSync(path.join(videosDir, name)).isFile()
    } catch {
      return false
    }
  }

  return {
    async list(now = Date.now()): Promise<CatalogSeries[]> {
      return (await db.courses.filter((course) => isCourseVisible(course, now)))
        .map((course) => toCatalogSeries(course, hasFile))
        .filter((series) => series.lessons.length > 0)
    },

    /** Só aulas de cursos visíveis são servidas, excepto para administração. */
    async findVideo(id: unknown, { includeHidden = false } = {}): Promise<VideoEntry | null> {
      if (!isValidId(id)) return null
      for (const course of await db.courses.all()) {
        if (!includeHidden && !isCourseVisible(course)) continue
        for (const module of course.modules) {
          const lesson = module.lessons.find((item) => item.id === id)
          if (lesson) {
            return { id: lesson.id, title: lesson.title, premium: !isLessonFree(course, lesson), courseId: course.id, prayerPoints: lesson.prayerPoints ?? [] }
          }
        }
      }
      return null
    },
  }
}

export type CatalogService = ReturnType<typeof createCatalogService>
