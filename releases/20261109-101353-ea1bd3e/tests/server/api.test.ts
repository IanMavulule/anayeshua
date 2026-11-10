import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { ADMIN, createClient, startTestServer } from './helpers.ts'

let server: Awaited<ReturnType<typeof startTestServer>>

before(async () => {
  server = await startTestServer()
})

after(async () => {
  await server.close()
})

describe('startup', () => {
  test('creates only the admin account: no sample courses or content', async () => {
    const empty = await startTestServer({ seed: false })
    try {
      const { db } = empty.context
      assert.equal(await db.courses.count(), 0)
      assert.equal(await db.events.count(), 0)
      assert.equal(await db.testimonies.count(), 0)
      const users = await db.users.all()
      assert.equal(users.length, 1)
      assert.equal(users[0].role, 'admin')
      assert.equal(users[0].email, ADMIN.email)
      assert.deepEqual((await createClient(empty.base).get('/api/catalog')).json.series, [])
    } finally {
      await empty.close()
    }
  })

  test('data is stored in PostgreSQL and survives a restart of the store', async () => {
    const { db } = server.context
    const before = await db.courses.get('PL9gyyXlYTfL1Sa_aax1clbXYWR9SOlbq6')
    assert.ok(before)
    // Duplicados são recusados pela chave primária.
    await assert.rejects(db.courses.insert(before), /duplicate_id/)
    // A ordem de inserção é respeitada: 'start' fica antes de tudo.
    await db.events.insert({ id: 'e-b', title: 'B', kind: '', date: '', place: '', entry: '', status: 'draft', description: '', image: '' })
    await db.events.insert({ id: 'e-a', title: 'A', kind: '', date: '', place: '', entry: '', status: 'draft', description: '', image: '' }, 'start')
    assert.deepEqual((await db.events.all()).map((event) => event.id), ['e-a', 'e-b'])
    await db.events.removeMany(['e-a', 'e-b'])
  })
})

describe('auth', () => {
  test('register, session and logout', async () => {
    const client = createClient(server.base)
    const registered = await client.post('/api/auth/register', {
      name: 'Maria Teste',
      email: 'Maria@Example.com',
      password: 'password-123',
    })
    assert.equal(registered.status, 201)
    assert.equal(registered.json.user.email, 'maria@example.com')
    assert.equal(registered.json.user.passwordHash, undefined)

    const session = await client.get('/api/auth/session')
    assert.equal(session.json.authenticated, true)
    assert.equal(session.json.user.premium, false)

    const duplicate = await createClient(server.base).post('/api/auth/register', {
      name: 'Outra',
      email: 'maria@example.com',
      password: 'password-123',
    })
    assert.equal(duplicate.status, 409)

    assert.equal((await client.post('/api/auth/logout')).status, 204)
    assert.equal((await client.get('/api/auth/session')).json.authenticated, false)
  })

  test('rejects wrong passwords and rate limits repeated failures', async () => {
    const client = createClient(server.base)
    for (let attempt = 0; attempt < 5; attempt++) {
      assert.equal((await client.login('limit@example.com', 'wrong')).status, 401)
    }
    assert.equal((await client.login('limit@example.com', 'wrong')).status, 429)
  })

  test('state-changing requests without the client header are refused', async () => {
    const response = await fetch(`${server.base}/api/auth/logout`, { method: 'POST' })
    assert.equal(response.status, 403)
  })
})

