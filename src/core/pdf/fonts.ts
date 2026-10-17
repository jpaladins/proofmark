import sansUrl from '@/assets/fonts/pdf/IBMPlexSans-Regular.ttf?url'
import sansMediumUrl from '@/assets/fonts/pdf/IBMPlexSans-Medium.ttf?url'
import sansSemiBoldUrl from '@/assets/fonts/pdf/IBMPlexSans-SemiBold.ttf?url'
import serifSemiBoldUrl from '@/assets/fonts/pdf/IBMPlexSerif-SemiBold.ttf?url'
import monoUrl from '@/assets/fonts/pdf/IBMPlexMono-Regular.ttf?url'
import monoMediumUrl from '@/assets/fonts/pdf/IBMPlexMono-Medium.ttf?url'

/** IBM Plex (SIL OFL 1.1, see src/assets/fonts/OFL.txt), self-hosted and embedded subset in the PDF. */
export type FontBytes = Record<
  'sans' | 'sansMedium' | 'sansSemiBold' | 'serifSemiBold' | 'mono' | 'monoMedium',
  Uint8Array
>

const URLS: Record<keyof FontBytes, string> = {
  sans: sansUrl,
  sansMedium: sansMediumUrl,
  sansSemiBold: sansSemiBoldUrl,
  serifSemiBold: serifSemiBoldUrl,
  mono: monoUrl,
  monoMedium: monoMediumUrl,
}

let cache: Promise<FontBytes> | undefined

export function loadFontBytes(): Promise<FontBytes> {
  cache ??= (async () => {
    const entries = await Promise.all(
      Object.entries(URLS).map(async ([key, url]) => {
        const res = await fetch(url)
        if (!res.ok) throw new Error(`Font non disponibile: ${key}`)
        return [key, new Uint8Array(await res.arrayBuffer())] as const
      }),
    )
    return Object.fromEntries(entries) as FontBytes
  })()
  cache.catch(() => (cache = undefined))
  return cache
}
