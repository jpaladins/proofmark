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

export type Evidence = { cert: Certificate; ots: Bytes; pdf?: Bytes }

export class EvidenceError extends Error {
  readonly code: 'format' | 'missing'
  constructor(code: 'format' | 'missing', message: string) {
    super(message)
    this.name = 'EvidenceError'
    this.code = code
  }
}

const fmtDate = (d: Date) =>
  `${new Intl.DateTimeFormat('it-IT', { dateStyle: 'long', timeStyle: 'short' }).format(d)} ${utcOffset(d)}`

function parseOrThrow(json: string): Certificate {
  try {
    return parseCertificate(json)
  } catch (err) {
    throw new EvidenceError('format', err instanceof CertError ? err.message : 'Certificato non leggibile.')
  }
}

export async function loadEvidence(file: File): Promise<Evidence> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.json')) {
    const cert = parseOrThrow(await file.text())
    return { cert, ots: base64ToBytes(cert.opentimestamps.otsBase64) }
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
    if (!files['prova.ots'] || !files['certificato.json']) {
      throw new EvidenceError('missing', 'Questo PDF non contiene le prove di ProofMark (prova.ots e certificato.json).')
    }
    const cert = parseOrThrow(new TextDecoder().decode(files['certificato.json']))
    return { cert, ots: files['prova.ots'], pdf }
  }
  throw new EvidenceError('format', "Carica la ricevuta, l'attestato PDF o il certificato JSON di ProofMark.")
}

function inspect(ots: Uint8Array): OtsInfo | undefined {
  try {
    return inspectOts(ots)
  } catch {
    return undefined
  }
}

export async function verifyOffline(zipSha256: string, ev: Evidence): Promise<Check[]> {
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

  const info = inspect(ev.ots)
  if (!info) {
    checks.push({ id: 'ots-hash', status: 'fail', label: 'Prova Bitcoin non leggibile' })
    return checks
  }
  checks.push(
    info.digestHex === expected
      ? { id: 'ots-hash', status: 'ok', label: 'La prova Bitcoin si riferisce a questo archivio' }
      : { id: 'ots-hash', status: 'fail', label: "La prova Bitcoin si riferisce a un'altra impronta" },
  )

  if (ev.cert.kind === 'ricevuta') {
    checks.push({
      id: 'meta',
      status: 'warn',
      label: 'Ricevuta: la data non è ancora attestata. Controlla la conferma Bitcoin.',
    })
  } else if (info.status === 'confirmed' && info.block === ev.cert.opentimestamps.block) {
    checks.push({
      id: 'meta',
      status: 'ok',
      label: `La prova contiene l'attestazione nel blocco Bitcoin #${info.block}. Controlla la conferma per verificarne la data.`,
    })
  } else {
    checks.push({ id: 'meta', status: 'fail', label: 'Il certificato dichiara un blocco diverso da quello della prova' })
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
  deps: BitcoinDeps = {},
): Promise<{ check: Check; upgraded?: { ots: Bytes; block: number; blockTime: Date } }> {
  const upgrade = deps.upgradeOts ?? ((o: Uint8Array) => upgradeOts(o))
  const verifyOnline = deps.verifyOtsOnline ?? ((o: Uint8Array) => verifyOtsOnline(o))
  const pending: Check = { id: 'bitcoin', status: 'warn', label: 'Conferma non ancora disponibile, riprova tra qualche ora' }
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
            label: 'La data del certificato non corrisponde alla blockchain',
            detail: `Blockchain: blocco #${confirmed.block} del ${fmtDate(confirmed.blockTime)}`,
          },
        }
      }
    }
    const check: Check = {
      id: 'bitcoin',
      status: 'ok',
      label: `Confermato nel blocco #${confirmed.block} del ${fmtDate(confirmed.blockTime)}`,
    }
    return { check, ...(ev.cert.kind === 'ricevuta' ? { upgraded: { ots, ...confirmed } } : {}) }
  } catch (err) {
    if (err instanceof OtsError && err.code === 'invalid') {
      return { check: { id: 'bitcoin', status: 'fail', label: 'La prova Bitcoin non corrisponde alla blockchain', detail: err.message } }
    }
    return { check: { id: 'bitcoin', status: 'warn', label: 'Impossibile contattare la rete Bitcoin. Riprova più tardi.' } }
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
