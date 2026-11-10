/** Respostas de /api/admin/system (painel Servidor). */

export type TranscoderCheck = { available: true; version: string } | { available: false; reason: string }

export type RenditionQuality = '360p' | '480p' | '720p'
export type RenditionStatus = 'pending' | 'processing' | 'ready' | 'failed' | 'skipped'

export interface CpuSample {
  at: string
  system: number
  process: number
}

export interface VideoJob {
  lessonId: string
  lessonTitle: string | null
  courseTitle: string | null
  quality: RenditionQuality
  status: RenditionStatus
  attempts: number
  lastError: string | null
  nextAttemptAt: string
  updatedAt: string
}

export interface SystemOverview {
  system: {
    cpu: { cores: number; model: string; current: CpuSample | null; history: CpuSample[] }
    memory: { total: number; free: number; process: number }
    uptime: { process: number; system: number }
    platform: string
    node: string
  }
  storage: {
    disk: { total: number; free: number; used: number } | null
    videosOriginal: number
    videosHls: number
    uploads: number
    database: number | null
    measuredAt: string
  }
  videos: {
    transcoder: TranscoderCheck | null
    current: { lessonId: string; quality: RenditionQuality; startedAt: string; attempt: number } | null
    counts: Record<RenditionStatus, number>
    jobs: VideoJob[]
  }
  openErrors: number
}

export interface ServerEvent {
  id: string
  createdAt: string
  level: 'error' | 'warning' | 'info'
  source: string
  message: string
  detail: string | null
  resolvedAt: string | null
}
