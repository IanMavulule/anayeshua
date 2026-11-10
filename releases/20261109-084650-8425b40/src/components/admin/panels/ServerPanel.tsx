import { useState } from 'react'
import { adminApi } from '../../../utils/api/adminApi'
import { useAdmin } from '../AdminContext'
import type { CpuSample, RenditionStatus, ServerEvent, VideoJob } from '../systemTypes'
import { useServerStatus } from '../useServerStatus'

const STATUS_TEXT: Record<RenditionStatus, string> = {
  pending: 'Na fila',
  processing: 'A converter',
  ready: 'Pronto',
  failed: 'Falhou',
  skipped: 'Não necessário',
}

const LEVEL_TEXT: Record<ServerEvent['level'], string> = { error: 'Erro', warning: 'Aviso', info: 'Informação' }

function bytes(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = value
  let unit = 0
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024
    unit++
  }
  return `${size.toLocaleString('pt-PT', { maximumFractionDigits: size < 10 && unit > 0 ? 1 : 0 })} ${units[unit]}`
}

function duration(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (days) return `${days} d ${hours} h`
  if (hours) return `${hours} h ${minutes} min`
  return `${minutes} min`
}

const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })

function relative(iso: string): string {
  const seconds = Math.round((Date.parse(iso) - Date.now()) / 1000)
  if (seconds <= 0) return 'agora'
  if (seconds < 60) return `daqui a ${seconds} s`
  if (seconds < 3600) return `daqui a ${Math.round(seconds / 60)} min`
  return `daqui a ${Math.round(seconds / 3600)} h`
}

/** Nível do medidor: verde até 70%, dourado até 90%, vermelho acima. */
const meterTone = (percent: number) => (percent >= 90 ? 'is-danger' : percent >= 70 ? 'is-warn' : '')

function Meter({ label, percent, detail }: { label: string; percent: number | null; detail: string }) {
  const value = percent === null ? 0 : Math.min(100, Math.max(0, percent))
  return (
    <div className="adm-srv-meter">
      <div className="adm-srv-meter-head">
        <span>{label}</span>
        <strong>{percent === null ? '—' : `${Math.round(value)}%`}</strong>
      </div>
      <div className="adm-srv-bar" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)}>
        <span className={meterTone(value)} style={{ width: `${value}%` }} />
      </div>
      <small>{detail}</small>
    </div>
  )
}

/** Gráfico simples da CPU nos últimos 10 minutos (servidor e esta aplicação). */
function CpuChart({ history }: { history: CpuSample[] }) {
  if (history.length < 2) return <p className="adm-srv-muted">A recolher amostras…</p>
  const width = 300
  const height = 80
  const step = width / Math.max(1, history.length - 1)
  const line = (key: 'system' | 'process') =>
    history.map((sample, index) => `${(index * step).toFixed(1)},${(height - (Math.min(100, sample[key]) / 100) * height).toFixed(1)}`).join(' ')
  return (
    <figure className="adm-srv-chart">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label="Uso da CPU nos últimos minutos">
        <line x1="0" x2={width} y1={height / 2} y2={height / 2} className="adm-srv-grid" />
        <polyline points={line('system')} className="adm-srv-line adm-srv-line--system" />
        <polyline points={line('process')} className="adm-srv-line adm-srv-line--process" />
      </svg>
      <figcaption>
        <span><i className="adm-srv-key adm-srv-key--system" /> Servidor</span>
        <span><i className="adm-srv-key adm-srv-key--process" /> Plataforma</span>
        <span>Últimos {Math.round((history.length * 5) / 60)} min</span>
      </figcaption>
    </figure>
  )
}

function jobName(job: VideoJob) {
  return job.lessonTitle ? `${job.lessonTitle}${job.courseTitle ? ` · ${job.courseTitle}` : ''}` : `Aula ${job.lessonId}`
}

