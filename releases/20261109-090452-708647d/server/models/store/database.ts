import pg from 'pg'
import { assertSupportedConnection, connectionConfig } from './connection.ts'
import { formatName, migrate, migrationStatus, schemaHasData } from './migrator.ts'
import { transaction, type Collection, type DocumentStore, type Queryable } from './pgStore.ts'
import { SettingsRepository } from '../repositories/settingsRepository.ts'
import { createEventRepository, createPostRepository } from '../repositories/contentRepositories.ts'
import { createUserRepository } from '../repositories/userRepository.ts'
import { createCourseRepository } from '../repositories/courseRepository.ts'
import { createPaymentRepository } from '../repositories/paymentRepository.ts'
import { createServerEventRepository, type ServerEventRepository } from '../repositories/serverEventRepository.ts'
import { createVideoRenditionRepository, type VideoRenditionRepository } from '../repositories/videoRenditionRepository.ts'
import { createFeedbackRepository, createQuestionRepository, createTestimonyRepository } from '../repositories/communityRepositories.ts'
import type {
  AssistanceFeedback,
  Course,
  EventItem,
  Payment,
  Post,
  Question,
  Settings,
  Testimony,
  User,
} from '../entities.ts'

export const DEFAULT_SETTINGS: Settings = {
  name: 'Ana Yeshua - Holy Ghost Ministering',
  email: '',
  description: 'Ministério Profético · Espírito Santo · Mulheres e Propósito.',
  moderation: true,
  comments: true,
  signups: true,
  maintenance: false,
  categories: {
    enabled: true,
    options: [
      { id: 'espirito-santo', label: 'Ministério do Espírito Santo', labelEn: 'Ministry of the Holy Spirit' },
      { id: 'profetico', label: 'Ministério Profético', labelEn: 'Prophetic ministry' },
      { id: 'mulheres', label: 'Mulheres e Propósito', labelEn: 'Women and purpose' },
      { id: 'palavra', label: 'Palavra de Deus', labelEn: 'Word of God' },
      { id: 'oracao', label: 'Oração, Intercessão e Adoração', labelEn: 'Prayer, intercession and worship' },
      { id: 'ministerial', label: 'Actividade Ministerial', labelEn: 'Ministerial activity' },
    ],
  },
  levels: {
    enabled: true,
    options: [
      { id: 'iniciante', label: 'Iniciante', labelEn: 'Beginner' },
      { id: 'intermedio', label: 'Intermédio', labelEn: 'Intermediate' },
      { id: 'avancado', label: 'Avançado', labelEn: 'Advanced' },
    ],
  },
}

export interface Database {
  users: Collection<User>
  courses: Collection<Course>
  events: Collection<EventItem>
  testimonies: Collection<Testimony>
  posts: Collection<Post>
  questions: Collection<Question>
  feedback: Collection<AssistanceFeedback>
  payments: Collection<Payment>
  settings: DocumentStore<Settings>
  /** Fila de conversão dos vídeos em várias qualidades. */
  renditions: VideoRenditionRepository
  /** Problemas do servidor mostrados à administração. */
  serverEvents: ServerEventRepository
  /**
   * Corre `work` numa transacção: tudo o que for feito através de `tx` é
   * confirmado junto ou desfeito junto. Dentro de uma transacção, corre na mesma.
   */
  transaction: <R>(work: (tx: Database) => Promise<R>) => Promise<R>
  /** Tamanho da base de dados em bytes (para o painel Servidor). */
  databaseSize: () => Promise<number>
  /** Fecha as ligações (no fim dos testes ou ao parar o servidor). */
  close: () => Promise<void>
}

/** Repositórios sobre uma pool ou sobre a ligação de uma transacção. */
function createDatabase(exec: Queryable, close: () => Promise<void>): Database {
  const db: Database = {
    users: createUserRepository(exec),
    courses: createCourseRepository(exec),
    events: createEventRepository(exec),
    testimonies: createTestimonyRepository(exec),
    posts: createPostRepository(exec),
    questions: createQuestionRepository(exec),
    feedback: createFeedbackRepository(exec),
    payments: createPaymentRepository(exec),
    settings: new SettingsRepository(exec, DEFAULT_SETTINGS),
    renditions: createVideoRenditionRepository(exec),
    serverEvents: createServerEventRepository(exec),
    transaction: (work) =>
      exec instanceof pg.Pool ? transaction(exec, (client) => work(createDatabase(client, async () => {}))) : work(db),
    databaseSize: async () => {
      const { rows } = await exec.query<{ size: string }>('SELECT pg_database_size(current_database()) AS size')
      return Number(rows[0].size)
    },
    close,
  }
  return db
}

