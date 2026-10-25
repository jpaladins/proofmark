import { FileArchive, ShieldCheck, X } from 'lucide-react'
import { useId, useState } from 'react'
import { DECLARED_MAX } from '@/core/cert/certificate'
import { formatBytes } from '@/i18n'
import type { CertifyDeps } from '@/flow/certify'
import { defaultCertifyDeps, useCertify } from '@/flow/useCertify'
import { CertificateCard } from '../components/CertificateCard'
import { DropZone } from '../components/DropZone'
import { HashProgress } from '../components/HashProgress'
import { Alert, Button } from '../components/primitives'
import { Stepper } from '../components/Stepper'

function Field({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const id = useId()
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label} <span className="font-normal text-muted">(facoltativo)</span>
        </label>
        <span className="text-xs tabular-nums text-muted" aria-hidden>
          {value.length}/{DECLARED_MAX}
        </span>
      </div>
      <input
        id={id}
        value={value}
        maxLength={DECLARED_MAX}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-blue focus:outline-none focus-visible:outline-2"
      />
    </div>
  )
}

export function CertifyPage({ deps = defaultCertifyDeps }: { deps?: CertifyDeps }) {
  const { steps, result, error, running, start, retry, reset } = useCertify(deps)
  const [author, setAuthor] = useState('')
  const [title, setTitle] = useState('')
  const [selected, setSelected] = useState<File>()
  const started = running || !!result || !!error
  const hashing = steps.hash.status === 'active'

  if (result) {
    return (
      <CertificateCard
        result={result}
        onReset={() => {
          reset()
          setSelected(undefined)
          setAuthor('')
          setTitle('')
        }}
      />
    )
  }

  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-16">
      <section aria-labelledby="certifica-title">
        <h1 id="certifica-title" className="max-w-[18ch] font-serif text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
          Dimostra che il tuo lavoro esisteva oggi
        </h1>
        <p className="mt-5 max-w-[60ch] text-lg leading-relaxed text-ink-2">
          Raccogli il progetto in un archivio .zip e trascinalo qui. Il browser ne calcola l'impronta e la registra sulla
          blockchain Bitcoin. Ricevi subito una ricevuta e, dopo qualche ora, un attestato con la data certificata dalla
          blockchain, verificabile da chiunque.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <Field label="Autore" value={author} onChange={setAuthor} disabled={running} />
          <Field label="Titolo dell'opera" value={title} onChange={setTitle} disabled={running} />
        </div>
        <p className="mt-2 text-sm text-muted">Compaiono nell'attestato come dati dichiarati da te, non certificati.</p>

        <div className="mt-6">
          {selected ? (
            <section
              aria-label="Archivio selezionato"
              className="rounded-xl border border-line-strong bg-surface p-5 sm:p-6 [animation:pm-reveal_.3s_ease-out_both]"
            >
              <div className="flex items-start gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-sunken text-ink-2">
                  <FileArchive aria-hidden className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="break-all font-medium text-ink">{selected.name}</p>
                  <p className="mt-0.5 text-sm text-muted">{formatBytes(selected.size, 'it')}</p>
                </div>
                {!started && (
                  <Button variant="ghost" onClick={() => setSelected(undefined)} className="-mr-2 -mt-1 shrink-0 px-2.5">
                    <X aria-hidden className="size-4" />
                    Cambia archivio
                  </Button>
                )}
              </div>
              {!started && (
                <div className="mt-5 border-t border-line pt-5">
                  <p className="max-w-[60ch] text-sm leading-relaxed text-ink-2">
                    Controlla l'archivio e i dati dichiarati, poi conferma. La registrazione sulla blockchain Bitcoin non si
                    può annullare: per modificare qualcosa dopo, dovrai certificare di nuovo.
                  </p>
                  <Button className="mt-4 w-full sm:w-auto" onClick={() => start(selected, { author, title })}>
                    <ShieldCheck aria-hidden className="size-4" />
                    Certifica archivio
                  </Button>
                </div>
              )}
            </section>
          ) : (
            <DropZone disabled={running} onFile={setSelected} />
          )}
        </div>

        {started && (
          <div className="mt-10 grid gap-8">
            <Stepper steps={steps} />
            {hashing && <HashProgress progress={steps.hash.hashProgress} />}
            {error && (
              <Alert tone="danger" title="La certificazione si è fermata" action={<Button onClick={retry}>Riprova</Button>}>
                {error}
              </Alert>
            )}
          </div>
        )}
      </section>

      <aside className="h-fit border-l-2 border-emerald pl-5 text-sm leading-relaxed text-ink-2 lg:mt-3">
        <h2 className="font-semibold text-ink">Cosa lascia il tuo computer</h2>
        <p className="mt-2">
          Solo l'impronta SHA-256 dell'archivio: 64 caratteri da cui è impossibile ricostruire il contenuto.
        </p>
        <p className="mt-3 break-all font-mono text-xs text-muted">9f2c41a7e03b5d18c6a0f2e471b9d3c508e6a4f2d1c7b0935e2a8f61c4d07b3e</p>
        <h2 className="mt-6 font-semibold text-ink">Cosa ricevi</h2>
        <p className="mt-2">
          Subito una ricevuta PDF con la prova OpenTimestamps. Dopo la conferma Bitcoin, di solito entro qualche ora,
          l'attestato con la data del blocco. Le prove si verificano con OpenTimestamps anche senza ProofMark.
        </p>
      </aside>
    </div>
  )
}
