// Repõe a palavra-passe da conta de administração a partir de ANA_ADMIN_PASSWORD.
//
// A conta admin só é criada no primeiro arranque; mudar o .env depois disso não
// altera a palavra-passe guardada. Este comando aplica o valor actual do .env.
//
// Uso (na pasta do projecto; lê DATABASE_URL e ANA_ADMIN_PASSWORD do .env):
//   npm run admin:reset
// Opções:
//   --root <pasta>   projecto cujo .env usar (por omissão, a pasta actual)
//
// A palavra-passe nunca é escrita na consola.
import fs from 'node:fs'
import path from 'node:path'

const MIN_LENGTH = 8

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

const root = path.resolve(argValue('--root') ?? process.cwd())
const envFile = path.join(root, '.env')
// As variáveis já definidas no ambiente têm precedência sobre o .env.
if (fs.existsSync(envFile)) process.loadEnvFile(envFile)

const { loadConfig } = await import('../server/config/env.ts')
const { openDatabase } = await import('../server/models/store/database.ts')
const { hashPassword } = await import('../server/services/passwordService.ts')

const config = loadConfig()
const password = config.adminPassword ?? ''

function fail(message: string): never {
  console.error(`[admin:reset] ${message}`)
  process.exit(1)
}

if (!password) fail(`Defina ANA_ADMIN_PASSWORD em ${envFile}.`)
if (password.length < MIN_LENGTH) {
  fail(`ANA_ADMIN_PASSWORD tem ${password.length} caracteres; use pelo menos ${MIN_LENGTH}.`)
}

const db = await openDatabase(config.databaseUrl, config.databaseSchema)
const admin =
  (await db.users.find((user) => user.role === 'admin' && user.email === config.adminEmail)) ??
  (await db.users.find((user) => user.role === 'admin'))
if (!admin) {
  await db.close()
  fail('Não existe nenhuma conta de administração. Arranque o servidor uma vez para a criar.')
}

await db.users.update(admin.id, (current) => ({ ...current, passwordHash: hashPassword(password), status: 'active' }))
await db.close()
console.log(`[admin:reset] Palavra-passe de ${admin.email} actualizada a partir de ANA_ADMIN_PASSWORD.`)
if (admin.email !== config.adminEmail) {
  console.log(`[admin:reset] Atenção: a conta admin usa o e-mail ${admin.email}, não ${config.adminEmail}. Entre com ${admin.email}.`)
}
