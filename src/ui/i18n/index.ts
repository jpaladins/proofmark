import type { Lang } from '@/i18n'
import { useLang } from '../LangContext'
import { enRich, type UiRich } from './en'
import { itRich } from './it'

export type { UiRich }

const RICH: Record<Lang, UiRich> = { en: enRich, it: itRich }

/** Rich page text (React nodes with links, code and emphasis) in the page language. */
export const useRich = (): UiRich => RICH[useLang()]
