// Verifica que todas as chaves usadas com t('...') / i18n.t('...') existem
// em src/locales/{en,pt}/translations.json. Com --write acrescenta as que
// faltam (em inglês, com o próprio texto) para depois serem traduzidas.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// fileURLToPath descodifica espaços (%20) e letras de unidade no Windows.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const srcDir = path.join(root, 'src')
const write = process.argv.includes('--write')
const pattern = /\bt\(\s*'((?:[^'\\]|\\.)+)'/g

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === 'locales' ? [] : walk(full)
    return /\.(tsx?|jsx?)$/.test(entry.name) ? [full] : []
  })
}

const keys = new Set()
for (const file of walk(srcDir)) {
  for (const match of fs.readFileSync(file, 'utf8').matchAll(pattern)) keys.add(match[1].replace(/\\'/g, "'"))
}

let missingTotal = 0
for (const language of ['en', 'pt']) {
  const file = path.join(srcDir, 'locales', language, 'translations.json')
  const translations = JSON.parse(fs.readFileSync(file, 'utf8'))
  const missing = [...keys].filter((key) => !(key in translations))
  const unused = Object.keys(translations).filter((key) => !keys.has(key))
  missingTotal += missing.length
  console.log(`${language}: ${keys.size} chaves, ${missing.length} em falta, ${unused.length} sem uso`)
  for (const key of missing) console.log(`  + ${key}`)
  if (write && missing.length) {
    for (const key of missing) translations[key] = key
    const sorted = Object.fromEntries(Object.entries(translations).sort(([a], [b]) => a.localeCompare(b)))
    fs.writeFileSync(file, `${JSON.stringify(sorted, null, 2)}\n`)
  }
}
if (missingTotal && !write) process.exitCode = 1