describe('admin API', () => {
  test('requires an admin session', async () => {
    const anonymous = createClient(server.base)
    assert.equal((await anonymous.get('/api/admin/state')).status, 401)

    const member = createClient(server.base)
    await member.post('/api/auth/register', { name: 'Membro', email: 'membro@example.com', password: 'password-123' })
    assert.equal((await member.get('/api/admin/state')).status, 403)
    assert.equal((await member.put('/api/admin/settings', { name: 'x' })).status, 403)

    const admin = createClient(server.base)
    assert.equal((await admin.login(ADMIN.email, ADMIN.password)).status, 200)
    const state = await admin.get('/api/admin/state')
    assert.equal(state.status, 200)
    assert.ok(Array.isArray(state.json.state.courses))
    assert.ok(state.json.state.members.every((member: Record<string, unknown>) => !('passwordHash' in member)))
  })

  test('creates, updates and deletes a course with validation', async () => {
    const admin = createClient(server.base)
    await admin.login(ADMIN.email, ADMIN.password)
    const invalid = await admin.post('/api/admin/courses', { title: '' })
    assert.equal(invalid.status, 400)

    const course = {
      title: 'Curso novo',
      category: 'oracao',
      status: 'published',
      level: 'iniciante',
      instructor: 'Ana Yeshua',
      cover: '/brand/img/video-oracao.webp',
      description: '',
      featured: false,
      modules: [{ id: 'm1', title: 'Módulo', lessons: [{ id: 'lesson_new_1', title: 'Aula 1', video: null, free: true }] }],
    }
    const created = await admin.post('/api/admin/courses', course)
    assert.equal(created.status, 201)
    const id = created.json.course.id

    const external = await admin.put(`/api/admin/courses/${id}`, { ...course, cover: 'https://i.ytimg.com/x.jpg' })
    assert.equal(external.status, 400)

    // O id da aula é único na plataforma: repetido no curso ou de outro curso → 409.
    const lesson = (lessonId: string) => ({ id: lessonId, title: 'Aula', video: null, free: false })
    const repeated = await admin.put(`/api/admin/courses/${id}`, { ...course, modules: [{ id: 'm1', title: 'M', lessons: [lesson('lesson_new_1'), lesson('lesson_new_1')] }] })
    assert.equal(repeated.status, 409)
    assert.equal(repeated.json.error, 'duplicate_id')
    const stolen = await admin.post('/api/admin/courses', { ...course, modules: [{ id: 'm1', title: 'M', lessons: [lesson('lesson_new_1')] }] })
    assert.equal(stolen.status, 409)
    assert.equal((await server.db.courses.get(id))?.modules[0].lessons.length, 1)

    const catalog = await createClient(server.base).get('/api/catalog')
    assert.ok(catalog.json.series.some((series: { id: string }) => series.id === id))

    assert.equal((await admin.del(`/api/admin/courses/${id}`)).status, 204)
  })

  test('events keep an optional local photo', async () => {
    const admin = createClient(server.base)
    await admin.login(ADMIN.email, ADMIN.password)
    const event = { title: 'Mesa Profética', date: '2099-01-10T18:00', status: 'published', image: '/uploads/covers/foto.webp' }
    const created = await admin.post('/api/admin/events', event)
    assert.equal(created.status, 201)
    const id = created.json.event.id
    assert.equal((await server.db.events.get(id))?.image, '/uploads/covers/foto.webp')

    const listed = await createClient(server.base).get('/api/events')
    assert.equal(listed.json.events.find((item: { id: string }) => item.id === id)?.image, '/uploads/covers/foto.webp')

    assert.equal((await admin.put(`/api/admin/events/${id}`, { ...event, image: 'https://example.com/x.jpg' })).status, 400)
    const cleared = await admin.put(`/api/admin/events/${id}`, { ...event, image: '' })
    assert.equal(cleared.json.event.image, '')
    assert.equal((await admin.put(`/api/admin/events/${id}`, { title: 'Sem foto', date: '2099-01-10T18:00', status: 'draft' })).json.event.image, '')
    assert.equal((await admin.del(`/api/admin/events/${id}`)).status, 204)
  })

  test('categories and levels are configurable in settings', async () => {
    const admin = createClient(server.base)
    await admin.login(ADMIN.email, ADMIN.password)
    const { settings } = (await admin.get('/api/admin/state')).json.state
    const course = {
      title: 'Curso de configuração',
      category: 'jovens',
      status: 'published',
      level: 'iniciante',
      instructor: 'Ana Yeshua',
      cover: '/brand/img/video-oracao.webp',
      description: '',
      featured: false,
      modules: [{ id: 'm1', title: 'Módulo', lessons: [{ id: 'lesson_cfg_1', title: 'Aula 1', video: null, free: true }] }],
    }

    // Uma categoria que não está configurada é recusada…
    const unknown = await admin.post('/api/admin/courses', course)
    assert.equal(unknown.status, 400)
    assert.equal(unknown.json.error, 'invalid_category')

    // …até ser acrescentada em Configurações; passa a ir no catálogo público.
    const withYouth = { ...settings.categories, options: [...settings.categories.options, { id: 'jovens', label: 'Jovens', labelEn: 'Youth' }] }
    assert.equal((await admin.put('/api/admin/settings', { categories: withYouth })).status, 200)
    const created = await admin.post('/api/admin/courses', course)
    assert.equal(created.status, 201)
    const catalog = await createClient(server.base).get('/api/catalog')
    assert.ok(catalog.json.categories.some((option: { id: string }) => option.id === 'jovens'))

    // Ids repetidos são recusados; uma opção em uso não pode ser removida.
    const duplicated = { ...withYouth, options: [...withYouth.options, { id: 'jovens', label: 'Outra', labelEn: '' }] }
    assert.equal((await admin.put('/api/admin/settings', { categories: duplicated })).status, 400)
    const removed = await admin.put('/api/admin/settings', { categories: settings.categories })
    assert.equal(removed.status, 409)
    assert.equal(removed.json.error, 'option_in_use')

    // Com o campo desligado, o curso guarda-se sem categoria e o site deixa de as receber.
    assert.equal((await admin.put('/api/admin/settings', { categories: { ...withYouth, enabled: false } })).status, 200)
    const noCategory = await admin.post('/api/admin/courses', { ...course, title: 'Sem categoria', category: '', modules: [{ id: 'm1', title: 'M', lessons: [{ id: 'lesson_cfg_2', title: 'Aula', video: null, free: true }] }] })
    assert.equal(noCategory.status, 201)
    assert.deepEqual((await createClient(server.base).get('/api/catalog')).json.categories, [])
    // Desligado, um valor que não é opção continua a ser recusado (o curso liga-se à opção na base).
    const ghost = await admin.post('/api/admin/courses', { ...course, category: 'nao-existe', modules: [] })
    assert.equal(ghost.status, 400)
    assert.equal(ghost.json.error, 'invalid_category')

    // Repor o estado para os outros testes.
    await admin.del(`/api/admin/courses/${created.json.course.id}`)
    await admin.del(`/api/admin/courses/${noCategory.json.course.id}`)
    assert.equal((await admin.put('/api/admin/settings', { categories: settings.categories })).status, 200)
  })
})

