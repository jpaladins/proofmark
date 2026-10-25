// Verification of an archive against a ProofMark receipt or attestation (PDF or JSON).
// The offline checks tie the archive to the OpenTimestamps proof. The date only ever comes from
// the blockchain (checkBitcoin, online, user-triggered): the JSON's block fields are never trusted.
import type { PDFDocument } from 'pdf-lib'
import { base64ToBytes } from '@/core/base64'
import {
  CertError,
  confirmCertificate,
  parseCertificate,
  serializeCertificate,
  type Certificate,
} from '@/core/cert/certificate'
import type { Bytes } from '@/core/hash/sha256'
import { OtsError } from '@/core/ots/format'
import { inspectOts, upgradeOts, verifyOtsOnline, type OtsInfo } from '@/core/ots/ots'
import type { FontBytes } from '@/core/pdf/fonts'
import type { Check } from '@/core/verify/check'
import { utcOffset } from '@/core/time'
import { localeOf, messages, type Lang } from '@/i18n'

export type Evidence = { cert: Certificate; ots: Bytes; pdf?: Bytes }

export class EvidenceError extends Error {
  readonly code: 'format' | 'missing'
  constructor(code: 'format' | 'missing', message: string) {
    super(message)
    this.name = 'EvidenceError'
    this.code = code
  }
}

/** Date, time and UTC offset of a block in the device's time zone, in the page language. */
function fmtDate(d: Date, lang: Lang): string {
  const locale = localeOf(lang)
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(d)
  const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d)
  return messages(lang).flow.blockMoment(date, time, utcOffset(d))
}

function parseOrThrow(json: string, lang: Lang): Certificate {
  const { evidence } = messages(lang).errors
  try {
    return parseCertificate(json)
  } catch (err) {
    const notJson = err instanceof CertError && err.code === 'json'
    throw new EvidenceError('format', notJson ? evidence.certificateJson : evidence.certificateInvalid)
  }
}

export async function loadEvidence(file: File, lang: Lang): Promise<Evidence> {
  const { evidence: errors } = messages(lang).errors
  const name = file.name.toLowerCase()
  if (name.endsWith('.json')) {
    const cert = parseOrThrow(await file.text(), lang)
    return { cert, ots: base64ToBytes(cert.opentimestamps.otsBase64) }
  }
  if (name.endsWith('.pdf')) {
    const pdf = new Uint8Array(await file.arrayBuffer())
    const { extractAttachments } = await import('@/core/pdf/renderAttestato')
    let files: Record<string, Bytes>
    try {
      files = await extractAttachments(pdf)
    } catch {
      throw new EvidenceError('format', errors.pdfUnreadable)
    }
    // Attachments are named after the archive (e.g. "opera.ots"); PDFs issued before that used
    // "prova.ots" and "certificato.json", so pick them by extension.
    const names = Object.keys(files)
    const otsName = names.find((n) => n.toLowerCase().endsWith('.ots'))
    const jsonName = names.find((n) => n.toLowerCase().endsWith('.json'))
    if (!otsName || !jsonName) {
      throw new EvidenceError('missing', errors.pdfMissingProofs)
    }
    const cert = parseOrThrow(new TextDecoder().decode(files[jsonName]), lang)
    return { cert, ots: files[otsName], pdf }
  }
  throw new EvidenceError('format', errors.wrongType)
}

function inspect(ots: Uint8Array): OtsInfo | undefined {
  try {
    return inspectOts(ots)
  } catch {
    return undefined
  }
}

export async function verifyOffline(zipSha256: string, ev: Evidence, lang: Lang): Promise<Check[]> {
  const t = messages(lang).flow.checks
  const expected = ev.cert.file.sha256
  const checks: Check[] = [
    zipSha256 === expected
      ? { id: 'hash', status: 'ok', label: t.hashOk }
      : {
          id: 'hash',
          status: 'fail',
          label: t.hashFail,
          detail: t.hashFailDetail(zipSha256, expected),
        },
  ]

  const info = inspect(ev.ots)
  if (!info) {
    checks.push({ id: 'ots-hash', status: 'fail', label: t.otsUnreadable })
    return checks
  }
  checks.push(
    info.digestHex === expected
      ? { id: 'ots-hash', status: 'ok', label: t.otsMatches }
      : { id: 'ots-hash', status: 'fail', label: t.otsOther },
  )

  if (ev.cert.kind === 'ricevuta') {
    checks.push({
      id: 'meta',
      status: 'warn',
      label: t.receiptPending,
    })
  } else if (info.status === 'confirmed' && info.block !== undefined && info.block === ev.cert.opentimestamps.block) {
    checks.push({
      id: 'meta',
      status: 'ok',
      label: t.attestationBlockOk(info.block),
    })
  } else {
    checks.push({ id: 'meta', status: 'fail', label: t.attestationBlockDiffers })
  }
  return checks
}

