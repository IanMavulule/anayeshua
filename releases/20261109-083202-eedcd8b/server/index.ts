import { createApp } from './app.ts'

try {
  const { app, context } = await createApp()
  const { config, db } = context

  if (config.secretIsEphemeral) {
    console.warn(
      '[anaYeshua] ANA_SECRET não definido — foi gerado um segredo aleatório para esta execução. ' +
        'As sessões terminam quando o servidor reinicia. Defina-o no ficheiro .env.',
    )
  }

  const server = app.listen(config.port, () => {
    console.log(`[anaYeshua] API e servidor de média em http://localhost:${config.port} (PostgreSQL ligado)`)
  })

  // Fecha as ligações ao PostgreSQL ao parar o servidor.
  process.on('unhandledRejection', (reason) => {
    console.error('[anaYeshua] promessa rejeitada sem tratamento:', reason)
    const detail = reason instanceof Error ? reason.stack ?? reason.message : String(reason)
    void db.serverEvents.add('error', 'servidor', 'Erro interno não tratado.', detail).catch(() => {})
  })

  const shutdown = () => {
    context.monitor.stop()
    void context.videos.stop()
    server.close(() => {
      void db.close().finally(() => process.exit(0))
    })
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
} catch (error) {
  console.error(`[anaYeshua] Não foi possível arrancar: ${(error as Error).message}`)
  process.exit(1)
}
