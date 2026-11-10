import fs from 'node:fs'
import path from 'node:path'
import type { Transcoder } from '../../server/services/video/transcoder.ts'

/** Conversor desligado (como um servidor sem ffmpeg): os testes normais não convertem nada. */
export function createDisabledTranscoder(): Transcoder {
  return {
    check: async () => ({ available: false, reason: 'Conversor desligado nos testes.' }),
    probe: async () => {
      throw new Error('Conversor desligado nos testes.')
    },
    toHls: async () => {
      throw new Error('Conversor desligado nos testes.')
    },
  }
}

/**
 * Conversor falso que escreve uma lista `index.m3u8` e um segmento fictício.
 * `failures` diz quantas conversões falham antes de começarem a resultar.
 */
export function createFakeTranscoder(options: { width?: number; height?: number; failures?: number } = {}) {
  const calls: { input: string; width: number; height: number }[] = []
  let failures = options.failures ?? 0
  const transcoder: Transcoder = {
    check: async () => ({ available: true, version: 'fake' }),
    probe: async () => ({ width: options.width ?? 1280, height: options.height ?? 720 }),
    toHls: async (input, outDir, target) => {
      calls.push({ input, width: target.width, height: target.height })
      if (failures > 0) {
        failures--
        throw new Error('Falha simulada do ffmpeg.')
      }
      fs.mkdirSync(outDir, { recursive: true })
      fs.writeFileSync(
        path.join(outDir, 'index.m3u8'),
        '#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:6\n#EXTINF:6.0,\nseg_0000.ts\n#EXT-X-ENDLIST\n',
      )
      fs.writeFileSync(path.join(outDir, 'seg_0000.ts'), Buffer.alloc(188, 0x47))
    },
  }
  return { transcoder, calls, setFailures: (count: number) => (failures = count) }
}
