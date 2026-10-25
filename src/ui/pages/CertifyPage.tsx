import { FileArchive, ShieldCheck, X } from 'lucide-react'
import { useId, useState } from 'react'
import { DECLARED_MAX } from '@/core/cert/certificate'
import { formatBytes } from '@/i18n'
import type { CertifyDeps } from '@/flow/certify'
import { defaultCertifyDeps, useCertify } from '@/flow/useCertify'
import { useLang, useT } from '../LangContext'
import { CertificateCard } from '../components/CertificateCard'
import { DropZone } from '../components/DropZone'
import { HashProgress } from '../components/HashProgress'
import { Alert, Button } from '../components/primitives'
import { Stepper } from '../components/Stepper'

function Field({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const id = useId()
  const t = useT().certify
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label} <span className="font-normal text-muted">{t.optional}</span>
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
  const lang = useLang()
  const t = useT().certify
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
      <section aria-labelledby="certify-title">
        <h1 id="certify-title" className="max-w-[18ch] font-serif text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
          {t.title}
        </h1>
        <p className="mt-5 max-w-[60ch] text-lg leading-relaxed text-ink-2">{t.intro}</p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <Field label={t.author} value={author} onChange={setAuthor} disabled={running} />
          <Field label={t.workTitle} value={title} onChange={setTitle} disabled={running} />
        </div>
        <p className="mt-2 text-sm text-muted">{t.declaredNote}</p>

        <div className="mt-6">
          {selected ? (
            <section
              aria-label={t.selected}
              className="rounded-xl border border-line-strong bg-surface p-5 sm:p-6 [animation:pm-reveal_.3s_ease-out_both]"
            >
              <div className="flex items-start gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-sunken text-ink-2">
                  <FileArchive aria-hidden className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="break-all font-medium text-ink">{selected.name}</p>
                  <p className="mt-0.5 text-sm text-muted">{formatBytes(selected.size, lang)}</p>
                </div>
                {!started && (
                  <Button variant="ghost" onClick={() => setSelected(undefined)} className="-mr-2 -mt-1 shrink-0 px-2.5">
                    <X aria-hidden className="size-4" />
                    {t.change}
                  </Button>
                )}
              </div>
              {!started && (
                <div className="mt-5 border-t border-line pt-5">
                  <p className="max-w-[60ch] text-sm leading-relaxed text-ink-2">{t.confirmBody}</p>
                  <Button className="mt-4 w-full sm:w-auto" onClick={() => start(selected, { author, title }, lang)}>
                    <ShieldCheck aria-hidden className="size-4" />
                    {t.confirm}
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
              <Alert tone="danger" title={t.stopped} action={<Button onClick={retry}>{t.retry}</Button>}>
                {error}
              </Alert>
            )}
          </div>
        )}
      </section>

      <aside className="h-fit border-l-2 border-emerald pl-5 text-sm leading-relaxed text-ink-2 lg:mt-3">
        <h2 className="font-semibold text-ink">{t.leavesTitle}</h2>
        <p className="mt-2">{t.leaves}</p>
        <p className="mt-3 break-all font-mono text-xs text-muted">9f2c41a7e03b5d18c6a0f2e471b9d3c508e6a4f2d1c7b0935e2a8f61c4d07b3e</p>
        <h2 className="mt-6 font-semibold text-ink">{t.getsTitle}</h2>
        <p className="mt-2">{t.gets}</p>
      </aside>
    </div>
  )
}
