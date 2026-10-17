import { APP_URL, APP_VERSION } from '@/core/app'
import { bytesToBase64 } from '@/core/base64'
import type { OtsInfo } from '@/core/ots/ots'
import type { TsaResult } from '@/core/tsa/rfc3161'

export const DECLARED_NOTE = 'dichiarati dal richiedente, non certificati'
export const DECLARED_MAX = 120

export type Certificate = {
  schema: 'proofmark/v1'
  id: string
  revision: 1 | 2
  createdAt: string
  declared?: { author?: string; title?: string; note: typeof DECLARED_NOTE }
  file: { name: string; size: number; lastModified: string; sha256: string }
  rfc3161: { tsa: string; genTime: string; serial: string; policy: string; nonce?: string; tokenBase64: string }
  opentimestamps: {
    status: 'pending' | 'confirmed' | 'unavailable'
    calendars: string[]
    otsBase64?: string
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

/** PM-<first 12 hash chars, uppercase>-<YYYYMMDD of the stamp in UTC>[-R2] */
export function makeCertificateId(sha256Hex: string, genTime: Date, revision: 1 | 2): string {
  const day = genTime.toISOString().slice(0, 10).replaceAll('-', '')
  return `PM-${sha256Hex.slice(0, 12).toUpperCase()}-${day}${revision === 2 ? '-R2' : ''}`
}

function cleanDeclared(declared?: { author?: string; title?: string }): Certificate['declared'] {
  const author = declared?.author?.trim().slice(0, DECLARED_MAX)
  const title = declared?.title?.trim().slice(0, DECLARED_MAX)
  if (!author && !title) return undefined
  return { ...(author ? { author } : {}), ...(title ? { title } : {}), note: DECLARED_NOTE }
}

export function buildCertificate(input: {
  file: File
  sha256: string
  tsa: TsaResult
  ots?: Uint8Array
  otsInfo?: OtsInfo
  declared?: { author?: string; title?: string }
}): Certificate {
  const { file, sha256, tsa, ots, otsInfo } = input
  const declared = cleanDeclared(input.declared)
  return {
    schema: 'proofmark/v1',
    id: makeCertificateId(sha256, tsa.info.genTime, 1),
    revision: 1,
    createdAt: new Date().toISOString(),
    ...(declared ? { declared } : {}),
    file: { name: file.name, size: file.size, lastModified: new Date(file.lastModified).toISOString(), sha256 },
    rfc3161: {
      tsa: tsa.info.tsa,
      genTime: tsa.info.genTime.toISOString(),
      serial: tsa.info.serialHex,
      policy: tsa.info.policy,
      ...(tsa.info.nonce !== undefined ? { nonce: tsa.info.nonce.toString(16) } : {}),
      tokenBase64: bytesToBase64(tsa.token),
    },
    opentimestamps:
      ots && otsInfo
        ? {
            status: otsInfo.status,
            calendars: otsInfo.calendars,
            otsBase64: bytesToBase64(ots),
            ...(otsInfo.block !== undefined ? { block: otsInfo.block } : {}),
          }
        : { status: 'unavailable', calendars: [] },
    app: { version: APP_VERSION, url: APP_URL },
  }
}

export function upgradeCertificate(
  cert: Certificate,
  ots: Uint8Array,
  confirmed: { block: number; blockTime: Date },
): Certificate {
  return {
    ...cert,
    id: makeCertificateId(cert.file.sha256, new Date(cert.rfc3161.genTime), 2),
    revision: 2,
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
  const { file, rfc3161, opentimestamps } = data
  if (!isStr(data.id) || !(data.revision === 1 || data.revision === 2) || !isStr(data.createdAt)) {
    throw invalid('intestazione incompleta')
  }
  if (!isObj(file) || !isStr(file.name) || typeof file.size !== 'number' || !isStr(file.lastModified)) {
    throw invalid('dati del file mancanti')
  }
  if (!isStr(file.sha256) || !/^[0-9a-f]{64}$/.test(file.sha256)) throw invalid('impronta SHA-256 non valida')
  if (!isObj(rfc3161) || !isStr(rfc3161.tokenBase64) || !isStr(rfc3161.genTime) || !isStr(rfc3161.tsa)) {
    throw invalid('marca temporale mancante')
  }
  if (
    !isObj(opentimestamps) ||
    !['pending', 'confirmed', 'unavailable'].includes(opentimestamps.status as string) ||
    !Array.isArray(opentimestamps.calendars)
  ) {
    throw invalid('dati OpenTimestamps non validi')
  }
  return data as unknown as Certificate
}
