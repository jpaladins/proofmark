import type { MouseEvent, ReactElement } from 'react'
import type { Lang } from '@/i18n'
import { useT } from '../LangContext'
import { toUrl, useRoute } from '../router'
import { useLangChoice } from '../useLangChoice'

const FLAG = 'h-3 w-4 shrink-0 rounded-[2px] ring-1 ring-inset ring-black/15 dark:ring-white/25'

function FlagGB() {
  return (
    <svg viewBox="0 0 60 40" aria-hidden className={FLAG}>
      <rect width="60" height="40" fill="#012169" />
      <path d="M0 0 60 40M60 0 0 40" stroke="#fff" strokeWidth="8" />
      <path d="M0 0 60 40M60 0 0 40" stroke="#c8102e" strokeWidth="3" />
      <path d="M30 0v40M0 20h60" stroke="#fff" strokeWidth="13" />
      <path d="M30 0v40M0 20h60" stroke="#c8102e" strokeWidth="8" />
    </svg>
  )
}

function FlagIT() {
  return (
    <svg viewBox="0 0 3 2" aria-hidden className={FLAG}>
      <rect width="1" height="2" fill="#009246" />
      <rect x="1" width="1" height="2" fill="#fff" />
      <rect x="2" width="1" height="2" fill="#ce2b37" />
    </svg>
  )
}

// Language names in their own language, so they are not part of the per-language dictionaries.
const OPTIONS: { lang: Lang; name: string; Flag: () => ReactElement }[] = [
  { lang: 'en', name: 'English', Flag: FlagGB },
  { lang: 'it', name: 'Italiano', Flag: FlagIT },
]

/**
 * A flag + name link to the same page in the other language. It works with JS off and in a new
 * tab; a plain click navigates in-page.
 */
export function LangSwitch() {
  const { page, lang, navigate } = useRoute()
  const { save } = useLangChoice()
  const t = useT().layout
  const { lang: target, name, Flag } = OPTIONS.find((o) => o.lang !== lang)!
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
    e.preventDefault()
    save(target)
    navigate(page, target, window.location.hash)
  }
  return (
    <nav aria-label={t.language} className="text-sm">
      <a
        href={toUrl(page, target) + window.location.hash}
        hrefLang={target}
        lang={target}
        onClick={onClick}
        className="flex items-center gap-2 underline-offset-4 hover:text-ink hover:underline"
      >
        <Flag />
        {name}
      </a>
    </nav>
  )
}
