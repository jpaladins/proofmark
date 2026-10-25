import { messages, type Lang } from '@/i18n'
import { certLang, type Certificate } from './certificate'

/** "opera.zip" → "opera"; a bare ".zip" falls back to the word for "archive" in `lang`. */
export function baseName(zipName: string, lang: Lang): string {
  return zipName.replace(/\.zip$/i, '') || messages(lang).files.archive
}

/**
 * Names of the files a certificate is saved as. The same names are used for the downloads and for
 * the attachments and instructions inside the PDF, so what the PDF mentions is what the user has.
 * The suffix is in the certificate's language (`_receipt` / `_ricevuta`…).
 */
export function proofFileNames(cert: Pick<Certificate, 'kind' | 'file' | 'lang'>): { pdf: string; json: string; ots: string } {
  const lang = certLang(cert)
  const base = baseName(cert.file.name, lang)
  const files = messages(lang).files
  const suffix = cert.kind === 'attestato' ? files.attestation : files.receipt
  return { pdf: `${base}_${suffix}.pdf`, json: `${base}_${suffix}.json`, ots: `${base}.ots` }
}
