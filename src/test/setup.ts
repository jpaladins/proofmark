import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'

// Vitest always reports BASE_URL '/', but the site is published under /proofmark/ (vite.config.ts).
vi.stubEnv('BASE_URL', '/proofmark/')

// Vitest runs without globals, so Testing Library cannot register its own cleanup.
afterEach(async () => {
  if (typeof document === 'undefined') return
  const { cleanup } = await import('@testing-library/react')
  cleanup()
})
