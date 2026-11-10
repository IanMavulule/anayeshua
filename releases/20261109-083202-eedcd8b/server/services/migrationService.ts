import type { AppConfig } from '../config/env.ts'
import type { User } from '../models/entities.ts'
import type { Database } from '../models/store/database.ts'
import { newId, nowIso } from '../utils/ids.ts'
import { generatePassword, hashPassword } from './passwordService.ts'

/**
 * Preparação no arranque. As tabelas são criadas por `openDatabase`; aqui só se
 * garante a conta de administração. Não há dados de exemplo: cursos, agenda e
 * conteúdos são criados no painel.
 */
export async function runMigrations(db: Database, config: AppConfig, log: (message: string) => void = console.log): Promise<void> {
  await ensureAdmin(db, config, log)
}

/** Garante que existe pelo menos uma conta de administração. */
async function ensureAdmin(db: Database, config: AppConfig, log: (message: string) => void): Promise<void> {
  if (await db.users.find((user) => user.role === 'admin')) return
  const password = config.adminPassword ?? generatePassword()
  const admin: User = {
    id: newId('u'),
    name: config.adminName,
    email: config.adminEmail,
    passwordHash: hashPassword(password),
    role: 'admin',
    status: 'active',
    language: 'pt',
    subscription: null,
    createdAt: nowIso(),
    lastLoginAt: null,
  }
  await db.users.insert(admin)
  if (config.adminPassword) {
    log(`[arranque] Conta de administração criada: ${admin.email} (palavra-passe de ANA_ADMIN_PASSWORD)`)
  } else {
    log(`[arranque] Conta de administração criada: ${admin.email} / ${password}`)
    log('[arranque] Guarde esta palavra-passe; ela não volta a ser mostrada.')
  }
}
