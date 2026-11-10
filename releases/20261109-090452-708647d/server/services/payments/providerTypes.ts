import type { PaymentMethod } from '../../config/plans.ts'

export type ProviderStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED'

export type ProviderName = 'imaliway' | 'unconfigured' | 'test'

export interface PushRequest {
  account: string
  amount: number
  method: PaymentMethod
  partnerTransactionId: string
}

export interface PushResult {
  providerRef: string | null
  status: ProviderStatus
  expiresAt: string | null
}

export interface PaymentProvider {
  /** 'imaliway' em produção; 'unconfigured' sem credenciais; os testes usam um fornecedor falso. */
  readonly name: ProviderName
  push(request: PushRequest): Promise<PushResult>
  status(partnerTransactionId: string): Promise<ProviderStatus>
}

/** Erro devolvido pelo fornecedor, com um código estável para a UI. */
export class PaymentProviderError extends Error {
  readonly code: string
  readonly httpStatus: number

  constructor(code: string, message: string, httpStatus = 502) {
    super(message)
    this.code = code
    this.httpStatus = httpStatus
  }
}
