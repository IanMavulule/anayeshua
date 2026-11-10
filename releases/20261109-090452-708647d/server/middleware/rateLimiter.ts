/**
 * Limite simples em memória para tentativas falhadas (ex.: login).
 * `hit` regista uma falha; `blocked` indica se a chave excedeu o limite na janela.
 */
export function createFailureLimiter(maxFailures = 5, windowMs = 15 * 60 * 1000) {
  const failures = new Map<string, number[]>()

  const recent = (key: string, now: number) => (failures.get(key) ?? []).filter((at) => now - at < windowMs)

  return {
    blocked(key: string, now = Date.now()): boolean {
      return recent(key, now).length >= maxFailures
    },
    hit(key: string, now = Date.now()): void {
      failures.set(key, [...recent(key, now), now])
    },
    reset(key: string): void {
      failures.delete(key)
    },
  }
}
