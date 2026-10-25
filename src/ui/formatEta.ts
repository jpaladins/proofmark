import { messages, type Lang } from '@/i18n'

/** Time left for a long operation, in plain words in the page language. */
export function formatEta(sec: number, lang: Lang): string {
  const t = messages(lang).eta
  if (sec < 1) return t.almostDone
  if (sec < 60) return t.seconds(Math.ceil(sec))
  return t.minutes(Math.round(sec / 60))
}