describe('prayer points', () => {
  test('are optional, per lesson and per devotional, with the lesson access rules', async () => {
    const admin = createClient(server.base)
    await admin.login(ADMIN.email, ADMIN.password)
    const course = {
      title: 'Devocional com oração',
      category: 'oracao',
      status: 'published',
      level: 'iniciante',
      instructor: 'Ana Yeshua',
      cover: '/brand/img/video-oracao.webp',
      description: '',
      prayerPoints: ['Pela família', 'Pela nação'],
      featured: false,
      modules: [
        {
          id: 'pp-m1',
          title: 'Aulas',
          lessons: [
            { id: 'pp_free', title: 'Aula 1', video: null, free: true, prayerPoints: ['Ore pela sua casa'] },
            { id: 'pp_premium', title: 'Aula 2', video: null, free: false, prayerPoints: ['Ore em línguas'] },
            // Sem pontos de oração: o campo é opcional.
            { id: 'pp_none', title: 'Aula 3', video: null, free: true },
          ],
        },
      ],
    }
    const created = await admin.post('/api/admin/courses', course)
    assert.equal(created.status, 201)

    // O catálogo público traz os pontos do devocional e só indica se a aula tem pontos.
    const catalog = await createClient(server.base).get('/api/catalog')
    const series = catalog.json.series.find((item: { id: string }) => item.id === created.json.course.id)
    assert.deepEqual(series.prayerPoints, ['Pela família', 'Pela nação'])
    const flags = Object.fromEntries(series.lessons.map((lesson: { id: string; hasPrayerPoints: boolean }) => [lesson.id, lesson.hasPrayerPoints]))
    assert.deepEqual(flags, { pp_free: true, pp_premium: true, pp_none: false })
    assert.ok(!JSON.stringify(series).includes('Ore em línguas'))

    assert.equal((await createClient(server.base).get('/api/lessons/pp_free/prayer-points')).status, 401)
    const member = createClient(server.base)
    await member.post('/api/auth/register', { name: 'Ana Oração', email: 'oracao@example.com', password: 'password-123' })
    assert.deepEqual((await member.get('/api/lessons/pp_free/prayer-points')).json.prayerPoints, ['Ore pela sua casa'])
    assert.deepEqual((await member.get('/api/lessons/pp_none/prayer-points')).json.prayerPoints, [])
    const locked = await member.get('/api/lessons/pp_premium/prayer-points')
    assert.equal(locked.status, 403)
    assert.equal(locked.json.error, 'premium_required')
    assert.deepEqual((await admin.get('/api/lessons/pp_premium/prayer-points')).json.prayerPoints, ['Ore em línguas'])

    // Linhas vazias são recusadas.
    const empty = await admin.put(`/api/admin/courses/${created.json.course.id}`, { ...course, prayerPoints: [''] })
    assert.equal(empty.status, 400)
    await admin.del(`/api/admin/courses/${created.json.course.id}`)
  })
})

