import { ROUTES } from '@/pages'
import type { Lang } from '@/i18n'

export const APP_VERSION = '1.0.0'
export const APP_HOST = 'jpaladins.github.io'
export const APP_URL = `https://${APP_HOST}/proofmark`
/** Verify page in the given language; documents link to the one they are written in. */
export const verifyUrlFor = (lang: Lang): string => `${APP_URL}${ROUTES[lang].verify}`
/** Verify address printed on documents and in reminders, without the scheme. */
export const verifyDisplayFor = (lang: Lang): string => verifyUrlFor(lang).replace(/^https:\/\//, '')
export const REPO_URL = 'https://github.com/jpaladins/proofmark'
export const DEVELOPER = { name: 'JPaladins', url: 'https://github.com/jpaladins' }
