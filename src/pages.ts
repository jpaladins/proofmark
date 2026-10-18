// The app's pages. Shared by the router and by the build, which publishes a copy of index.html for
// each one so a direct link (or a QR code) works on GitHub Pages.
export const PAGES = ['/', '/verifica', '/privacy'] as const
export type Path = (typeof PAGES)[number]
