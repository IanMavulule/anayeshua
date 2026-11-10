import type { Course, CourseModule, Lesson } from '../entities.ts'
import type { Queryable } from '../store/pgStore.ts'
import { emptyToNull, localDateTime, TableRepository } from './tableRepository.ts'

interface ModuleRow {
  course_id: string
  id: string
  title: string
}

interface LessonRow {
  course_id: string
  module_id: string
  id: string
  title: string
  free: boolean
  video_name: string | null
  video_size: number | null
  video_duration: number | null
  video_type: string | null
}

interface PointRow {
  course_id: string
  lesson_id: string | null
  text: string
}

/** `updated` é o minuto em UTC sem designador ('YYYY-MM-DDTHH:MM'); guardado como timestamptz. */
const utcMinuteToDb = (value: unknown) => {
  if (typeof value !== 'string' || !value) return null
  return /(Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : `${value}Z`
}

/** Ids repetidos no próprio curso (módulos ou aulas): as chaves não os aceitam. */
function assertUniqueIds(course: Course) {
  const seen = new Set<string>()
  for (const module of course.modules) {
    if (seen.has(`m:${module.id}`)) throw new Error(`duplicate_id:${module.id}`)
    seen.add(`m:${module.id}`)
    for (const lesson of module.lessons) {
      if (seen.has(`l:${lesson.id}`)) throw new Error(`duplicate_id:${lesson.id}`)
      seen.add(`l:${lesson.id}`)
    }
  }
}

/** Lê módulos, aulas e pontos de oração dos cursos indicados, pela ordem guardada. */
async function hydrateCourses(exec: Queryable, courses: Course[]): Promise<void> {
  const ids = courses.map((course) => course.id)
  // Em sequência: numa transacção todas as consultas usam a mesma ligação.
  const modules = await exec.query<ModuleRow>(
    `SELECT course_id, id, title FROM course_modules WHERE course_id = ANY($1::text[]) ORDER BY course_id, position, id`,
    [ids],
  )
  const lessons = await exec.query<LessonRow>(
    `SELECT course_id, module_id, id, title, free, video_name, video_size::float8 AS video_size, video_duration, video_type
       FROM lessons WHERE course_id = ANY($1::text[]) ORDER BY course_id, module_id, position, id`,
    [ids],
  )
  const points = await exec.query<PointRow>(
    `SELECT course_id, lesson_id, text FROM prayer_points WHERE course_id = ANY($1::text[]) ORDER BY course_id, lesson_id NULLS FIRST, position, id`,
    [ids],
  )

  const pointsOf = new Map<string, string[]>()
  for (const point of points.rows) {
    const key = point.lesson_id === null ? `c:${point.course_id}` : `l:${point.lesson_id}`
    const list = pointsOf.get(key) ?? []
    list.push(point.text)
    pointsOf.set(key, list)
  }
  const lessonsOf = new Map<string, Lesson[]>()
  for (const row of lessons.rows) {
    const key = `${row.course_id}\u0000${row.module_id}`
    const list = lessonsOf.get(key) ?? []
    list.push({
      id: row.id,
      title: row.title,
      video:
        row.video_name === null
          ? null
          : { name: row.video_name, size: Number(row.video_size), duration: Number(row.video_duration), type: row.video_type ?? '' },
      free: row.free,
      prayerPoints: pointsOf.get(`l:${row.id}`) ?? [],
    })
    lessonsOf.set(key, list)
  }
  const modulesOf = new Map<string, CourseModule[]>()
  for (const row of modules.rows) {
    const list = modulesOf.get(row.course_id) ?? []
    list.push({ id: row.id, title: row.title, lessons: lessonsOf.get(`${row.course_id}\u0000${row.id}`) ?? [] })
    modulesOf.set(row.course_id, list)
  }
  for (const course of courses) {
    course.modules = modulesOf.get(course.id) ?? []
    course.prayerPoints = pointsOf.get(`c:${course.id}`) ?? []
  }
}

/**
 * Grava módulos, aulas e pontos de oração do curso, comparando por id: insere
 * ou actualiza os que vêm (mantendo ids e ordem) e apaga os que deixaram de
 * vir. Um id de aula que já pertença a outro curso lança `duplicate_id`.
 */
async function saveCourseContent(exec: Queryable, course: Course): Promise<void> {
  assertUniqueIds(course)
  for (const [position, module] of course.modules.entries()) {
    await exec.query(
      `INSERT INTO course_modules (course_id, id, position, title) VALUES ($1, $2, $3, $4)
       ON CONFLICT (course_id, id) DO UPDATE SET position = EXCLUDED.position, title = EXCLUDED.title`,
      [course.id, module.id, position, module.title ?? ''],
    )
  }
  const lessonIds: string[] = []
  for (const module of course.modules) {
    for (const [position, lesson] of module.lessons.entries()) {
      const video = lesson.video
      const { rowCount } = await exec.query(
        `INSERT INTO lessons (id, course_id, module_id, position, title, free, video_name, video_size, video_duration, video_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO UPDATE SET
           module_id = EXCLUDED.module_id, position = EXCLUDED.position, title = EXCLUDED.title, free = EXCLUDED.free,
           video_name = EXCLUDED.video_name, video_size = EXCLUDED.video_size,
           video_duration = EXCLUDED.video_duration, video_type = EXCLUDED.video_type
         WHERE lessons.course_id = EXCLUDED.course_id`,
        [
          lesson.id,
          course.id,
          module.id,
          position,
          lesson.title ?? '',
          Boolean(lesson.free),
          video ? video.name ?? '' : null,
          video ? Math.round(video.size ?? 0) : null,
          video ? video.duration ?? 0 : null,
          video ? video.type ?? '' : null,
        ],
      )
      // Sem linha afectada: o id é de uma aula de outro curso.
      if (!rowCount) throw new Error(`duplicate_id:${lesson.id}`)
      lessonIds.push(lesson.id)
    }
  }
  await exec.query(`DELETE FROM lessons WHERE course_id = $1 AND NOT (id = ANY($2::text[]))`, [course.id, lessonIds])
  await exec.query(`DELETE FROM course_modules WHERE course_id = $1 AND NOT (id = ANY($2::text[]))`, [
    course.id,
    course.modules.map((module) => module.id),
  ])

  await exec.query(`DELETE FROM prayer_points WHERE course_id = $1`, [course.id])
  const points: [string | null, string[]][] = [
    [null, course.prayerPoints ?? []],
    ...course.modules.flatMap((module) => module.lessons.map((lesson): [string, string[]] => [lesson.id, lesson.prayerPoints ?? []])),
  ]
  for (const [lessonId, list] of points) {
    const texts = list.filter((text) => text !== '')
    if (!texts.length) continue
    await exec.query(
      `INSERT INTO prayer_points (course_id, lesson_id, position, text)
       SELECT $1, $2, ordinality - 1, value FROM unnest($3::text[]) WITH ORDINALITY AS p(value, ordinality)`,
      [course.id, lessonId, texts],
    )
  }
}

/** Cursos: a linha do curso em `courses`, o conteúdo em course_modules, lessons e prayer_points. */
export const createCourseRepository = (exec: Queryable) =>
  new TableRepository<Course>(exec, {
    table: 'courses',
    columns: [
      { key: 'id', column: 'id' },
      { key: 'title', column: 'title' },
      { key: 'category', column: 'category', read: `COALESCE(t.category, '')`, toDb: emptyToNull },
      { key: 'status', column: 'status' },
      { key: 'access', column: 'access', toDb: (value) => (value === 'free' ? 'free' : 'premium') },
      { key: 'publishAt', column: 'publish_at', read: localDateTime('t.publish_at'), toDb: emptyToNull },
      { key: 'level', column: 'level', read: `COALESCE(t.level, '')`, toDb: emptyToNull },
      { key: 'instructor', column: 'instructor' },
      { key: 'cover', column: 'cover' },
      { key: 'description', column: 'description' },
      { key: 'prayerPoints', column: '', read: 'NULL', optional: true },
      { key: 'modules', column: '', read: 'NULL' },
      { key: 'featured', column: 'featured' },
      {
        key: 'updated',
        column: 'updated_at',
        read: `COALESCE(to_char(t.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI'), '')`,
        toDb: utcMinuteToDb,
      },
      { key: 'views', column: 'views', toDb: (value) => Math.max(0, Math.round(Number(value) || 0)) },
      { key: 'students', column: 'students', toDb: (value) => Math.max(0, Math.round(Number(value) || 0)) },
    ],
    hydrate: hydrateCourses,
    afterWrite: (exec, course) => saveCourseContent(exec, course),
  })
