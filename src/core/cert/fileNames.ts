import type { Certificate } from './certificate'

/** "archivio.zip" → "archivio" */
export function baseName(zipName: string): string {
  return zipName.replace(/\.zip$/i, '') || 'archivio'
}

/**
 * Names of the files a certificate is saved as. The same names are used for the downloads and for
 * the attachments and instructions inside the PDF, so what the PDF mentions is what the user has.
 */
export function proofFileNames(cert: Pick<Certificate, 'kind' | 'file'>): { pdf: string; json: string; ots: string } {
  const base = baseName(cert.file.name)
  const suffix = cert.kind === 'attestato' ? 'attestato' : 'ricevuta'
  return { pdf: `${base}_${suffix}.pdf`, json: `${base}_${suffix}.json`, ots: `${base}.ots` }
}
