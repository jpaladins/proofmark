/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin } from 'vite'
import { CSP } from './src/csp.ts'
import { PAGES } from './src/pages.ts'

// Published as a GitHub Pages project site: https://jpaladins.github.io/proofmark/
const BASE = '/proofmark/'

/** Build-only: CSP as a <meta> tag, plus copies of index.html so /verifica (and any deep link) loads the app. */
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
      const pageFiles = PAGES.filter((p) => p !== '/').map((p) => `${p.slice(1)}/index.html`)
      for (const fileName of [...pageFiles, '404.html']) {
        this.emitFile({ type: 'asset', fileName, source: index.source })
      }
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
