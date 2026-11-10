// Aplica as migrações SQL pendentes (server/models/store/migrations) à base do .env.
//
// O servidor só migra sozinho um esquema sem dados (instalação nova, testes).
// Numa base com dados, faça antes uma cópia de segurança:
//   pg_dump --format=custom --file=anayeshua-antes-da-migracao.dump "$DATABASE_URL"
// e depois:
//   npm run db:migrate
// Opções:
//   --status         só mostra as migrações aplicadas e pendentes
//   --to <versão>    aplica só até essa versão (inclusive)
//   --root <pasta>   projecto cujo .env usar (por omissão, a pasta actual)
import fs from 'node:fs'
import path from 'node:path'

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

const root = path.resolve(argValue('--root') ?? process.cwd())
const envFile = path.join(root, '.env')
// As variáveis já definidas no ambiente têm precedência sobre o .env.
if (fs.existsSync(envFile)) process.loadEnvFile(envFile)

const { loadConfig } = await import('../server/config/env.ts')
const { openPool } = await import('../server/models/store/database.ts')
const { formatName, migrate, migrationStatus } = await import('../server/models/store/migrator.ts')

const config = loadConfig()
const schema = config.databaseSchema
const target = argValue('--to') ? Number(argValue('--to')) : undefined
if (target !== undefined && !Number.isInteger(target)) {
  console.error('[db:migrate] --to precisa de um número de versão.')
  process.exit(1)
}

const pool = await openPool(config.databaseUrl, schema)
try {
  const status = await migrationStatus(pool, schema)
  console.log(`[db:migrate] Esquema ${schema}: ${status.applied.length} aplicada(s), ${status.pending.length} pendente(s).`)
  for (const migration of status.pending) console.log(`  pendente: ${formatName(migration)}`)
  if (!process.argv.includes('--status')) {
    const applied = await migrate(pool, schema, { target, log: (message) => console.log(message) })
    console.log(applied.length ? `[db:migrate] ${applied.length} migração(ões) aplicada(s).` : '[db:migrate] Nada a aplicar.')
  }
} catch (error) {
  console.error(`[db:migrate] ${(error as Error).message}`)
  process.exitCode = 1
} finally {
  await pool.end()
}
