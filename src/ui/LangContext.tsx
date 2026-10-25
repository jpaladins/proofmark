import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { messages, type Lang, type Messages } from '@/i18n'
import { useRoute } from './router'

const LangCtx = createContext<Lang | undefined>(undefined)

/** Provides the language of the current URL and keeps <html lang> and the tab title in step with it. */
export function LangProvider({ children }: { children: ReactNode }) {
  const { lang } = useRoute()
  useEffect(() => {
    document.documentElement.lang = lang
    document.title = messages(lang).app.title
  }, [lang])
  return <LangCtx.Provider value={lang}>{children}</LangCtx.Provider>
}

/** The page language; a component rendered outside the provider (as in tests) follows the URL. */
// oxlint-disable-next-line react/only-export-components
export function useLang(): Lang {
  const provided = useContext(LangCtx)
  const { lang } = useRoute()
  return provided ?? lang
}
// oxlint-disable-next-line react/only-export-components
export const useT = (): Messages => messages(useLang())
