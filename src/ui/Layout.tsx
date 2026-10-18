import type { ReactNode } from 'react'
import { APP_VERSION, REPO_URL } from '@/core/app'
import { Header } from './components/Header'

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#contenuto"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2"
      >
        Vai al contenuto
      </a>
      <Header />
      <main id="contenuto" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
        {children}
      </main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-3 px-4 py-6 text-sm text-muted sm:px-6">
          <p>
            ProofMark {APP_VERSION}, open source con licenza MIT. Nessun dato personale raccolto, nessun cookie.
          </p>
          <a className="underline-offset-4 hover:text-ink hover:underline" href={REPO_URL}>
            Codice sorgente
          </a>
        </div>
      </footer>
    </div>
  )
}
