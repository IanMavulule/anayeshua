import fs from 'node:fs'
import path from 'node:path'
import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { createVideoProcessor, hlsLessonDir } from '../../server/services/video/videoProcessor.ts'
import { createFakeTranscoder } from './fakeTranscoder.ts'
import { ADMIN, createClient, FREE_LESSON, PREMIUM_LESSON, startTestServer, TEST_COURSE_ID } from './helpers.ts'

let server: Awaited<ReturnType<typeof startTestServer>>

before(async () => {
  server = await startTestServer()
})

after(async () => {
  await server.close()
})

function writeVideo(lessonId: string, bytes = 4096) {
  fs.writeFileSync(path.join(server.videosDir, `${lessonId}.mp4`), Buffer.alloc(bytes, 1))
}

function processor(fake: ReturnType<typeof createFakeTranscoder>) {
  // Esperas negativas: a nova tentativa fica logo disponível.
  return createVideoProcessor({ db: server.db, videosDir: server.videosDir, transcoder: fake.transcoder, retryDelaysMs: [-1000, -1000] })
}

describe('video conversion', () => {
  test('converts each quality without upscaling and writes the master playlist', async () => {
    const fake = createFakeTranscoder({ width: 854, height: 480 })
    const videos = processor(fake)
    writeVideo(FREE_LESSON)
    await videos.recheck()
    await videos.enqueue(FREE_LESSON)
    await videos.idle()
    await videos.stop()

    const rows = await server.db.renditions.forLesson(FREE_LESSON)
    assert.deepEqual(
      rows.map((row) => [row.quality, row.status]),
      [
        ['360p', 'ready'],
        ['480p', 'ready'],
        ['720p', 'skipped'],
      ],
    )
    assert.deepEqual(fake.calls.map((call) => `${call.width}x${call.height}`), ['640x360', '854x480'])
    const master = fs.readFileSync(path.join(hlsLessonDir(server.videosDir, FREE_LESSON), 'master.m3u8'), 'utf8')
    assert.match(master, /RESOLUTION=640x360/)
    assert.match(master, /480p\/index\.m3u8/)
    assert.doesNotMatch(master, /720p/)

    const catalog = await createClient(server.base).get('/api/catalog')
    const series = catalog.json.series.find((item: { id: string }) => item.id === TEST_COURSE_ID)
    assert.equal(series.lessons.find((lesson: { id: string }) => lesson.id === FREE_LESSON).hls, true)
  })

  test('retries failures and tells only the admin after the last attempt', async () => {
    const lessonId = '4vE9AWoXxBQ'
    const fake = createFakeTranscoder({ width: 640, height: 360, failures: 99 })
    const videos = processor(fake)
    writeVideo(lessonId)
    await videos.recheck()
    await videos.enqueue(lessonId)
    await videos.idle()

    const [low] = await server.db.renditions.forLesson(lessonId)
    assert.equal(low.status, 'failed')
    assert.equal(low.attempts, 3)
    const events = await server.db.serverEvents.list()
    assert.ok(events.some((event) => event.level === 'error' && event.message.includes(lessonId)))

    // "Tentar de novo" depois de corrigido.
    fake.setFailures(0)
    assert.ok((await videos.retry(lessonId)) >= 1)
    await videos.idle()
    await videos.stop()
    assert.equal((await server.db.renditions.forLesson(lessonId))[0].status, 'ready')
  })

  test('a replaced video restarts the conversion and drops the old version', async () => {
    const lessonId = 'G5u2zvd9fCk'
    const fake = createFakeTranscoder({ width: 640, height: 360 })
    const videos = processor(fake)
    writeVideo(lessonId, 1000)
    await videos.recheck()
    await videos.enqueue(lessonId)
    await videos.idle()
    const first = (await server.db.renditions.forLesson(lessonId))[0].sourceVersion

    writeVideo(lessonId, 2000)
    await videos.enqueue(lessonId)
    await videos.idle()
    await videos.stop()
    const [row] = await server.db.renditions.forLesson(lessonId)
    assert.notEqual(row.sourceVersion, first)
    assert.equal(row.status, 'ready')
    assert.ok(fs.existsSync(path.join(hlsLessonDir(server.videosDir, lessonId), '360p', 'index.m3u8')))
  })
})

