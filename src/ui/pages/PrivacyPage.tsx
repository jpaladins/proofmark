import { useLang } from '../LangContext'
import { PrivacyContentEn } from './PrivacyContentEn'
import { PrivacyContentIt } from './PrivacyContentIt'

/** Privacy & security: a long page, written out once per language. */
export function PrivacyPage() {
  const lang = useLang()
  return <article className="max-w-3xl">{lang === 'it' ? <PrivacyContentIt /> : <PrivacyContentEn />}</article>
}
