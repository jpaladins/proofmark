import { X } from 'lucide-react'
import { messages } from '@/i18n'
import { toUrl, useRoute } from '../router'
import { useLangChoice } from '../useLangChoice'

/** Slim bar offering the Italian version to Italian browsers on an English page; always Italian, whatever the page language. */
export function ItalianNotice() {
  const { page, lang, navigate } = useRoute()
  const { saved, save } = useLangChoice()
  const t = messages('it').notice
  const first = typeof navigator === 'undefined' ? undefined : navigator.languages?.[0]
  if (lang !== 'en' || saved !== undefined || !first?.toLowerCase().startsWith('it')) return null
  return (
    <div lang="it" className="border-b border-amber/30 bg-amber-soft text-ink">
      <div className="mx-auto flex max-w-6xl items-center gap-x-3 gap-y-1 px-4 py-2 text-sm sm:px-6">
        <p className="min-w-0 flex-1">
          {t.text}{' '}
          <a
            href={toUrl(page, 'it') + window.location.hash}
            hrefLang="it"
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
              e.preventDefault()
              save('it')
              navigate(page, 'it', window.location.hash)
            }}
            className="font-medium underline underline-offset-4"
          >
            {t.switchTo}
          </a>
        </p>
        <button
          type="button"
          onClick={() => save('en')}
          aria-label={t.close}
          className="grid size-7 shrink-0 place-items-center rounded-md text-muted transition-colors hover:text-ink"
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>
    </div>
  )
}