describe('course access', () => {
  test('a free course opens every lesson; a paid course keeps only its sample lessons open', async () => {
    const admin = createClient(server.base)
    await admin.login(ADMIN.email, ADMIN.password)
    const course = {
      title: 'Curso de acesso',
      category: 'oracao',
      status: 'published',
      level: 'iniciante',
      instructor: 'Ana Yeshua',
      cover: '/brand/img/video-oracao.webp',
      description: '',
      featured: false,
      access: 'free',
      modules: [
        {
          id: 'acc-m1',
          title: 'Aulas',
          lessons: [
            { id: 'acc_l1', title: 'Aula 1', video: null, free: false, prayerPoints: ['Ore pela sua casa'] },
            { id: 'acc_l2', title: 'Aula 2', video: null, free: true, prayerPoints: ['Ore em línguas'] },
          ],
        },
      ],
    }
    const created = await admin.post('/api/admin/courses', course)
    assert.equal(created.status, 201)
    assert.equal(created.json.course.access, 'free')
    const id = created.json.course.id

    const premiumFlags = async () => {
      const catalog = await createClient(server.base).get('/api/catalog')
      const series = catalog.json.series.find((item: { id: string }) => item.id === id)
      return { access: series.access, lessons: Object.fromEntries(series.lessons.map((l: { id: string; premium: boolean }) => [l.id, l.premium])) }
    }
    assert.deepEqual(await premiumFlags(), { access: 'free', lessons: { acc_l1: false, acc_l2: false } })

    const member = createClient(server.base)
    await member.post('/api/auth/register', { name: 'Ana Acesso', email: 'acesso@example.com', password: 'password-123' })
    assert.equal((await member.get('/api/lessons/acc_l1/prayer-points')).status, 200)
    assert.equal((await member.post('/api/media-token', { videoId: 'acc_l1' })).status, 200)

    // Passa a pago: só a aula marcada como amostra fica aberta.
    assert.equal((await admin.put(`/api/admin/courses/${id}`, { ...course, access: 'premium' })).status, 200)
    assert.deepEqual(await premiumFlags(), { access: 'premium', lessons: { acc_l1: true, acc_l2: false } })
    assert.equal((await member.get('/api/lessons/acc_l1/prayer-points')).status, 403)
    assert.equal((await member.post('/api/media-token', { videoId: 'acc_l1' })).status, 403)
    assert.equal((await member.get('/api/lessons/acc_l2/prayer-points')).status, 200)

    // Sem o campo (cursos antigos), o curso conta como pago.
    const { access: _omit, ...legacy } = course
    assert.equal((await admin.put(`/api/admin/courses/${id}`, legacy)).json.course.access, 'premium')

    assert.equal((await admin.put(`/api/admin/courses/${id}`, { ...course, access: 'gratis' })).status, 400)
    await admin.del(`/api/admin/courses/${id}`)
  })
})

