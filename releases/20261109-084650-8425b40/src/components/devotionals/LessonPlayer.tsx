import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { I18nProvider } from '@videojs/react/i18n'
import { HlsJsVideo } from '@videojs/react/media/hlsjs-video'
import { Video, VideoPlayer, VideoSkin, usePlayer } from '@videojs/react/video'
import '@videojs/react/video/skin.css'
import {
  masterUrl,
  mediaUrl,
  withToken,
  type PlaybackPosition,
  type PlayerSession,
} from '../../hooks/catalog/useVideoPlayer'

interface LessonPlayerProps {
  session: PlayerSession | null
  getToken: () => string
  onFailure: (position: PlaybackPosition) => void
}

/** Avisa a página quando o leitor regista um erro de reprodução (também os erros fatais do hls.js). */
function ErrorWatcher({ onError }: { onError: () => void }) {
  const error = usePlayer((state) => state.error)
  useEffect(() => {
    if (error) onError()
  }, [error, onError])
  return null
}

/**
 * Leitor de aulas Video.js 10 com o skin moderno: barra de progresso, ±10 s,
 * volume, legendas, menu de definições (qualidade com "Auto" ajustado à
 * internet, velocidade), PiP e ecrã inteiro. Nunca iframe; o vídeo vem do
 * nosso servidor com token de média de curta duração.
 */
export default function LessonPlayer({ session, getToken, onFailure }: LessonPlayerProps) {
  const { i18n } = useTranslation()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const locale = i18n.language?.startsWith('pt') ? 'pt-PT' : 'en'

  // Cada pedido do hls.js (listas e segmentos) leva o token mais recente.
  const xhrSetup = useMemo(
    () => (xhr: XMLHttpRequest, url: string) => xhr.open('GET', withToken(url, getToken()), true),
    [getToken],
  )

  const reportFailure = useMemo(
    () => () => {
      const video = videoRef.current
      onFailure({ time: video?.currentTime ?? session?.resumeAt ?? 0, playing: video ? !video.paused : false })
    },
    [onFailure, session],
  )

  // MP4: ao sair da aula corta logo o download.
  useEffect(() => {
    if (session?.mode !== 'mp4') return
    const video = videoRef.current
    return () => {
      if (!video) return
      try {
        video.pause()
        video.removeAttribute('src')
        video.load()
      } catch {
        /* ignora */
      }
    }
  }, [session])

  if (!session) return <div id="player-frame" className="player" />

  const onLoadedMetadata = (event: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = event.currentTarget
    try {
      if (session.resumeAt > 0) video.currentTime = session.resumeAt
    } catch {
      /* ignora */
    }
    if (session.autoplay) video.play()?.catch(() => {})
  }

  const captions = session.lesson.captions ? (
    <track kind="captions" srcLang="pt" label="Português" src={mediaUrl(session.lesson.id, session.token, '.vtt')} default />
  ) : null

  const common = {
    ref: videoRef,
    playsInline: true,
    preload: 'metadata' as const,
    onLoadedMetadata,
  }

  return (
    <div id="player-frame" className="player" data-mode={session.mode}>
      <I18nProvider locale={locale}>
        <VideoPlayer key={session.key} poster={session.poster || undefined} title={session.title}>
          <VideoSkin className="player__skin">
            {session.mode === 'hls' ? (
              <HlsJsVideo
                {...common}
                source={{
                  src: masterUrl(session.lesson.id, session.token),
                  type: 'application/vnd.apple.mpegurl',
                  capRenditionToPlayerSize: true,
                  engine: { hlsJs: { xhrSetup } },
                }}
              >
                {captions}
              </HlsJsVideo>
            ) : (
              <Video {...common} src={mediaUrl(session.lesson.id, session.token)}>
                {captions}
              </Video>
            )}
          </VideoSkin>
          <ErrorWatcher onError={reportFailure} />
        </VideoPlayer>
      </I18nProvider>
    </div>
  )
}
