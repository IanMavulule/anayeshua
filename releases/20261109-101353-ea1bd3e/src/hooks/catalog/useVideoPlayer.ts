import { useCallback, useEffect, useRef, useState } from 'react'
import type { CatalogLesson } from '../../types/api'
import { ApiError, api } from '../../utils/api/apiClient'

export type PlayResult = 'playing' | 'login_required' | 'premium_required' | 'unavailable' | 'error'

interface PlayOptions {
  poster: string
  title: string
  lesson: CatalogLesson
  autoplay: boolean
}

/** Aula aberta no leitor; cada sessão nova (aula, token renovado ou troca para MP4) remonta o leitor. */
export interface PlayerSession {
  key: number
  lesson: CatalogLesson
  poster: string
  title: string
  /** Token com que o leitor foi montado (o mais recente está em `getToken()`). */
  token: string
  /** `hls`: qualidade ajustada à rede (com escolha manual); `mp4`: o vídeo original. */
  mode: 'hls' | 'mp4'
  autoplay: boolean
  /** Segundo onde retomar depois de uma renovação. */
  resumeAt: number
}

/** Ponto da reprodução quando ocorreu a falha. */
export interface PlaybackPosition {
  time: number
  playing: boolean
}

const MAX_TOKEN_RENEWALS = 2
/** O token dura 5 minutos; é renovado antes de expirar (o hls.js usa sempre o mais recente). */
const TOKEN_REFRESH_MS = 4 * 60 * 1000

export const mediaUrl = (videoId: string, token: string, extension = '') =>
  `/media/${encodeURIComponent(videoId)}${extension}?t=${encodeURIComponent(token)}`

export const masterUrl = (videoId: string, token: string) => mediaUrl(videoId, token, '/hls/master.m3u8')

/** Troca o token de um endereço de média pelo actual. */
export const withToken = (url: string, token: string) =>
  url.replace(/([?&]t=)[^&#]*/, `$1${encodeURIComponent(token)}`)

async function requestToken(videoId: string): Promise<{ token: string } | PlayResult> {
  try {
    return await api.post<{ token: string }>('/api/media-token', { videoId })
  } catch (error) {
    if (!(error instanceof ApiError)) return 'error'
    if (error.status === 401) return 'login_required'
    if (error.status === 403) return 'premium_required'
    if (error.status === 404) return 'unavailable'
    return 'error'
  }
}

/**
 * Estado do leitor de aulas (o desenho fica em `LessonPlayer`). Pede o token de
 * média, escolhe HLS quando a aula já tem várias qualidades e, se a reprodução
 * falhar, renova o token e retoma no mesmo ponto; se o HLS voltar a falhar,
 * passa para o MP4 original.
 */
export function useVideoPlayer(onUnavailable: () => void) {
  const [session, setSession] = useState<PlayerSession | null>(null)
  const sessionRef = useRef<PlayerSession | null>(null)
  const keyRef = useRef(0)
  const requestIdRef = useRef(0)
  const renewalsRef = useRef(0)
  const busyRef = useRef(false)
  const tokenRef = useRef('')
  const onUnavailableRef = useRef(onUnavailable)

  useEffect(() => {
    onUnavailableRef.current = onUnavailable
  }, [onUnavailable])

  const show = useCallback((next: Omit<PlayerSession, 'key'> | null) => {
    const value = next ? { ...next, key: ++keyRef.current } : null
    sessionRef.current = value
    tokenRef.current = value?.token ?? ''
    setSession(value)
  }, [])

  const getToken = useCallback(() => tokenRef.current, [])

  const lessonId = session?.lesson.id
  useEffect(() => {
    if (!lessonId) return
    const timer = window.setInterval(() => {
      void requestToken(lessonId).then((result) => {
        if (typeof result !== 'string' && sessionRef.current?.lesson.id === lessonId) tokenRef.current = result.token
      })
    }, TOKEN_REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [lessonId])

  const release = useCallback(() => {
    requestIdRef.current++
    renewalsRef.current = 0
    show(null)
  }, [show])

  const play = useCallback(
    async (options: PlayOptions): Promise<PlayResult> => {
      const requestId = ++requestIdRef.current
      if (!options.lesson.available) return 'unavailable'
      const result = await requestToken(options.lesson.id)
      if (requestId !== requestIdRef.current) return 'error'
      if (typeof result === 'string') return result
      renewalsRef.current = 0
      show({
        lesson: options.lesson,
        poster: options.poster,
        title: options.title,
        token: result.token,
        mode: options.lesson.hls ? 'hls' : 'mp4',
        autoplay: options.autoplay,
        resumeAt: 0,
      })
      return 'playing'
    },
    [show],
  )

  /** Chamado pelo leitor quando a reprodução falha. */
  const handleFailure = useCallback(
    async (position: PlaybackPosition) => {
      const current = sessionRef.current
      if (!current || busyRef.current) return
      busyRef.current = true
      try {
        let mode = current.mode
        if (mode === 'hls') {
          // 1.ª falha: token novo e volta a tentar o HLS; 2.ª: passa para o MP4 original.
          if (renewalsRef.current >= 1) {
            mode = 'mp4'
            renewalsRef.current = 0
          }
        } else {
          // Confirma por HEAD se o erro foi de autorização ou de ficheiro em falta.
          const status = await fetch(mediaUrl(current.lesson.id, tokenRef.current), { method: 'HEAD' })
            .then((response) => response.status)
            .catch(() => 0)
          if (sessionRef.current !== current) return
          if (status === 404) return onUnavailableRef.current()
          if ((status !== 401 && status !== 403) || renewalsRef.current >= MAX_TOKEN_RENEWALS) return
        }
        renewalsRef.current++
        const result = await requestToken(current.lesson.id)
        if (sessionRef.current !== current) return
        if (typeof result === 'string') {
          if (result === 'unavailable') onUnavailableRef.current()
          return
        }
        show({ ...current, token: result.token, mode, autoplay: position.playing, resumeAt: position.time })
      } finally {
        busyRef.current = false
      }
    },
    [show],
  )

  useEffect(() => () => void (requestIdRef.current++), [])

  return { session, getToken, handleFailure, play, release }
}
