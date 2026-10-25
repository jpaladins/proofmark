import type { ReactNode } from 'react'
import { APP_VERSION, DEVELOPER, REPO_URL } from '@/core/app'
import { Header } from './components/Header'
import { useT } from './LangContext'
import { toUrl, useRoute } from './router'

export function Layout({ children }: { children: ReactNode }) {
  const { lang, navigate } = useRoute()
  const t = useT().layout
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2"
      >
        {t.skip}
      </a>
      <Header />
      <main id="content" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
        {children}
      </main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-3 px-4 py-6 text-sm text-muted sm:px-6">
          <p>{t.about(APP_VERSION)}</p>
          <nav aria-label={t.footerNav} className="flex flex-wrap gap-x-5 gap-y-2">
            <a
              className="underline-offset-4 hover:text-ink hover:underline"
              href={toUrl('privacy', lang)}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
                e.preventDefault()
                navigate('privacy')
              }}
            >
              {t.privacy}
            </a>
            <a className="underline-offset-4 hover:text-ink hover:underline" href={REPO_URL}>
              {t.source}
            </a>
          </nav>
        </div>
        <div className="border-t border-line/60">
          <p className="mx-auto max-w-6xl px-4 py-4 text-center text-xs text-muted sm:px-6">
            Developed by{' '}
            <a
              className="font-medium text-ink-2 underline-offset-4 hover:text-ink hover:underline"
              href={DEVELOPER.url}
            >
              {DEVELOPER.name}
            </a>
          </p>
        </div>
      </footer>
    </div>
  )
}
