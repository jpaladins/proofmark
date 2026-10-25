import type { MouseEvent } from 'react'
import type { Lang } from '@/i18n'
import { toUrl, useRoute } from '../router'
import { useLangChoice } from '../useLangChoice'
import { cx } from '../cx'

// Language names in their own language, so they are not part of the per-language dictionaries.
const OPTIONS: { lang: Lang; code: string; name: string }[] = [
  { lang: 'en', code: 'EN', name: 'English' },
  { lang: 'it', code: 'IT', name: 'Italiano' },
]

/** One compact "EN | IT" pill of real links: they work with JS off and in a new tab; a plain click navigates in-page. */
export function LangSwitch() {
  const { page, lang, navigate } = useRoute()
  const { save } = useLangChoice()
  const onClick = (e: MouseEvent<HTMLAnchorElement>, target: Lang) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
    e.preventDefault()
    save(target)
    navigate(page, target, window.location.hash)
  }
  return (
    <div className="flex shrink-0 items-center rounded-full border border-line bg-sunken p-0.5 text-xs font-medium">
      {OPTIONS.map((o) => (
        <a
          key={o.lang}
          href={toUrl(page, o.lang) + window.location.hash}
          hrefLang={o.lang}
          lang={o.lang}
          aria-label={o.name}
          aria-current={o.lang === lang ? 'true' : undefined}
          onClick={(e) => onClick(e, o.lang)}
          className={cx(
            'rounded-full px-2 py-1 transition-colors',
            o.lang === lang ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink',
          )}
        >
          {o.code}
        </a>
      ))}
    </div>
  )
}