/**
 * Se a base indicada em DATABASE_URL ainda não existir, cria-a ligando à base
 * de manutenção `postgres` com as mesmas credenciais (precisa de CREATEDB).
 */
async function ensureDatabaseExists(connectionString: string): Promise<void> {
  const probe = new pg.Client(connectionConfig(connectionString))
  try {
    await probe.connect()
    await probe.end()
    return
  } catch (error) {
    await probe.end().catch(() => {})
    if ((error as { code?: string }).code !== '3D000') throw error
  }
  const url = new URL(connectionString)
  const name = decodeURIComponent(url.pathname.replace(/^\//, ''))
  url.pathname = '/postgres'
  const admin = new pg.Client(connectionConfig(url.toString()))
  await admin.connect()
  try {
    await admin.query(`CREATE DATABASE ${pg.escapeIdentifier(name)}`)
  } catch (error) {
    // Outro processo (ex.: ficheiros de teste em paralelo) criou-a entretanto.
    if ((error as { code?: string }).code !== '42P04') throw error
  } finally {
    await admin.end()
  }
}

/** Esquema válido para o search_path: letras, números e _. */
const SCHEMA_NAME = /^[a-z_][a-z0-9_]{0,62}$/

/**
 * Como tratar migrações pendentes ao abrir a base:
 * - `auto`: aplica-as;
 * - `check` (por omissão): aplica-as só num esquema sem dados (instalação nova,
 *   testes); com dados, recusa arrancar e pede `npm run db:migrate`, para haver
 *   antes uma cópia de segurança.
 * `DATABASE_MIGRATE=auto` no ambiente equivale a `auto`.
 */
export type MigrateMode = 'auto' | 'check'

export interface OpenDatabaseOptions {
  migrate?: MigrateMode
  log?: (message: string) => void
}

function createPool(connectionString: string, schema: string): pg.Pool {
  if (!SCHEMA_NAME.test(schema)) throw new Error(`Nome de esquema inválido: ${schema}`)
  assertSupportedConnection(connectionString, schema)
  const pool = new pg.Pool({ ...connectionConfig(connectionString), max: 10 })
  // Todas as consultas usam as tabelas do esquema escolhido. Definido com SET em
  // cada ligação nova (e não com o parâmetro `options` do arranque), porque o
  // pooler do Supabase não reencaminha esse parâmetro. O pg executa este SET
  // antes de qualquer consulta posta na fila do mesmo cliente.
  const setSearchPath = `SET search_path TO ${pg.escapeIdentifier(schema)}`
  pool.on('connect', (client) => {
    client.query(setSearchPath).catch((error: unknown) => {
      console.error(`[base de dados] não foi possível definir o search_path: ${(error as Error).message}`)
    })
  })
  pool.on('error', (error) => {
    // Ligações inactivas que o servidor fecha (comum em bases alojadas) não devem derrubar o processo.
    console.error(`[base de dados] ligação inactiva perdida: ${error.message}`)
  })
  return pool
}

/** Abre uma pool para o esquema, criando a base se faltar. Para os scripts de migração. */
export async function openPool(connectionString: string, schema = 'public'): Promise<pg.Pool> {
  if (!SCHEMA_NAME.test(schema)) throw new Error(`Nome de esquema inválido: ${schema}`)
  assertSupportedConnection(connectionString, schema)
  await ensureDatabaseExists(connectionString)
  return createPool(connectionString, schema)
}

async function preparePool(pool: pg.Pool, schema: string, options: OpenDatabaseOptions): Promise<void> {
  const log = options.log ?? (() => {})
  const mode = options.migrate ?? (process.env.DATABASE_MIGRATE === 'auto' ? 'auto' : 'check')
  const { pending } = await migrationStatus(pool, schema)
  if (!pending.length) return
  if (mode === 'auto' || !(await schemaHasData(pool, schema))) {
    await migrate(pool, schema, { log })
    return
  }
  const names = pending.map(formatName).join(', ')
  throw new Error(
    `A base de dados (esquema ${schema}) tem ${pending.length} migração(ões) pendente(s): ${names}. ` +
      'Faça uma cópia de segurança (pg_dump) e corra `npm run db:migrate`.',
  )
}

/**
 * Liga ao PostgreSQL (DATABASE_URL) e confirma que o esquema está na última
 * migração. `schema` permite isolar cada execução de testes num esquema próprio.
 */
export async function openDatabase(connectionString: string, schema = 'public', options: OpenDatabaseOptions = {}): Promise<Database> {
  const pool = await openPool(connectionString, schema)
  try {
    await preparePool(pool, schema, options)
  } catch (error) {
    await pool.end().catch(() => {})
    throw error
  }
  return createDatabase(pool, () => pool.end())
}
