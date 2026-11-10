import { isUniqueViolation, withTransaction, type Collection, type Identified, type Queryable } from '../store/pgStore.ts'

/**
 * Uma propriedade do registo guardada numa coluna da tabela principal
 * (com o alias `t` nas consultas).
 */
export interface Column<T> {
  key: keyof T & string
  column: string
  /** Expressão SQL de leitura (por omissão `t.<column>`). */
  read?: string
  /** Converte o valor do registo no parâmetro SQL (por omissão, igual; undefined → null). */
  toDb?: (value: unknown) => unknown
  /** Converte o valor lido no valor do registo. */
  fromDb?: (value: unknown) => unknown
  /** Propriedade opcional: um NULL lido não aparece no registo. */
  optional?: boolean
}

/** Instante do sistema (timestamptz) ↔ texto ISO em UTC com milissegundos, como `toISOString()`. */
export const isoInstant = (column: string) =>
  `to_char(${column} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`

/** Data e hora local, sem fuso (timestamp) ↔ 'YYYY-MM-DDTHH:MM' do campo datetime-local; NULL ↔ ''. */
export const localDateTime = (column: string) => `COALESCE(to_char(${column}, 'YYYY-MM-DD"T"HH24:MI'), '')`

/** Data de calendário (date) ↔ 'YYYY-MM-DD'. */
export const calendarDate = (column: string) => `to_char(${column}, 'YYYY-MM-DD')`

export const emptyToNull = (value: unknown) => (value === '' || value === undefined ? null : value)

export interface TableRepositoryOptions<T> {
  table: string
  columns: Column<T>[]
  /** Junções extra (depois de `FROM <table> t`), para colunas de tabelas filhas 1:1. */
  joins?: string
  /** Completa os registos lidos (ex.: listas guardadas noutras tabelas). */
  hydrate?: (exec: Queryable, items: T[]) => Promise<void>
  /** Grava o que não está na tabela principal, na mesma transacção. */
  afterWrite?: (exec: Queryable, item: T, previous: T | undefined) => Promise<void>
}

/**
 * Colecção numa tabela relacional com colunas próprias e `position` para a
 * ordem das listas (inserir no início ou no fim), com a mesma interface que a
 * colecção JSONB anterior. As escritas correm numa transacção, com a linha
 * bloqueada, e devolvem o registo relido da base.
 */
export class TableRepository<T extends Identified> implements Collection<T> {
  protected readonly exec: Queryable
  private readonly options: TableRepositoryOptions<T>
  private readonly selectSql: string
  private readonly writable: Column<T>[]

  constructor(exec: Queryable, options: TableRepositoryOptions<T>) {
    this.exec = exec
    this.options = options
    const columns = options.columns.map((column) => `${column.read ?? `t.${column.column}`} AS "${column.key}"`)
    this.selectSql = `SELECT ${columns.join(', ')} FROM ${options.table} t ${options.joins ?? ''}`
    this.writable = options.columns.filter((column) => column.key !== 'id' && column.column)
  }

  private hydrateRow(row: Record<string, unknown>): T {
    const item: Record<string, unknown> = {}
    for (const column of this.options.columns) {
      const raw = row[column.key]
      if (raw === null && column.optional) continue
      item[column.key] = column.fromDb ? column.fromDb(raw) : raw
    }
    return item as unknown as T
  }

  private async select(exec: Queryable, where = '', params: unknown[] = [], suffix = ''): Promise<T[]> {
    const { rows } = await exec.query(`${this.selectSql} ${where} ${suffix}`, params)
    const items = rows.map((row) => this.hydrateRow(row))
    if (items.length && this.options.hydrate) await this.options.hydrate(exec, items)
    return items
  }

  private values(item: T): unknown[] {
    return this.writable.map((column) => {
      const value = (item as Record<string, unknown>)[column.key]
      return column.toDb ? column.toDb(value) : value === undefined ? null : value
    })
  }

