// Verification of an archive against a ProofMark certificate (JSON) or attestation (PDF).
// Everything here runs offline except checkBitcoin, which the user triggers explicitly.
import type { PDFDocument } from 'pdf-lib'
import { base64ToBytes } from '@/core/base64'
import {
  CertError,
  parseCertificate,
  serializeCertificate,
  upgradeCertificate,
  type Certificate,
} from '@/core/cert/certificate'
import type { Bytes } from '@/core/hash/sha256'
import { bytesToBase64 } from '@/core/base64'
import { parseTimeStampToken } from '@/core/tsa/rfc3161'
import { inspectOts, upgradeOts, verifyOtsOnline } from '@/core/ots/ots'
import { OtsError } from '@/core/ots/format'
import type { FontBytes } from '@/core/pdf/fonts'
import { verifyTimestampToken, type Check } from '@/core/verify/verifyToken'

export type Evidence = { cert: Certificate; tsr: Bytes; ots?: Bytes; pdf?: Bytes }

export class EvidenceError extends Error {
  readonly code: 'format' | 'missing'
  constructor(code: 'format' | 'missing', message: string) {
    super(message)
    this.name = 'EvidenceError'
    this.code = code
  }
}

const fmtDate = (d: Date) => new Intl.DateTimeFormat('it-IT', { dateStyle: 'long', timeStyle: 'short' }).format(d)

export async function loadEvidence(file: File): Promise<Evidence> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.json')) {
    let cert: Certificate
    try {
      cert = parseCertificate(await file.text())
    } catch (err) {
      throw new EvidenceError('format', err instanceof CertError ? err.message : 'Certificato non leggibile.')
    }
    return {
      cert,
      tsr: base64ToBytes(cert.rfc3161.tokenBase64),
      ...(cert.opentimestamps.otsBase64 ? { ots: base64ToBytes(cert.opentimestamps.otsBase64) } : {}),
    }
  }
  if (name.endsWith('.pdf')) {
    const pdf = new Uint8Array(await file.arrayBuffer())
    const { extractAttachments } = await import('@/core/pdf/renderAttestato')
    let files: Record<string, Bytes>
    try {
      files = await extractAttachments(pdf)
    } catch {
      throw new EvidenceError('format', 'Il PDF non è leggibile.')
    }
    if (!files['prova.tsr'] || !files['certificato.json']) {
      throw new EvidenceError('missing', 'Questo PDF non contiene le prove di ProofMark (prova.tsr e certificato.json).')
    }
    let cert: Certificate
    try {
      cert = parseCertificate(new TextDecoder().decode(files['certificato.json']))
    } catch (err) {
      throw new EvidenceError('format', err instanceof CertError ? err.message : 'Certificato non leggibile.')
    }
    return { cert, tsr: files['prova.tsr'], ...(files['prova.ots'] ? { ots: files['prova.ots'] } : {}), pdf }
  }
  throw new EvidenceError('format', "Carica l'attestato PDF o il certificato JSON di ProofMark.")
}

const fmtUtc = (d: Date) => `${d.toISOString().replace('T', ' ').slice(0, 19)} UTC`

/** The certificate's timestamp fields are unsigned: they must match the signed token exactly. */
function metadataCheck(ev: Evidence): Check {
  try {
    const t = parseTimeStampToken(ev.tsr)
    const r = ev.cert.rfc3161
    const same =
      new Date(r.genTime).getTime() === t.genTime.getTime() &&
      r.serial.toLowerCase() === t.serialHex.toLowerCase() &&
      r.tsa === t.tsa &&
      r.policy === t.policy
    return same
      ? { id: 'meta', status: 'ok', label: `Data certificata dalla marca temporale: ${fmtUtc(t.genTime)}` }
      : {
          id: 'meta',
          status: 'fail',
          label: 'I dati del certificato non corrispondono alla marca temporale firmata',
          detail: `Marca temporale firmata: ${fmtUtc(t.genTime)}`,
        }
  } catch {
    return { id: 'meta', status: 'fail', label: 'Marca temporale non leggibile' }
  }
}

/** Rebuilds the timestamp fields from the signed token, ignoring what the uploaded JSON claims. */
function fromToken(ev: Evidence): Certificate {
  const t = parseTimeStampToken(ev.tsr)
  return {
    ...ev.cert,
    file: { ...ev.cert.file, sha256: t.imprintHex },
    rfc3161: {
      tsa: t.tsa,
      genTime: t.genTime.toISOString(),
      serial: t.serialHex,
      policy: t.policy,
      ...(t.nonce !== undefined ? { nonce: t.nonce.toString(16) } : {}),
      tokenBase64: bytesToBase64(ev.tsr),
    },
  }
}

