import { spawn, spawnSync } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'

const children: ChildProcess[] = []
let shuttingDown = false

// No Windows, child.kill() mata apenas o processo lançado (cmd.exe) e deixa os
// netos (vite, tsx) órfãos a segurar as portas. taskkill /T encerra a árvore toda.
function killTree(child: ChildProcess): void {
  if (child.pid === undefined) return
  if (process.platform === 'win32') {
    try {
      spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
    } catch {
      /* ignora */
    }
    return
  }
  try {
    child.kill()
  } catch {
    /* ignora */
  }
}

function shutdown(exitCode = 0): void {
  if (shuttingDown) return
  shuttingDown = true
  for (const child of children) killTree(child)
  process.exitCode = exitCode
  setTimeout(() => process.exit(exitCode), 200)
}

function start(label: string, command: string): ChildProcess {
  const child = spawn(command, { shell: true, stdio: 'inherit' })
  children.push(child)
  child.on('error', (error) => {
    console.error(`[dev] Falha ao arrancar ${label}: ${error.message}`)
    shutdown(1)
  })
  child.on('exit', (code, signal) => {
    if (!shuttingDown) {
      console.log(
        `[dev] ${label} terminou (code=${code ?? 'null'}, signal=${signal ?? 'null'}). A encerrar tudo.`
      )
    }
    shutdown(code ?? 0)
  })
  return child
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

start('servidor de mídia', 'tsx server/index.ts')
start('vite', 'npm run dev:web')