/** True when offline verification found nothing wrong (a receipt's pending date is expected). */
export function offlineVerified(checks: Check[]): boolean {
  return checks.every((c) => c.status === 'ok' || (c.id === 'meta' && c.status === 'warn'))
}

export type BitcoinDeps = {
  upgradeOts?: (ots: Uint8Array) => Promise<{ ots: Bytes; changed: boolean }>
  verifyOtsOnline?: (ots: Uint8Array) => Promise<{ block: number; blockTime: Date } | null>
}

export async function checkBitcoin(
  ev: Evidence,
  lang: Lang,
  deps: BitcoinDeps = {},
): Promise<{ check: Check; upgraded?: { ots: Bytes; block: number; blockTime: Date } }> {
  const upgrade = deps.upgradeOts ?? ((o: Uint8Array) => upgradeOts(o))
  const verifyOnline = deps.verifyOtsOnline ?? ((o: Uint8Array) => verifyOtsOnline(o))
  const t = messages(lang).flow.checks
  const pending: Check = { id: 'bitcoin', status: 'warn', label: t.bitcoinPending }
  try {
    let ots = ev.ots
    if (inspectOts(ots).status === 'pending') ots = (await upgrade(ots)).ots
    if (inspectOts(ots).status === 'pending') return { check: pending }
    const confirmed = await verifyOnline(ots)
    if (!confirmed) return { check: pending }

    if (ev.cert.kind === 'attestato') {
      const claimed = ev.cert.opentimestamps
      const sameTime = claimed.blockTime && new Date(claimed.blockTime).getTime() === confirmed.blockTime.getTime()
      if (claimed.block !== confirmed.block || !sameTime) {
        return {
          check: {
            id: 'bitcoin',
            status: 'fail',
            label: t.dateMismatch,
            detail: t.dateMismatchDetail(confirmed.block, fmtDate(confirmed.blockTime, lang)),
          },
        }
      }
    }
    const check: Check = {
      id: 'bitcoin',
      status: 'ok',
      label: t.confirmed(confirmed.block, fmtDate(confirmed.blockTime, lang)),
    }
    return { check, ...(ev.cert.kind === 'ricevuta' ? { upgraded: { ots, ...confirmed } } : {}) }
  } catch (err) {
    if (err instanceof OtsError && err.code === 'invalid') {
      const detail = err.height === undefined ? undefined : t.bitcoinInvalidDetail(err.height)
      return { check: { id: 'bitcoin', status: 'fail', label: t.bitcoinInvalid, detail } }
    }
    return { check: { id: 'bitcoin', status: 'warn', label: t.bitcoinUnreachable } }
  }
}

export type AttestatoDeps = {
  renderAttestato: (cert: Certificate, proofs: { ots: Uint8Array }, opts?: { fonts?: FontBytes }) => Promise<PDFDocument>
}

/**
 * Issues the attestation for a verified receipt. The block number and time come from the online
 * check and the hash from the proof itself, never from the uploaded certificate.
 */
export async function buildAttestato(
  ev: Evidence,
  upgraded: { ots: Bytes; block: number; blockTime: Date },
  deps: AttestatoDeps,
): Promise<{ certificate: Certificate; pdf: Bytes; json: string; ots: Bytes }> {
  const digest = inspectOts(upgraded.ots).digestHex
  const base: Certificate = { ...ev.cert, file: { ...ev.cert.file, sha256: digest } }
  const certificate = confirmCertificate(base, upgraded.ots, upgraded)
  const pdf = new Uint8Array(await (await deps.renderAttestato(certificate, { ots: upgraded.ots })).save())
  return { certificate, pdf, json: serializeCertificate(certificate), ots: upgraded.ots }
}
