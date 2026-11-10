import type { NextFunction, Request, Response } from 'express'
import { ZodError, type ZodTypeAny, type z } from 'zod'

/** Erro com estado HTTP e código estável que a UI traduz. */
export class HttpError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: unknown

  constructor(status: number, code: string, details?: unknown) {
    super(code)
    this.status = status
    this.code = code
    this.details = details
  }
}

/** Valida o corpo do pedido com um schema zod; devolve 400 com os campos inválidos. */
export function parseBody<T extends ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  try {
    return schema.parse(body ?? {})
  } catch (error) {
    if (error instanceof ZodError) {
      throw new HttpError(400, 'invalid_body', error.issues.map((issue) => issue.path.join('.')))
    }
    throw error
  }
}

export function notFound(_request: Request, response: Response): void {
  response.status(404).json({ error: 'not_found' })
}

// Respostas sempre em JSON, sem expor stack traces.
export function errorHandler(error: unknown, _request: Request, response: Response, _next: NextFunction): void {
  if (response.headersSent) return
  if (error instanceof HttpError) {
    response.status(error.status).json({ error: error.code, details: error.details })
    return
  }
  let status = 500
  if (error && typeof error === 'object' && 'status' in error) {
    const value = (error as { status?: unknown }).status
    if (typeof value === 'number' && value >= 400 && value < 600) status = value
  }
  if (status >= 500) console.error('[anaYeshua] erro interno:', error)
  response.status(status).json({ error: status >= 500 ? 'internal_error' : 'bad_request' })
}

/** Valida um id vindo do URL (só [A-Za-z0-9_-]). */
export function requireIdParam(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(value)) throw new HttpError(400, 'invalid_id')
  return value
}
