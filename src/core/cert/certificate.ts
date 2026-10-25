import { APP_URL, APP_VERSION } from '@/core/app'
import { bytesToBase64 } from '@/core/base64'
import type { OtsInfo } from '@/core/ots/ots'
import { LANGS, messages, type Lang } from '@/i18n'

/** Note stored with the declared data, in the certificate's language. */
export const declaredNote = (lang: Lang): string => messages(lang).cert.declaredNote
export const DECLARED_MAX = 120

/**
 * A ProofMark document. The only proof of time is the OpenTimestamps (Bitcoin) proof in
 * `opentimestamps.otsBase64`; every other field is descriptive and must be checked against it.
 * - `ricevuta`: issued at once, the proof is still pending, no date is attested yet.
 * - `attestato`: issued after the Bitcoin confirmation, attests existence at the block's time.
 */
export type Certificate = {
  schema: 'proofmark/v1'
  id: string
  kind: 'ricevuta' | 'attestato'
  createdAt: string
  /** Time of the request from the user's device clock: declared, not certified. */
  requestedAt: string
  /** Language of the documents. Absent on certificates issued before the English version: Italian. */
  lang?: Lang
  /** `note` is human text in the certificate's language; any value is accepted when parsing. */
  declared?: { author?: string; title?: string; note: string }
  file: { name: string; size: number; lastModified: string; sha256: string }
  opentimestamps: {
    status: 'pending' | 'confirmed'
    calendars: string[]
    otsBase64: string
    block?: number
    blockTime?: string
  }
  app: { version: string; url: typeof APP_URL }
}

export class CertError extends Error {
  readonly code: 'schema' | 'json'
  constructor(code: 'schema' | 'json', message: string) {
    super(message)
    this.name = 'CertError'
    this.code = code
  }
}

/** PM-<first 12 hash chars, uppercase>-<YYYYMMDD of the request in UTC> */
export function makeCertificateId(sha256Hex: string, requestedAt: Date): string {
  const day = requestedAt.toISOString().slice(0, 10).replaceAll('-', '')
  return `PM-${sha256Hex.slice(0, 12).toUpperCase()}-${day}`
}

/** Language a certificate's documents are written in. */
export const certLang = (c: Pick<Certificate, 'lang'>): Lang => c.lang ?? 'it'

function cleanDeclared(lang: Lang, declared?: { author?: string; title?: string }): Certificate['declared'] {
  const author = declared?.author?.trim().slice(0, DECLARED_MAX)
  const title = declared?.title?.trim().slice(0, DECLARED_MAX)
  if (!author && !title) return undefined
  return { ...(author ? { author } : {}), ...(title ? { title } : {}), note: declaredNote(lang) }
}

/** Builds the receipt issued right after the hash was submitted to the calendars. */
export function buildCertificate(input: {
  file: File
  sha256: string
  ots: Uint8Array
  otsInfo: OtsInfo
  requestedAt?: Date
  declared?: { author?: string; title?: string }
  lang: Lang
}): Certificate {
  const { file, sha256, ots, otsInfo } = input
  const requestedAt = input.requestedAt ?? new Date()
  const declared = cleanDeclared(input.lang, input.declared)
  return {
    schema: 'proofmark/v1',
    id: makeCertificateId(sha256, requestedAt),
    kind: 'ricevuta',
    lang: input.lang,
    createdAt: new Date().toISOString(),
    requestedAt: requestedAt.toISOString(),
    ...(declared ? { declared } : {}),
    file: { name: file.name, size: file.size, lastModified: new Date(file.lastModified).toISOString(), sha256 },
    opentimestamps: { status: 'pending', calendars: otsInfo.calendars, otsBase64: bytesToBase64(ots) },
    app: { version: APP_VERSION, url: APP_URL },
  }
}

/** Turns a receipt into the attestation, once the proof is confirmed in a Bitcoin block. */
export function confirmCertificate(
  cert: Certificate,
  ots: Uint8Array,
  confirmed: { block: number; blockTime: Date },
): Certificate {
  return {
    ...cert,
    kind: 'attestato',
    createdAt: new Date().toISOString(),
    opentimestamps: {
      status: 'confirmed',
      calendars: cert.opentimestamps.calendars,
      otsBase64: bytesToBase64(ots),
      block: confirmed.block,
      blockTime: confirmed.blockTime.toISOString(),
    },
    app: { version: APP_VERSION, url: APP_URL },
  }
}

export function serializeCertificate(c: Certificate): string {
  return JSON.stringify(c, null, 2)
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isStr = (v: unknown): v is string => typeof v === 'string'

export function parseCertificate(json: string): Certificate {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    throw new CertError('json', 'Il certificato non è un file JSON valido.')
  }
  const invalid = (why: string) => new CertError('schema', `Certificato ProofMark non valido: ${why}.`)
  if (!isObj(data) || data.schema !== 'proofmark/v1') throw invalid('formato sconosciuto')
  const { file, opentimestamps } = data
  if (!isStr(data.id) || !isStr(data.createdAt) || !isStr(data.requestedAt)) throw invalid('intestazione incompleta')
  if (data.kind !== 'ricevuta' && data.kind !== 'attestato') throw invalid('tipo di documento sconosciuto')
  // A missing language means Italian (certificates issued before the English version).
  if (data.lang !== undefined && !LANGS.includes(data.lang as Lang)) throw invalid('lingua sconosciuta')
  if (!isObj(file) || !isStr(file.name) || typeof file.size !== 'number' || !isStr(file.lastModified)) {
    throw invalid('dati del file mancanti')
  }
  if (!isStr(file.sha256) || !/^[0-9a-f]{64}$/.test(file.sha256)) throw invalid('impronta SHA-256 non valida')
  if (
    !isObj(opentimestamps) ||
    !['pending', 'confirmed'].includes(opentimestamps.status as string) ||
    !Array.isArray(opentimestamps.calendars) ||
    !isStr(opentimestamps.otsBase64)
  ) {
    throw invalid('prova Bitcoin mancante o non valida')
  }
  return data as unknown as Certificate
}
