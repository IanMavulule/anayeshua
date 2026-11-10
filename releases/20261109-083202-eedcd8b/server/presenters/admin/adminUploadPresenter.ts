import fs from 'node:fs'
import path from 'node:path'
import type { NextFunction, Request, Response } from 'express'
import type { AppContext } from '../../context.ts'
import { HttpError, requireIdParam } from '../../middleware/errorMiddleware.ts'
import { coverExtension, saveCover } from '../../services/uploadService.ts'

export const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024

/** Upload de vídeos das aulas e de capas dos cursos. */
export function createAdminUploadPresenter({ config, videos, db }: AppContext) {
  return {
    /**
     * O corpo é o ficheiro MP4, gravado em streaming em videos/<lessonId>.mp4
     * (o id da aula é o id do vídeo no catálogo). Usa um ficheiro temporário
     * para que um envio interrompido nunca substitua o vídeo anterior.
     */
    video(request: Request, response: Response, next: NextFunction) {
      const lessonId = requireIdParam(request.params.lessonId)
      const declared = Number(request.headers['content-length'])
      if (Number.isFinite(declared) && declared > MAX_VIDEO_BYTES) throw new HttpError(413, 'file_too_large')
      fs.mkdirSync(config.videosDir, { recursive: true })
      const target = path.join(config.videosDir, `${lessonId}.mp4`)
      const temp = `${target}.uploading`
      const output = fs.createWriteStream(temp)
      let received = 0
      let failed = false
      const fail = (error: HttpError) => {
        if (failed) return
        failed = true
        output.destroy()
        fs.rm(temp, { force: true }, () => next(error))
      }
      request.on('data', (chunk: Buffer) => {
        received += chunk.length
        if (received > MAX_VIDEO_BYTES) {
          request.unpipe(output)
          fail(new HttpError(413, 'file_too_large'))
        }
      })
      request.on('aborted', () => fail(new HttpError(400, 'upload_aborted')))
      output.on('error', () => fail(new HttpError(500, 'write_failed')))
      output.on('finish', () => {
        if (failed) return
        fs.rename(temp, target, (error) => {
          if (error) return next(new HttpError(500, 'write_failed'))
          // O vídeo fica logo disponível em MP4; as qualidades são criadas em segundo plano.
          videos.enqueue(lessonId).catch((enqueueError: Error) =>
            db.serverEvents
              .add('error', 'vídeo', `Não foi possível pôr a aula ${lessonId} na fila de conversão.`, enqueueError.stack ?? enqueueError.message)
              .catch(() => {}),
          )
          response.status(201).json({ lessonId, size: received })
        })
      })
      request.pipe(output)
    },

    // O corpo (imagem) já chega como Buffer pelo parser `raw` da rota.
    cover(request: Request, response: Response) {
      const extension = coverExtension(request.headers['content-type'])
      if (!extension) throw new HttpError(415, 'unsupported_image')
      if (!Buffer.isBuffer(request.body) || request.body.length === 0) throw new HttpError(400, 'empty_file')
      response.status(201).json({ url: saveCover(config.uploadsDir, request.body, extension) })
    },
  }
}
