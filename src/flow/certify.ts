// The three-step certification run: hash → Bitcoin anchor (OpenTimestamps) → receipt.
// The anchor is the only proof of time, so it is mandatory: without it no receipt is issued.
import type { PDFDocument } from 'pdf-lib'
import { buildCertificate, serializeCertificate, type Certificate } from '@/core/cert/certificate'
import type { Bytes } from '@/core/hash/sha256'
import type { HashProgress } from '@/core/hash/hashFile'
import { inspectOts } from '@/core/ots/ots'
import type { FontBytes } from '@/core/pdf/fonts'

export type StepId = 'hash' | 'ots' | 'cert'
export type StepState = {
  status: 'idle' | 'active' | 'done' | 'warn' | 'error'
  message?: string
  progress?: number
  /** Byte-level detail while hashing, for the progress panel. */
  hashProgress?: HashProgress
}

export type CertifyResult = {
  certificate: Certificate
  pdf: Bytes
  json: string
  ots: Bytes
  /** When it is worth coming back for the Bitcoin confirmation. */
  reminderAfter: Date
}

export type CertifyDeps = {
  hashFile: (file: File, onProgress: (p: HashProgress) => void, signal?: AbortSignal) => Promise<string>
  stampHash: (sha256Hex: string, signal?: AbortSignal) => Promise<Bytes>
  renderAttestato: (cert: Certificate, proofs: { ots: Uint8Array }, opts?: { fonts?: FontBytes }) => Promise<PDFDocument>
}

export const OTS_ERROR = 'Impossibile raggiungere i calendari Bitcoin. Controlla la connessione e riprova.'
export const OTS_MISMATCH = "La prova ricevuta non corrisponde all'archivio. Riprova."
export const PDF_ERROR = 'Impossibile generare la ricevuta PDF. Riprova.'
export const REMINDER_DELAY_MS = 3 * 3600_000

/** Thrown when a step fails; `resume` lets a retry skip the hashing already done. */
export class CertifyError extends Error {
  readonly step: StepId
  readonly resume: { sha256?: string }
  constructor(step: StepId, message: string, resume: { sha256?: string }) {
    super(message)
    this.name = 'CertifyError'
    this.step = step
    this.resume = resume
  }
}

const throwIfAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
}

export async function runCertification(
  input: { file: File; declared?: { author?: string; title?: string } },
  deps: CertifyDeps,
  onStep: (id: StepId, s: StepState) => void,
  signal?: AbortSignal,
  resume: { sha256?: string } = {},
): Promise<CertifyResult> {
  // 1. Hash
  let sha256 = resume.sha256
  if (!sha256) {
    onStep('hash', { status: 'active', progress: 0 })
    try {
      sha256 = await deps.hashFile(
        input.file,
        (p) =>
          onStep('hash', {
            status: 'active',
            progress: p.total ? p.bytesDone / p.total : 1,
            message: `${Math.round((p.total ? p.bytesDone / p.total : 1) * 100)}%`,
            hashProgress: p,
          }),
        signal,
      )
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err
      const message = "Impossibile leggere l'archivio. Riprova."
      onStep('hash', { status: 'error', message })
      throw new CertifyError('hash', message, {})
    }
  }
  onStep('hash', { status: 'done', progress: 1 })
  throwIfAborted(signal)

  // 2. Bitcoin anchor (mandatory)
  onStep('ots', { status: 'active' })
  const requestedAt = new Date()
  let ots: Bytes
  try {
    ots = await deps.stampHash(sha256, signal)
  } catch {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    onStep('ots', { status: 'error', message: OTS_ERROR })
    throw new CertifyError('ots', OTS_ERROR, { sha256 })
  }
  let otsInfo: ReturnType<typeof inspectOts>
  try {
    otsInfo = inspectOts(ots)
    if (otsInfo.digestHex !== sha256) throw new Error('digest mismatch')
  } catch {
    onStep('ots', { status: 'error', message: OTS_MISMATCH })
    throw new CertifyError('ots', OTS_MISMATCH, { sha256 })
  }
  onStep('ots', { status: 'done', message: `${otsInfo.calendars.length} calendari` })
  throwIfAborted(signal)

  // 3. Receipt
  onStep('cert', { status: 'active' })
  const certificate = buildCertificate({ file: input.file, sha256, ots, otsInfo, requestedAt, declared: input.declared })
  let pdf: Bytes
  try {
    pdf = new Uint8Array(await (await deps.renderAttestato(certificate, { ots })).save())
  } catch {
    onStep('cert', { status: 'error', message: PDF_ERROR })
    throw new CertifyError('cert', PDF_ERROR, { sha256 })
  }
  onStep('cert', { status: 'done' })

  return {
    certificate,
    pdf,
    json: serializeCertificate(certificate),
    ots,
    reminderAfter: new Date(requestedAt.getTime() + REMINDER_DELAY_MS),
  }
}
