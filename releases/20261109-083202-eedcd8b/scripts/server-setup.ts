// Prepara (ou confirma) um servidor para correr a plataforma:
//   1. Node.js e ficheiro .env (DATABASE_URL, ANA_SECRET, conta de administração);
//   2. ffmpeg e ffprobe para converter os vídeos em várias qualidades (HLS),
//      instalados automaticamente se faltarem (winget no Windows, apt/dnf/apk
//      no Linux, Homebrew no macOS);
//   3. pastas dos vídeos e das capas;
//   4. base de dados: cópia de segurança (pg_dump) antes de aplicar migrações
//      pendentes e depois a migração;
//   5. (opcional) build do frontend.
// No arranque seguinte o servidor põe na fila de conversão todos os vídeos que
// ainda não têm versão HLS e retoma as conversões interrompidas.
//
// Uso:
//   npm run server:setup               faz tudo o que faltar
//   npm run server:setup -- --check    só verifica, sem instalar nem alterar nada
// Opções:
//   --no-install     não instala o ffmpeg (só indica como)
//   --skip-backup    migra sem cópia de segurança (não recomendado)
//   --build          corre também `npm run build`
//   --root <pasta>   projecto a preparar (por omissão, a pasta actual)
import { spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

type Status = 'ok' | 'warn' | 'fail'
const report: { status: Status; item: string; detail: string }[] = []
const note = (status: Status, item: string, detail: string) => {
  report.push({ status, item, detail })
  const mark = status === 'ok' ? '✔' : status === 'warn' ? '!' : '✖'
  console.log(`${mark} ${item}: ${detail}`)
}

const args = process.argv.slice(2)
const flag = (name: string) => args.includes(name)
const argValue = (name: string) => {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}

const checkOnly = flag('--check')
const root = path.resolve(argValue('--root') ?? process.cwd())
const envFile = path.join(root, '.env')
const isWindows = process.platform === 'win32'

/** Corre um comando; devolve o código e o texto (ou -1 se o programa não existir). */
function run(command: string, commandArgs: string[], options: { inherit?: boolean; env?: NodeJS.ProcessEnv } = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: root,
    encoding: 'utf8',
    stdio: options.inherit ? 'inherit' : 'pipe',
    env: options.env ?? process.env,
    // npm/npx são .cmd no Windows e precisam da shell.
    shell: isWindows && /^(npm|npx)$/.test(command),
  })
  return { code: result.error ? -1 : result.status ?? -1, output: `${result.stdout ?? ''}${result.stderr ?? ''}` }
}

const exists = (command: string, versionArg = '-version') => run(command, [versionArg]).code === 0

/** Escreve (ou substitui, mesmo comentada) uma variável no .env. */
function setEnvValue(key: string, value: string) {
  const text = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : ''
  const line = `${key}=${value}`
  const pattern = new RegExp(`^#?\\s*${key}=.*$`, 'm')
  const next = pattern.test(text) ? text.replace(pattern, line) : `${text.replace(/\s*$/, '')}\n${line}\n`
  fs.writeFileSync(envFile, next)
  process.env[key] = value
}

console.log(`Preparação do servidor em ${root}${checkOnly ? ' (só verificação)' : ''}\n`)

/* 1. Node.js e .env ------------------------------------------------------- */
const [major, minor] = process.versions.node.split('.').map(Number)
if (major > 20 || (major === 20 && minor >= 12)) note('ok', 'Node.js', process.versions.node)
else note('fail', 'Node.js', `${process.versions.node}; é preciso o 20.12 ou mais recente (recomendado: 22 LTS).`)

if (!fs.existsSync(envFile)) {
  const example = path.join(root, '.env.example')
  if (!checkOnly && fs.existsSync(example)) {
    fs.copyFileSync(example, envFile)
    note('warn', '.env', 'criado a partir do .env.example; preencha DATABASE_URL e as restantes variáveis e volte a correr.')
  } else {
    note('fail', '.env', 'não existe; copie o .env.example para .env e preencha-o.')
  }
}
if (fs.existsSync(envFile)) process.loadEnvFile(envFile)

const databaseUrl = process.env.DATABASE_URL ?? ''
if (!databaseUrl || databaseUrl.includes('utilizador:senha')) note('fail', 'DATABASE_URL', 'em falta no .env.')
else note('ok', 'DATABASE_URL', databaseUrl.replace(/\/\/([^:/@]+):[^@]*@/, '//$1:***@'))

const secret = process.env.ANA_SECRET ?? process.env.ANA_MEDIA_SECRET ?? ''
if (secret.length >= 32) note('ok', 'ANA_SECRET', 'definido.')
else if (!secret && !checkOnly) {
  setEnvValue('ANA_SECRET', crypto.randomBytes(32).toString('hex'))
  note('ok', 'ANA_SECRET', 'gerado e guardado no .env.')
} else {
  note('warn', 'ANA_SECRET', secret ? 'curto; use pelo menos 32 caracteres aleatórios.' : 'em falta; as sessões terminam sempre que o servidor reinicia.')
}

