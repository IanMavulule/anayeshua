import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { AddressInfo } from 'node:net'
import pg from 'pg'
import { createApp, type CreateAppOptions } from '../../server/app.ts'
import type { Course } from '../../server/models/entities.ts'
import { connectionConfig } from '../../server/models/store/connection.ts'
import { openPool, type Database } from '../../server/models/store/database.ts'
import { createDisabledTranscoder } from './fakeTranscoder.ts'

export const ADMIN = { email: 'admin@test.local', password: 'admin-pass-123' }

/** Curso de teste: primeira aula gratuita, as outras Premium. */
export const TEST_COURSE_ID = 'PL9gyyXlYTfL1Sa_aax1clbXYWR9SOlbq6'
export const FREE_LESSON = 'YSTQF4OBib8'
export const PREMIUM_LESSON = 'ncts5aoifN0'

const testCourse = (): Course => ({
  id: TEST_COURSE_ID,
  title: '3 dias de oração e jejum',
  category: 'oracao',
  status: 'published',
  level: 'iniciante',
  instructor: 'Ana Yeshua',
  cover: '/brand/img/video-oracao.webp',
  description: 'Curso de teste.',
  featured: false,
  updated: new Date().toISOString().slice(0, 16),
  views: 0,
  students: 0,
  modules: [
    {
      id: `${TEST_COURSE_ID}-m1`,
      title: 'Aulas',
      lessons: [
        { id: FREE_LESSON, title: 'Dia 1', video: null, free: true },
        { id: PREMIUM_LESSON, title: 'Dia 3 — vigília', video: null, free: false },
        { id: '4vE9AWoXxBQ', title: 'Segundo dia', video: null, free: false },
        { id: 'G5u2zvd9fCk', title: 'Primeiro dia', video: null, free: false },
      ],
    },
  ],
})

/**
 * Ligação para os testes: TEST_DATABASE_URL, ou DATABASE_URL do .env. Cada
 * execução usa um esquema próprio (test_…), apagado no fim, por isso os dados
 * reais nunca são tocados.
 */
function testDatabaseUrl(): string {
  if (!process.env.DATABASE_URL && typeof process.loadEnvFile === 'function') {
    const envFile = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '../../.env')
    try {
      process.loadEnvFile(decodeURIComponent(envFile))
    } catch {
      /* sem .env: usa o ambiente */
    }
  }
  const url = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL
  if (!url) throw new Error('Os testes precisam de PostgreSQL: defina TEST_DATABASE_URL ou DATABASE_URL.')
  return url
}

/**
 * Esquema temporário vazio (test_…) com uma pool ligada a ele, para testar as
 * migrações directamente. `drop` fecha a pool e apaga o esquema.
 */
export async function createTestSchema() {
  const databaseUrl = testDatabaseUrl()
  const schema = `test_${crypto.randomBytes(6).toString('hex')}`
  const pool = await openPool(databaseUrl, schema)
  return {
    databaseUrl,
    schema,
    pool,
    drop: async () => {
      await pool.end()
      const client = new pg.Client(connectionConfig(databaseUrl))
      await client.connect()
      await client.query(`DROP SCHEMA IF EXISTS ${pg.escapeIdentifier(schema)} CASCADE`)
      await client.end()
    },
  }
}

/** Arranca a aplicação numa porta livre, num esquema PostgreSQL temporário e com pastas temporárias. */
export async function startTestServer(options: CreateAppOptions & { seed?: boolean } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ana-test-'))
  const dataDir = path.join(root, 'data')
  const videosDir = path.join(root, 'videos')
  fs.mkdirSync(videosDir, { recursive: true })
  const databaseUrl = testDatabaseUrl()
  const schema = `test_${crypto.randomBytes(6).toString('hex')}`

  const { app, context } = await createApp({
    log: () => {},
    transcoder: createDisabledTranscoder(),
    ...options,
    config: {
      databaseUrl,
      databaseSchema: schema,
      dataDir,
      videosDir,
      uploadsDir: path.join(dataDir, 'uploads'),
      secret: 'test-secret',
      adminEmail: ADMIN.email,
      adminPassword: ADMIN.password,
      ...options.config,
    },
  })
  if (options.seed !== false) await context.db.courses.insert(testCourse())

  const server = await new Promise<import('node:http').Server>((resolve) => {
    const instance = app.listen(0, () => resolve(instance))
  })
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  return {
    base,
    context,
    db: context.db as Database,
    root,
    videosDir,
    close: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()))
      context.monitor.stop()
      await context.videos.stop()
      await context.db.close()
      // Apaga o esquema temporário com uma ligação própria.
      const client = new pg.Client(connectionConfig(databaseUrl))
      await client.connect()
      await client.query(`DROP SCHEMA IF EXISTS ${pg.escapeIdentifier(schema)} CASCADE`)
      await client.end()
      fs.rmSync(root, { recursive: true, force: true })
    },
  }
}

/** Cliente HTTP mínimo que guarda o cookie de sessão, como um browser. */
export function createClient(base: string) {
  let cookie = ''
  async function call(method: string, url: string, body?: unknown, headers: Record<string, string> = {}) {
    const response = await fetch(base + url, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        'X-Ana-Client': 'web',
        ...(cookie ? { Cookie: cookie } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const setCookie = response.headers.get('set-cookie')
    if (setCookie) cookie = setCookie.split(';')[0]
    const text = await response.text()
    let json: any = null
    try {
      json = text ? JSON.parse(text) : null
    } catch {
      json = text
    }
    return { status: response.status, json, headers: response.headers }
  }
  return {
    get: (url: string, headers?: Record<string, string>) => call('GET', url, undefined, headers),
    post: (url: string, body?: unknown, headers?: Record<string, string>) => call('POST', url, body ?? {}, headers),
    put: (url: string, body?: unknown) => call('PUT', url, body ?? {}),
    patch: (url: string, body?: unknown) => call('PATCH', url, body ?? {}),
    del: (url: string) => call('DELETE', url),
    raw: call,
    login: (email: string, password: string) => call('POST', '/api/auth/login', { email, password }),
    /** Cookie de sessão actual, para pedidos com corpo binário. */
    cookie: () => cookie,
  }
}
