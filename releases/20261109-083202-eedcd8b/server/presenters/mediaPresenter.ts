import fs from 'node:fs'
import path from 'node:path'
import type { Request, Response } from 'express'
import type { AppContext } from '../context.ts'
import { HttpError, parseBody } from '../middleware/errorMiddleware.ts'
import { hasActiveSubscription } from '../models/userModel.ts'
import { mediaTokenSchema } from '../schemas/communitySchemas.ts'
import { serveMedia } from '../services/mediaService.ts'
import { resolveCoverPath } from '../services/uploadService.ts'
import { hlsLessonDir, MASTER_PLAYLIST } from '../services/video/videoProcessor.ts'
import { isValidId } from '../utils/ids.ts'

const HLS_QUALITY = /^(360p|480p|720p)$/
const HLS_SEGMENT = /^seg_\d{4,6}\.ts$/

/** Tokens de média, entrega de vídeos por Range e capas carregadas. */
export function createMediaPresenter({ catalog, tokens, db, config }: AppContext) {
  /** Valida o token e volta a confirmar o utilizador e o acesso Premium actuais. */
  async function authorize(request: Request, id: string) {
    const token = tokens.readMediaToken(request.query.t)
    if (!token) throw new HttpError(403, 'invalid_token')
    if (!isValidId(id)) throw new HttpError(404, 'video_not_found')
    if (token.v !== id) throw new HttpError(403, 'token_mismatch')

    // O token identifica o utilizador; voltamos a verificar o estado actual dele.
    const user = await db.users.get(token.uid)
    if (!user || user.status !== 'active') throw new HttpError(403, 'invalid_token')
    const video = await catalog.findVideo(id, { includeHidden: user.role === 'admin' })
    if (!video) throw new HttpError(404, 'video_not_found')
    if (video.premium && !hasActiveSubscription(user)) throw new HttpError(403, 'premium_required')
    return video
  }

  return {
    async createToken(request: Request, response: Response) {
      const { videoId } = parseBody(mediaTokenSchema, request.body)
      const user = request.user!
      const video = await catalog.findVideo(videoId, { includeHidden: user.role === 'admin' })
      if (!video) throw new HttpError(404, 'video_not_found')
      if (video.premium && !hasActiveSubscription(user)) throw new HttpError(403, 'premium_required')
      response.json(tokens.createMediaToken(video.id, user.id))
    },

    async serveVideo(request: Request, response: Response) {
      const raw = String(request.params.videoId || '')
      const captions = raw.endsWith('.vtt')
      const video = await authorize(request, captions ? raw.slice(0, -4) : raw)
      // O caminho é sempre reconstruído a partir do id validado.
      const filePath = path.join(config.videosDir, `${video.id}${captions ? '.vtt' : '.mp4'}`)
      serveMedia(request, response, filePath, captions ? 'text/vtt' : 'video/mp4')
    },

    /**
     * Versões HLS: /media/:videoId/hls/master.m3u8, /hls/:quality/index.m3u8 e
     * /hls/:quality/seg_NNNN.ts. Cada pedido é autorizado como o MP4. As listas
     * são reescritas para cada endereço levar o token (os endereços relativos
     * do HLS não herdam o `?t=`).
     */
    async serveHls(request: Request, response: Response) {
      const quality = request.params.quality ? String(request.params.quality) : null
      const file = String(request.params.file || '')
      if (quality !== null && !HLS_QUALITY.test(quality)) throw new HttpError(404, 'not_found')
      const playlist = quality === null ? file === MASTER_PLAYLIST : file === 'index.m3u8'
      const segment = quality !== null && HLS_SEGMENT.test(file)
      if (!playlist && !segment) throw new HttpError(404, 'not_found')

      const video = await authorize(request, String(request.params.videoId || ''))
      const dir = quality === null ? hlsLessonDir(config.videosDir, video.id) : path.join(hlsLessonDir(config.videosDir, video.id), quality)
      const filePath = path.join(dir, file)
      if (segment) {
        serveMedia(request, response, filePath, 'video/mp2t')
        return
      }
      let text: string
      try {
        text = await fs.promises.readFile(filePath, 'utf8')
      } catch {
        throw new HttpError(404, 'video_not_found')
      }
      const token = encodeURIComponent(String(request.query.t))
      const rewritten = text
        .split(/\r?\n/)
        .map((line) => (line && !line.startsWith('#') ? `${line}?t=${token}` : line))
        .join('\n')
      response.setHeader('Content-Type', 'application/vnd.apple.mpegurl')
      response.setHeader('Cache-Control', 'private, no-store')
      response.send(request.method === 'HEAD' ? undefined : rewritten)
    },

    methodNotAllowed(_request: Request, response: Response) {
      response.setHeader('Allow', 'GET, HEAD')
      response.status(405).json({ error: 'method_not_allowed' })
    },

    serveCover(request: Request, response: Response) {
      const file = resolveCoverPath(config.uploadsDir, String(request.params.name))
      if (!file || !fs.existsSync(file)) throw new HttpError(404, 'not_found')
      response.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
      // Com `root`, o Express só verifica o nome do ficheiro. Com o caminho
      // completo recusava pastas que começam por ponto (ex.: .claude/…) e a capa
      // carregada não aparecia.
      response.sendFile(path.basename(file), { root: path.dirname(file) })
    },
  }
}