describe('HLS delivery', () => {
  test('playlists carry the token and premium lessons stay closed', async () => {
    const member = createClient(server.base)
    const registered = await member.post('/api/auth/register', { name: 'Ouvinte', email: 'ouvinte@example.com', password: 'password-123' })
    assert.equal(registered.status, 201)
    const token = await member.post('/api/media-token', { videoId: FREE_LESSON })
    const t = encodeURIComponent(token.json.token)

    const master = await fetch(`${server.base}/media/${FREE_LESSON}/hls/master.m3u8?t=${t}`)
    assert.equal(master.status, 200)
    assert.match(master.headers.get('content-type') ?? '', /^application\/vnd\.apple\.mpegurl/)
    const masterText = await master.text()
    assert.ok(masterText.includes(`360p/index.m3u8?t=${t}`))

    const variant = await (await fetch(`${server.base}/media/${FREE_LESSON}/hls/360p/index.m3u8?t=${t}`)).text()
    assert.ok(variant.includes(`seg_0000.ts?t=${t}`))
    const segment = await fetch(`${server.base}/media/${FREE_LESSON}/hls/360p/seg_0000.ts?t=${t}`)
    assert.equal(segment.status, 200)
    assert.equal(segment.headers.get('content-type'), 'video/mp2t')
    await segment.arrayBuffer()

    // Sem token, com nomes inventados ou noutra pasta: recusado.
    assert.equal((await fetch(`${server.base}/media/${FREE_LESSON}/hls/master.m3u8`)).status, 403)
    assert.equal((await fetch(`${server.base}/media/${FREE_LESSON}/hls/1080p/index.m3u8?t=${t}`)).status, 404)
    assert.equal((await fetch(`${server.base}/media/${FREE_LESSON}/hls/360p/..%2F..%2Fsecret.ts?t=${t}`)).status, 404)

    // Um token de uma aula Premium (sem plano) não abre os segmentos.
    const user = (await server.db.users.all()).find((item) => item.email === 'ouvinte@example.com')!
    const forged = server.context.tokens.createMediaToken(PREMIUM_LESSON, user.id)
    const premium = await fetch(`${server.base}/media/${PREMIUM_LESSON}/hls/master.m3u8?t=${encodeURIComponent(forged.token)}`)
    assert.equal(premium.status, 403)
  })
})

describe('admin server panel', () => {
  test('only admins see system status and can resolve events', async () => {
    const member = createClient(server.base)
    await member.post('/api/auth/register', { name: 'Curiosa', email: 'curiosa@example.com', password: 'password-123' })
    assert.equal((await member.get('/api/admin/system')).status, 403)

    const admin = createClient(server.base)
    assert.equal((await admin.login(ADMIN.email, ADMIN.password)).status, 200)
    const overview = await admin.get('/api/admin/system')
    assert.equal(overview.status, 200)
    assert.ok(overview.json.system.cpu.cores >= 1)
    assert.ok(overview.json.storage.videosOriginal > 0)
    assert.equal(overview.json.videos.transcoder.available, false)
    assert.ok(overview.json.openErrors >= 1)

    const events = await admin.get('/api/admin/system/events')
    const open = events.json.events.find((event: { level: string }) => event.level === 'error')
    assert.equal((await admin.post(`/api/admin/system/events/${open.id}/resolve`)).status, 200)
    assert.equal((await admin.post(`/api/admin/system/events/${open.id}/resolve`)).status, 404)
    assert.equal((await admin.post('/api/admin/system/events/resolve-all')).status, 200)
    assert.equal((await admin.get('/api/admin/system')).json.openErrors, 0)
    assert.equal((await admin.post('/api/admin/system/videos/recheck')).json.transcoder.available, false)
  })
})
