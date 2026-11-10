import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

export const COVERS_URL_PREFIX = '/uploads/covers/'
export const MAX_COVER_BYTES = 4 * 1024 * 1024

const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
}

export function coverExtension(contentType: string | undefined): string | null {
  return IMAGE_TYPES[String(contentType || '').split(';')[0].trim().toLowerCase()] ?? null
}

/** Guarda uma capa e devolve o URL público. */
export function saveCover(uploadsDir: string, data: Buffer, extension: string): string {
  const dir = path.join(uploadsDir, 'covers')
  fs.mkdirSync(dir, { recursive: true })
  const name = `${Date.now().toString(36)}-${crypto.randomBytes(6).toString('hex')}${extension}`
  fs.writeFileSync(path.join(dir, name), data)
  return `${COVERS_URL_PREFIX}${name}`
}

/** Resolve um nome de capa pedido por URL, sem permitir sair da pasta. */
export function resolveCoverPath(uploadsDir: string, name: string): string | null {
  if (!/^[a-z0-9-]+\.(jpg|png|webp)$/i.test(name)) return null
  return path.join(uploadsDir, 'covers', name)
}