export async function verifyOffline(zipSha256: string, ev: Evidence, opts: { trustPem?: string } = {}): Promise<Check[]> {
  const expected = ev.cert.file.sha256
  const checks: Check[] = [
    zipSha256 === expected
      ? { id: 'hash', status: 'ok', label: "L'impronta dell'archivio corrisponde al certificato" }
      : {
          id: 'hash',
          status: 'fail',
          label: "L'impronta non corrisponde: l'archivio è diverso da quello certificato",
          detail: `Archivio: ${zipSha256}\nCertificato: ${expected}`,
        },
  ]
  checks.push(...(await verifyTimestampToken(ev.tsr, expected, opts)))
  checks.push(metadataCheck(ev))

  if (!ev.ots) {
    checks.push({ id: 'ots-hash', status: 'warn', label: 'Prova Bitcoin assente in questo certificato' })
  } else {
    try {
      const info = inspectOts(ev.ots)
      checks.push(
        info.digestHex === expected
          ? { id: 'ots-hash', status: 'ok', label: 'La prova Bitcoin si riferisce a questo archivio' }
          : { id: 'ots-hash', status: 'fail', label: "La prova Bitcoin si riferisce a un'altra impronta" },
      )
    } catch {
      checks.push({ id: 'ots-hash', status: 'fail', label: 'Prova Bitcoin non leggibile' })
    }
  }

  if (ev.pdf) {
    const { verifyPdfSeal } = await import('@/core/pdf/pades')
    checks.push(await verifyPdfSeal(ev.pdf, opts))
  }
  return checks
}

export type BitcoinDeps = {
  upgradeOts?: (ots: Uint8Array) => Promise<{ ots: Bytes; changed: boolean }>
  verifyOtsOnline?: (ots: Uint8Array) => Promise<{ block: number; blockTime: Date } | null>
}

export async function checkBitcoin(
  ev: Evidence,
  deps: BitcoinDeps = {},
): Promise<{ check: Check; upgraded?: { ots: Bytes; block: number; blockTime: Date } }> {
  const upgrade = deps.upgradeOts ?? ((o: Uint8Array) => upgradeOts(o))
  const verifyOnline = deps.verifyOtsOnline ?? ((o: Uint8Array) => verifyOtsOnline(o))
  if (!ev.ots) return { check: { id: 'bitcoin', status: 'warn', label: 'Prova Bitcoin assente in questo certificato' } }
  try {
    let ots = ev.ots
    if (inspectOts(ots).status === 'pending') ots = (await upgrade(ots)).ots
    if (inspectOts(ots).status === 'pending') {
      return { check: { id: 'bitcoin', status: 'warn', label: 'Conferma non ancora disponibile, riprova tra qualche ora' } }
    }
    const confirmed = await verifyOnline(ots)
    if (!confirmed) {
      return { check: { id: 'bitcoin', status: 'warn', label: 'Conferma non ancora disponibile, riprova tra qualche ora' } }
    }
    const check: Check = {
      id: 'bitcoin',
      status: 'ok',
      label: `Confermato nel blocco #${confirmed.block} del ${fmtDate(confirmed.blockTime)}`,
    }
    const isNew = ev.cert.opentimestamps.status !== 'confirmed'
    return { check, ...(isNew ? { upgraded: { ots, ...confirmed } } : {}) }
  } catch (err) {
    if (err instanceof OtsError && err.code === 'invalid') {
      return { check: { id: 'bitcoin', status: 'fail', label: 'La prova Bitcoin non corrisponde alla blockchain', detail: err.message } }
    }
    return {
      check: { id: 'bitcoin', status: 'warn', label: 'Impossibile contattare la rete Bitcoin. Riprova più tardi.' },
    }
  }
}

export type Revision2Deps = {
  renderAttestato: (
    cert: Certificate,
    proofs: { tsr: Uint8Array; ots?: Uint8Array },
    opts?: { sealed?: boolean; fonts?: FontBytes },
  ) => Promise<PDFDocument>
  sealPdf: (doc: PDFDocument, timestamp: (sha256Hex: string) => Promise<{ token: Uint8Array }>) => Promise<Bytes>
  timestamp: (sha256Hex: string) => Promise<{ token: Uint8Array }>
}

export async function buildRevision2(
  ev: Evidence,
  upgraded: { ots: Bytes; block: number; blockTime: Date },
  deps: Revision2Deps,
): Promise<{ certificate: Certificate; pdf: Bytes; pdfSealed: boolean; json: string; ots: Bytes }> {
  const certificate = upgradeCertificate(fromToken(ev), upgraded.ots, upgraded)
  const proofs = { tsr: ev.tsr, ots: upgraded.ots }
  let pdf: Bytes
  let pdfSealed = true
  try {
    pdf = await deps.sealPdf(await deps.renderAttestato(certificate, proofs, { sealed: true }), deps.timestamp)
  } catch {
    pdfSealed = false
    pdf = new Uint8Array(await (await deps.renderAttestato(certificate, proofs, { sealed: false })).save())
  }
  return { certificate, pdf, pdfSealed, json: serializeCertificate(certificate), ots: upgraded.ots }
}
