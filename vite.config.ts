/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  worker: { format: 'es' },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    include: [
      'src/**/*.test.{ts,tsx}',
      'functions/**/*.test.ts',
      // Dev-only renderers (e.g. sample PDFs): PM_SAMPLES=1 npx vitest run scripts
      ...(process.env.PM_SAMPLES ? ['scripts/**/*.test.ts'] : []),
    ],
  },
})
