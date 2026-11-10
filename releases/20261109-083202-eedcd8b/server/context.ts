import type { AppConfig } from './config/env.ts'
import type { Database } from './models/store/database.ts'
import type { CatalogService } from './services/catalogService.ts'
import type { PaymentService } from './services/payments/paymentService.ts'
import type { MonitorService } from './services/monitorService.ts'
import type { TokenService } from './services/tokenService.ts'
import type { VideoProcessor } from './services/video/videoProcessor.ts'

/** Dependências partilhadas pelos presenters (injectadas para facilitar os testes). */
export interface AppContext {
  config: AppConfig
  db: Database
  tokens: TokenService
  catalog: CatalogService
  payments: PaymentService
  webhookSecret: string
  videos: VideoProcessor
  monitor: MonitorService
}
