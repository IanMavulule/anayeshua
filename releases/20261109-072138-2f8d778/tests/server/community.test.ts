import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { ADMIN, createClient, startTestServer } from './helpers.ts'

let server: Awaited<ReturnType<typeof startTestServer>>
const courseId = 'PL9gyyXlYTfL1Sa_aax1clbXYWR9SOlbq6'
const lessonId = 'YSTQF4OBib8'

before(async () => {
  server = await startTestServer()
})

after(async () => {
  await server.close()
})

describe('testimonies', () => {
  test('are moderated before becoming public', async () => {
    const member = createClient(server.base)
    await member.post('/api/auth/register', { name: 'Rute', email: 'rute@example.com', password: 'password-123' })
    const created = await member.post('/api/testimonies', { courseId, lessonId, text: 'Fui muito abençoada.' })
    assert.equal(created.status, 201)
    assert.equal(created.json.testimony.status, 'pending')
    assert.equal(created.json.testimony.name, 'Rute')

    const query = `/api/testimonies?courseId=${courseId}&lessonId=${lessonId}`
    assert.equal((await createClient(server.base).get(query)).json.testimonies.length, 0)
    assert.equal((await member.get(query)).json.testimonies.length, 1, 'the author sees their own pending testimony')

    const admin = createClient(server.base)
    await admin.login(ADMIN.email, ADMIN.password)
    await admin.patch(`/api/admin/testimonies/${created.json.testimony.id}`, { status: 'published' })
    assert.equal((await createClient(server.base).get(query)).json.testimonies.length, 1)

    const wrongLesson = await member.post('/api/testimonies', { courseId, lessonId: 'nope', text: 'Olá mundo' })
    assert.equal(wrongLesson.status, 404)
  })
})

describe('daily content', () => {
  test('daily message prefers the requested language and hides premium bodies', async () => {
    const admin = createClient(server.base)
    await admin.login(ADMIN.email, ADMIN.password)
    const yesterday = new Date(Date.now() - 86400000).toISOString()
    const tomorrow = new Date(Date.now() + 86400000).toISOString()
    const base = { type: 'daily-message', status: 'published', premium: false }
    await admin.post('/api/admin/posts', { ...base, title: 'Mensagem', body: 'Texto PT', language: 'pt', publishAt: yesterday })
    await admin.post('/api/admin/posts', { ...base, title: 'Message', body: 'EN text', language: 'en', publishAt: yesterday })
    await admin.post('/api/admin/posts', { ...base, title: 'Futuro', body: 'Ainda não', language: 'pt', publishAt: tomorrow })
    await admin.post('/api/admin/posts', {
      ...base,
      type: 'note',
      premium: true,
      title: 'Anotação',
      body: 'Só Premium',
      language: 'pt',
      publishAt: yesterday,
    })
    assert.equal((await admin.post('/api/admin/posts', { ...base, title: 'x', body: 'y', language: 'pt', publishAt: 'not-a-date' })).status, 400)

    const visitor = createClient(server.base)
    assert.equal((await visitor.get('/api/posts/today?language=en')).json.post.body, 'EN text')
    assert.equal((await visitor.get('/api/posts/today?language=pt')).json.post.body, 'Texto PT')
    const notes = (await visitor.get('/api/posts?type=note')).json.posts
    assert.equal(notes[0].locked, true)
    assert.equal(notes[0].body, '')
  })
})

describe('questions and feedback', () => {
  test('members ask questions and the admin answers them', async () => {
    const member = createClient(server.base)
    await member.post('/api/auth/register', { name: 'Sara', email: 'sara@example.com', password: 'password-123' })
    const asked = await member.post('/api/questions', { courseId, lessonId, body: 'Como devo orar de madrugada?' })
    assert.equal(asked.status, 201)
    // Fica ligada à aula, com os títulos do momento; o assunto por omissão é o título da aula.
    assert.equal(asked.json.question.lessonId, lessonId)
    assert.equal(asked.json.question.courseId, courseId)
    assert.ok(asked.json.question.courseTitle)
    assert.equal(asked.json.question.subject, asked.json.question.lessonTitle)

    const admin = createClient(server.base)
    await admin.login(ADMIN.email, ADMIN.password)
    const answered = await admin.put(`/api/admin/questions/${asked.json.question.id}/answer`, { answer: 'Com perseverança.' })
    assert.equal(answered.json.question.status, 'answered')

    const mine = await member.get('/api/questions/mine')
    assert.equal(mine.json.questions[0].answer, 'Com perseverança.')

    assert.equal((await member.post('/api/feedback', { rating: 5, comment: 'Óptimo' })).status, 403)
  })

  test('questions belong to a lesson: wrong lesson, Premium lesson and filtering', async () => {
    const member = createClient(server.base)
    await member.post('/api/auth/register', { name: 'Débora', email: 'debora@example.com', password: 'password-123' })

    // Sem aula, ou com uma aula de outro curso, a dúvida é recusada.
    assert.equal((await member.post('/api/questions', { subject: 'Geral', body: 'Uma dúvida geral' })).status, 400)
    const wrong = await member.post('/api/questions', { courseId, lessonId: 'nope', body: 'Sobre esta aula' })
    assert.equal(wrong.status, 404)
    assert.equal(wrong.json.error, 'lesson_not_found')

    // Numa aula Premium só pergunta quem tem acesso.
    const premiumLesson = await member.post('/api/questions', { courseId, lessonId: 'ncts5aoifN0', body: 'Sobre a vigília' })
    assert.equal(premiumLesson.status, 403)
    assert.equal(premiumLesson.json.error, 'premium_required')

    assert.equal((await member.post('/api/questions', { courseId, lessonId, body: 'Sobre o primeiro dia' })).status, 201)
    const forLesson = await member.get(`/api/questions/mine?lessonId=${lessonId}`)
    assert.equal(forLesson.json.questions.length, 1)
    assert.equal((await member.get('/api/questions/mine?lessonId=G5u2zvd9fCk')).json.questions.length, 0)
  })

  test('assistance feedback is only for members on the 500 MT plan', async () => {
    const { db } = server.context
    const member = createClient(server.base)
    await member.post('/api/auth/register', { name: 'Ester', email: 'ester@example.com', password: 'password-123' })
    const user = (await db.users.find((item) => item.email === 'ester@example.com'))!
    const future = new Date(Date.now() + 30 * 86400000).toISOString()

    await db.users.update(user.id, (current) => ({
      ...current,
      subscription: { plan: '200', startedAt: new Date().toISOString(), expiresAt: future, paymentId: null, assistanceExpiresAt: null },
    }))
    const monthly = await member.get('/api/auth/session')
    assert.equal(monthly.json.user.premium, true)
    assert.equal(monthly.json.user.assistance, false)
    const refused = await member.post('/api/feedback', { rating: 5, comment: 'Óptimo' })
    assert.equal(refused.status, 403)
    assert.equal(refused.json.error, 'assistance_required')

    await db.users.update(user.id, (current) => ({
      ...current,
      subscription: { ...current.subscription!, plan: '500', assistanceExpiresAt: future },
    }))
    assert.equal((await member.get('/api/auth/session')).json.user.assistance, true)
    assert.equal((await member.post('/api/feedback', { rating: 5, comment: 'Óptimo' })).status, 201)
  })
})
