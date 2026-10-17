import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'

const headers = readFileSync(join(process.cwd(), 'public', '_headers'), 'utf8')

test('every page is served with HSTS', () => {
  expect(headers).toMatch(/^\/\*\n(?: {2}.+\n)*? {2}Strict-Transport-Security: max-age=(\d+); includeSubDomains$/m)
  const maxAge = Number(/Strict-Transport-Security: max-age=(\d+)/.exec(headers)![1])
  expect(maxAge).toBeGreaterThanOrEqual(31_536_000)
})
