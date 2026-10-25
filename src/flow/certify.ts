// The three-step certification run: hash → Bitcoin anchor (OpenTimestamps) → receipt.
// The anchor is the only proof of time, so it is mandatory: without it no receipt is issued.
import type { PDFDocument } from 'pdf-lib'
import { buildCertificate, serializeCertificate, type Certificate } from '@/core/cert/certificate'
import type { Bytes } from '@/core/hash/sha256'
import type { HashProgress } from '@/core/hash/hashFile'
import { inspectOts } from '@/core/ots/ots'
import type { FontBytes } from '@/core/pdf/fonts'
import { messages, type Lang, type Messages } from '@/i18n'

export type StepId = 'hash' | 'ots' | 'cert'
/** Why a certification stopped: a key of the `errors` dictionary section. */
export type CertifyErrorCode = 'hashRead' | 'ots' | 'otsMismatch' | 'pdf' | 'unexpected'
/**
 * What a step says under its name, as data rather than text, so that it can be shown in whatever
 * language the page is in when it renders (the language can change while a certification runs).
 */
export type StepNote =
  | { kind: 'percent'; value: number }
  | { kind: 'calendars'; count: number }
  | { kind: 'error'; code: CertifyErrorCode }
export type StepState = {
  status: 'idle' | 'active' | 'done' | 'warn' | 'error'
  note?: StepNote
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

export const REMINDER_DELAY_MS = 3 * 3600_000

/** A step note in the given dictionary's language. */
export function noteText(note: StepNote, t: Messages): string {
  if (note.kind === 'percent') return `${note.value}%`
  if (note.kind === 'calendars') return t.flow.calendars(note.count)
  return t.errors[note.code]
}

/** Thrown when a step fails; `resume` lets a retry skip the hashing already done. */
export class CertifyError extends Error {
  readonly step: StepId
  readonly code: CertifyErrorCode
  readonly resume: { sha256?: string }
  constructor(step: StepId, code: CertifyErrorCode, resume: { sha256?: string }) {
    super(messages('en').errors[code])
    this.name = 'CertifyError'
    this.step = step
    this.code = code
    this.resume = resume
  }
}

const throwIfAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
}

export async function runCertification(
  input: { file: File; declared?: { author?: string; title?: string }; lang: Lang },
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
            note: { kind: 'percent', value: Math.round((p.total ? p.bytesDone / p.total : 1) * 100) },
            hashProgress: p,
          }),
        signal,
      )
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err
      onStep('hash', { status: 'error', note: { kind: 'error', code: 'hashRead' } })
      throw new CertifyError('hash', 'hashRead', {})
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
    onStep('ots', { status: 'error', note: { kind: 'error', code: 'ots' } })
    throw new CertifyError('ots', 'ots', { sha256 })
  }
  let otsInfo: ReturnType<typeof inspectOts>
  try {
    otsInfo = inspectOts(ots)
    if (otsInfo.digestHex !== sha256) throw new Error('digest mismatch')
  } catch {
    onStep('ots', { status: 'error', note: { kind: 'error', code: 'otsMismatch' } })
    throw new CertifyError('ots', 'otsMismatch', { sha256 })
  }
  onStep('ots', { status: 'done', note: { kind: 'calendars', count: otsInfo.calendars.length } })
  throwIfAborted(signal)

  // 3. Receipt
  onStep('cert', { status: 'active' })
  const certificate = buildCertificate({ file: input.file, sha256, ots, otsInfo, requestedAt, declared: input.declared, lang: input.lang })
  let pdf: Bytes
  try {
    pdf = new Uint8Array(await (await deps.renderAttestato(certificate, { ots })).save())
  } catch {
    onStep('cert', { status: 'error', note: { kind: 'error', code: 'pdf' } })
    throw new CertifyError('cert', 'pdf', { sha256 })
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
