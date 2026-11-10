import fs from 'node:fs'
import type { Request, Response } from 'express'

interface ByteRange {
  start: number
  end: number
}

const RANGE_PATTERN = /^bytes=(\d*)-(\d*)$/

// Interpreta cabeçalhos `bytes=start-end`, `bytes=start-` e `bytes=-suffix`.
// Devolve { start, end } válidos ou null (sintaxe inválida / insatisfazível).
function parseRange(header: unknown, size: number): ByteRange | null {
  const match = RANGE_PATTERN.exec(String(header).trim())
  if (!match) return null
  const startText = match[1]
  const endText = match[2]
  if (startText === '' && endText === '') return null

  let start: number
  let end: number
  if (startText === '') {
    const suffix = Number(endText)
    if (!Number.isFinite(suffix) || suffix <= 0) return null
    start = Math.max(size - suffix, 0)
    end = size - 1
  } else {
    start = Number(startText)
    end = endText === '' ? size - 1 : Number(endText)
    if (!Number.isFinite(start) || !Number.isFinite(end)) return null
    if (end >= size) end = size - 1
    if (start < 0 || start > end || start >= size) return null
  }
  if (end < start) return null
  return { start, end }
}

function streamRange(
  request: Request,
  response: Response,
  status: number,
  filePath: string,
  start: number,
  end: number
): void {
  const stream = fs.createReadStream(filePath, { start, end })
  const abort = () => stream.destroy()
  request.on('close', abort)
  response.on('close', abort)
  stream.on('error', () => {
    if (!response.headersSent) response.status(500).json({ error: 'stream_error' })
    else response.destroy()
  })
  response.status(status)
  stream.pipe(response)
}

// Entrega um ficheiro de vídeo/legendas por HTTP Range, sem bufferizar o conteúdo.
export function serveMedia(
  request: Request,
  response: Response,
  filePath: string,
  contentType: string
): void {
  let stats: fs.Stats
  try {
    stats = fs.statSync(filePath)
  } catch {
    response.status(404).json({ error: 'media_not_found' })
    return
  }
  if (!stats.isFile()) {
    response.status(404).json({ error: 'media_not_found' })
    return
  }

  const size = stats.size
  const etag = `"${size}-${Math.round(stats.mtimeMs)}"`
  const lastModified = stats.mtime.toUTCString()

  response.setHeader('Accept-Ranges', 'bytes')
  response.setHeader('Content-Type', contentType)
  response.setHeader('Cache-Control', 'private, no-store')
  response.setHeader('ETag', etag)
  response.setHeader('Last-Modified', lastModified)

  const rangeHeader = request.headers.range
  const ifRange = request.headers['if-range']
  const rangeUsable = !ifRange || ifRange === etag || ifRange === lastModified

  if (!rangeHeader || !rangeUsable) {
    response.setHeader('Content-Length', String(size))
    if (request.method === 'HEAD') {
      response.status(200).end()
      return
    }
    streamRange(request, response, 200, filePath, 0, size - 1)
    return
  }

  const range = parseRange(rangeHeader, size)
  if (!range) {
    response.setHeader('Content-Range', `bytes */${size}`)
    response.status(416).end()
    return
  }

  const { start, end } = range
  response.setHeader('Content-Range', `bytes ${start}-${end}/${size}`)
  response.setHeader('Content-Length', String(end - start + 1))
  if (request.method === 'HEAD') {
    response.status(206).end()
    return
  }
  streamRange(request, response, 206, filePath, start, end)
}
