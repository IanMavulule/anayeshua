import express from 'express'
import { loadConfig, type AppConfig } from './config/env.ts'
import type { AppContext } from './context.ts'
import { attachUser } from './middleware/authMiddleware.ts'
import { errorHandler, notFound } from './middleware/errorMiddleware.ts'
import { openDatabase } from './models/store/database.ts'
import { apiRouter, fileRouter } from './routes/index.ts'
import { createCatalogService } from './services/catalogService.ts'
import { runMigrations } from './services/migrationService.ts'
import { createImaliWayProvider, missingImaliWayFields, readImaliWayConfig } from './services/payments/imaliwayProvider.ts'
import { createPaymentService } from './services/payments/paymentService.ts'
import type { PaymentProvider } from './services/payments/providerTypes.ts'
import { createUnconfiguredProvider } from './services/payments/unconfiguredProvider.ts'
import { createDisabledGoogleAuth, createGoogleAuth, type GoogleAuthService } from './services/googleAuthService.ts'
import { createMonitorService } from './services/monitorService.ts'
import { createTokenService } from './services/tokenService.ts'
import { createFfmpegTranscoder, type Transcoder } from './services/video/transcoder.ts'
import { createVideoProcessor, HLS_DIR } from './services/video/videoProcessor.ts'
import { HttpError } from './middleware/errorMiddleware.ts'
import type { NextFunction, Request, Response } from 'express'

export interface CreateAppOptions {
  config?: Partial<AppConfig>
  log?: (message: string) => void
  // Permite aos testes injectar um fornecedor de pagamentos.
  paymentProvider?: PaymentProvider
  webhookSecret?: string
  // Os testes usam um conversor falso em vez do ffmpeg.
  transcoder?: Transcoder
  /** Os testes injectam um verificador de ID tokens da Google. */
  googleAuth?: GoogleAuthService
  /** Por omissão, a fila de conversão e o monitor arrancam com a aplicação. */
  startBackground?: boolean
}

/** iMaliWay com as credenciais do .env; sem elas, o checkout é recusado com uma mensagem clara. */
function selectPaymentProvider(log: (message: string) => void): PaymentProvider {
  const imaliway = readImaliWayConfig()
  if (imaliway) return createImaliWayProvider(imaliway)
  const missing = missingImaliWayFields(readImaliWayConfig.partial())
  log(`[pagamentos] iMaliWay por configurar (${missing.join(', ')}): o checkout fica indisponível.`)
  return createUnconfiguredProvider(missing)
}

/**
 * Composition root: liga ao PostgreSQL, prepara as tabelas, cria os services e
 * o contexto partilhado pelos presenters, e monta as routes. Separado de
 * `index.ts` para os testes.
 */
export async function createApp(options: CreateAppOptions = {}) {
  const config = loadConfig(options.config)
  const log = options.log ?? console.log
  const db = await openDatabase(config.databaseUrl, config.databaseSchema, { log })
  await runMigrations(db, config, log)

  const context: AppContext = {
    config,
    db,
    tokens: createTokenService(config.secret),
    catalog: createCatalogService(db, config.videosDir),
    payments: createPaymentService(db, options.paymentProvider ?? selectPaymentProvider(log)),
    webhookSecret: options.webhookSecret ?? process.env.IMALIWAY_WEBHOOK_SECRET ?? '',
    videos: createVideoProcessor({ db, videosDir: config.videosDir, transcoder: options.transcoder ?? createFfmpegTranscoder(), log }),
    google: options.googleAuth ?? (config.googleClientId ? createGoogleAuth(config.googleClientId) : createDisabledGoogleAuth()),
    monitor: createMonitorService({ db, videosDir: config.videosDir, uploadsDir: config.uploadsDir, hlsDirName: HLS_DIR }),
  }
  if (options.startBackground !== false) {
    context.monitor.start()
    await context.videos.start()
  }

  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', 'loopback')
  app.use(attachUser(db, context.tokens))
  app.use('/api', apiRouter(context))
  app.use(fileRouter(context))
  app.use(notFound)
  // Erros inesperados (500) ficam registados para a administração ver no painel Servidor.
  app.use((error: unknown, request: Request, _response: Response, next: NextFunction) => {
    const status = error instanceof HttpError ? error.status : Number((error as { status?: unknown })?.status) || 500
    if (status >= 500) {
      const detail = error instanceof Error ? error.stack ?? error.message : String(error)
      void db.serverEvents.add('error', 'api', `${request.method} ${request.path} falhou (${status}).`, detail).catch(() => {})
    }
    next(error)
  })
  app.use(errorHandler)

  return { app, context }
}
