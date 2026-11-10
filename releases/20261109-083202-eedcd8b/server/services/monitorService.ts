import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { Database } from '../models/store/database.ts'

export interface CpuSample {
  at: string
  /** Uso de todo o servidor, em %. */
  system: number
  /** Uso deste processo (API + conversões lançadas por ele não contam), em %. */
  process: number
}

export interface StorageUsage {
  /** Disco onde está a pasta dos vídeos. */
  disk: { total: number; free: number; used: number } | null
  videosOriginal: number
  videosHls: number
  uploads: number
  database: number | null
  measuredAt: string
}

/** Abaixo disto a administração recebe um aviso de pouco espaço. */
export const LOW_DISK_RATIO = 0.1

const SAMPLE_MS = 5_000
const HISTORY = 120 // 10 minutos
const STORAGE_CACHE_MS = 60_000

function cpuTotals() {
  let idle = 0
  let total = 0
  for (const cpu of os.cpus()) {
    const times = cpu.times
    idle += times.idle
    total += times.user + times.nice + times.sys + times.irq + times.idle
  }
  return { idle, total }
}

/** Soma o tamanho dos ficheiros de uma pasta (com subpastas), sem seguir ligações. */
async function folderSize(dir: string): Promise<number> {
  let total = 0
  let entries: fs.Dirent[]
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true })
  } catch {
    return 0
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) total += await folderSize(full)
    else if (entry.isFile()) {
      try {
        total += (await fs.promises.stat(full)).size
      } catch {
        /* apagado entretanto */
      }
    }
  }
  return total
}

/**
 * CPU, memória e espaço do servidor para o painel de administração. A CPU é
 * medida de 5 em 5 segundos (com histórico de 10 minutos); o espaço em disco
 * fica em cache 1 minuto, porque percorrer as pastas dos vídeos custa.
 */
export function createMonitorService(options: { db: Database; videosDir: string; uploadsDir: string; hlsDirName: string }) {
  const { db, videosDir, uploadsDir, hlsDirName } = options
  const history: CpuSample[] = []
  let previous = cpuTotals()
  let previousProcess = process.cpuUsage()
  let previousAt = process.hrtime.bigint()
  let timer: NodeJS.Timeout | null = null
  let storage: StorageUsage | null = null
  let storagePromise: Promise<StorageUsage> | null = null

  function sample() {
    const now = cpuTotals()
    const nowProcess = process.cpuUsage()
    const nowAt = process.hrtime.bigint()
    const totalDelta = now.total - previous.total
    const idleDelta = now.idle - previous.idle
    const elapsedMicros = Number(nowAt - previousAt) / 1000
    const processMicros = nowProcess.user - previousProcess.user + nowProcess.system - previousProcess.system
    const cores = Math.max(1, os.cpus().length)
    history.push({
      at: new Date().toISOString(),
      system: totalDelta > 0 ? Math.round((1 - idleDelta / totalDelta) * 1000) / 10 : 0,
      process: elapsedMicros > 0 ? Math.round((processMicros / (elapsedMicros * cores)) * 1000) / 10 : 0,
    })
    if (history.length > HISTORY) history.shift()
    previous = now
    previousProcess = nowProcess
    previousAt = nowAt
  }

  async function measureStorage(): Promise<StorageUsage> {
    let disk: StorageUsage['disk'] = null
    try {
      fs.mkdirSync(videosDir, { recursive: true })
      const stats = await fs.promises.statfs(videosDir)
      const total = stats.blocks * stats.bsize
      const free = stats.bavail * stats.bsize
      disk = { total, free, used: total - free }
    } catch {
      disk = null
    }
    let videosOriginal = 0
    try {
      for (const entry of await fs.promises.readdir(videosDir, { withFileTypes: true })) {
        if (entry.isFile()) videosOriginal += (await fs.promises.stat(path.join(videosDir, entry.name))).size
      }
    } catch {
      /* pasta ainda não existe */
    }
    let database: number | null = null
    try {
      database = await db.databaseSize()
    } catch {
      database = null
    }
    const result: StorageUsage = {
      disk,
      videosOriginal,
      videosHls: await folderSize(path.join(videosDir, hlsDirName)),
      uploads: await folderSize(uploadsDir),
      database,
      measuredAt: new Date().toISOString(),
    }
    if (disk && disk.total > 0 && disk.free / disk.total < LOW_DISK_RATIO) {
      const percent = Math.round((disk.free / disk.total) * 100)
      await db.serverEvents
        .addUnlessOpen('warning', 'servidor', 'Pouco espaço livre no disco dos vídeos.', `Restam ${percent}% do disco.`)
        .catch(() => {})
    }
    return result
  }

  return {
    start() {
      if (timer) return
      sample()
      timer = setInterval(sample, SAMPLE_MS)
      timer.unref()
    },
    stop() {
      if (timer) clearInterval(timer)
      timer = null
    },

    async storage(force = false): Promise<StorageUsage> {
      const fresh = storage && Date.now() - Date.parse(storage.measuredAt) < STORAGE_CACHE_MS
      if (fresh && !force) return storage!
      storagePromise ??= measureStorage().finally(() => {
        storagePromise = null
      })
      storage = await storagePromise
      return storage
    },

    snapshot() {
      const memory = process.memoryUsage()
      return {
        cpu: {
          cores: os.cpus().length,
          model: os.cpus()[0]?.model?.trim() ?? '',
          current: history.at(-1) ?? null,
          history: [...history],
        },
        memory: {
          total: os.totalmem(),
          free: os.freemem(),
          process: memory.rss,
        },
        uptime: { process: Math.round(process.uptime()), system: Math.round(os.uptime()) },
        platform: `${os.type()} ${os.release()}`,
        node: process.version,
      }
    },
  }
}

export type MonitorService = ReturnType<typeof createMonitorService>
