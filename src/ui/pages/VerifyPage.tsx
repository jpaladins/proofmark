import { Bitcoin, Download, FileJson, FileText, Loader2, RefreshCw, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { hashFile } from '@/core/hash/hashFile'
import { requestTimestamp } from '@/core/tsa/client'
import type { Check } from '@/core/verify/verifyToken'
import {
  buildRevision2,
  checkBitcoin,
  EvidenceError,
  loadEvidence,
  verifyOffline,
  type Evidence,
} from '@/flow/verify'
import { CheckList } from '../components/CheckList'
import { DropZone } from '../components/DropZone'
import { Fingerprint } from '../components/Fingerprint'
import { Alert, Button } from '../components/primitives'
import { baseName, downloadBytes } from '../download'
import { useRoute } from '../router'

export type VerifyPageDeps = {
  hashFile: (file: File, onProgress: (p: { bytesDone: number; total: number }) => void) => Promise<string>
  loadEvidence: (file: File) => Promise<Evidence>
  verifyOffline: (zipSha256: string, ev: Evidence) => Promise<Check[]>
  checkBitcoin: typeof checkBitcoin
  buildRevision2: (
    ev: Evidence,
    upgraded: { ots: Uint8Array<ArrayBuffer>; block: number; blockTime: Date },
  ) => ReturnType<typeof buildRevision2>
}

const defaultDeps: VerifyPageDeps = {
  hashFile,
  loadEvidence,
  verifyOffline,
  checkBitcoin: (ev) => checkBitcoin(ev),
  buildRevision2: async (ev, upgraded) => {
    const [{ renderAttestato }, { sealPdf }] = await Promise.all([
      import('@/core/pdf/renderAttestato'),
      import('@/core/pdf/pades'),
    ])
    return buildRevision2(ev, upgraded, { renderAttestato, sealPdf, timestamp: (h) => requestTimestamp(h) })
  },
}

const EVIDENCE_FORMAT = "Carica l'attestato PDF o il certificato JSON di ProofMark"

function Slot({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold text-ink">{title}</h2>
      {children}
    </div>
  )
}

export function VerifyPage({ deps = defaultDeps }: { deps?: VerifyPageDeps }) {
  const { hashParams } = useRoute()
  const fromQr = /^[0-9a-f]{64}$/.test(hashParams.get('sha256') ?? '') ? hashParams.get('sha256')! : undefined
  const [zip, setZip] = useState<File>()
  const [evidenceFile, setEvidenceFile] = useState<File>()
  const [busy, setBusy] = useState<'verify' | 'bitcoin' | 'rev2'>()
  const [progress, setProgress] = useState<number>()
  const [error, setError] = useState<string>()
  const [checks, setChecks] = useState<Check[]>()
  const [evidence, setEvidence] = useState<Evidence>()
  const [bitcoin, setBitcoin] = useState<Awaited<ReturnType<VerifyPageDeps['checkBitcoin']>>>()
  const [rev2, setRev2] = useState<Awaited<ReturnType<VerifyPageDeps['buildRevision2']>>>()
  const [rev2Warning, setRev2Warning] = useState<string>()

  // A result only describes the files it was computed from: drop it as soon as either changes.
  function clearResult() {
    setError(undefined)
    setChecks(undefined)
    setEvidence(undefined)
    setBitcoin(undefined)
    setRev2(undefined)
    setRev2Warning(undefined)
  }
  const chooseZip = (f: File) => {
    clearResult()
    setZip(f)
  }
  const chooseEvidence = (f: File) => {
    clearResult()
    setEvidenceFile(f)
  }

  const canVerify = !!zip && (!!evidenceFile || !!fromQr) && !busy

  async function verify() {
    if (!zip) return
    setBusy('verify')
    clearResult()
    try {
      const sha256 = await deps.hashFile(zip, (p) => setProgress(p.total ? p.bytesDone / p.total : 1))
      if (!evidenceFile && fromQr) {
        setEvidence(undefined)
        setChecks([
          sha256 === fromQr
            ? { id: 'hash', status: 'ok', label: "L'impronta corrisponde a quella del QR code" }
            : {
                id: 'hash',
                status: 'fail',
                label: "L'impronta non corrisponde: l'archivio è diverso da quello certificato",
                detail: `Archivio: ${sha256}\nQR code: ${fromQr}`,
              },
        ])
        return
      }
      const ev = await deps.loadEvidence(evidenceFile!)
      setEvidence(ev)
      setChecks(await deps.verifyOffline(sha256, ev))
    } catch (err) {
      setError(err instanceof EvidenceError ? err.message : 'Verifica non riuscita. Controlla i file e riprova.')
    } finally {
      setBusy(undefined)
      setProgress(undefined)
    }
  }

  async function runBitcoin() {
    if (!evidence) return
    setBusy('bitcoin')
    setRev2(undefined)
    setRev2Warning(undefined)
    try {
      setBitcoin(await deps.checkBitcoin(evidence))
    } finally {
      setBusy(undefined)
    }
  }

  // Browsers block or prompt on several downloads from one click, so each file gets its own button.
  async function generateRev2() {
    if (!evidence || !bitcoin?.upgraded) return
    setBusy('rev2')
    setRev2Warning(undefined)
    try {
      const out = await deps.buildRevision2(evidence, bitcoin.upgraded)
      setRev2(out)
      if (!out.pdfSealed) setRev2Warning('Attestato aggiornato generato senza sigillo sul documento: riprova più tardi.')
    } catch {
      setRev2Warning("Impossibile generare l'attestato aggiornato. Riprova.")
    } finally {
      setBusy(undefined)
    }
  }

  const rev2Base = rev2 ? baseName(rev2.certificate.file.name) : ''
  const rev2Downloads = rev2
    ? [
        {
          label: 'Scarica attestato PDF aggiornato',
          icon: FileText,
          run: () => downloadBytes(rev2.pdf, `${rev2Base}_attestato_R2.pdf`, 'application/pdf'),
        },
        {
          label: 'Scarica certificato JSON aggiornato',
          icon: FileJson,
          run: () => downloadBytes(rev2.json, `${rev2Base}_certificato_R2.json`, 'application/json'),
        },
        {
          label: 'Scarica prova Bitcoin (.ots)',
          icon: Download,
          run: () => downloadBytes(rev2.ots, `${rev2Base}.ots`, 'application/vnd.opentimestamps.v1'),
        },
      ]
    : []

  const allChecks = checks ? [...checks, ...(bitcoin ? [bitcoin.check] : [])] : undefined
  const failed = allChecks?.some((c) => c.status === 'fail')
  // Revision 2 is only issued for evidence that fully verified offline (an unsealed PDF/JSON may warn).
  const canIssueRev2 = !!checks?.every((c) => c.status === 'ok' || (c.id === 'pdf-seal' && c.status === 'warn'))

  return (
    <div className="max-w-3xl">
      <h1 className="font-serif text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">Verifica un attestato</h1>
      <p className="mt-5 max-w-[60ch] text-lg leading-relaxed text-ink-2">
        Carica l'archivio originale e il suo attestato. Il controllo avviene nel browser e senza connessione: la rete serve
        solo se chiedi la conferma Bitcoin.
      </p>

      {fromQr && (
        <div className="mt-8 rounded-xl border border-line bg-surface p-5">
          <p className="text-sm font-medium text-ink-2">Impronta attesa dal QR code</p>
          <p className="mt-2 break-all font-mono text-sm text-ink">{fromQr}</p>
          <p className="mt-2 text-sm text-muted">Basta caricare l'archivio per confrontarlo.</p>
        </div>
      )}

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <Slot title="1. Archivio .zip">
          <DropZone compact onFile={chooseZip} disabled={!!busy} label="Trascina l'archivio" />
        </Slot>
        <Slot title="2. Attestato PDF o certificato JSON">
          <DropZone
            compact
            onFile={chooseEvidence}
            disabled={!!busy}
            label="Trascina il PDF o il JSON"
            inputLabel="Seleziona attestato PDF o certificato JSON"
            accept=".pdf,.json,application/pdf,application/json"
            multipleMessage="Carica un solo file"
            validate={async (f) => (/\.(pdf|json)$/i.test(f.name) ? undefined : EVIDENCE_FORMAT)}
          />
        </Slot>
      </div>

      <div className="mt-6 flex items-center gap-4">
        <Button onClick={verify} disabled={!canVerify}>
          {busy === 'verify' ? <Loader2 aria-hidden className="size-4 animate-spin motion-reduce:animate-none" /> : <ShieldCheck aria-hidden className="size-4" />}
          Verifica
        </Button>
        {busy === 'verify' && progress !== undefined && (
          <p className="text-sm text-muted" aria-live="polite">
            Calcolo dell'impronta: {Math.round(progress * 100)}%
          </p>
        )}
      </div>

      {error && (
        <div className="mt-6">
          <Alert tone="danger" title="Impossibile verificare">
            {error}
          </Alert>
        </div>
      )}

      {allChecks && (
        <section aria-label="Risultato" className="mt-10 [animation:pm-reveal_.4s_ease-out_both]">
          <h2 className="font-serif text-2xl font-semibold tracking-tight">
            {failed ? 'La verifica ha trovato problemi' : 'Verifica completata'}
          </h2>
          {evidence && (
            <div className="mt-4">
              <Fingerprint hash={evidence.cert.file.sha256} size="md" />
            </div>
          )}
          <div className="mt-6">
            <CheckList checks={allChecks} />
          </div>

          {evidence && (
            <div className="mt-6 flex flex-wrap gap-3">
              <Button variant="secondary" onClick={runBitcoin} disabled={!!busy}>
                {busy === 'bitcoin' ? <Loader2 aria-hidden className="size-4 animate-spin motion-reduce:animate-none" /> : <Bitcoin aria-hidden className="size-4" />}
                Controlla conferma Bitcoin (richiede connessione)
              </Button>
              {bitcoin?.upgraded && canIssueRev2 && !rev2 && (
                <Button onClick={generateRev2} disabled={!!busy}>
                  {busy === 'rev2' ? <Loader2 aria-hidden className="size-4 animate-spin motion-reduce:animate-none" /> : <RefreshCw aria-hidden className="size-4" />}
                  Genera attestato aggiornato
                </Button>
              )}
            </div>
          )}
          {rev2 && (
            <div className="mt-6 rounded-xl border border-line bg-surface p-5">
              <p className="text-sm font-medium text-ink-2">Attestato aggiornato pronto: scarica ogni file.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                {rev2Downloads.map(({ label, icon: Icon, run }, i) => (
                  <Button key={label} variant={i === 0 ? undefined : 'secondary'} onClick={run}>
                    <Icon aria-hidden className="size-4" />
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          )}
          {rev2Warning && (
            <div className="mt-4">
              <Alert tone="warning" title="Attestato aggiornato">
                {rev2Warning}
              </Alert>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
