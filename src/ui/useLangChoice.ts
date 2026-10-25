import { useCallback, useSyncExternalStore } from 'react'
import type { Lang } from '@/i18n'

const KEY = 'pm:lang'
const CHANGE_EVENT = 'pm:lang-change'
/** Holds the choice when storage is unavailable, so it still lasts for this visit. */
let memory: Lang | undefined

function read(): Lang | undefined {
  try {
    const v = localStorage.getItem(KEY)
    // Storage may be readable but not writable (quota, some private modes): fall back to this visit's choice.
    return v === 'en' || v === 'it' ? v : memory
  } catch {
    return memory
  }
}

/** Forgets the in-memory choice; for tests, which share this module across cases. */
export function resetLangMemory() {
  memory = undefined
}

const subscribe = (cb: () => void) => {
  window.addEventListener(CHANGE_EVENT, cb)
  window.addEventListener('storage', cb)
  return () => {
    window.removeEventListener(CHANGE_EVENT, cb)
    window.removeEventListener('storage', cb)
  }
}

/** The language the visitor picked explicitly (undefined until they do), shared by every component that uses it. */
export function useLangChoice(): { saved: Lang | undefined; save: (l: Lang) => void } {
  const saved = useSyncExternalStore(subscribe, read, () => undefined)
  const save = useCallback((l: Lang) => {
    try {
      localStorage.setItem(KEY, l)
    } catch {
      memory = l // storage unavailable: the choice lasts for this visit
    }
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }, [])
  return { saved, save }
}
