import { useCallback, useSyncExternalStore } from 'react'
import { PAGES, type Path } from '@/pages'

export type { Path }
const NAV_EVENT = 'pm:navigate'
/** Site prefix on GitHub Pages ('/proofmark'), '' when served from the root. */
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '')

/** The URL path for an app page, including the site prefix. */
export function toUrl(path: Path): string {
  return path === '/' ? `${BASE}/` : `${BASE}${path}`
}

function pageOf(pathname: string): Path {
  const inner = pathname.startsWith(BASE) ? pathname.slice(BASE.length) : pathname
  const clean = inner.replace(/\/+$/, '') || '/'
  return (PAGES as readonly string[]).includes(clean) ? (clean as Path) : '/'
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

export function navigate(to: Path) {
  const url = toUrl(to)
  if (window.location.pathname === url && !window.location.hash) return
  window.history.pushState(null, '', url)
  window.dispatchEvent(new Event(NAV_EVENT))
  window.scrollTo?.({ top: 0 })
}

/** Minimal History-API router: two pages, plus the `#sha256=` fragment used by QR codes. */
export function useRoute(): { path: Path; navigate: (p: Path) => void; hashParams: URLSearchParams } {
  const current = useSyncExternalStore(subscribe, snapshot, () => '/')
  const [pathname, hash = ''] = current.split('#')
  const path = pageOf(pathname)
  return { path, navigate: useCallback((p: Path) => navigate(p), []), hashParams: new URLSearchParams(hash) }
}