describe('covers', () => {
  test('an uploaded cover is served even when the data folder path has a dot folder', async () => {
    // Ex.: .claude/worktrees/… — antes, o Express recusava servir a capa.
    const dataDir = path.join(os.tmpdir(), `.ana-dot-${Date.now()}`, 'data')
    const dotted = await startTestServer({ config: { dataDir, uploadsDir: path.join(dataDir, 'uploads') } })
    try {
      const admin = createClient(dotted.base)
      await admin.login(ADMIN.email, ADMIN.password)
      const png = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex')
      const upload = await admin.raw('POST', '/api/admin/uploads/cover', undefined, { 'Content-Type': 'image/png' })
      assert.equal(upload.status, 400)
      const response = await fetch(`${dotted.base}/api/admin/uploads/cover`, {
        method: 'POST',
        headers: { 'Content-Type': 'image/png', 'X-Ana-Client': 'web', Cookie: admin.cookie() },
        body: png,
      })
      assert.equal(response.status, 201)
      const { url } = (await response.json()) as { url: string }
      const served = await fetch(dotted.base + url)
      assert.equal(served.status, 200)
      assert.equal(Buffer.from(await served.arrayBuffer()).equals(png), true)
    } finally {
      await dotted.close()
      fs.rmSync(path.dirname(dataDir), { recursive: true, force: true })
    }
  })
})

describe('media', () => {
  const courseId = 'PL9gyyXlYTfL1Sa_aax1clbXYWR9SOlbq6'
  const freeVideo = 'YSTQF4OBib8'
  const premiumVideo = 'ncts5aoifN0'

  test('free lessons stream with Range; premium lessons need a plan', async () => {
    fs.writeFileSync(path.join(server.videosDir, `${freeVideo}.mp4`), Buffer.alloc(4096, 1))
    const anonymous = createClient(server.base)
    assert.equal((await anonymous.post('/api/media-token', { videoId: freeVideo })).status, 401)

    const member = createClient(server.base)
    await member.post('/api/auth/register', { name: 'Leitora', email: 'leitora@example.com', password: 'password-123' })
    const token = await member.post('/api/media-token', { videoId: freeVideo })
    assert.equal(token.status, 200)

    const ranged = await fetch(`${server.base}/media/${freeVideo}?t=${encodeURIComponent(token.json.token)}`, {
      headers: { Range: 'bytes=0-1023' },
    })
    assert.equal(ranged.status, 206)
    assert.equal(ranged.headers.get('content-range'), 'bytes 0-1023/4096')
    await ranged.arrayBuffer()

    const tooFar = await fetch(`${server.base}/media/${freeVideo}?t=${encodeURIComponent(token.json.token)}`, {
      headers: { Range: 'bytes=9999-' },
    })
    assert.equal(tooFar.status, 416)

    assert.equal((await fetch(`${server.base}/media/${freeVideo}`)).status, 403)
    assert.equal((await member.post('/api/media-token', { videoId: premiumVideo })).status, 403)

    const catalog = await member.get('/api/catalog')
    const series = catalog.json.series.find((item: { id: string }) => item.id === courseId)
    assert.equal(series.lessons[0].available, true)
    assert.equal(series.lessons[1].premium, true)
  })
})
