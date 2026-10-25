import { CalendarPlus, Download, FileJson, FileText, RotateCcw } from 'lucide-react'
import { useLayoutEffect, useRef } from 'react'
import { verifyDisplayFor } from '@/core/app'
import { formatBytes, messages } from '@/i18n'
import type { CertifyResult } from '@/flow/certify'
import { utcOffset } from '@/core/time'
import { buildReminderIcs } from '../ics'
import { downloadBytes } from '../download'
import { proofFileNames } from '@/core/cert/fileNames'
import { Alert, Badge, Button } from './primitives'
import { CopyButton, Fingerprint } from './Fingerprint'

const fmtDateTime = (iso: string) =>
  `${new Intl.DateTimeFormat('it-IT', { dateStyle: 'long', timeStyle: 'medium' }).format(new Date(iso))} ${utcOffset(new Date(iso))}`
const fmtTime = (d: Date) => new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' }).format(d)

export function PendingBanner({ at, certId, fileName }: { at: Date; certId: string; fileName: string }) {
  return (
    <Alert
      tone="info"
      label="Conferma Bitcoin in arrivo"
      title={`Per l'attestato con la data torna dopo le ${fmtTime(at)} circa`}
      action={
        <Button
          variant="secondary"
          onClick={() =>
            downloadBytes(buildReminderIcs({ at, certId, fileName }), `${certId}-promemoria.ics`, 'text/calendar')
          }
        >
          <CalendarPlus aria-hidden className="size-4" />
          Aggiungi promemoria al calendario
        </Button>
      }
    >
      {/* Italian until the result page follows the page language. */}
      {messages('it').pdf.pendingReminder(verifyDisplayFor('it'))}
    </Alert>
  )
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-t border-line py-3 sm:grid-cols-[11rem_1fr] sm:gap-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="min-w-0 text-sm text-ink">{children}</dd>
    </div>
  )
}

/** Result of a certification run: the receipt. The attestation comes later, from the Verify page. */
export function CertificateCard({ result, onReset }: { result: CertifyResult; onReset: () => void }) {
  const { certificate: c } = result
  const names = proofFileNames(c)
  const headingRef = useRef<HTMLHeadingElement>(null)

  // The receipt replaces a long form: jump to the top before it is painted (a smooth scroll can be
  // cancelled by the browser while the page height changes) and move focus to the result.
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    headingRef.current?.focus({ preventScroll: true })
  }, [])
  const downloads = [
    {
      label: 'Scarica ricevuta PDF',
      icon: FileText,
      primary: true,
      run: () => downloadBytes(result.pdf, names.pdf, 'application/pdf'),
    },
    {
      label: 'Scarica ricevuta JSON',
      icon: FileJson,
      run: () => downloadBytes(result.json, names.json, 'application/json'),
    },
    {
      label: 'Scarica prova Bitcoin (.ots)',
      icon: Download,
      run: () => downloadBytes(result.ots, names.ots, 'application/vnd.opentimestamps.v1'),
    },
  ]

  return (
    <section aria-label="Ricevuta generata" className="[animation:pm-reveal_.45s_ease-out_both]">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 ref={headingRef} tabIndex={-1} className="font-serif text-2xl font-semibold tracking-tight focus:outline-none">
          Registrazione inviata alla blockchain
        </h2>
        <p className="font-mono text-sm text-muted">{c.id}</p>
      </div>
      <p className="mt-3 max-w-[62ch] text-ink-2">
        Hai la ricevuta. La data di esistenza verrà dal blocco Bitcoin che conterrà la prova, di solito entro qualche ora:
        a quel punto potrai scaricare l'attestato dalla pagina Verifica.
      </p>

      <div className="mt-6 rounded-xl border border-line bg-surface p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-ink-2">Impronta SHA-256 di {c.file.name}</p>
          <CopyButton value={c.file.sha256} label="Copia l'impronta" />
        </div>
        <div className="mt-3">
          <Fingerprint hash={c.file.sha256} />
        </div>
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_20rem]">
        <dl>
          <Fact label="Archivio">
            {c.file.name} <span className="text-muted">({formatBytes(c.file.size, 'it')})</span>
          </Fact>
          {c.declared?.author && <Fact label="Autore (dichiarato)">{c.declared.author}</Fact>}
          {c.declared?.title && <Fact label="Titolo (dichiarato)">{c.declared.title}</Fact>}
          <Fact label="Richiesta inviata">
            {fmtDateTime(c.requestedAt)}
            <span className="mt-0.5 block text-muted">Orologio del tuo dispositivo, non certificato</span>
          </Fact>
          <Fact label="Ancoraggio Bitcoin">
            <Badge tone="warn">In attesa di conferma</Badge>
            <span className="mt-1 block text-muted">{c.opentimestamps.calendars.length} calendari OpenTimestamps</span>
          </Fact>
        </dl>

        <div className="flex flex-col gap-2">
          {downloads.map(({ label, icon: Icon, primary, run }) => (
            <Button key={label} variant={primary ? 'primary' : 'secondary'} onClick={run} className="justify-start">
              <Icon aria-hidden className="size-4" />
              {label}
            </Button>
          ))}
          <Button variant="ghost" onClick={onReset} className="mt-2 justify-start">
            <RotateCcw aria-hidden className="size-4" />
            Certifica un altro archivio
          </Button>
        </div>
      </div>

      <div className="mt-8 grid gap-3">
        <PendingBanner at={result.reminderAfter} certId={c.id} fileName={c.file.name} />
        <Alert tone="warning" title="Conserva l'archivio esattamente com'è.">
          Se estrai i file e li ricomprimi, anche senza modificarli, l'impronta cambia e la prova non sarà più
          riconducibile all'archivio. Tieni insieme lo .zip originale, la ricevuta e la prova .ots.
        </Alert>
      </div>
    </section>
  )
}
