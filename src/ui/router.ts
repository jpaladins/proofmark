import { useCallback, useEffect, useSyncExternalStore } from 'react'
import type { Lang } from '@/i18n'
import { LEGACY, ROUTES, type PageId } from '@/pages'

export type { PageId }
const NAV_EVENT = 'pm:navigate'
/** Site prefix on GitHub Pages ('/proofmark'), '' when served from the root. */
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '')

/** The URL path for an app page, including the site prefix. */
export function toUrl(page: PageId, lang: Lang): string {
  const path = ROUTES[lang][page]
  return path === '/' ? `${BASE}/` : `${BASE}${path}`
}

const norm = (p: string) => p.replace(/\/+$/, '') || '/'

/** Resolves a location pathname; unknown paths fall back to the certify page of the language they sit under. */
export function routeOf(pathname: string): { page: PageId; lang: Lang; legacy: boolean } {
  const inner = norm(pathname.startsWith(BASE) ? pathname.slice(BASE.length) : pathname)
  const legacy = LEGACY[inner]
  if (legacy) return { ...legacy, legacy: true }
  for (const lang of ['en', 'it'] as const) {
    for (const page of Object.keys(ROUTES[lang]) as PageId[]) {
      if (norm(ROUTES[lang][page]) === inner) return { page, lang, legacy: false }
    }
  }
  const lang: Lang = inner === '/it' || inner.startsWith('/it/') ? 'it' : 'en'
  return { page: 'certify', lang, legacy: false }
}

const subscribe = (cb: () => void) => {
  window.addEventListener('popstate', cb)
  window.addEventListener('hashchange', cb)
  window.addEventListener(NAV_EVENT, cb)
  return () => {
    window.removeEventListener('popstate', cb)
    window.removeEventListener('hashchange', cb)
    window.removeEventListener(NAV_EVENT, cb)
  }
}

const snapshot = () => window.location.pathname + window.location.hash

/** `hash` (with its `#`) is carried over, as when the language changes on a page that holds a `#sha256=`. */
export function navigate(page: PageId, lang: Lang, hash = '') {
  const url = toUrl(page, lang) + hash
  if (window.location.pathname + window.location.hash === url) return
  window.history.pushState(null, '', url)
  window.dispatchEvent(new Event(NAV_EVENT))
  window.scrollTo?.({ top: 0 })
}

/** Minimal History-API router: three pages in two languages, plus the `#sha256=` fragment used by QR codes. */
export function useRoute(): {
  page: PageId
  lang: Lang
  navigate: (page: PageId, lang?: Lang, hash?: string) => void
  hashParams: URLSearchParams
} {
  const current = useSyncExternalStore(subscribe, snapshot, () => '/')
  const [pathname, hash = ''] = current.split('#')
  const { page, lang, legacy } = routeOf(pathname)
  useEffect(() => {
    // Rewrites an old URL in place; it no longer matches a legacy path afterwards, so this runs once.
    if (legacy) window.history.replaceState(null, '', toUrl(page, lang) + (hash ? `#${hash}` : ''))
  }, [legacy, page, lang, hash])
  const go = useCallback((p: PageId, l?: Lang, h?: string) => navigate(p, l ?? lang, h), [lang])
  return { page, lang, navigate: go, hashParams: new URLSearchParams(hash) }
}
