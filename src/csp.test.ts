// @vitest-environment node
import { expect, test } from 'vitest'
import { CSP } from './csp'

const directive = (name: string) => CSP.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${name} `)) ?? ''

test('scripts only come from the site itself (plus WebAssembly for hashing)', () => {
  expect(directive('script-src')).toBe("script-src 'self' 'wasm-unsafe-eval'")
})

test('the network is limited to the OpenTimestamps calendars and the Bitcoin block explorer', () => {
  expect(directive('connect-src')).toBe(
    "connect-src 'self' https://*.opentimestamps.org https://*.eternitywall.com https://blockstream.info",
  )
})

test('no DigiCert relay or other origins remain', () => {
  expect(CSP).not.toMatch(/digicert|api\/tsa/i)
  expect(directive('default-src')).toBe("default-src 'self'")
  expect(directive('form-action')).toBe("form-action 'none'")
})

test('only uses directives that work in a <meta> tag', () => {
  for (const unsupported of ['frame-ancestors', 'report-uri', 'sandbox']) expect(CSP).not.toContain(unsupported)
})
