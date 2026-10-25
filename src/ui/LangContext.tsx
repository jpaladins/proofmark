import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { messages, type Lang, type Messages } from '@/i18n'
import { useRoute } from './router'

const LangCtx = createContext<Lang>('en')

/** Provides the language of the current URL and keeps <html lang> and the tab title in step with it. */
export function LangProvider({ children }: { children: ReactNode }) {
  const { lang } = useRoute()
  useEffect(() => {
    document.documentElement.lang = lang
    document.title = messages(lang).app.title
  }, [lang])
  return <LangCtx.Provider value={lang}>{children}</LangCtx.Provider>
}

// oxlint-disable-next-line react/only-export-components
export const useLang = (): Lang => useContext(LangCtx)
// oxlint-disable-next-line react/only-export-components
export const useT = (): Messages => messages(useLang())
