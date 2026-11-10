// Publica a versão actual (último commit) na VPS de produção.
//
//   npm run deploy                 verifica, envia o último commit e activa-o
//   npm run deploy -- --rollback   volta à versão anterior
//   npm run deploy -- --status     mostra a versão activa, as versões guardadas e o estado da API
// Opções:
//   --skip-checks    não corre typecheck nem i18n:check localmente
//   --allow-dirty    publica mesmo com alterações por gravar (só o último commit é enviado)
//
// Destino (no .env local ou no ambiente):
//   DEPLOY_HOST=ian@168.231.127.248   utilizador@servidor SSH
//   DEPLOY_PATH=/var/www/anayeshua    pasta da app na VPS
//
// Só é enviado o que está commitado (git archive HEAD). Na VPS, scripts/deploy-remote.sh
// instala, compila, copia a base (pg_dump), migra, activa e confirma que a API responde;
// se falhar, volta sozinho à versão anterior. O .env de produção, os vídeos e as capas
// ficam em <DEPLOY_PATH>/shared e nunca são substituídos.
//
// O SSH pede a palavra-passe (duas vezes: envio e instalação). Para não a escrever,
// instale uma chave: ssh-copy-id, ou acrescente ~/.ssh/id_ed25519.pub ao
// ~/.ssh/authorized_keys do servidor.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const root = process.cwd()
const envFile = path.join(root, '.env')
if (fs.existsSync(envFile)) process.loadEnvFile(envFile)

const args = process.argv.slice(2)
const flag = (name: string) => args.includes(name)
const host = process.env.DEPLOY_HOST || 'ian@168.231.127.248'
const base = process.env.DEPLOY_PATH || '/var/www/anayeshua'
const isWindows = process.platform === 'win32'

function step(message: string) {
  console.log(`\n\x1b[1;35m▶ ${message}\x1b[0m`)
}

function stop(message: string): never {
  console.error(`\n\x1b[1;31m✖ ${message}\x1b[0m`)
  process.exit(1)
}

function run(command: string, commandArgs: string[], options: { capture?: boolean } = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: root,
    encoding: 'utf8',
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    shell: isWindows && /^(npm|npx)$/.test(command),
  })
  if (result.error) stop(`${command} não encontrado: ${result.error.message}`)
  return { code: result.status ?? 1, out: (result.stdout ?? '').trim() }
}

function must(command: string, commandArgs: string[], failure: string) {
  if (run(command, commandArgs).code !== 0) stop(failure)
}

/** Corre o script remoto da versão activa (rollback/status). */
function remote(command: 'rollback' | 'status') {
  const script = `DEPLOY_PATH='${base}' bash '${base}/current/scripts/deploy-remote.sh' ${command}`
  process.exit(run('ssh', [host, script]).code)
}

if (flag('--rollback')) remote('rollback')
if (flag('--status')) remote('status')

// 1. Estado do repositório.
const sha = run('git', ['rev-parse', '--short=7', 'HEAD'], { capture: true }).out
if (!sha) stop('Não é um repositório git.')
const branch = run('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { capture: true }).out
const dirty = run('git', ['status', '--porcelain'], { capture: true }).out
if (dirty && !flag('--allow-dirty')) {
  stop(
    'Há alterações por gravar — só o último commit seria publicado.\n' +
      '  Faça commit primeiro, ou use: npm run deploy -- --allow-dirty',
  )
}
console.log(`Destino: ${host}:${base}\nVersão:  ${branch} @ ${sha}${dirty ? ' (há alterações locais NÃO incluídas)' : ''}`)

// 2. Verificações locais (rápidas; o build completo corre na VPS).
if (!flag('--skip-checks')) {
  step('typecheck')
  must('npm', ['run', 'typecheck', '--silent'], 'typecheck falhou — corrija antes de publicar.')
  step('i18n:check')
  must('npm', ['run', 'i18n:check', '--silent'], 'i18n:check falhou — faltam traduções.')
}

// 3. Pacote do último commit.
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15)
const release = `${stamp}-${sha}`
const archive = path.join(os.tmpdir(), `anayeshua-${release}.tar.gz`)
step(`A empacotar ${release}`)
must('git', ['archive', '--format=tar.gz', '-o', archive, 'HEAD'], 'git archive falhou.')

try {
  // 4. Envio.
  step('A enviar para o servidor')
  const remoteArchive = `/tmp/anayeshua-${release}.tar.gz`
  must('scp', ['-q', archive, `${host}:${remoteArchive}`], 'Envio (scp) falhou.')

  // 5. Instalação na VPS.
  step('A instalar na VPS')
  const dir = `${base}/releases/${release}`
  const script = [
    'set -e',
    `mkdir -p '${dir}'`,
    `tar -xzf '${remoteArchive}' -C '${dir}'`,
    `rm -f '${remoteArchive}'`,
    `DEPLOY_PATH='${base}' bash '${dir}/scripts/deploy-remote.sh' deploy '${dir}'`,
  ].join(' && ')
  const { code } = run('ssh', [host, script])
  if (code !== 0) stop('Deploy falhou (ver mensagens acima). O site continua na versão anterior.')
  console.log(`\n\x1b[1;32m✔ Publicado ${release}\x1b[0m`)
} finally {
  fs.rmSync(archive, { force: true })
}