if (process.env.ANA_ADMIN_PASSWORD) note('ok', 'Administração', `conta ${process.env.ANA_ADMIN_EMAIL || 'ana@example.com'}.`)
else note('warn', 'Administração', 'sem ANA_ADMIN_PASSWORD; no primeiro arranque é gerada uma palavra-passe e mostrada uma vez na consola.')

if (process.env.IMALIWAY_CLIENT_ID && process.env.IMALIWAY_API_KEY) note('ok', 'Pagamentos', 'credenciais iMaliWay definidas.')
else note('warn', 'Pagamentos', 'sem credenciais iMaliWay; o checkout fica indisponível.')

/* 2. ffmpeg / ffprobe ----------------------------------------------------- */
/** Onde o winget deixa o ffmpeg quando o PATH desta consola ainda não foi actualizado. */
function findWingetFfmpeg(): { ffmpeg: string; ffprobe: string } | null {
  const local = process.env.LOCALAPPDATA
  if (!local) return null
  const links = path.join(local, 'Microsoft', 'WinGet', 'Links')
  if (fs.existsSync(path.join(links, 'ffmpeg.exe')) && fs.existsSync(path.join(links, 'ffprobe.exe'))) {
    return { ffmpeg: path.join(links, 'ffmpeg.exe'), ffprobe: path.join(links, 'ffprobe.exe') }
  }
  const packages = path.join(local, 'Microsoft', 'WinGet', 'Packages')
  if (!fs.existsSync(packages)) return null
  for (const dir of fs.readdirSync(packages).filter((name) => name.startsWith('Gyan.FFmpeg'))) {
    const stack = [path.join(packages, dir)]
    while (stack.length) {
      const current = stack.pop() as string
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const full = path.join(current, entry.name)
        if (entry.isDirectory()) stack.push(full)
        else if (entry.name === 'ffmpeg.exe' && fs.existsSync(path.join(current, 'ffprobe.exe'))) {
          return { ffmpeg: full, ffprobe: path.join(current, 'ffprobe.exe') }
        }
      }
    }
  }
  return null
}

function installCommand(): { command: string; args: string[] } | null {
  if (isWindows) return { command: 'winget', args: ['install', '--id', 'Gyan.FFmpeg', '-e', '--accept-source-agreements', '--accept-package-agreements'] }
  if (process.platform === 'darwin') return exists('brew', '--version') ? { command: 'brew', args: ['install', 'ffmpeg'] } : null
  const sudo = typeof process.getuid === 'function' && process.getuid() !== 0 ? ['sudo'] : []
  const withSudo = (parts: string[]) => (sudo.length ? { command: 'sudo', args: parts } : { command: parts[0], args: parts.slice(1) })
  if (exists('apt-get', '--version')) return withSudo(['sh', '-c', 'apt-get update && apt-get install -y ffmpeg'])
  if (exists('dnf', '--version')) return withSudo(['dnf', 'install', '-y', 'ffmpeg'])
  if (exists('apk', '--version')) return withSudo(['apk', 'add', 'ffmpeg'])
  return null
}

const ffmpegPath = () => process.env.FFMPEG_PATH || 'ffmpeg'
const ffprobePath = () => process.env.FFPROBE_PATH || 'ffprobe'
const ffmpegReady = () => exists(ffmpegPath()) && exists(ffprobePath())

if (!ffmpegReady() && isWindows) {
  const found = findWingetFfmpeg()
  if (found && !checkOnly) {
    setEnvValue('FFMPEG_PATH', found.ffmpeg)
    setEnvValue('FFPROBE_PATH', found.ffprobe)
  }
}
if (!ffmpegReady() && !checkOnly && !flag('--no-install')) {
  const install = installCommand()
  if (install) {
    console.log(`\nA instalar o ffmpeg: ${install.command} ${install.args.join(' ')}\n`)
    run(install.command, install.args, { inherit: true })
    if (!ffmpegReady() && isWindows) {
      const found = findWingetFfmpeg()
      if (found) {
        setEnvValue('FFMPEG_PATH', found.ffmpeg)
        setEnvValue('FFPROBE_PATH', found.ffprobe)
      }
    }
  }
}
if (ffmpegReady()) {
  const version = run(ffmpegPath(), ['-version']).output.match(/ffmpeg version (\S+)/)?.[1] ?? '?'
  note('ok', 'ffmpeg', `${version}; os vídeos são convertidos para 360p, 480p e 720p (HLS).`)
} else {
  const hint = isWindows
    ? 'winget install Gyan.FFmpeg'
    : process.platform === 'darwin'
      ? 'brew install ffmpeg'
      : 'sudo apt-get install -y ffmpeg'
  note('warn', 'ffmpeg', `não encontrado; os vídeos tocam só no formato original. Instale com: ${hint} (ou defina FFMPEG_PATH e FFPROBE_PATH no .env).`)
}

