import { CalendarPlus, Download, FileJson, FileText, RotateCcw } from 'lucide-react'
import { PENDING_REMINDER } from '@/core/pdf/content'
import { formatBytes } from '@/core/pdf/content'
import type { CertifyResult } from '@/flow/certify'
import { buildReminderIcs } from '../ics'
import { baseName, downloadBytes } from '../download'
import { Alert, Badge, Button } from './primitives'
import { CopyButton, Fingerprint } from './Fingerprint'

const fmtDateTime = (iso: string) =>
  new Intl.DateTimeFormat('it-IT', { dateStyle: 'long', timeStyle: 'medium' }).format(new Date(iso))
const fmtTime = (d: Date) => new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' }).format(d)

export function PendingBanner({ at, certId, fileName }: { at: Date; certId: string; fileName: string }) {
  return (
    <Alert
      tone="info"
      label="Conferma Bitcoin in arrivo"
      title={`Conferma Bitcoin: torna dopo le ${fmtTime(at)} circa`}
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
      {PENDING_REMINDER.replace('questo PDF', "l'attestato PDF")}
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

export function CertificateCard({ result, onReset }: { result: CertifyResult; onReset: () => void }) {
  const { certificate: c } = result
  const base = baseName(c.file.name)
  const ots = c.opentimestamps
  const downloads = [
    {
      label: 'Scarica attestato PDF',
      icon: FileText,
      primary: true,
      run: () => downloadBytes(result.pdf, `${base}_attestato.pdf`, 'application/pdf'),
    },
    {
      label: 'Scarica certificato JSON',
      icon: FileJson,
      run: () => downloadBytes(result.json, `${base}_certificato.json`, 'application/json'),
    },
    {
      label: 'Scarica prova DigiCert (.tsr)',
      icon: Download,
      run: () => downloadBytes(result.tsr, `${base}.tsr`, 'application/timestamp-reply'),
    },
    ...(result.ots
      ? [
          {
            label: 'Scarica prova Bitcoin (.ots)',
            icon: Download,
            run: () => downloadBytes(result.ots!, `${base}.ots`, 'application/vnd.opentimestamps.v1'),
          },
        ]
      : []),
  ]

  return (
    <section aria-label="Certificato generato" className="[animation:pm-reveal_.45s_ease-out_both]">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-serif text-2xl font-semibold tracking-tight">Il tuo archivio è certificato</h2>
        <p className="font-mono text-sm text-muted">{c.id}</p>
      </div>

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
            {c.file.name} <span className="text-muted">({formatBytes(c.file.size)})</span>
          </Fact>
          {c.declared?.author && <Fact label="Autore (dichiarato)">{c.declared.author}</Fact>}
          {c.declared?.title && <Fact label="Titolo (dichiarato)">{c.declared.title}</Fact>}
          <Fact label="Marca DigiCert">
            <span className="flex flex-wrap items-center gap-2">
              {fmtDateTime(c.rfc3161.genTime)} <Badge tone="ok">Valida</Badge>
            </span>
            <span className="mt-0.5 block text-muted">{c.rfc3161.tsa}</span>
          </Fact>
          <Fact label="Ancoraggio Bitcoin">
            {ots.status === 'pending' && <Badge tone="warn">In attesa di conferma</Badge>}
            {ots.status === 'confirmed' && <Badge tone="ok">Confermato nel blocco #{ots.block}</Badge>}
            {ots.status === 'unavailable' && <Badge tone="muted">Non disponibile</Badge>}
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
        {result.reminderAfter && <PendingBanner at={result.reminderAfter} certId={c.id} fileName={c.file.name} />}
        {!result.pdfSealed && (
          <Alert tone="warning" title="Attestato senza sigillo sul documento">
            La marca DigiCert sull'archivio è valida, ma il sigillo sul PDF non è riuscito. Puoi certificare di nuovo più
            tardi per ottenere un PDF sigillato.
          </Alert>
        )}
        <Alert tone="warning" title="Conserva l'archivio esattamente com'è.">
          Se estrai i file e li ricomprimi, anche senza modificarli, l'impronta cambia e l'attestato non sarà più
          riconducibile all'archivio. Tieni insieme lo .zip originale, il PDF e la prova .ots.
        </Alert>
      </div>
    </section>
  )
}
