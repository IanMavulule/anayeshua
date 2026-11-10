import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import type { Database } from '../../models/store/database.ts'
import { QUALITIES, type Rendition, type RenditionQuality } from '../../models/repositories/videoRenditionRepository.ts'
import { isValidId } from '../../utils/ids.ts'
import type { HlsTarget, Transcoder, TranscoderCheck } from './transcoder.ts'

/** Pasta das versões HLS: videos/hls/<lessonId>/{master.m3u8, 360p/, 480p/, 720p/}. */
export const HLS_DIR = 'hls'
export const MASTER_PLAYLIST = 'master.m3u8'

export const hlsLessonDir = (videosDir: string, lessonId: string) => path.join(videosDir, HLS_DIR, lessonId)

/** Identifica a versão do MP4 carregado (muda quando o vídeo é substituído). */
export function sourceVersion(file: string): string | null {
  try {
    const stats = fs.statSync(file)
    return stats.isFile() ? `${stats.size}-${Math.round(stats.mtimeMs)}` : null
  } catch {
    return null
  }
}

/** Dimensões da versão: o lado menor fica com a altura da qualidade, sem aumentar o original. */
export function targetSize(source: { width: number; height: number }, shortSide: number): { width: number; height: number } {
  const even = (value: number) => Math.max(2, Math.round(value / 2) * 2)
  const sourceShort = Math.min(source.width, source.height)
  const scale = Math.min(1, shortSide / sourceShort)
  return { width: even(source.width * scale), height: even(source.height * scale) }
}

export interface VideoProcessorOptions {
  db: Database
  videosDir: string
  transcoder: Transcoder
  log?: (message: string) => void
  /** Intervalo de verificação da fila. */
  pollMs?: number
  /** Espera antes de cada nova tentativa; depois da última, a tarefa fica `failed`. */
  retryDelaysMs?: number[]
}

export interface VideoProcessorStatus {
  transcoder: TranscoderCheck | null
  current: { lessonId: string; quality: RenditionQuality; startedAt: string; attempt: number } | null
}

/**
 * Converte os vídeos carregados em várias qualidades (HLS), uma tarefa de cada
 * vez e em segundo plano. O MP4 original continua disponível enquanto isso; o
 * leitor passa a usar o HLS quando a primeira qualidade fica pronta.
 *
 * O estado fica na base (`video_renditions`), por isso uma conversão
 * interrompida é retomada ao arrancar, e uma que falhe volta a ser tentada mais
 * tarde. Só depois da última tentativa a administração é avisada.
 */
