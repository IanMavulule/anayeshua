import type { Queryable } from '../store/pgStore.ts'

export type ServerEventLevel = 'error' | 'warning' | 'info'

export interface ServerEvent {
  id: string
  createdAt: string
  level: ServerEventLevel
  source: string
  message: string
  detail: string | null
  resolvedAt: string | null
}

/** Quantos registos se guardam no máximo (os mais antigos são apagados). */
export const MAX_SERVER_EVENTS = 1000

const SELECT = `SELECT id::text AS id, created_at AS "createdAt", level, source, message, detail, resolved_at AS "resolvedAt"
  FROM server_events`

const toEvent = (row: Record<string, unknown>): ServerEvent => ({
  ...(row as unknown as ServerEvent),
  createdAt: new Date(row.createdAt as string).toISOString(),
  resolvedAt: row.resolvedAt ? new Date(row.resolvedAt as string).toISOString() : null,
})

/** Problemas do servidor, visíveis só no painel de administração. */
export function createServerEventRepository(exec: Queryable) {
  let writes = 0
  return {
    async add(level: ServerEventLevel, source: string, message: string, detail?: string | null): Promise<void> {
      await exec.query('INSERT INTO server_events (level, source, message, detail) VALUES ($1, $2, $3, $4)', [
        level,
        source.slice(0, 60),
        message.slice(0, 500),
        detail ? detail.slice(0, 4000) : null,
      ])
      // De vez em quando, apaga os registos mais antigos para a tabela não crescer sem limite.
      if (++writes % 50 === 0) {
        await exec.query(
          `DELETE FROM server_events WHERE id IN (SELECT id FROM server_events ORDER BY id DESC OFFSET ${MAX_SERVER_EVENTS})`,
        )
      }
    },

    /** Regista só se não houver já um aviso igual por resolver (ex.: a cada arranque). */
    async addUnlessOpen(level: ServerEventLevel, source: string, message: string, detail?: string | null): Promise<void> {
      const { rows } = await exec.query(
        'SELECT 1 FROM server_events WHERE resolved_at IS NULL AND level = $1 AND source = $2 AND message = $3 LIMIT 1',
        [level, source.slice(0, 60), message.slice(0, 500)],
      )
      if (!rows.length) await this.add(level, source, message, detail)
    },

    async list({ includeResolved = false, limit = 100 } = {}): Promise<ServerEvent[]> {
      const where = includeResolved ? '' : 'WHERE resolved_at IS NULL'
      const { rows } = await exec.query(`${SELECT} ${where} ORDER BY id DESC LIMIT $1`, [Math.min(Math.max(limit, 1), 500)])
      return rows.map(toEvent)
    },

    /** Erros por resolver (para o número na barra lateral). */
    async openErrorCount(): Promise<number> {
      const { rows } = await exec.query<{ total: string }>(
        `SELECT count(*) AS total FROM server_events WHERE resolved_at IS NULL AND level = 'error'`,
      )
      return Number(rows[0]?.total ?? 0)
    },

    async resolve(id: string): Promise<boolean> {
      if (!/^\d{1,18}$/.test(id)) return false
      const { rowCount } = await exec.query('UPDATE server_events SET resolved_at = now() WHERE id = $1 AND resolved_at IS NULL', [id])
      return (rowCount ?? 0) > 0
    },

    async resolveAll(): Promise<number> {
      const { rowCount } = await exec.query('UPDATE server_events SET resolved_at = now() WHERE resolved_at IS NULL')
      return rowCount ?? 0
    },
  }
}

export type ServerEventRepository = ReturnType<typeof createServerEventRepository>
