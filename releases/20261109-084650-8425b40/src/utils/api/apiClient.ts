/**
 * Cliente HTTP da API. Envia sempre o cabeçalho `X-Ana-Client` (protecção
 * CSRF do servidor) e transforma respostas de erro em `ApiError` com o
 * `code` estável devolvido pelo servidor.
 */
export class ApiError extends Error {
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

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

interface RequestOptions {
  body?: unknown
  raw?: Blob | File
  signal?: AbortSignal
}

async function request<T>(method: Method, url: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { 'X-Ana-Client': 'web', Accept: 'application/json' }
  let body: BodyInit | undefined
  if (options.raw) {
    headers['Content-Type'] = options.raw.type || 'application/octet-stream'
    body = options.raw
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(options.body)
  }
  let response: Response
  try {
    response = await fetch(url, { method, headers, body, credentials: 'same-origin', signal: options.signal })
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') throw error
    throw new ApiError(0, 'network_error')
  }
  if (response.status === 204) return undefined as T
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new ApiError(response.status, payload?.error ?? 'unknown_error', payload?.details)
  }
  return payload as T
}

export const api = {
  get: <T>(url: string, signal?: AbortSignal) => request<T>('GET', url, { signal }),
  post: <T>(url: string, body?: unknown) => request<T>('POST', url, { body: body ?? {} }),
  put: <T>(url: string, body?: unknown) => request<T>('PUT', url, { body: body ?? {} }),
  patch: <T>(url: string, body?: unknown) => request<T>('PATCH', url, { body: body ?? {} }),
  del: <T = void>(url: string) => request<T>('DELETE', url),
  upload: <T>(method: 'POST' | 'PUT', url: string, file: Blob | File) => request<T>(method, url, { raw: file }),
}

/**
 * Upload com progresso (XMLHttpRequest), usado para vídeos grandes.
 * Devolve a resposta JSON do servidor.
 */
export function uploadWithProgress<T>(url: string, file: File, onProgress: (percent: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('X-Ana-Client', 'web')
    xhr.setRequestHeader('Content-Type', file.type || 'video/mp4')
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100))
    }
    xhr.onload = () => {
      let payload: { error?: string } | null = null
      try {
        payload = JSON.parse(xhr.responseText)
      } catch {
        payload = null
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(payload as T)
      else reject(new ApiError(xhr.status, payload?.error ?? 'upload_failed'))
    }
    xhr.onerror = () => reject(new ApiError(0, 'network_error'))
    xhr.send(file)
  })
}
