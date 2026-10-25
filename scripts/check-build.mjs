// Verifies the build output: every page has a copy of index.html in the right language.
// Run after `npm run build`; exits non-zero with a message on the first problems found.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dist = fileURLToPath(new URL('../dist/', import.meta.url))
const EN = 'ProofMark — Digital proof of existence'
const IT = 'ProofMark — Prova di esistenza digitale'

const expected = {
  'index.html': 'en',
  'verify/index.html': 'en',
  'privacy/index.html': 'en',
  'it/index.html': 'it',
  'it/verifica/index.html': 'it',
  'it/privacy/index.html': 'it',
  'verifica/index.html': 'it', // legacy URL, redirected by the router
  '404.html': 'en',
}

const errors = []
for (const [file, lang] of Object.entries(expected)) {
  const path = join(dist, file)
  if (!existsSync(path)) {
    errors.push(`missing: dist/${file}`)
    continue
  }
  const html = readFileSync(path, 'utf8')
  if (!html.includes(`<html lang="${lang}"`)) errors.push(`dist/${file}: expected <html lang="${lang}">`)
  if (!html.includes(`<title>${lang === 'en' ? EN : IT}</title>`)) errors.push(`dist/${file}: expected the ${lang} <title>`)
}

if (errors.length) {
  console.error(`check:build failed:\n${errors.map((e) => `  - ${e}`).join('\n')}`)
  process.exit(1)
}
console.log(`check:build ok: ${Object.keys(expected).length} files`)
