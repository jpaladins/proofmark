// The app's pages and their URLs per language. Shared by the router and by the build, which publishes
// a copy of index.html for each one so a direct link (or a QR code) works on GitHub Pages.
// No `@/` imports and no import.meta.env: vite.config.ts loads this file directly.
import type { Lang } from './i18n/types.ts'

export type PageId = 'certify' | 'verify' | 'privacy'

/** Paths relative to the site base; English is the default and lives at the root. */
export const ROUTES: Record<Lang, Record<PageId, string>> = {
  en: { certify: '/', verify: '/verify', privacy: '/privacy' },
  it: { certify: '/it/', verify: '/it/verifica', privacy: '/it/privacy' },
}

/** Old Italian-only URLs (printed QR codes and calendar events point here); redirected to the new routes. */
export const LEGACY: Record<string, { page: PageId; lang: Lang }> = {
  '/verifica': { page: 'verify', lang: 'it' },
}

export function allPaths(): { path: string; lang: Lang }[] {
  const routes = (Object.keys(ROUTES) as Lang[]).flatMap((lang) =>
    Object.values(ROUTES[lang]).map((path) => ({ path, lang })),
  )
  const legacy = Object.entries(LEGACY).map(([path, { lang }]) => ({ path, lang }))
  return [...routes, ...legacy]
}