  private async save(exec: Queryable, item: T, previous: T | undefined): Promise<void> {
    if (this.options.afterWrite) await this.options.afterWrite(exec, item, previous)
  }

  all(): Promise<T[]> {
    return this.select(this.exec, '', [], 'ORDER BY t.position, t.id')
  }

  async get(id: string): Promise<T | undefined> {
    return (await this.select(this.exec, 'WHERE t.id = $1', [id]))[0]
  }

  async find(predicate: (item: T) => boolean): Promise<T | undefined> {
    return (await this.all()).find(predicate)
  }

  async filter(predicate: (item: T) => boolean): Promise<T[]> {
    return (await this.all()).filter(predicate)
  }

  async count(): Promise<number> {
    const { rows } = await this.exec.query<{ n: string }>(`SELECT count(*) AS n FROM ${this.options.table}`)
    return Number(rows[0].n)
  }

  async insert(item: T, position: 'start' | 'end' = 'end'): Promise<T> {
    const edge = position === 'start' ? 'COALESCE(MIN(position), 0) - 1' : 'COALESCE(MAX(position), 0) + 1'
    const names = this.writable.map((column) => column.column)
    const placeholders = names.map((_, index) => `$${index + 2}`)
    try {
      return await withTransaction(this.exec, async (client) => {
        await client.query(
          `INSERT INTO ${this.options.table} (id, position${names.map((name) => `, ${name}`).join('')})
           SELECT $1, ${edge}${placeholders.map((placeholder) => `, ${placeholder}`).join('')} FROM ${this.options.table}`,
          [item.id, ...this.values(item)],
        )
        await this.save(client, item, undefined)
        return (await this.select(client, 'WHERE t.id = $1', [item.id]))[0]
      })
    } catch (error) {
      if (isUniqueViolation(error)) throw new Error(`duplicate_id:${item.id}`)
      throw error
    }
  }

  private async write(client: Queryable, current: T, next: T): Promise<void> {
    if (this.writable.length) {
      const sets = this.writable.map((column, index) => `${column.column} = $${index + 2}`)
      await client.query(`UPDATE ${this.options.table} SET ${sets.join(', ')} WHERE id = $1`, [current.id, ...this.values(next)])
    }
    await this.save(client, next, current)
  }

  async update(id: string, patch: Partial<T> | ((current: T) => T)): Promise<T | undefined> {
    return withTransaction(this.exec, async (client) => {
      const current = (await this.select(client, 'WHERE t.id = $1', [id], 'FOR UPDATE OF t'))[0]
      if (!current) return undefined
      const next = { ...(typeof patch === 'function' ? patch(current) : { ...current, ...patch }), id: current.id }
      await this.write(client, current, next)
      return (await this.select(client, 'WHERE t.id = $1', [id]))[0]
    })
  }

  async updateMany(ids: string[], change: (current: T) => T): Promise<T[]> {
    if (!ids.length) return []
    return withTransaction(this.exec, async (client) => {
      const rows = await this.select(client, 'WHERE t.id = ANY($1::text[])', [ids], 'ORDER BY t.position, t.id FOR UPDATE OF t')
      for (const current of rows) await this.write(client, current, { ...change(current), id: current.id })
      return this.select(client, 'WHERE t.id = ANY($1::text[])', [rows.map((row) => row.id)], 'ORDER BY t.position, t.id')
    })
  }

  async remove(id: string): Promise<boolean> {
    const { rowCount } = await this.exec.query(`DELETE FROM ${this.options.table} WHERE id = $1`, [id])
    return (rowCount ?? 0) > 0
  }

  async removeMany(ids: string[]): Promise<number> {
    if (!ids.length) return 0
    const { rowCount } = await this.exec.query(`DELETE FROM ${this.options.table} WHERE id = ANY($1::text[])`, [ids])
    return rowCount ?? 0
  }
}
