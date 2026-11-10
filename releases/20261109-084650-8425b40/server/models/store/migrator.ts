import crypto from 'node:crypto'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

/**
 * Migrações SQL versionadas em `migrations/NNN_descricao.sql`, aplicadas por
 * ordem e registadas em `schema_migrations`. Cada migração corre numa
 * transacção própria: ou fica toda aplicada ou nada muda. As tabelas são
 * criadas no esquema do `search_path` da pool (os testes usam `test_<hex>`).
 *
 * Nunca se edita uma migração já aplicada: acrescenta-se uma nova.
 */

export interface Migration {
  version: number
  name: string
  sql: string
  checksum: string
}

export interface MigrationStatus {
  applied: number[]
  pending: Migration[]
}

export const MIGRATIONS_DIR = fileURLToPath(new URL('./migrations/', import.meta.url))

const FILE_NAME = /^(\d{3})_([a-z0-9_]+)\.sql$/

/** Lê as migrações da pasta, por ordem de versão. */
export function loadMigrations(dir = MIGRATIONS_DIR): Migration[] {
  const migrations = fs
    .readdirSync(dir)
    .map((file) => ({ file, match: FILE_NAME.exec(file) }))
    .filter((entry): entry is { file: string; match: RegExpExecArray } => entry.match !== null)
    .map(({ file, match }) => {
      // Fins de linha normalizados: o checksum é igual em Windows e Linux.
      const sql = fs.readFileSync(`${dir}/${file}`, 'utf8').replace(/\r\n/g, '\n')
      return {
        version: Number(match[1]),
        name: match[2],
        sql,
        checksum: crypto.createHash('sha256').update(sql).digest('hex'),
      }
    })
    .sort((a, b) => a.version - b.version)
  for (let index = 1; index < migrations.length; index++) {
    if (migrations[index].version === migrations[index - 1].version) {
      throw new Error(`Migração repetida: versão ${migrations[index].version}`)
    }
  }
  return migrations
}

async function ensureMigrationsTable(client: pg.PoolClient, schema: string): Promise<void> {
  await client.query(`CREATE SCHEMA IF NOT EXISTS ${pg.escapeIdentifier(schema)}`)
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version integer PRIMARY KEY,
    name text NOT NULL,
    checksum text NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`)
}

async function readApplied(client: pg.PoolClient): Promise<Map<number, string>> {
  const { rows } = await client.query<{ version: number; checksum: string }>('SELECT version, checksum FROM schema_migrations ORDER BY version')
  return new Map(rows.map((row) => [row.version, row.checksum]))
}

/** O esquema tem tabelas da aplicação (fora de `schema_migrations`)? */
async function tableNames(client: pg.PoolClient, schema: string): Promise<string[]> {
  const { rows } = await client.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = $1 AND table_type = 'BASE TABLE' AND table_name <> 'schema_migrations'`,
    [schema],
  )
  return rows.map((row) => row.table_name)
}

/**
 * Há dados no esquema? Um esquema novo (ou só com tabelas vazias) pode ser
 * migrado automaticamente no arranque; um esquema com dados reais só com
 * `npm run db:migrate`, depois de uma cópia de segurança.
 */
export async function schemaHasData(pool: pg.Pool, schema: string): Promise<boolean> {
  const client = await pool.connect()
  try {
    for (const table of await tableNames(client, schema)) {
      const qualified = `${pg.escapeIdentifier(schema)}.${pg.escapeIdentifier(table)}`
      const { rows } = await client.query<{ present: boolean }>(`SELECT EXISTS (SELECT 1 FROM ${qualified}) AS present`)
      if (rows[0].present) return true
    }
    return false
  } finally {
    client.release()
  }
}

function lockKey(schema: string): string {
  return `ana_yeshua:migrations:${schema}`
}

/** Versões aplicadas e migrações por aplicar. */
export async function migrationStatus(pool: pg.Pool, schema: string, migrations = loadMigrations()): Promise<MigrationStatus> {
  const client = await pool.connect()
  try {
    const { rows } = await client.query<{ present: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = 'schema_migrations') AS present`,
      [schema],
    )
    const applied = rows[0].present ? await readApplied(client) : new Map<number, string>()
    return checkStatus(applied, migrations)
  } finally {
    client.release()
  }
}

function checkStatus(applied: Map<number, string>, migrations: Migration[], log?: (message: string) => void): MigrationStatus {
  const known = new Set(migrations.map((migration) => migration.version))
  const unknown = [...applied.keys()].filter((version) => !known.has(version))
  if (unknown.length) {
    // A base foi migrada por uma versão mais recente do código: não arriscar.
    throw new Error(`A base de dados tem migrações que este código não conhece (${unknown.join(', ')}). Actualize o código.`)
  }
  for (const migration of migrations) {
    const checksum = applied.get(migration.version)
    if (checksum && checksum !== migration.checksum) {
      log?.(`[migrações] Aviso: ${formatName(migration)} foi alterada depois de aplicada. Crie uma nova migração em vez de editar.`)
    }
  }
  return {
    applied: [...applied.keys()],
    pending: migrations.filter((migration) => !applied.has(migration.version)),
  }
}

export function formatName(migration: Migration): string {
  return `${String(migration.version).padStart(3, '0')}_${migration.name}`
}

export interface MigrateOptions {
  /** Aplica só até esta versão (inclusive). Usado nos testes da migração de dados. */
  target?: number
  log?: (message: string) => void
  migrations?: Migration[]
}

/**
 * Aplica as migrações pendentes, cada uma na sua transacção. Um advisory lock
 * por esquema impede dois processos de migrarem ao mesmo tempo.
 */
export async function migrate(pool: pg.Pool, schema: string, options: MigrateOptions = {}): Promise<Migration[]> {
  const migrations = options.migrations ?? loadMigrations()
  const target = options.target ?? Number.POSITIVE_INFINITY
  const client = await pool.connect()
  const done: Migration[] = []
  try {
    await client.query('SELECT pg_advisory_lock(hashtext($1))', [lockKey(schema)])
    try {
      await ensureMigrationsTable(client, schema)
      const { pending } = checkStatus(await readApplied(client), migrations, options.log)
      for (const migration of pending) {
        if (migration.version > target) break
        try {
          await client.query('BEGIN')
          await client.query(migration.sql)
          await client.query('INSERT INTO schema_migrations (version, name, checksum) VALUES ($1, $2, $3)', [
            migration.version,
            migration.name,
            migration.checksum,
          ])
          await client.query('COMMIT')
        } catch (error) {
          await client.query('ROLLBACK').catch(() => {})
          throw new Error(`A migração ${formatName(migration)} falhou e foi desfeita: ${(error as Error).message}`, { cause: error })
        }
        options.log?.(`[migrações] Aplicada ${formatName(migration)}`)
        done.push(migration)
      }
    } finally {
      await client.query('SELECT pg_advisory_unlock(hashtext($1))', [lockKey(schema)]).catch(() => {})
    }
  } finally {
    client.release()
  }
  return done
}
