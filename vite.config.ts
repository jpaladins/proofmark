/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin } from 'vite'
import { CSP } from './src/csp.ts'
import { messages, type Lang } from './src/i18n/index.ts'
import { allPaths } from './src/pages.ts'

// Published as a GitHub Pages project site: https://jpaladins.github.io/proofmark/
const BASE = '/proofmark/'

const escapeAttr = (v: string) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;')

/** The English index.html with <html lang>, <title> and the description swapped for another language. */
function localize(html: string, lang: Lang): string {
  const { title, description } = messages(lang).app
  return html
    .replace(/<html lang="[^"]*"/, `<html lang="${lang}"`)
    .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
    .replace(/(<meta name="description" content=")[^"]*"/, `$1${escapeAttr(description)}"`)
}

/** Build-only: CSP as a <meta> tag, plus a localized copy of index.html per page so direct links (and QR codes) load the app. */
function githubPages(): Plugin {
  return {
    name: 'proofmark:github-pages',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' },
      { tag: 'meta', attrs: { name: 'referrer', content: 'no-referrer' }, injectTo: 'head-prepend' },
    ],
    generateBundle(_, bundle) {
      const index = bundle['index.html']
      if (!index || index.type !== 'asset') this.error('index.html missing from the bundle')
      const html = String(index.source)
      for (const { path, lang } of allPaths()) {
        if (path === '/') continue // index.html itself, already English
        this.emitFile({ type: 'asset', fileName: `${path.replace(/^\/|\/$/g, '')}/index.html`, source: localize(html, lang) })
      }
      // Unknown URLs: the router resolves the real page at runtime.
      this.emitFile({ type: 'asset', fileName: '404.html', source: html })
    },
  }
}

export default defineConfig({
  base: BASE,
  plugins: [react(), tailwindcss(), githubPages()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  worker: { format: 'es' },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    include: [
      'src/**/*.test.{ts,tsx}',
      // Dev-only renderers (e.g. sample PDFs): PM_SAMPLES=1 npx vitest run scripts
      ...(process.env.PM_SAMPLES ? ['scripts/**/*.test.ts'] : []),
    ],
  },
})
