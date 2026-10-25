import { render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, test } from 'vitest'
import App from '@/App'
import { ROUTES, type PageId } from '@/pages'
import { routeOf, toUrl } from './router'

afterEach(() => window.history.replaceState(null, '', '/'))

describe('routeOf', () => {
  test.each([
    ['/proofmark/', 'certify', 'en', false],
    ['/proofmark/verify', 'verify', 'en', false],
    ['/proofmark/it/', 'certify', 'it', false],
    ['/proofmark/it', 'certify', 'it', false],
    ['/proofmark/it/verifica/', 'verify', 'it', false],
    ['/proofmark/verifica', 'verify', 'it', true],
    ['/proofmark/it/nope', 'certify', 'it', false],
    ['/proofmark/nope', 'certify', 'en', false],
  ] as const)('%s', (pathname, page, lang, legacy) => {
    expect(routeOf(pathname)).toEqual({ page, lang, legacy })
  })
})

describe('toUrl', () => {
  test('round-trips every route', () => {
    for (const lang of ['en', 'it'] as const) {
      for (const page of Object.keys(ROUTES[lang]) as PageId[]) {
        expect(routeOf(toUrl(page, lang))).toEqual({ page, lang, legacy: false })
      }
    }
  })

  test('puts English at the site root and Italian under /it/', () => {
    expect(toUrl('certify', 'en')).toBe('/proofmark/')
    expect(toUrl('certify', 'it')).toBe('/proofmark/it/')
  })
})

test('a legacy /verifica link is redirected to the Italian route, keeping the QR fragment', () => {
  const hash = 'a'.repeat(64)
  window.history.replaceState(null, '', `/proofmark/verifica#sha256=${hash}`)
  render(createElement(App))
  expect(window.location.pathname).toBe('/proofmark/it/verifica')
  expect(window.location.hash).toBe(`#sha256=${hash}`)
  expect(screen.getByText(hash)).toBeInTheDocument()
})
