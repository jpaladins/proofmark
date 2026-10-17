// The four-step certification run: hash → DigiCert stamp → Bitcoin anchor → certificate.
// Policy (spec §11): the DigiCert stamp on the archive is mandatory; OpenTimestamps and the PDF
// seal are optional and degrade to a visible warning.
import type { PDFDocument } from 'pdf-lib'
import { buildCertificate, serializeCertificate, type Certificate } from '@/core/cert/certificate'
import type { Bytes } from '@/core/hash/sha256'
import type { HashProgress } from '@/core/hash/hashFile'
import { inspectOts } from '@/core/ots/ots'
import type { FontBytes } from '@/core/pdf/fonts'
import { TsaError, type TsaErrorCode, type TsaResult } from '@/core/tsa/rfc3161'
import { verifyTimestampToken } from '@/core/verify/verifyToken'

export type StepId = 'hash' | 'tsa' | 'ots' | 'cert'
export type StepState = { status: 'idle' | 'active' | 'done' | 'warn' | 'error'; message?: string; progress?: number }

export type CertifyResult = {
  certificate: Certificate
  pdf: Bytes
  pdfSealed: boolean
  json: string
  tsr: Bytes
  ots?: Bytes
  reminderAfter?: Date
}

export type CertifyDeps = {
  hashFile: (file: File, onProgress: (p: HashProgress) => void, signal?: AbortSignal) => Promise<string>
  requestTimestamp: (sha256Hex: string, signal?: AbortSignal) => Promise<TsaResult>
  stampHash: (sha256Hex: string, signal?: AbortSignal) => Promise<Bytes>
  renderAttestato: (
    cert: Certificate,
    proofs: { tsr: Uint8Array; ots?: Uint8Array },
    opts?: { sealed?: boolean; fonts?: FontBytes },
  ) => Promise<PDFDocument>
  sealPdf: (doc: PDFDocument, timestamp: (sha256Hex: string) => Promise<{ token: Uint8Array }>) => Promise<Bytes>
}

export const TSA_ERROR_COPY: Record<TsaErrorCode, string> = {
  network: 'Impossibile contattare DigiCert. Controlla la connessione e riprova.',
  timeout: 'DigiCert non risponde. Riprova tra qualche istante.',
  rejected: 'DigiCert ha rifiutato la richiesta. Riprova tra qualche istante.',
  malformed: 'Risposta di DigiCert non valida. Riprova tra qualche istante.',
  mismatch: "La marca ricevuta non corrisponde all'archivio. Riprova.",
}
export const OTS_UNAVAILABLE = 'Ancoraggio Bitcoin non disponibile: potrai aggiungerlo dalla sezione Verifica'
export const SEAL_FAILED = 'PDF generato senza sigillo: il sigillo DigiCert sul documento non è riuscito'
export const REMINDER_DELAY_MS = 3 * 3600_000

/** Thrown when a mandatory step fails; `resume` lets a retry skip the steps already done. */
export class CertifyError extends Error {
  readonly step: StepId
  readonly resume: { sha256?: string; tsa?: TsaResult }
  constructor(step: StepId, message: string, resume: { sha256?: string; tsa?: TsaResult }) {
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
  resume: { sha256?: string; tsa?: TsaResult } = {},
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
            message: `${p.mbPerSec.toFixed(0)} MB/s · ${Math.ceil(p.etaSec)} s rimanenti`,
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

  // 2. DigiCert RFC 3161 (mandatory)
  let tsa = resume.tsa
  if (!tsa) {
    onStep('tsa', { status: 'active' })
    try {
      tsa = await deps.requestTimestamp(sha256, signal)
      // The relay→DigiCert hop is plain HTTP: accept only a token that verifies against the pinned root.
      const checks = await verifyTimestampToken(tsa.token, sha256)
      if (checks.some((c) => c.status !== 'ok')) throw new TsaError('malformed', 'Token DigiCert non valido.')
    } catch (err) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      const message = err instanceof TsaError ? TSA_ERROR_COPY[err.code] : TSA_ERROR_COPY.network
      onStep('tsa', { status: 'error', message })
      throw new CertifyError('tsa', message, { sha256 })
    }
  }
  onStep('tsa', { status: 'done', message: tsa.info.tsa })
  throwIfAborted(signal)

  // 3. OpenTimestamps (optional)
  onStep('ots', { status: 'active' })
  let ots: Bytes | undefined
  try {
    ots = await deps.stampHash(sha256, signal)
    onStep('ots', { status: 'done' })
  } catch {
    onStep('ots', { status: 'warn', message: OTS_UNAVAILABLE })
  }
  throwIfAborted(signal)

  // 4. Certificate, PDF and seal (seal optional)
  onStep('cert', { status: 'active' })
  const otsInfo = ots ? inspectOts(ots) : undefined
  const certificate = buildCertificate({ file: input.file, sha256, tsa, ots, otsInfo, declared: input.declared })
  const proofs = { tsr: tsa.token, ots }
  let pdf: Bytes
  let pdfSealed = true
  try {
    const seal = (h: string) => deps.requestTimestamp(h, signal)
    pdf = await deps.sealPdf(await deps.renderAttestato(certificate, proofs, { sealed: true }), seal)
    onStep('cert', { status: 'done' })
  } catch {
    pdfSealed = false
    try {
      pdf = new Uint8Array(await (await deps.renderAttestato(certificate, proofs, { sealed: false })).save())
    } catch {
      const message = "Impossibile generare l'attestato PDF. Riprova."
      onStep('cert', { status: 'error', message })
      throw new CertifyError('cert', message, { sha256, tsa })
    }
    onStep('cert', { status: 'warn', message: SEAL_FAILED })
  }

  return {
    certificate,
    pdf,
    pdfSealed,
    json: serializeCertificate(certificate),
    tsr: tsa.token,
    ...(ots ? { ots } : {}),
    ...(otsInfo?.status === 'pending' ? { reminderAfter: new Date(tsa.info.genTime.getTime() + REMINDER_DELAY_MS) } : {}),
  }
}
