import { Award, Bitcoin, Download, FileJson, FileText, Loader2, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { hashFile, type HashProgress as Progress } from '@/core/hash/hashFile'
import type { Check } from '@/core/verify/check'
import {
  buildAttestato,
  checkBitcoin,
  EvidenceError,
  loadEvidence,
  offlineVerified,
  verifyOffline,
  type Evidence,
} from '@/flow/verify'
import { CheckList } from '../components/CheckList'
import { DropZone } from '../components/DropZone'
import { Fingerprint } from '../components/Fingerprint'
import { HashProgress } from '../components/HashProgress'
import { Alert, Button } from '../components/primitives'
import { downloadBytes } from '../download'
import { proofFileNames } from '@/core/cert/fileNames'
import { useRoute } from '../router'

export type VerifyPageDeps = {
  hashFile: (file: File, onProgress: (p: Progress) => void) => Promise<string>
  loadEvidence: (file: File) => Promise<Evidence>
  verifyOffline: (zipSha256: string, ev: Evidence) => Promise<Check[]>
  checkBitcoin: typeof checkBitcoin
  buildAttestato: (
    ev: Evidence,
    upgraded: { ots: Uint8Array<ArrayBuffer>; block: number; blockTime: Date },
  ) => ReturnType<typeof buildAttestato>
}

const defaultDeps: VerifyPageDeps = {
  hashFile,
  loadEvidence,
  verifyOffline,
  checkBitcoin: (ev) => checkBitcoin(ev),
  buildAttestato: async (ev, upgraded) => {
    const { renderAttestato } = await import('@/core/pdf/renderAttestato')
    return buildAttestato(ev, upgraded, { renderAttestato })
  },
}

const EVIDENCE_FORMAT = "Carica la ricevuta o l'attestato di ProofMark (PDF o JSON)"

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
  const [busy, setBusy] = useState<'verify' | 'bitcoin' | 'attestato'>()
  const [progress, setProgress] = useState<Progress>()
  const [error, setError] = useState<string>()
  const [checks, setChecks] = useState<Check[]>()
  const [evidence, setEvidence] = useState<Evidence>()
  const [bitcoin, setBitcoin] = useState<Awaited<ReturnType<VerifyPageDeps['checkBitcoin']>>>()
  const [attestato, setAttestato] = useState<Awaited<ReturnType<VerifyPageDeps['buildAttestato']>>>()
  const [attestatoError, setAttestatoError] = useState<string>()

  // A result only describes the files it was computed from: drop it as soon as either changes.
  function clearResult() {
    setError(undefined)
    setChecks(undefined)
    setEvidence(undefined)
    setBitcoin(undefined)
    setAttestato(undefined)
    setAttestatoError(undefined)
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
      const sha256 = await deps.hashFile(zip, setProgress)
      if (!evidenceFile && fromQr) {
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
    setAttestato(undefined)
    setAttestatoError(undefined)
    try {
      setBitcoin(await deps.checkBitcoin(evidence))
    } finally {
      setBusy(undefined)
    }
  }

  // Browsers block or prompt on several downloads from one click, so each file gets its own button.
  async function generateAttestato() {
    if (!evidence || !bitcoin?.upgraded) return
    setBusy('attestato')
    setAttestatoError(undefined)
    try {
      setAttestato(await deps.buildAttestato(evidence, bitcoin.upgraded))
    } catch {
      setAttestatoError("Impossibile generare l'attestato. Riprova.")
    } finally {
      setBusy(undefined)
    }
  }

  const names = attestato ? proofFileNames(attestato.certificate) : undefined
  const downloads = attestato
    ? [
        {
          label: 'Scarica attestato PDF',
          icon: FileText,
          run: () => downloadBytes(attestato.pdf, names!.pdf, 'application/pdf'),
        },
        {
          label: 'Scarica attestato JSON',
          icon: FileJson,
          run: () => downloadBytes(attestato.json, names!.json, 'application/json'),
        },
        {
          label: 'Scarica prova Bitcoin (.ots)',
          icon: Download,
          run: () => downloadBytes(attestato.ots, names!.ots, 'application/vnd.opentimestamps.v1'),
        },
      ]
    : []

  const allChecks = checks ? [...checks, ...(bitcoin ? [bitcoin.check] : [])] : undefined
  const failed = allChecks?.some((c) => c.status === 'fail')
  // The attestation is only issued for a receipt that fully verified offline.
  const canIssue = !!checks && offlineVerified(checks)

  return (
    <div className="max-w-3xl">
      <h1 className="font-serif text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">Verifica e ottieni l'attestato</h1>
      <p className="mt-5 max-w-[60ch] text-lg leading-relaxed text-ink-2">
        Carica l'archivio originale con la sua ricevuta o il suo attestato. Il controllo dell'archivio avviene nel browser e
        senza connessione. La rete serve solo per leggere la conferma dalla blockchain Bitcoin e, per una ricevuta,
        generare l'attestato con la data.
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
        <Slot title="2. Ricevuta o attestato (PDF o JSON)">
          <DropZone
            compact
            onFile={chooseEvidence}
            disabled={!!busy}
            label="Trascina il PDF o il JSON"
            inputLabel="Seleziona ricevuta o attestato (PDF o JSON)"
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
      </div>

      {busy === 'verify' && (
        <div className="mt-6">
          <HashProgress progress={progress} />
        </div>
      )}

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
              {bitcoin?.upgraded && canIssue && !attestato && (
                <Button onClick={generateAttestato} disabled={!!busy}>
                  {busy === 'attestato' ? <Loader2 aria-hidden className="size-4 animate-spin motion-reduce:animate-none" /> : <Award aria-hidden className="size-4" />}
                  Genera attestato
                </Button>
              )}
            </div>
          )}
          {attestato && (
            <div className="mt-6 rounded-xl border border-emerald/30 bg-emerald-soft p-5">
              <p className="text-sm font-medium text-ink">
                Attestato pronto: la data di esistenza è quella del blocco Bitcoin #{attestato.certificate.opentimestamps.block}.
                Scarica ogni file e conservalo con l'archivio.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                {downloads.map(({ label, icon: Icon, run }, i) => (
                  <Button key={label} variant={i === 0 ? undefined : 'secondary'} onClick={run}>
                    <Icon aria-hidden className="size-4" />
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          )}
          {attestatoError && (
            <div className="mt-4">
              <Alert tone="warning" title="Attestato">
                {attestatoError}
              </Alert>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