export default function ServerPanel() {
  const { panel, toast } = useAdmin()
  const active = panel === 'panel-server'
  const { overview, events, showResolved, error, loading, refresh, setShowResolved } = useServerStatus(active)
  const [busy, setBusy] = useState<string | null>(null)
  const [openDetail, setOpenDetail] = useState<string | null>(null)

  const run = async (key: string, action: () => Promise<unknown>, done?: string) => {
    setBusy(key)
    try {
      await action()
      if (done) toast('Feito', done)
      await refresh()
    } catch {
      toast('Não foi possível concluir', 'Tente de novo dentro de momentos.', 'error')
    } finally {
      setBusy(null)
    }
  }

  const system = overview?.system
  const storage = overview?.storage
  const videos = overview?.videos
  const cpu = system?.cpu.current?.system ?? null
  const memoryUsed = system ? system.memory.total - system.memory.free : 0
  const disk = storage?.disk
  const failedLessons = [...new Set((videos?.jobs ?? []).filter((job) => job.status === 'failed').map((job) => job.lessonId))]
  const transcoder = videos?.transcoder

  return (
    <section className="adm-panel" id="panel-server" role="tabpanel" aria-labelledby="nav-server" tabIndex={0} hidden={!active}>
      <div className="adm-head">
        <div>
          <span className="eyebrow">Sistema</span>
          <h1>Servidor</h1>
          <p className="adm-head-sub">Uso da CPU, memória e espaço, conversão dos vídeos e problemas recentes. Actualiza sozinho a cada 10 segundos.</p>
        </div>
        <div className="adm-head-actions">
          <button className="adm-btn" type="button" disabled={loading} onClick={() => void refresh(true)}>
            {loading ? 'A actualizar…' : 'Actualizar agora'}
          </button>
        </div>
      </div>

      {error && <p className="adm-srv-alert" role="alert">Não foi possível obter o estado do servidor. A tentar de novo…</p>}
      {!overview && !error && <p className="adm-srv-muted">A carregar o estado do servidor…</p>}

      {overview && system && storage && videos && (
        <div className="adm-srv">
          <div className="adm-srv-grid3">
            <div className="adm-card">
              <div className="adm-card-head"><div><h2>Processador</h2><span className="adm-card-meta">{system.cpu.cores} núcleos · {system.cpu.model || 'CPU'}</span></div></div>
              <Meter label="Uso agora" percent={cpu} detail={`Plataforma: ${system.cpu.current?.process ?? 0}%`} />
              <CpuChart history={system.cpu.history} />
            </div>

            <div className="adm-card">
              <div className="adm-card-head"><div><h2>Memória</h2><span className="adm-card-meta">Ligado há {duration(system.uptime.system)} · plataforma há {duration(system.uptime.process)}</span></div></div>
              <Meter
                label="Memória em uso"
                percent={system.memory.total ? (memoryUsed / system.memory.total) * 100 : null}
                detail={`${bytes(memoryUsed)} de ${bytes(system.memory.total)} · plataforma ${bytes(system.memory.process)}`}
              />
              <dl className="adm-srv-facts">
                <div><dt>Sistema</dt><dd>{system.platform}</dd></div>
                <div><dt>Node.js</dt><dd>{system.node}</dd></div>
              </dl>
            </div>

            <div className="adm-card">
              <div className="adm-card-head"><div><h2>Armazenamento</h2><span className="adm-card-meta">Medido às {new Date(storage.measuredAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</span></div></div>
              <Meter
                label="Disco dos vídeos"
                percent={disk && disk.total ? (disk.used / disk.total) * 100 : null}
                detail={disk ? `${bytes(disk.free)} livres de ${bytes(disk.total)}` : 'Não foi possível medir o disco.'}
              />
              <dl className="adm-srv-facts">
                <div><dt>Vídeos originais</dt><dd>{bytes(storage.videosOriginal)}</dd></div>
                <div><dt>Várias qualidades (HLS)</dt><dd>{bytes(storage.videosHls)}</dd></div>
                <div><dt>Capas carregadas</dt><dd>{bytes(storage.uploads)}</dd></div>
                <div><dt>Base de dados</dt><dd>{bytes(storage.database)}</dd></div>
              </dl>
            </div>
          </div>

          <div className="adm-card">
            <div className="adm-card-head">
              <div>
                <h2>Conversão dos vídeos</h2>
                <span className="adm-card-meta">
                  {videos.counts.ready} prontas · {videos.counts.pending + videos.counts.processing} na fila · {videos.counts.failed} falhadas
                </span>
              </div>
              <button className="adm-btn adm-btn--sm" type="button" disabled={busy === 'recheck'} onClick={() => void run('recheck', adminApi.recheckTranscoder)}>
                Verificar o ffmpeg
              </button>
            </div>
            {transcoder && !transcoder.available ? (
              <p className="adm-srv-alert adm-srv-alert--warn">
                <strong>A conversão está desligada.</strong> Os vídeos continuam a funcionar no formato original, mas sem ajuste à rede. {transcoder.available === false ? transcoder.reason : null}
              </p>
            ) : (
              <p className="adm-srv-muted">
                {transcoder?.available === true ? `ffmpeg ${transcoder.version}. ` : ''}
                Cada vídeo é publicado logo no formato original; as qualidades 360p, 480p e 720p são acrescentadas ao leitor quando ficam prontas.
              </p>
            )}
            {videos.current && (
              <p className="adm-srv-now">
                A converter agora: <strong>{jobName(videos.jobs.find((job) => job.lessonId === videos.current!.lessonId && job.quality === videos.current!.quality) ?? { lessonId: videos.current.lessonId } as VideoJob)}</strong> ({videos.current.quality}, tentativa {videos.current.attempt}), desde {dateTime(videos.current.startedAt)}
              </p>
            )}
            {videos.jobs.length === 0 ? (
              <p className="adm-srv-empty">Nenhuma conversão pendente.</p>
            ) : (
              <div className="adm-srv-table-wrap">
                <table className="adm-srv-table">
                  <thead>
                    <tr><th scope="col">Aula</th><th scope="col">Qualidade</th><th scope="col">Estado</th><th scope="col">Tentativas</th><th scope="col"><span className="visually-hidden">Acções</span></th></tr>
                  </thead>
                  <tbody>
                    {videos.jobs.map((job) => (
                      <tr key={`${job.lessonId}-${job.quality}`}>
                        <td>
                          {jobName(job)}
                          {job.lastError && <small className="adm-srv-error-line" title={job.lastError}>{job.lastError.split('\n')[0]}</small>}
                        </td>
                        <td>{job.quality}</td>
                        <td>
                          <span className={`adm-srv-chip adm-srv-chip--${job.status}`}>{STATUS_TEXT[job.status]}</span>
                          {job.status === 'pending' && job.attempts > 0 && <small className="adm-srv-muted"> nova tentativa {relative(job.nextAttemptAt)}</small>}
                        </td>
                        <td>{job.attempts}</td>
                        <td>
                          {job.status === 'failed' && failedLessons.includes(job.lessonId) && job === videos.jobs.find((item) => item.lessonId === job.lessonId && item.status === 'failed') && (
                            <button className="adm-btn adm-btn--sm" type="button" disabled={busy === job.lessonId} onClick={() => void run(job.lessonId, () => adminApi.retryVideo(job.lessonId), 'A conversão voltou à fila.')}>
                              Tentar de novo
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="adm-card">
            <div className="adm-card-head">
              <div>
                <h2>Problemas no servidor</h2>
                <span className="adm-card-meta">{overview.openErrors ? `${overview.openErrors} erro(s) por resolver` : 'Sem erros por resolver'} · só a administração vê esta lista</span>
              </div>
              <div className="adm-srv-actions">
                <label className="adm-srv-toggle">
                  <input type="checkbox" checked={showResolved} onChange={(event) => setShowResolved(event.target.checked)} /> Mostrar resolvidos
                </label>
                <button className="adm-btn adm-btn--sm" type="button" disabled={busy === 'all' || !events.some((item) => !item.resolvedAt)} onClick={() => void run('all', adminApi.resolveAllEvents, 'Todos os problemas foram marcados como resolvidos.')}>
                  Marcar todos como resolvidos
                </button>
              </div>
            </div>
            {events.length === 0 ? (
              <p className="adm-srv-empty">Nada a assinalar. O servidor está a funcionar sem problemas registados.</p>
            ) : (
              <ul className="adm-srv-events">
                {events.map((event) => (
                  <li key={event.id} className={`adm-srv-event adm-srv-event--${event.level}${event.resolvedAt ? ' is-resolved' : ''}`}>
                    <div className="adm-srv-event-head">
                      <span className={`adm-srv-chip adm-srv-chip--${event.level}`}>{LEVEL_TEXT[event.level]}</span>
                      <span className="adm-srv-muted">{event.source} · {dateTime(event.createdAt)}</span>
                      {event.resolvedAt ? (
                        <span className="adm-srv-muted">Resolvido</span>
                      ) : (
                        <button className="adm-btn adm-btn--ghost adm-btn--sm" type="button" disabled={busy === event.id} onClick={() => void run(event.id, () => adminApi.resolveEvent(event.id))}>
                          Marcar como resolvido
                        </button>
                      )}
                    </div>
                    <p>{event.message}</p>
                    {event.detail && (
                      <>
                        <button className="adm-srv-link" type="button" aria-expanded={openDetail === event.id} onClick={() => setOpenDetail(openDetail === event.id ? null : event.id)}>
                          {openDetail === event.id ? 'Esconder detalhes' : 'Ver detalhes técnicos'}
                        </button>
                        {openDetail === event.id && <pre className="adm-srv-detail">{event.detail}</pre>}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
