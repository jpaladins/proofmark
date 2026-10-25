// Verifies the build output: every page has a copy of index.html in the right language, with the
// Content Security Policy and the meta description of that language.
// Run after `npm run build`; exits non-zero with a message on the first problems found.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
// Node strips the types of the dictionaries (they use relative `.ts` imports for this reason).
import { messages } from '../src/i18n/index.ts'

const dist = fileURLToPath(new URL('../dist/', import.meta.url))

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

const unescape = (s) =>
  s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')

/** The value of `<meta {attr}="{value}" content="…">`, decoded, or undefined when the tag is missing. */
function metaContent(html, attr, value) {
  const tag = html.match(new RegExp(`<meta\\s+[^>]*${attr}="${value}"[^>]*>`, 'i'))?.[0]
  const content = tag?.match(/content="([^"]*)"/)?.[1]
  return content === undefined ? undefined : unescape(content)
}

const errors = []
for (const [file, lang] of Object.entries(expected)) {
  const path = join(dist, file)
  if (!existsSync(path)) {
    errors.push(`missing: dist/${file}`)
    continue
  }
  const html = readFileSync(path, 'utf8')
  const { title, description } = messages(lang).app
  if (!html.includes(`<html lang="${lang}"`)) errors.push(`dist/${file}: expected <html lang="${lang}">`)
  if (!html.includes(`<title>${title}</title>`)) errors.push(`dist/${file}: expected the ${lang} <title>`)
  const csp = metaContent(html, 'http-equiv', 'Content-Security-Policy')
  if (!csp?.includes("default-src 'self'")) errors.push(`dist/${file}: expected the Content-Security-Policy meta tag`)
  if (metaContent(html, 'name', 'description') !== description) errors.push(`dist/${file}: expected the ${lang} meta description`)
}

if (errors.length) {
  console.error(`check:build failed:\n${errors.map((e) => `  - ${e}`).join('\n')}`)
  process.exit(1)
}
console.log(`check:build ok: ${Object.keys(expected).length} files`)
