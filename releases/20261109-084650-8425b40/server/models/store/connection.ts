import fs from 'node:fs'
import type pg from 'pg'

/**
 * Opções de ligação ao PostgreSQL a partir de DATABASE_URL, com suporte para o
 * Supabase (ou outro PostgreSQL alojado que exija TLS).
 *
 * DATABASE_SSL controla o TLS:
 * - `verify-full`: cifra e valida o certificado com a CA de DATABASE_SSL_CA
 *   (no Supabase: Project Settings → Database → SSL Configuration → Download certificate);
 * - `require`: cifra sem validar o certificado;
 * - `disable`: sem TLS;
 * - por omissão: no Supabase, `verify-full` se houver DATABASE_SSL_CA, senão
 *   `require`; noutros servidores vale o `sslmode` do próprio URL.
 */
export type SslMode = 'disable' | 'require' | 'verify-full'

const SSL_URL_PARAMS = ['sslmode', 'ssl', 'sslcert', 'sslkey', 'sslrootcert', 'uselibpqcompat']

function parseUrl(connectionString: string): URL | null {
  try {
    return new URL(connectionString)
  } catch {
    return null
  }
}

/** Anfitrião do Supabase: ligação directa (db.<ref>.supabase.co) ou pooler (*.pooler.supabase.com). */
export function isSupabaseUrl(connectionString: string): boolean {
  const host = parseUrl(connectionString)?.hostname ?? ''
  return /(^|\.)supabase\.(co|com)$/i.test(host)
}

function resolveSslMode(connectionString: string): SslMode | null {
  const value = (process.env.DATABASE_SSL ?? '').trim().toLowerCase()
  if (value) {
    if (value === 'disable' || value === 'require' || value === 'verify-full') return value
    throw new Error(`DATABASE_SSL inválido: ${value} (use disable, require ou verify-full).`)
  }
  if (isSupabaseUrl(connectionString)) return process.env.DATABASE_SSL_CA ? 'verify-full' : 'require'
  return null
}

function readCa(): string {
  const file = process.env.DATABASE_SSL_CA
  if (!file) throw new Error('DATABASE_SSL=verify-full precisa de DATABASE_SSL_CA (caminho do certificado da CA).')
  return fs.readFileSync(file, 'utf8')
}

/**
 * Configuração para `new pg.Client` / `new pg.Pool`. Quando o TLS é definido aqui,
 * os parâmetros ssl* do URL são retirados (o pg dar-lhes-ia precedência).
 */
export function connectionConfig(connectionString: string): pg.ClientConfig {
  const mode = resolveSslMode(connectionString)
  if (!mode) return { connectionString }
  const url = parseUrl(connectionString)
  let cleaned = connectionString
  if (url) {
    for (const name of SSL_URL_PARAMS) url.searchParams.delete(name)
    cleaned = url.toString()
  }
  if (mode === 'disable') return { connectionString: cleaned, ssl: false }
  if (mode === 'require') return { connectionString: cleaned, ssl: { rejectUnauthorized: false } }
  return { connectionString: cleaned, ssl: { ca: readCa(), rejectUnauthorized: true } }
}

/**
 * Recusa configurações do Supabase que não funcionam ou expõem dados:
 * - o pooler em modo transacção (porta 6543) não mantém o search_path entre
 *   consultas: use o modo sessão (porta 5432) ou a ligação directa;
 * - o esquema `public` é servido pela Data API do Supabase (anon/authenticated),
 *   o que exporia tabelas como `users`: use um esquema próprio (DATABASE_SCHEMA).
 */
export function assertSupportedConnection(connectionString: string, schema: string): void {
  if (!isSupabaseUrl(connectionString)) return
  const url = parseUrl(connectionString)
  if (url && /\.pooler\.supabase\.com$/i.test(url.hostname) && url.port === '6543') {
    throw new Error(
      'O pooler do Supabase em modo transacção (porta 6543) não é suportado. ' +
        'Use o "Session pooler" (porta 5432) ou a ligação directa em DATABASE_URL.',
    )
  }
  if (schema === 'public') {
    throw new Error(
      'No Supabase o esquema public é exposto pela Data API. ' +
        'Defina um esquema próprio no .env, ex.: DATABASE_SCHEMA=ana',
    )
  }
}
