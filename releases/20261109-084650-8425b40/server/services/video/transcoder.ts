import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export interface SourceInfo {
  /** Dimensões como são mostradas (já com a rotação dos vídeos de telemóvel). */
  width: number
  height: number
}

export interface HlsTarget {
  width: number
  height: number
  videoKbps: number
  audioKbps: number
}

export type TranscoderCheck = { available: true; version: string } | { available: false; reason: string }

/** Converte vídeos; o ffmpeg na aplicação e uma versão falsa nos testes. */
export interface Transcoder {
  check(): Promise<TranscoderCheck>
  probe(input: string): Promise<SourceInfo>
  /** Escreve `index.m3u8` e os segmentos em `outDir`. Aborta com `signal`. */
  toHls(input: string, outDir: string, target: HlsTarget, signal: AbortSignal): Promise<void>
}

/** Limite de tempo por conversão (vídeos até ~10 min convertem em poucos minutos). */
const CONVERSION_TIMEOUT_MS = 60 * 60 * 1000

interface RunResult {
  code: number | null
  stdout: string
  stderr: string
}

function run(command: string, args: string[], options: { signal?: AbortSignal; timeoutMs?: number; lowPriority?: boolean } = {}) {
  return new Promise<RunResult>((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
      if (stdout.length > 1_000_000) stdout = stdout.slice(-1_000_000)
    })
    // Guarda só o fim do stderr do ffmpeg (é onde está a causa do erro).
    child.stderr.on('data', (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-8000)
    })
    if (options.lowPriority && child.pid) {
      try {
        // A conversão não deve deixar o site lento para os membros.
        os.setPriority(child.pid, os.constants.priority.PRIORITY_BELOW_NORMAL)
      } catch {
        /* sem permissão: continua com a prioridade normal */
      }
    }
    const kill = () => child.kill('SIGKILL')
    const timer = options.timeoutMs ? setTimeout(kill, options.timeoutMs) : null
    options.signal?.addEventListener('abort', kill, { once: true })
    child.on('error', (error) => {
      if (timer) clearTimeout(timer)
      reject(error)
    })
    child.on('close', (code) => {
      if (timer) clearTimeout(timer)
      options.signal?.removeEventListener('abort', kill)
      resolve({ code, stdout, stderr })
    })
  })
}

const lastLines = (text: string, count = 6) =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-count)
    .join('\n')

/** ffmpeg/ffprobe instalados no servidor (FFMPEG_PATH / FFPROBE_PATH, ou no PATH). */
export function createFfmpegTranscoder(ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg', ffprobe = process.env.FFPROBE_PATH || 'ffprobe'): Transcoder {
  return {
    async check() {
      try {
        const [main, probe] = await Promise.all([run(ffmpeg, ['-hide_banner', '-version']), run(ffprobe, ['-hide_banner', '-version'])])
        if (main.code !== 0) return { available: false, reason: `O ffmpeg terminou com o código ${main.code}.` }
        if (probe.code !== 0) return { available: false, reason: `O ffprobe terminou com o código ${probe.code}.` }
        const version = /ffmpeg version (\S+)/.exec(main.stdout)?.[1] ?? 'desconhecida'
        return { available: true, version }
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code
        return {
          available: false,
          reason:
            code === 'ENOENT'
              ? 'O ffmpeg não está instalado (ou não está no PATH). Instale-o ou defina FFMPEG_PATH e FFPROBE_PATH no .env.'
              : `Não foi possível executar o ffmpeg: ${(error as Error).message}`,
        }
      }
    },

    async probe(input) {
      const result = await run(ffprobe, [
        '-v', 'error',
        '-select_streams', 'v:0',
        // -show_streams (e não -show_entries com stream_side_data, que o ffmpeg 4.x não conhece)
        // devolve width/height, tags.rotate e side_data_list em todas as versões.
        '-show_streams',
        '-of', 'json',
        input,
      ])
      if (result.code !== 0) throw new Error(`O ffprobe não conseguiu ler o vídeo.\n${lastLines(result.stderr)}`)
      const stream = (JSON.parse(result.stdout || '{}').streams ?? [])[0]
      if (!stream?.width || !stream?.height) throw new Error('O ficheiro não tem uma faixa de vídeo válida.')
      const rotation = Number(stream.tags?.rotate ?? stream.side_data_list?.find((item: { rotation?: number }) => item.rotation !== undefined)?.rotation ?? 0)
      const sideways = Math.abs(rotation) % 180 === 90
      return sideways ? { width: stream.height, height: stream.width } : { width: stream.width, height: stream.height }
    },

    async toHls(input, outDir, target, signal) {
      fs.mkdirSync(outDir, { recursive: true })
      const gop = 48 // fotogramas-chave regulares: segmentos de ~6 s com cortes limpos
      const result = await run(
        ffmpeg,
        [
          '-hide_banner', '-nostdin', '-y',
          '-i', input,
          '-map', '0:v:0', '-map', '0:a:0?',
          '-vf', `scale=${target.width}:${target.height}`,
          '-c:v', 'libx264', '-preset', 'veryfast', '-profile:v', 'main', '-pix_fmt', 'yuv420p',
          '-crf', '23', '-maxrate', `${target.videoKbps}k`, '-bufsize', `${target.videoKbps * 2}k`,
          '-g', String(gop), '-keyint_min', String(gop), '-sc_threshold', '0',
          '-c:a', 'aac', '-b:a', `${target.audioKbps}k`, '-ac', '2',
          '-f', 'hls', '-hls_time', '6', '-hls_playlist_type', 'vod',
          '-hls_segment_filename', path.join(outDir, 'seg_%04d.ts'),
          path.join(outDir, 'index.m3u8'),
        ],
        { signal, timeoutMs: CONVERSION_TIMEOUT_MS, lowPriority: true },
      )
      if (signal.aborted) throw new Error('Conversão interrompida.')
      if (result.code !== 0) throw new Error(`O ffmpeg terminou com o código ${result.code}.\n${lastLines(result.stderr)}`)
    },
  }
}