/* 3. Pastas --------------------------------------------------------------- */
const resolveDir = (value: string | undefined, fallback: string) => (value ? path.resolve(root, value) : path.join(root, fallback))
const videosDir = resolveDir(process.env.ANA_VIDEOS_DIR, 'videos')
const dataDir = resolveDir(process.env.ANA_DATA_DIR, 'data')
for (const [label, dir] of [
  ['Vídeos', videosDir],
  ['Vídeos HLS', path.join(videosDir, 'hls')],
  ['Capas', path.join(dataDir, 'uploads')],
] as const) {
  if (!fs.existsSync(dir) && !checkOnly) fs.mkdirSync(dir, { recursive: true })
  if (fs.existsSync(dir)) {
    try {
      fs.accessSync(dir, fs.constants.W_OK)
      note('ok', label, dir)
    } catch {
      note('fail', label, `${dir} sem permissão de escrita.`)
    }
  } else note('warn', label, `${dir} ainda não existe.`)
}
try {
  const stats = fs.statfsSync(videosDir)
  const freeGb = (stats.bavail * stats.bsize) / 1024 ** 3
  note(freeGb < 5 ? 'warn' : 'ok', 'Disco', `${freeGb.toFixed(1)} GB livres na pasta dos vídeos.`)
} catch {
  /* sem statfs (pasta em falta) */
}

/* 4. Base de dados -------------------------------------------------------- */
/** pg_dump no PATH ou, no Windows, na instalação mais recente do PostgreSQL. */
function findPgDump(): string | null {
  if (exists('pg_dump', '--version')) return 'pg_dump'
  if (!isWindows) return null
  const base = path.join(process.env.ProgramFiles || 'C:\\Program Files', 'PostgreSQL')
  if (!fs.existsSync(base)) return null
  const versions = fs.readdirSync(base).filter((name) => /^\d+/.test(name)).sort((a, b) => parseFloat(b) - parseFloat(a))
  for (const version of versions) {
    const candidate = path.join(base, version, 'bin', 'pg_dump.exe')
    if (fs.existsSync(candidate)) return candidate
  }
  return null
}

if (databaseUrl && !databaseUrl.includes('utilizador:senha')) {
  const { openPool } = await import('../server/models/store/database.ts')
  const { formatName, migrate, migrationStatus, schemaHasData } = await import('../server/models/store/migrator.ts')
  const schema = process.env.DATABASE_SCHEMA || 'public'
  let pool: Awaited<ReturnType<typeof openPool>> | null = null
  try {
    pool = await openPool(databaseUrl, schema)
    const status = await migrationStatus(pool, schema)
    if (!status.pending.length) {
      note('ok', 'Base de dados', `esquema ${schema} actualizado (${status.applied.length} migrações).`)
    } else if (checkOnly) {
      note('warn', 'Base de dados', `${status.pending.length} migração(ões) pendente(s): ${status.pending.map(formatName).join(', ')}.`)
    } else {
      let backupOk = flag('--skip-backup') || !(await schemaHasData(pool, schema))
      if (!backupOk) {
        const pgDump = findPgDump()
        if (!pgDump) {
          note('fail', 'Cópia de segurança', 'pg_dump não encontrado; instale as ferramentas do PostgreSQL ou use --skip-backup.')
        } else {
          const backupsDir = path.join(root, 'backups')
          fs.mkdirSync(backupsDir, { recursive: true })
          const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
          const file = path.join(backupsDir, `anayeshua-${stamp}.dump`)
          const dump = run(pgDump, ['--format=custom', `--file=${file}`, databaseUrl])
          if (dump.code === 0 && fs.existsSync(file)) {
            backupOk = true
            note('ok', 'Cópia de segurança', `${file} (${(fs.statSync(file).size / 1024 ** 2).toFixed(1)} MB).`)
          } else {
            note('fail', 'Cópia de segurança', `o pg_dump falhou: ${dump.output.trim().split('\n').slice(-2).join(' ')}`)
          }
        }
      }
      if (backupOk) {
        const applied = await migrate(pool, schema, { log: (message) => console.log(`  ${message}`) })
        note('ok', 'Base de dados', `${applied.length} migração(ões) aplicada(s) ao esquema ${schema}.`)
      } else {
        note('fail', 'Base de dados', 'migrações não aplicadas (sem cópia de segurança).')
      }
    }
  } catch (error) {
    note('fail', 'Base de dados', (error as Error).message)
  } finally {
    await pool?.end()
  }
}

/* 5. Build ---------------------------------------------------------------- */
if (flag('--build') && !checkOnly) {
  console.log('\nA compilar o frontend (npm run build)…\n')
  const build = run('npm', ['run', 'build'], { inherit: true })
  note(build.code === 0 ? 'ok' : 'fail', 'Build', build.code === 0 ? 'dist/ actualizado.' : 'falhou; veja os erros acima.')
}

/* Resumo ------------------------------------------------------------------ */
const failures = report.filter((entry) => entry.status === 'fail').length
const warnings = report.filter((entry) => entry.status === 'warn').length
console.log(`\n${failures ? '✖' : '✔'} ${report.length - failures - warnings} ok, ${warnings} aviso(s), ${failures} erro(s) em ${os.hostname()}.`)
if (!failures) {
  console.log('Arranque o servidor (npm run media ou o seu gestor de processos); os vídeos sem versão HLS entram na fila de conversão automaticamente.')
}
process.exitCode = failures ? 1 : 0
