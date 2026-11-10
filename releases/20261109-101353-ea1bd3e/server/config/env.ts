import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Carrega `.env` da raiz do projecto, se existir (Node >= 21.7). Variáveis já
// definidas no ambiente têm precedência.
const here = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(here, '..', '..')
const envFile = path.join(rootDir, '.env')
if (fs.existsSync(envFile) && typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile(envFile)
  } catch {
    /* ficheiro inválido: ignora e usa o ambiente */
  }
}

export interface AppConfig {
  port: number
  production: boolean
  rootDir: string
  /** Ligação ao PostgreSQL (DATABASE_URL). Obrigatória. */
  databaseUrl: string
  /** Esquema das tabelas; os testes usam um esquema próprio. */
  databaseSchema: string
  /** Ficheiros carregados (capas). Os dados ficam no PostgreSQL. */
  dataDir: string
  videosDir: string
  uploadsDir: string
  secret: string
  secretIsEphemeral: boolean
  adminEmail: string
  adminPassword: string | null
  adminName: string
  /** OAuth Client ID da Google (GOOGLE_CLIENT_ID); vazio = entrada com Google desligada. */
  googleClientId: string
}

function resolveDir(value: string | undefined, fallback: string): string {
  return value ? path.resolve(rootDir, value) : path.join(rootDir, fallback)
}

export function loadConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  const production = process.env.NODE_ENV === 'production'
  const secret = process.env.ANA_SECRET ?? process.env.ANA_MEDIA_SECRET ?? ''
  const dataDir = overrides.dataDir ?? resolveDir(process.env.ANA_DATA_DIR, 'data')
  const config: AppConfig = {
    port: Number(process.env.PORT) || 8787,
    production,
    rootDir,
    databaseUrl: process.env.DATABASE_URL ?? '',
    databaseSchema: process.env.DATABASE_SCHEMA || 'public',
    dataDir,
    videosDir: resolveDir(process.env.ANA_VIDEOS_DIR, 'videos'),
    uploadsDir: path.join(dataDir, 'uploads'),
    secret,
    secretIsEphemeral: !secret,
    adminEmail: (process.env.ANA_ADMIN_EMAIL || 'ana@example.com').trim().toLowerCase(),
    adminPassword: process.env.ANA_ADMIN_PASSWORD || null,
    adminName: process.env.ANA_ADMIN_NAME || 'Ana Yeshua',
    googleClientId: (process.env.GOOGLE_CLIENT_ID ?? '').trim(),
    ...overrides,
  }
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL não definido. Acrescente ao .env, ex.: DATABASE_URL=postgres://utilizador:senha@localhost:5432/anayeshua')
  }
  if (!config.secret) {
    if (config.production) throw new Error('ANA_SECRET é obrigatório em produção.')
    config.secret = cryptoRandom()
    config.secretIsEphemeral = true
  }
  if (overrides.dataDir && !overrides.uploadsDir) config.uploadsDir = path.join(overrides.dataDir, 'uploads')
  return config
}

function cryptoRandom(): string {
  return Buffer.from(globalThis.crypto.getRandomValues(new Uint8Array(32))).toString('hex')
}
