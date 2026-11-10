import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { adminApi } from '../../utils/api/adminApi'
import type { ServerEvent, SystemOverview } from './systemTypes'

/** Com o painel Servidor aberto actualiza de 10 em 10 s; fora dele, só o número de erros, de minuto a minuto. */
const ACTIVE_MS = 10_000
const IDLE_MS = 60_000

interface ServerStatusState {
  overview: SystemOverview | null
  events: ServerEvent[]
  showResolved: boolean
  error: boolean
  loading: boolean
}

let state: ServerStatusState = { overview: null, events: [], showResolved: false, error: false, loading: false }
const listeners = new Set<() => void>()
let activeViews = 0
let timer: number | null = null
let inFlight: Promise<void> | null = null

const set = (patch: Partial<ServerStatusState>) => {
  state = { ...state, ...patch }
  listeners.forEach((listener) => listener())
}

async function load(refreshStorage = false): Promise<void> {
  if (inFlight && !refreshStorage) return inFlight
  set({ loading: true })
  inFlight = (async () => {
    try {
      const [overview, events] = await Promise.all([
        adminApi.system(refreshStorage),
        activeViews > 0 ? adminApi.systemEvents(state.showResolved) : Promise.resolve(state.events),
      ])
      set({ overview, events, error: false })
    } catch {
      set({ error: true })
    } finally {
      set({ loading: false })
      inFlight = null
    }
  })()
  return inFlight
}

function schedule() {
  if (timer !== null) window.clearInterval(timer)
  if (!listeners.size) {
    timer = null
    return
  }
  timer = window.setInterval(() => {
    if (document.visibilityState === 'visible') void load()
  }, activeViews > 0 ? ACTIVE_MS : IDLE_MS)
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (listeners.size === 1) {
    void load()
    schedule()
  }
  return () => {
    listeners.delete(listener)
    if (!listeners.size) schedule()
  }
}

/**
 * Estado do servidor partilhado pela barra lateral (número de erros) e pelo
 * painel Servidor (tudo). `active` indica que o painel está visível.
 */
export function useServerStatus(active = false) {
  const snapshot = useSyncExternalStore(subscribe, () => state)

  useEffect(() => {
    if (!active) return
    activeViews++
    void load()
    schedule()
    return () => {
      activeViews--
      schedule()
    }
  }, [active])

  const refresh = useCallback((refreshStorage = false) => load(refreshStorage), [])
  const setShowResolved = useCallback((showResolved: boolean) => {
    set({ showResolved })
    // Se já houver um pedido a meio, volta a carregar no fim com o novo filtro.
    void (inFlight ? inFlight.finally(() => load()) : load())
  }, [])

  return { ...snapshot, refresh, setShowResolved }
}
