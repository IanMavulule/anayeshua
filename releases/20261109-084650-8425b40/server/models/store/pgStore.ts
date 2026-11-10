import pg from 'pg'

export interface Identified {
  id: string
}

/** Pool (cada consulta numa ligação livre) ou ligação já dentro de uma transacção. */
export type Queryable = pg.Pool | pg.PoolClient

/** Interface comum das colecções: os presenters não sabem como cada uma é guardada. */
export interface Collection<T extends Identified> {
  all(): Promise<T[]>
  get(id: string): Promise<T | undefined>
  find(predicate: (item: T) => boolean): Promise<T | undefined>
  filter(predicate: (item: T) => boolean): Promise<T[]>
  count(): Promise<number>
  /** Insere no início (listas "mais recentes primeiro") ou no fim. Lança `duplicate_id` se o id existir. */
  insert(item: T, position?: 'start' | 'end'): Promise<T>
  /** Lê, altera e grava na mesma transacção, com a linha bloqueada. */
  update(id: string, patch: Partial<T> | ((current: T) => T)): Promise<T | undefined>
  /** Aplica `change` a vários registos numa só transacção; devolve os alterados. */
  updateMany(ids: string[], change: (current: T) => T): Promise<T[]>
  remove(id: string): Promise<boolean>
  removeMany(ids: string[]): Promise<number>
}

/** Documento único (configurações). */
export interface DocumentStore<T extends object> {
  read(): Promise<T>
  write(patch: Partial<T>): Promise<T>
}

/** Erro de chave duplicada do PostgreSQL (violação de UNIQUE / PRIMARY KEY). */
export function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === '23505'
}

/** Corre `work` numa transacção; desfaz tudo se lançar um erro. */
export async function transaction<R>(pool: pg.Pool, work: (client: pg.PoolClient) => Promise<R>): Promise<R> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await work(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

/**
 * Corre `work` numa transacção. Se `exec` já for uma ligação dentro de uma
 * transacção, usa-a directamente (as operações juntam-se à transacção exterior).
 */
export async function withTransaction<R>(exec: Queryable, work: (client: Queryable) => Promise<R>): Promise<R> {
  return exec instanceof pg.Pool ? transaction(exec, work) : work(exec)
}
