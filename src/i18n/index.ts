// Relative imports only: vite.config.ts imports this module, where the `@/` alias is unavailable.
import { en } from './en.ts'
import { it, type ItMessages } from './it.ts'
import type { Lang } from './types.ts'

export { LANGS } from './types.ts'
export type { Lang } from './types.ts'
export type Messages = typeof en

const dictionaries: Record<Lang, Messages> = { en, it }

export function messages(lang: 'it'): ItMessages
export function messages(lang: Lang): Messages
export function messages(lang: Lang): Messages {
  return dictionaries[lang]
}

export const localeOf = (lang: Lang): 'en-GB' | 'it-IT' => (lang === 'en' ? 'en-GB' : 'it-IT')

const UNITS: Record<Lang, string[]> = {
  en: ['bytes', 'KB', 'MB', 'GB', 'TB'],
  it: ['byte', 'KB', 'MB', 'GB', 'TB'],
}

export function formatBytes(size: number, lang: Lang): string {
  const units = UNITS[lang]
  let v = size
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return i === 0 ? `${size} ${units[0]}` : `${v.toLocaleString(localeOf(lang), { maximumFractionDigits: 1 })} ${units[i]}`
}
