import { useCallback, useSyncExternalStore } from 'react'

export type Path = '/' | '/verifica'
const NAV_EVENT = 'pm:navigate'

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
  if (window.location.pathname === to && !window.location.hash) return
  window.history.pushState(null, '', to)
  window.dispatchEvent(new Event(NAV_EVENT))
  window.scrollTo?.({ top: 0 })
}

/** Minimal History-API router: two pages, plus the `#sha256=` fragment used by QR codes. */
export function useRoute(): { path: Path; navigate: (p: Path) => void; hashParams: URLSearchParams } {
  const current = useSyncExternalStore(subscribe, snapshot, () => '/')
  const [pathname, hash = ''] = current.split('#')
  const path: Path = pathname.replace(/\/+$/, '') === '/verifica' ? '/verifica' : '/'
  return { path, navigate: useCallback((p: Path) => navigate(p), []), hashParams: new URLSearchParams(hash) }
}