export function createVideoProcessor(options: VideoProcessorOptions) {
  const { db, videosDir, transcoder } = options
  const log = options.log ?? (() => {})
  const pollMs = options.pollMs ?? 15_000
  const retryDelays = options.retryDelaysMs ?? [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000]

  let check: TranscoderCheck | null = null
  let timer: NodeJS.Timeout | null = null
  let running: Promise<void> | null = null
  let again = false
  let stopped = false
  let current: VideoProcessorStatus['current'] = null
  let abort: AbortController | null = null

  const sourceFile = (lessonId: string) => path.join(videosDir, `${lessonId}.mp4`)

  const report = (level: 'error' | 'warning', message: string, detail?: string) =>
    db.serverEvents.addUnlessOpen(level, 'vídeo', message, detail).catch((error) => log(`[vídeo] não foi possível registar: ${(error as Error).message}`))

  /** Reescreve a lista principal com as qualidades prontas (ou apaga-a se não houver). */
  async function writeMaster(lessonId: string): Promise<void> {
    const ready = (await db.renditions.forLesson(lessonId)).filter((item) => item.status === 'ready' && item.width && item.height)
    const dir = hlsLessonDir(videosDir, lessonId)
    const master = path.join(dir, MASTER_PLAYLIST)
    const present = ready.filter((item) => fs.existsSync(path.join(dir, item.quality, 'index.m3u8')))
    if (!present.length) {
      fs.rmSync(master, { force: true })
      return
    }
    const lines = ['#EXTM3U', '#EXT-X-VERSION:3']
    for (const item of present) {
      lines.push(`#EXT-X-STREAM-INF:BANDWIDTH=${item.bandwidth},RESOLUTION=${item.width}x${item.height},NAME="${item.quality}"`)
      lines.push(`${item.quality}/index.m3u8`)
    }
    fs.mkdirSync(dir, { recursive: true })
    const temp = `${master}.${crypto.randomBytes(4).toString('hex')}.tmp`
    fs.writeFileSync(temp, lines.join('\n') + '\n')
    fs.renameSync(temp, master)
  }

  async function failOrRetry(item: Rendition, error: Error): Promise<void> {
    const message = error.message || String(error)
    // Interrompida porque o vídeo foi substituído: a nova versão já está na fila.
    if (sourceVersion(sourceFile(item.lessonId)) !== item.sourceVersion) return
    const delay = retryDelays[item.attempts - 1]
    if (delay !== undefined) {
      log(`[vídeo] ${item.lessonId} ${item.quality}: tentativa ${item.attempts} falhou; nova tentativa em ${Math.round(delay / 1000)} s`)
      await db.renditions.markFailed(item, message, new Date(Date.now() + delay))
      return
    }
    log(`[vídeo] ${item.lessonId} ${item.quality}: falhou depois de ${item.attempts} tentativas`)
    await db.renditions.markFailed(item, message, null)
    await report('error', `A conversão da aula ${item.lessonId} para ${item.quality} falhou depois de ${item.attempts} tentativas.`, message)
  }

  async function processOne(item: Rendition): Promise<void> {
    const source = sourceFile(item.lessonId)
    const version = sourceVersion(source)
    if (!version) {
      // O vídeo foi apagado: não há nada a converter nem a tentar de novo.
      await db.renditions.markFailed(item, 'O ficheiro MP4 original já não existe.', null)
      await report('warning', `O vídeo da aula ${item.lessonId} já não existe; a conversão para ${item.quality} foi cancelada.`)
      return
    }
    if (version !== item.sourceVersion) {
      // O ficheiro mudou sem passar pelo carregamento (ex.: copiado à mão): recomeça.
      await db.renditions.enqueue(item.lessonId, version)
      return
    }

    const profile = QUALITIES.find((entry) => entry.quality === item.quality)!
    const info = await transcoder.probe(source)
    const shortSide = Math.min(info.width, info.height)
    // Não se aumenta a resolução: só a qualidade mais baixa é sempre gerada.
    if (shortSide < profile.height && item.quality !== QUALITIES[0].quality) {
      await db.renditions.markSkipped(item)
      return
    }
    const size = targetSize(info, profile.height)
    const target: HlsTarget = { ...size, videoKbps: profile.videoKbps, audioKbps: profile.audioKbps }

    const lessonDir = hlsLessonDir(videosDir, item.lessonId)
    const finalDir = path.join(lessonDir, item.quality)
    const tempDir = path.join(lessonDir, `.tmp-${item.quality}-${crypto.randomBytes(4).toString('hex')}`)
    abort = new AbortController()
    try {
      await transcoder.toHls(source, tempDir, target, abort.signal)
      if (!fs.existsSync(path.join(tempDir, 'index.m3u8'))) throw new Error('A conversão terminou sem criar a lista index.m3u8.')
      // Se o vídeo foi substituído durante a conversão, o resultado é descartado.
      if (sourceVersion(source) !== item.sourceVersion) return
      fs.rmSync(finalDir, { recursive: true, force: true })
      fs.renameSync(tempDir, finalDir)
    } finally {
      abort = null
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
    const bandwidth = Math.round((profile.videoKbps + profile.audioKbps) * 1000 * 1.1)
    if (!(await db.renditions.markReady(item, { ...size, bandwidth }))) {
      fs.rmSync(finalDir, { recursive: true, force: true })
      return
    }
    await writeMaster(item.lessonId)
    log(`[vídeo] ${item.lessonId} ${item.quality} pronto (${size.width}x${size.height})`)
  }

  async function drain(): Promise<void> {
    do {
      again = false
      while (!stopped && check?.available) {
        const item = await db.renditions.claimNext()
        if (!item) break
        current = { lessonId: item.lessonId, quality: item.quality, startedAt: new Date().toISOString(), attempt: item.attempts }
        try {
          await processOne(item)
        } catch (error) {
          if (stopped) break
          await failOrRetry(item, error as Error).catch((inner) => log(`[vídeo] erro ao registar a falha: ${(inner as Error).message}`))
        } finally {
          current = null
        }
      }
    } while (again && !stopped)
  }

  /** Corre a fila agora (se já estiver a correr, volta a verificar no fim). */
  function kick(): Promise<void> {
    if (stopped) return Promise.resolve()
    if (running) {
      again = true
      return running
    }
    running = drain()
      .catch((error) => log(`[vídeo] erro na fila de conversão: ${(error as Error).message}`))
      .finally(() => {
        running = null
      })
    return running
  }

  /** Vídeos já carregados antes desta funcionalidade também são convertidos. */
  async function enqueueExisting(): Promise<number> {
    let files: string[] = []
    try {
      files = fs.readdirSync(videosDir)
    } catch {
      return 0
    }
    const known = await db.renditions.lessonIds()
    let added = 0
    for (const file of files) {
      if (!file.endsWith('.mp4')) continue
      const lessonId = file.slice(0, -4)
      if (!isValidId(lessonId) || known.has(lessonId)) continue
      const version = sourceVersion(path.join(videosDir, file))
      if (!version) continue
      await db.renditions.enqueue(lessonId, version)
      added++
    }
    return added
  }

  return {
    async start(): Promise<void> {
      stopped = false
      check = await transcoder.check()
      const resumed = await db.renditions.resetInterrupted()
      const added = await enqueueExisting()
      if (!check.available) {
        log(`[vídeo] conversão desligada: ${check.reason}`)
        await report('warning', 'A conversão dos vídeos em várias qualidades está desligada. Os vídeos continuam disponíveis no formato original.', check.reason)
      } else {
        log(`[vídeo] ffmpeg ${check.version}; ${resumed} retomada(s), ${added} vídeo(s) existente(s) na fila`)
      }
      timer = setInterval(() => void kick(), pollMs)
      timer.unref()
      void kick()
    },

    /** Chamado depois de um carregamento: apaga as versões antigas e recomeça a conversão. */
    async enqueue(lessonId: string): Promise<void> {
      const version = sourceVersion(sourceFile(lessonId))
      if (!version) return
      if (current?.lessonId === lessonId) abort?.abort()
      fs.rmSync(hlsLessonDir(videosDir, lessonId), { recursive: true, force: true })
      await db.renditions.enqueue(lessonId, version)
      void kick()
    },

    /** "Tentar de novo" para as qualidades falhadas de uma aula. */
    async retry(lessonId: string): Promise<number> {
      const count = await db.renditions.retryFailed(lessonId)
      if (count) void kick()
      return count
    },

    /** Volta a verificar o ffmpeg (ex.: depois de o instalar) sem reiniciar o servidor. */
    async recheck(): Promise<TranscoderCheck> {
      check = await transcoder.check()
      if (check.available) void kick()
      return check
    },

    status(): VideoProcessorStatus {
      return { transcoder: check, current }
    },

    /** Espera que a fila fique vazia (testes). */
    idle: () => kick(),

    async stop(): Promise<void> {
      stopped = true
      if (timer) clearInterval(timer)
      timer = null
      abort?.abort()
      await running
    },
  }
}

export type VideoProcessor = ReturnType<typeof createVideoProcessor>
