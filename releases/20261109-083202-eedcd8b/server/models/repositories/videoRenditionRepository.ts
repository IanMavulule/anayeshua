import type { Queryable } from '../store/pgStore.ts'

export type RenditionQuality = '360p' | '480p' | '720p'
export type RenditionStatus = 'pending' | 'processing' | 'ready' | 'failed' | 'skipped'

/** Qualidades por ordem de conversão: a mais leve primeiro, para quem tem rede fraca. */
export const QUALITIES: { quality: RenditionQuality; height: number; videoKbps: number; audioKbps: number }[] = [
  { quality: '360p', height: 360, videoKbps: 600, audioKbps: 64 },
  { quality: '480p', height: 480, videoKbps: 1000, audioKbps: 96 },
  { quality: '720p', height: 720, videoKbps: 2500, audioKbps: 128 },
]

export interface Rendition {
  lessonId: string
  quality: RenditionQuality
  sourceVersion: string
  status: RenditionStatus
  attempts: number
  lastError: string | null
  nextAttemptAt: string
  width: number | null
  height: number | null
  bandwidth: number | null
  updatedAt: string
}

const SELECT = `SELECT lesson_id AS "lessonId", quality, source_version AS "sourceVersion", status, attempts,
  last_error AS "lastError", next_attempt_at AS "nextAttemptAt", width, height, bandwidth, updated_at AS "updatedAt"
  FROM video_renditions`

const QUALITY_ORDER = `CASE quality WHEN '360p' THEN 1 WHEN '480p' THEN 2 ELSE 3 END`

const toRendition = (row: Record<string, unknown>): Rendition => ({
  ...(row as unknown as Rendition),
  nextAttemptAt: new Date(row.nextAttemptAt as string).toISOString(),
  updatedAt: new Date(row.updatedAt as string).toISOString(),
})

/** Fila de conversão dos vídeos (uma linha por aula e qualidade). */
export function createVideoRenditionRepository(exec: Queryable) {
  return {
    /** Recomeça a conversão de uma aula para a versão actual do MP4. */
    async enqueue(lessonId: string, sourceVersion: string): Promise<void> {
      await exec.query(
        `INSERT INTO video_renditions (lesson_id, quality, source_version)
         SELECT $1, q, $2 FROM unnest($3::text[]) AS q
         ON CONFLICT (lesson_id, quality) DO UPDATE SET source_version = EXCLUDED.source_version,
           status = 'pending', attempts = 0, last_error = NULL, next_attempt_at = now(),
           width = NULL, height = NULL, bandwidth = NULL, updated_at = now()`,
        [lessonId, sourceVersion, QUALITIES.map((item) => item.quality)],
      )
    },

    /** Aulas que já têm linhas na fila (para não voltar a enfileirar ao arrancar). */
    async lessonIds(): Promise<Set<string>> {
      const { rows } = await exec.query<{ lesson_id: string }>('SELECT DISTINCT lesson_id FROM video_renditions')
      return new Set(rows.map((row) => row.lesson_id))
    },

    /** Tarefas interrompidas (servidor parou a meio) voltam à fila. */
    async resetInterrupted(): Promise<number> {
      const { rowCount } = await exec.query(
        `UPDATE video_renditions SET status = 'pending', next_attempt_at = now(), updated_at = now() WHERE status = 'processing'`,
      )
      return rowCount ?? 0
    },

    /** Reserva a próxima tarefa pronta a correr (a qualidade mais leve primeiro). */
    async claimNext(): Promise<Rendition | null> {
      const { rows } = await exec.query(
        `UPDATE video_renditions SET status = 'processing', attempts = attempts + 1, updated_at = now()
          WHERE (lesson_id, quality) = (
            SELECT lesson_id, quality FROM video_renditions
             WHERE status = 'pending' AND next_attempt_at <= now()
             ORDER BY ${QUALITY_ORDER}, updated_at, lesson_id
             LIMIT 1 FOR UPDATE SKIP LOCKED)
          RETURNING lesson_id AS "lessonId", quality, source_version AS "sourceVersion", status, attempts,
            last_error AS "lastError", next_attempt_at AS "nextAttemptAt", width, height, bandwidth, updated_at AS "updatedAt"`,
      )
      return rows[0] ? toRendition(rows[0]) : null
    },

    /** Só altera a linha se ainda for da mesma versão do vídeo (não foi substituído entretanto). */
    async markReady(item: Rendition, size: { width: number; height: number; bandwidth: number }): Promise<boolean> {
      const { rowCount } = await exec.query(
        `UPDATE video_renditions SET status = 'ready', last_error = NULL, width = $4, height = $5, bandwidth = $6, updated_at = now()
          WHERE lesson_id = $1 AND quality = $2 AND source_version = $3`,
        [item.lessonId, item.quality, item.sourceVersion, size.width, size.height, size.bandwidth],
      )
      return (rowCount ?? 0) > 0
    },

    async markSkipped(item: Rendition): Promise<void> {
      await exec.query(
        `UPDATE video_renditions SET status = 'skipped', last_error = NULL, updated_at = now()
          WHERE lesson_id = $1 AND quality = $2 AND source_version = $3`,
        [item.lessonId, item.quality, item.sourceVersion],
      )
    },

    /** Volta a tentar mais tarde, ou fica `failed` quando `retryAt` é null. */
    async markFailed(item: Rendition, error: string, retryAt: Date | null): Promise<void> {
      await exec.query(
        `UPDATE video_renditions SET status = $4, last_error = $5, next_attempt_at = COALESCE($6, next_attempt_at), updated_at = now()
          WHERE lesson_id = $1 AND quality = $2 AND source_version = $3`,
        [item.lessonId, item.quality, item.sourceVersion, retryAt ? 'pending' : 'failed', error.slice(0, 2000), retryAt],
      )
    },

    /** "Tentar de novo" da administração: as qualidades falhadas voltam à fila. */
    async retryFailed(lessonId: string): Promise<number> {
      const { rowCount } = await exec.query(
        `UPDATE video_renditions SET status = 'pending', attempts = 0, next_attempt_at = now(), updated_at = now()
          WHERE lesson_id = $1 AND status = 'failed'`,
        [lessonId],
      )
      return rowCount ?? 0
    },

    async forLesson(lessonId: string): Promise<Rendition[]> {
      const { rows } = await exec.query(`${SELECT} WHERE lesson_id = $1 ORDER BY ${QUALITY_ORDER}`, [lessonId])
      return rows.map(toRendition)
    },

    /** Tudo o que não está concluído (em fila, a converter ou falhado). */
    async unfinished(): Promise<Rendition[]> {
      const { rows } = await exec.query(
        `${SELECT} WHERE status IN ('pending', 'processing', 'failed') ORDER BY updated_at DESC, lesson_id, ${QUALITY_ORDER} LIMIT 200`,
      )
      return rows.map(toRendition)
    },

    async counts(): Promise<Record<RenditionStatus, number>> {
      const { rows } = await exec.query<{ status: RenditionStatus; total: string }>(
        'SELECT status, count(*) AS total FROM video_renditions GROUP BY status',
      )
      const counts: Record<RenditionStatus, number> = { pending: 0, processing: 0, ready: 0, failed: 0, skipped: 0 }
      for (const row of rows) counts[row.status] = Number(row.total)
      return counts
    },
  }
}

export type VideoRenditionRepository = ReturnType<typeof createVideoRenditionRepository>
