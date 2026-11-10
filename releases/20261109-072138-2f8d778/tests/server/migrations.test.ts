import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_SETTINGS, openDatabase } from '../../server/models/store/database.ts'
import { loadMigrations, migrate, migrationStatus, type Migration } from '../../server/models/store/migrator.ts'
import { createTestSchema } from './helpers.ts'

const tableNames = async (pool: import('pg').Pool, schema: string) =>
  (
    await pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 ORDER BY table_name`,
      [schema],
    )
  ).rows.map((row) => row.table_name)

/** Insere registos numa tabela JSONB antiga, pela ordem dada (position 0, 1, …). */
const seed = async (pool: import('pg').Pool, table: string, docs: { id: string }[]) => {
  for (const [position, doc] of docs.entries()) {
    await pool.query(`INSERT INTO ${table} (id, position, doc) VALUES ($1, $2, $3)`, [doc.id, position, JSON.stringify(doc)])
  }
}

describe('migration runner', () => {
  test('applies every migration once, in order, and records it', async () => {
    const { pool, schema, drop } = await createTestSchema()
    try {
      const all = loadMigrations()
      assert.ok(all.length >= 1)
      assert.deepEqual(all.map((m) => m.version), [...all.map((m) => m.version)].sort((a, b) => a - b))
      const applied = await migrate(pool, schema)
      assert.deepEqual(applied.map((m) => m.version), all.map((m) => m.version))
      // Segunda execução: nada a fazer.
      assert.deepEqual(await migrate(pool, schema), [])
      const status = await migrationStatus(pool, schema)
      assert.equal(status.pending.length, 0)
      const { rows } = await pool.query('SELECT version, name FROM schema_migrations ORDER BY version')
      assert.deepEqual(rows.map((row) => row.version), all.map((m) => m.version))
    } finally {
      await drop()
    }
  })

  test('the baseline is a no-op on a database created by the old ensureSchema', async () => {
    const { pool, schema, drop } = await createTestSchema()
    try {
      // Esquema como a versão anterior o deixava, já com dados.
      await pool.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`)
      await pool.query(`CREATE TABLE users (id text PRIMARY KEY, position bigint NOT NULL DEFAULT 0, doc jsonb NOT NULL)`)
      await pool.query(`CREATE UNIQUE INDEX users_email_key ON users ((lower(doc->>'email')))`)
      await pool.query(`INSERT INTO users VALUES ('u1', 0, '{"id":"u1","email":"a@b.c"}')`)
      await migrate(pool, schema, { target: 1 })
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM users')).rows[0].n, 1)
      assert.ok((await tableNames(pool, schema)).includes('settings'))
    } finally {
      await drop()
    }
  })

  test('a failing migration is rolled back and not recorded', async () => {
    const { pool, schema, drop } = await createTestSchema()
    try {
      const broken: Migration[] = [
        { version: 1, name: 'ok', sql: 'CREATE TABLE one (id int PRIMARY KEY);', checksum: 'a' },
        { version: 2, name: 'broken', sql: 'CREATE TABLE two (id int PRIMARY KEY); SELECT 1/0;', checksum: 'b' },
      ]
      await assert.rejects(migrate(pool, schema, { migrations: broken }), /002_broken/)
      const tables = await tableNames(pool, schema)
      assert.ok(tables.includes('one'))
      assert.ok(!tables.includes('two'))
      assert.deepEqual((await pool.query('SELECT version FROM schema_migrations')).rows.map((row) => row.version), [1])
    } finally {
      await drop()
    }
  })

  test('refuses to run against a database migrated by newer code', async () => {
    const { pool, schema, drop } = await createTestSchema()
    try {
      await migrate(pool, schema)
      await pool.query(`INSERT INTO schema_migrations (version, name, checksum) VALUES (999, 'future', 'x')`)
      await assert.rejects(migrate(pool, schema), /999/)
    } finally {
      await drop()
    }
  })

  test('002 moves settings and course field options out of JSONB', async () => {
    const { pool, schema, databaseUrl, drop } = await createTestSchema()
    try {
      await migrate(pool, schema, { target: 1 })
      // Documento antigo parcial: sem `levels` nem `comments` (vêm dos valores por omissão).
      const legacy = {
        name: 'Ministério',
        email: 'geral@example.com',
        description: 'Descrição',
        moderation: false,
        signups: false,
        maintenance: true,
        categories: {
          enabled: false,
          options: [
            { id: 'b', label: 'Bê', labelEn: 'Bee' },
            { id: 'a', label: 'Á' },
          ],
        },
      }
      await pool.query(`INSERT INTO settings (id, doc) VALUES (1, $1)`, [JSON.stringify(legacy)])
      await migrate(pool, schema, { target: 2 })

      const tables = await tableNames(pool, schema)
      assert.ok(tables.includes('legacy_settings'))
      assert.ok(tables.includes('course_field_options'))
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM legacy_settings')).rows[0].n, 1)

      const db = await openDatabase(databaseUrl, schema, { migrate: 'auto' })
      try {
        const settings = await db.settings.read()
        assert.equal(settings.name, 'Ministério')
        assert.equal(settings.email, 'geral@example.com')
        assert.equal(settings.moderation, false)
        assert.equal(settings.comments, true)
        assert.equal(settings.maintenance, true)
        assert.deepEqual(settings.categories, {
          enabled: false,
          options: [
            { id: 'b', label: 'Bê', labelEn: 'Bee' },
            { id: 'a', label: 'Á', labelEn: '' },
          ],
        })
        assert.equal(settings.levels.enabled, true)
        assert.deepEqual(settings.levels.options.map((option) => option.id), ['iniciante', 'intermedio', 'avancado'])

        // Gravar: reordena, renomeia, acrescenta e apaga opções.
        const saved = await db.settings.write({
          signups: true,
          categories: {
            enabled: true,
            options: [
              { id: 'c', label: 'Cê', labelEn: 'See' },
              { id: 'b', label: 'Bê novo', labelEn: 'Bee' },
            ],
          },
        })
        assert.equal(saved.signups, true)
        assert.equal(saved.name, 'Ministério')
        assert.deepEqual(await db.settings.read(), saved)
        assert.deepEqual(saved.categories.options.map((option) => option.id), ['c', 'b'])
        assert.equal(saved.categories.options[1].label, 'Bê novo')
        assert.equal(saved.levels.options.length, 3)
      } finally {
        await db.close()
      }
    } finally {
      await drop()
    }
  })

  test('002 uses the default settings when there was no settings row', async () => {
    const { pool, schema, databaseUrl, drop } = await createTestSchema()
    try {
      await migrate(pool, schema)
      const db = await openDatabase(databaseUrl, schema)
      try {
        assert.deepEqual(await db.settings.read(), DEFAULT_SETTINGS)
      } finally {
        await db.close()
      }
    } finally {
      await drop()
    }
  })

  test('003 moves events and posts to columns, keeping ids and order', async () => {
    const { pool, schema, databaseUrl, drop } = await createTestSchema()
    try {
      await migrate(pool, schema, { target: 2 })
      const event = (id: string, date: string) => ({
        id, title: `Evento ${id}`, kind: 'Culto', date, place: 'Maputo', entry: 'Livre', status: 'published', description: 'D', image: '',
      })
      await seed(pool, 'events', [
        event('e-2', '2026-12-24T18:30'),
        event('e-1', ''),
        event('e-3', '2026-11-01'),
      ])
      const post = (id: string) => ({
        id, type: 'daily-message', title: `Post ${id}`, body: 'Texto', language: 'pt',
        publishAt: '2026-10-01T06:00:00.000Z', status: 'published', premium: id === 'p-b', createdAt: '2026-09-30T21:15:42.123Z',
      })
      await seed(pool, 'posts', [post('p-b'), post('p-a')])
      await migrate(pool, schema, { target: 3 })

      const tables = await tableNames(pool, schema)
      assert.ok(tables.includes('legacy_events') && tables.includes('legacy_posts'))
      const db = await openDatabase(databaseUrl, schema, { migrate: 'auto' })
      try {
        const events = await db.events.all()
        assert.deepEqual(events.map((item) => [item.id, item.date]), [
          ['e-2', '2026-12-24T18:30'],
          ['e-1', ''],
          ['e-3', '2026-11-01T00:00'],
        ])
        assert.deepEqual(events[0], event('e-2', '2026-12-24T18:30'))
        const posts = await db.posts.all()
        assert.deepEqual(posts, [post('p-b'), post('p-a')])

        // Inserir no início/fim e actualizar continuam a funcionar.
        await db.posts.insert({ ...post('p-new'), premium: false }, 'start')
        assert.equal((await db.posts.all())[0].id, 'p-new')
        const updated = await db.events.update('e-1', { date: '2027-01-02T09:00', title: 'Novo' })
        assert.equal(updated?.date, '2027-01-02T09:00')
        assert.equal(updated?.title, 'Novo')
        await assert.rejects(db.events.insert(event('e-1', '')), /duplicate_id:e-1/)
      } finally {
        await db.close()
      }
    } finally {
      await drop()
    }
  })

  test('003 refuses unknown event date formats without changing anything', async () => {
    const { pool, schema, drop } = await createTestSchema()
    try {
      await migrate(pool, schema, { target: 2 })
      await seed(pool, 'events', [{ id: 'e-x', title: 'X', date: 'amanhã à noite', status: 'draft' }])
      await assert.rejects(migrate(pool, schema, { target: 3 }), /e-x/)
      const tables = await tableNames(pool, schema)
      assert.ok(!tables.includes('legacy_events'))
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM events')).rows[0].n, 1)
    } finally {
      await drop()
    }
  })

  test('004 moves users to columns and their subscription to its own table', async () => {
    const { pool, schema, databaseUrl, drop } = await createTestSchema()
    try {
      await migrate(pool, schema, { target: 3 })
      const user = (id: string, subscription: Record<string, unknown> | null) => ({
        id, name: `Membro ${id}`, email: `${id}@example.com`, passwordHash: 'hash', role: 'member', status: 'active',
        language: 'pt', subscription, createdAt: '2026-01-01T10:00:00.000Z', lastLoginAt: null,
      })
      const sub = { plan: '200', startedAt: '2026-05-01T00:00:00.000Z', expiresAt: '2026-05-31T00:00:00.000Z', paymentId: 'pay-1' }
      await seed(pool, 'users', [
        user('u-c', null),
        // Registo antigo do plano 500, sem assistanceExpiresAt: assistência até ao fim.
        user('u-a', { ...sub, plan: '500', paymentId: null }),
        user('u-b', { ...sub, assistanceExpiresAt: '2026-05-20T00:00:00.000Z' }),
        { ...user('u-admin', null), role: 'admin', lastLoginAt: '2026-06-01T08:09:10.011Z' },
      ])
      await migrate(pool, schema, { target: 4 })

      assert.equal((await pool.query('SELECT count(*)::int AS n FROM legacy_users')).rows[0].n, 4)
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM subscriptions')).rows[0].n, 2)
      assert.equal((await pool.query(`SELECT payment_id FROM subscriptions WHERE user_id = 'u-b'`)).rows[0].payment_id, 'pay-1')
      const db = await openDatabase(databaseUrl, schema, { migrate: 'auto' })
      try {
        const users = await db.users.all()
        assert.deepEqual(users.map((item) => item.id), ['u-c', 'u-a', 'u-b', 'u-admin'])
        assert.deepEqual(users[0], user('u-c', null))
        assert.deepEqual(users[1].subscription, { ...sub, plan: '500', paymentId: null, assistanceExpiresAt: sub.expiresAt })
        // A 006 solta referências a pagamentos que não existem (pay-1 nunca foi gravado).
        assert.deepEqual(users[2].subscription, { ...sub, paymentId: null, assistanceExpiresAt: '2026-05-20T00:00:00.000Z' })
        assert.equal(users[3].lastLoginAt, '2026-06-01T08:09:10.011Z')

        // Gravar e retirar a subscrição.
        const next = { plan: '500' as const, startedAt: sub.startedAt, expiresAt: '2026-08-01T00:00:00.000Z', paymentId: null, assistanceExpiresAt: '2026-08-01T00:00:00.000Z' }
        assert.deepEqual((await db.users.update('u-c', { subscription: next }))?.subscription, next)
        assert.equal((await db.users.update('u-b', { subscription: null }))?.subscription, null)
        assert.equal((await pool.query('SELECT count(*)::int AS n FROM subscriptions')).rows[0].n, 2)

        // E-mail único sem distinguir maiúsculas; apagar o membro apaga a subscrição.
        await assert.rejects(db.users.insert({ ...user('u-d', null), email: 'U-A@example.com' } as never), /duplicate_id/)
        assert.equal(await db.users.remove('u-a'), true)
        assert.equal((await pool.query(`SELECT count(*)::int AS n FROM subscriptions WHERE user_id = 'u-a'`)).rows[0].n, 0)
        await assert.rejects(pool.query(`INSERT INTO subscriptions (user_id, plan, started_at, expires_at) VALUES ('ninguem', '200', now(), now())`), { code: '23503' })
      } finally {
        await db.close()
      }
    } finally {
      await drop()
    }
  })

  test('005 moves courses, modules, lessons and prayer points to tables', async () => {
    const { pool, schema, databaseUrl, drop } = await createTestSchema()
    try {
      await migrate(pool, schema, { target: 4 })
      const video = { name: 'dia1.mp4', size: 7340032, duration: 912.5, type: 'video/mp4' }
      const courseA = {
        id: 'c-a', title: 'Ensino', category: 'mulheres', status: 'published', level: 'antigo-nivel',
        instructor: 'Ana Yeshua', cover: '/uploads/a.webp', description: 'D', featured: true,
        updated: '2026-03-04T05:06', views: 12, students: 3, prayerPoints: ['Ponto do curso'],
        // Sem `access` nem `publishAt` (cursos antigos).
        modules: [
          {
            id: 'm2', title: 'Segundo',
            lessons: [
              { id: 'l-3', title: 'Três', video, free: false, prayerPoints: ['Ponto 1', 'Ponto 2'] },
              { id: 'l-1', title: 'Um', video: null, free: true },
            ],
          },
          { id: 'm1', title: 'Primeiro', lessons: [{ id: 'l-2', title: 'Dois', video: null, free: false }] },
        ],
      }
      const courseB = {
        id: 'c-b', title: 'Oração', category: '', status: 'scheduled', access: 'free', publishAt: '2026-12-01T19:00', level: '',
        instructor: 'Ana Yeshua', cover: '/brand/b.webp', description: '', featured: false,
        updated: '2026-01-01T00:00', views: 0, students: 0,
        // O mesmo id de módulo noutro curso é permitido.
        modules: [{ id: 'm1', title: 'Aulas', lessons: [{ id: 'l-9', title: 'Nove', video: null, free: false }] }],
      }
      await seed(pool, 'courses', [courseB, courseA])
      await migrate(pool, schema, { target: 5 })

      assert.equal((await pool.query('SELECT count(*)::int AS n FROM legacy_courses')).rows[0].n, 2)
      // O nível antigo que já não estava nas Configurações passou a opção.
      assert.equal((await pool.query(`SELECT label FROM course_field_options WHERE field = 'level' AND id = 'antigo-nivel'`)).rows[0].label, 'antigo-nivel')

      const db = await openDatabase(databaseUrl, schema, { migrate: 'auto' })
      try {
        const courses = await db.courses.all()
        assert.deepEqual(courses.map((course) => course.id), ['c-b', 'c-a'])
        const a = courses[1]
        assert.equal(a.access, 'premium')
        assert.equal(a.publishAt, '')
        assert.equal(a.updated, '2026-03-04T05:06')
        assert.deepEqual(a.prayerPoints, ['Ponto do curso'])
        assert.deepEqual(a.modules.map((module) => [module.id, module.lessons.map((lesson) => lesson.id)]), [
          ['m2', ['l-3', 'l-1']],
          ['m1', ['l-2']],
        ])
        assert.deepEqual(a.modules[0].lessons[0], { id: 'l-3', title: 'Três', video, free: false, prayerPoints: ['Ponto 1', 'Ponto 2'] })
        assert.deepEqual(courses[0].modules[0].lessons[0], { id: 'l-9', title: 'Nove', video: null, free: false, prayerPoints: [] })
        assert.equal(courses[0].access, 'free')
        assert.equal(courses[0].publishAt, '2026-12-01T19:00')
        assert.equal(courses[0].category, '')

        // Gravar: reordena, move uma aula de módulo, apaga e acrescenta, mantendo os ids.
        const saved = (await db.courses.update('c-a', (current) => ({
          ...current,
          modules: [
            { id: 'm1', title: 'Primeiro', lessons: [{ id: 'l-1', title: 'Um', video: null, free: true, prayerPoints: [] }, current.modules[1].lessons[0]] },
            { id: 'm3', title: 'Novo', lessons: [{ id: 'l-4', title: 'Quatro', video: null, free: false, prayerPoints: ['Novo ponto'] }] },
          ],
        })))!
        assert.deepEqual(saved.modules.map((module) => [module.id, module.lessons.map((lesson) => lesson.id)]), [
          ['m1', ['l-1', 'l-2']],
          ['m3', ['l-4']],
        ])
        assert.equal((await pool.query(`SELECT count(*)::int AS n FROM lessons WHERE id = 'l-3'`)).rows[0].n, 0)
        assert.equal((await pool.query(`SELECT count(*)::int AS n FROM prayer_points WHERE lesson_id = 'l-3'`)).rows[0].n, 0)
        assert.deepEqual(await db.courses.get('c-a'), saved)

        // Uma aula de outro curso não pode ser reutilizada; nada fica gravado.
        const before = await db.courses.get('c-b')
        await assert.rejects(
          db.courses.update('c-b', (current) => ({ ...current, title: 'X', modules: [{ id: 'm1', title: 'A', lessons: [{ id: 'l-1', title: 'Roubada', video: null, free: false }] }] })),
          /duplicate_id:l-1/,
        )
        assert.deepEqual(await db.courses.get('c-b'), before)

        // Categoria inexistente é recusada pela chave estrangeira; apagar o curso apaga o conteúdo.
        await assert.rejects(db.courses.update('c-b', { category: 'nao-existe' }), { code: '23503' })
        assert.equal(await db.courses.remove('c-a'), true)
        for (const table of ['course_modules', 'lessons', 'prayer_points']) {
          assert.equal((await pool.query(`SELECT count(*)::int AS n FROM ${table} WHERE course_id = 'c-a'`)).rows[0].n, 0)
        }
      } finally {
        await db.close()
      }
    } finally {
      await drop()
    }
  })

  test('005 refuses lesson ids repeated across courses without changing anything', async () => {
    const { pool, schema, drop } = await createTestSchema()
    try {
      await migrate(pool, schema, { target: 4 })
      const course = (id: string) => ({ id, title: id, status: 'draft', modules: [{ id: 'm1', title: '', lessons: [{ id: 'l-same', title: '', video: null, free: false }] }] })
      await seed(pool, 'courses', [course('c-1'), course('c-2')])
      await assert.rejects(migrate(pool, schema, { target: 5 }), /l-same/)
      assert.ok(!(await tableNames(pool, schema)).includes('legacy_courses'))
    } finally {
      await drop()
    }
  })

  test('006 moves payments to columns and links them to members and subscriptions', async () => {
    const { pool, schema, databaseUrl, drop } = await createTestSchema()
    try {
      await migrate(pool, schema, { target: 3 })
      const payment = (id: string, userId: string, extra: Record<string, unknown> = {}) => ({
        id, userId, plan: '200', amount: 200, method: 'mpesa', accountMasked: '84*****67', status: 'pending',
        provider: 'imaliway', partnerTransactionId: `ptx${id}`, providerRef: null, failureReason: null,
        createdAt: '2026-05-01T10:00:00.000Z', expiresAt: '2026-05-01T10:05:00.000Z', confirmedAt: null, lastCheckedAt: null,
        ...extra,
      })
      const sub = { plan: '200', startedAt: '2026-05-01T00:00:00.000Z', expiresAt: '2026-05-31T00:00:00.000Z' }
      await seed(pool, 'users', [
        { id: 'u-1', name: 'Membro', email: 'u1@example.com', passwordHash: 'h', role: 'member', status: 'active', language: 'pt',
          subscription: { ...sub, paymentId: 'p-ok' }, createdAt: '2026-01-01T00:00:00.000Z', lastLoginAt: null },
        { id: 'u-2', name: 'Outro', email: 'u2@example.com', passwordHash: 'h', role: 'member', status: 'active', language: 'pt',
          subscription: { ...sub, paymentId: 'p-sumido' }, createdAt: '2026-01-01T00:00:00.000Z', lastLoginAt: null },
      ])
      await seed(pool, 'payments', [
        payment('p-new', 'u-1'),
        payment('p-ok', 'u-1', { status: 'confirmed', providerRef: 'tx-9', confirmedAt: '2026-05-01T10:01:02.003Z', lastCheckedAt: '2026-05-01T10:01:02.003Z' }),
        // Pagamento de uma conta que já não existe: fica sem membro.
        payment('p-orfao', 'u-apagado', { status: 'failed', failureReason: 'failed' }),
      ])
      await migrate(pool, schema, { target: 6 })

      assert.equal((await pool.query('SELECT count(*)::int AS n FROM legacy_payments')).rows[0].n, 3)
      const links = (await pool.query(`SELECT user_id, payment_id FROM subscriptions ORDER BY user_id`)).rows
      assert.deepEqual(links, [{ user_id: 'u-1', payment_id: 'p-ok' }, { user_id: 'u-2', payment_id: null }])

      const db = await openDatabase(databaseUrl, schema, { migrate: 'auto' })
      try {
        const payments = await db.payments.all()
        assert.deepEqual(payments.map((item) => item.id), ['p-new', 'p-ok', 'p-orfao'])
        assert.deepEqual(payments[0], payment('p-new', 'u-1'))
        assert.equal(payments[1].confirmedAt, '2026-05-01T10:01:02.003Z')
        assert.equal(payments[2].userId, null)
        assert.equal((await db.payments.find((item) => item.providerRef === 'tx-9'))?.id, 'p-ok')

        // Activação atómica: se a subscrição falhar, o estado do pagamento é desfeito.
        await assert.rejects(
          db.transaction(async (tx) => {
            await tx.payments.update('p-new', { status: 'confirmed' })
            await tx.users.update('u-1', () => { throw new Error('falha') })
          }),
          /falha/,
        )
        assert.equal((await db.payments.get('p-new'))?.status, 'pending')

        // partner_transaction_id único; apagar o membro mantém o pagamento sem membro
        // e apagar o pagamento solta a subscrição.
        await assert.rejects(db.payments.insert(payment('p-dup', 'u-1', { partnerTransactionId: 'ptxp-ok' }) as never), /duplicate_id/)
        await pool.query(`DELETE FROM payments WHERE id = 'p-ok'`)
        assert.equal((await db.users.get('u-1'))?.subscription?.paymentId, null)
        assert.equal(await db.users.remove('u-1'), true)
        assert.equal((await db.payments.get('p-new'))?.userId, null)
        await assert.rejects(pool.query(`UPDATE payments SET user_id = 'ninguem' WHERE id = 'p-new'`), { code: '23503' })
      } finally {
        await db.close()
      }
    } finally {
      await drop()
    }
  })

  test('006 refuses repeated partner transaction ids without changing anything', async () => {
    const { pool, schema, drop } = await createTestSchema()
    try {
      await migrate(pool, schema, { target: 5 })
      const payment = (id: string) => ({ id, userId: 'u', plan: '200', amount: 200, method: 'mpesa', status: 'pending', partnerTransactionId: 'SAME12345678', createdAt: '2026-05-01T10:00:00.000Z' })
      await seed(pool, 'payments', [payment('p-1'), payment('p-2')])
      await assert.rejects(migrate(pool, schema, { target: 6 }), /SAME12345678/)
      assert.ok(!(await tableNames(pool, schema)).includes('legacy_payments'))
    } finally {
      await drop()
    }
  })

  test('007 moves testimonies, questions and assistance feedback to tables', async () => {
    const { pool, schema, databaseUrl, drop } = await createTestSchema()
    try {
      await migrate(pool, schema, { target: 3 })
      const member = (id: string) => ({
        id, name: id, email: `${id}@example.com`, passwordHash: 'h', role: 'member', status: 'active', language: 'pt',
        subscription: null, createdAt: '2026-01-01T00:00:00.000Z', lastLoginAt: null,
      })
      await seed(pool, 'users', [member('u-1'), member('u-2')])
      await seed(pool, 'courses', [{
        id: 'c-1', title: 'Curso', status: 'published', access: 'premium',
        modules: [{ id: 'm1', title: 'M', lessons: [{ id: 'l-1', title: 'Aula', video: null, free: true }, { id: 'l-2', title: 'Outra', video: null, free: false }] }],
      }])
      const testimony = (id: string, extra: Record<string, unknown> = {}) => ({
        id, userId: 'u-1', name: 'u-1', text: 'Fui abençoada', courseId: 'c-1', lessonId: 'l-1',
        source: 'Curso · Aula', status: 'published', date: '2026-04-05', ...extra,
      })
      const question = (id: string, extra: Record<string, unknown> = {}) => ({
        id, userId: 'u-1', name: 'u-1', email: 'u-1@example.com', subject: 'Assunto', body: 'Pergunta',
        courseId: 'c-1', lessonId: 'l-2', courseTitle: 'Curso', lessonTitle: 'Outra', answer: '', status: 'open',
        createdAt: '2026-04-05T06:07:08.009Z', answeredAt: null, ...extra,
      })
      await seed(pool, 'testimonies', [
        testimony('t-b'),
        // Conta, curso e aula que já não existem: o testemunho fica, sem ligações.
        testimony('t-a', { userId: 'u-apagado', courseId: 'c-apagado', lessonId: 'l-apagada', status: 'pending' }),
      ])
      await seed(pool, 'questions', [
        question('q-2', { status: 'answered', answer: 'Resposta', answeredAt: '2026-04-06T00:00:00.000Z' }),
        // Dúvida geral antiga, sem aula.
        { id: 'q-1', userId: 'u-2', name: 'u-2', email: 'u-2@example.com', subject: 'Geral', body: 'Pergunta', answer: '', status: 'open', createdAt: '2026-03-01T00:00:00.000Z', answeredAt: null },
        // Dono já apagado: fica só em legacy_questions.
        question('q-orfa', { userId: 'u-apagado' }),
      ])
      await seed(pool, 'feedback', [
        { id: 'f-1', userId: 'u-1', name: 'u-1', rating: 5, comment: 'Obrigada', createdAt: '2026-04-07T00:00:00.000Z' },
        { id: 'f-orfao', userId: 'u-apagado', name: 'x', rating: 3, comment: '', createdAt: '2026-04-07T00:00:00.000Z' },
      ])
      await migrate(pool, schema, { target: 7 })

      assert.deepEqual(
        (await pool.query(`SELECT (SELECT count(*)::int FROM legacy_questions) AS q, (SELECT count(*)::int FROM legacy_feedback) AS f, (SELECT count(*)::int FROM legacy_testimonies) AS t`)).rows[0],
        { q: 3, f: 2, t: 2 },
      )
      const db = await openDatabase(databaseUrl, schema, { migrate: 'auto' })
      try {
        const testimonies = await db.testimonies.all()
        assert.deepEqual(testimonies.map((item) => item.id), ['t-b', 't-a'])
        assert.deepEqual(testimonies[0], testimony('t-b'))
        assert.deepEqual(testimonies[1], testimony('t-a', { userId: null, courseId: null, lessonId: null, status: 'pending' }))

        const questions = await db.questions.all()
        assert.deepEqual(questions.map((item) => item.id), ['q-2', 'q-1'])
        assert.deepEqual(questions[0], question('q-2', { status: 'answered', answer: 'Resposta', answeredAt: '2026-04-06T00:00:00.000Z' }))
        assert.equal(questions[1].lessonId, null)
        assert.deepEqual(await db.feedback.all(), [{ id: 'f-1', userId: 'u-1', name: 'u-1', rating: 5, comment: 'Obrigada', createdAt: '2026-04-07T00:00:00.000Z' }])

        // Novos registos entram no início, como antes.
        await db.questions.insert(question('q-3'), 'start')
        assert.equal((await db.questions.all())[0].id, 'q-3')
        await assert.rejects(pool.query(`UPDATE assistance_feedback SET rating = 6`), { code: '23514' })
        await assert.rejects(pool.query(`UPDATE questions SET user_id = 'ninguem' WHERE id = 'q-3'`), { code: '23503' })

        // Apagar a aula solta as ligações; apagar o membro apaga dúvidas e feedback
        // e deixa os testemunhos sem membro.
        await pool.query(`DELETE FROM lessons WHERE id = 'l-2'`)
        assert.equal((await db.questions.get('q-2'))?.lessonId, null)
        assert.equal((await db.questions.get('q-2'))?.lessonTitle, 'Outra')
        assert.equal(await db.users.remove('u-1'), true)
        assert.deepEqual((await db.questions.all()).map((item) => item.id), ['q-1'])
        assert.deepEqual(await db.feedback.all(), [])
        assert.equal((await db.testimonies.get('t-b'))?.userId, null)
      } finally {
        await db.close()
      }
    } finally {
      await drop()
    }
  })

  test('007 refuses testimonies with an unknown date format without changing anything', async () => {
    const { pool, schema, drop } = await createTestSchema()
    try {
      await migrate(pool, schema, { target: 6 })
      await seed(pool, 'testimonies', [{ id: 't-mau', text: 'x', status: 'published', date: '05/04/2026' } as never])
      await assert.rejects(migrate(pool, schema, { target: 7 }), /t-mau/)
      assert.ok(!(await tableNames(pool, schema)).includes('legacy_testimonies'))
    } finally {
      await drop()
    }
  })

  test('openDatabase migrates an empty schema but not one with data, unless asked', async () => {
    const { pool, schema, databaseUrl, drop } = await createTestSchema()
    try {
      await migrate(pool, schema, { target: 1 })
      const user = {
        id: 'u1',
        name: 'Membro',
        email: 'membro@example.com',
        passwordHash: 'x',
        role: 'member',
        status: 'active',
        language: 'pt',
        subscription: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        lastLoginAt: null,
      }
      await pool.query(`INSERT INTO users (id, position, doc) VALUES ('u1', 0, $1)`, [JSON.stringify(user)])
      const pending = (await migrationStatus(pool, schema)).pending.length
      if (pending > 0) {
        await assert.rejects(openDatabase(databaseUrl, schema), /db:migrate/)
      }
      const db = await openDatabase(databaseUrl, schema, { migrate: 'auto' })
      await db.close()
      assert.equal((await migrationStatus(pool, schema)).pending.length, 0)
    } finally {
      await drop()
    }
  })
})
