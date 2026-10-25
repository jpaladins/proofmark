import { CalendarPlus, Download, FileJson, FileText, RotateCcw } from 'lucide-react'
import { useLayoutEffect, useRef } from 'react'
import { verifyDisplayFor } from '@/core/app'
import { formatBytes, localeOf, type Lang } from '@/i18n'
import type { CertifyResult } from '@/flow/certify'
import { utcOffset } from '@/core/time'
import { useLang, useT } from '../LangContext'
import { buildReminderIcs } from '../ics'
import { downloadBytes } from '../download'
import { proofFileNames } from '@/core/cert/fileNames'
import { Alert, Badge, Button } from './primitives'
import { CopyButton, Fingerprint } from './Fingerprint'

const fmtDateTime = (iso: string, lang: Lang) =>
  `${new Intl.DateTimeFormat(localeOf(lang), { dateStyle: 'long', timeStyle: 'medium' }).format(new Date(iso))} ${utcOffset(new Date(iso))}`
const fmtTime = (d: Date, lang: Lang) =>
  new Intl.DateTimeFormat(localeOf(lang), { hour: '2-digit', minute: '2-digit' }).format(d)

export function PendingBanner({ at, certId, fileName }: { at: Date; certId: string; fileName: string }) {
  const lang = useLang()
  const m = useT()
  const t = m.result
  return (
    <Alert
      tone="info"
      label={t.bannerLabel}
      title={t.bannerTitle(fmtTime(at, lang))}
      action={
        <Button
          variant="secondary"
          onClick={() =>
            downloadBytes(buildReminderIcs({ at, certId, fileName, lang }), `${certId}-${t.icsSuffix}.ics`, 'text/calendar')
          }
        >
          <CalendarPlus aria-hidden className="size-4" />
          {t.addReminder}
        </Button>
      }
    >
      {m.pdf.pendingReminder(verifyDisplayFor(lang))}
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
  const lang = useLang()
  const t = useT().result
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
      label: t.downloadPdf,
      icon: FileText,
      primary: true,
      run: () => downloadBytes(result.pdf, names.pdf, 'application/pdf'),
    },
    {
      label: t.downloadJson,
      icon: FileJson,
      run: () => downloadBytes(result.json, names.json, 'application/json'),
    },
    {
      label: t.downloadOts,
      icon: Download,
      run: () => downloadBytes(result.ots, names.ots, 'application/vnd.opentimestamps.v1'),
    },
  ]

  return (
    <section aria-label={t.region} className="[animation:pm-reveal_.45s_ease-out_both]">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 ref={headingRef} tabIndex={-1} className="font-serif text-2xl font-semibold tracking-tight focus:outline-none">
          {t.heading}
        </h2>
        <p className="font-mono text-sm text-muted">{c.id}</p>
      </div>
      <p className="mt-3 max-w-[62ch] text-ink-2">{t.intro}</p>

      <div className="mt-6 rounded-xl border border-line bg-surface p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-ink-2">{t.fingerprintOf(c.file.name)}</p>
          <CopyButton value={c.file.sha256} label={t.copyFingerprint} />
        </div>
        <div className="mt-3">
          <Fingerprint hash={c.file.sha256} />
        </div>
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_20rem]">
        <dl>
          <Fact label={t.archive}>
            {c.file.name} <span className="text-muted">({formatBytes(c.file.size, lang)})</span>
          </Fact>
          {c.declared?.author && <Fact label={t.authorDeclared}>{c.declared.author}</Fact>}
          {c.declared?.title && <Fact label={t.titleDeclared}>{c.declared.title}</Fact>}
          <Fact label={t.requested}>
            {fmtDateTime(c.requestedAt, lang)}
            <span className="mt-0.5 block text-muted">{t.deviceClock}</span>
          </Fact>
          <Fact label={t.anchoring}>
            <Badge tone="warn">{t.pending}</Badge>
            <span className="mt-1 block text-muted">{t.calendars(c.opentimestamps.calendars.length)}</span>
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
            {t.another}
          </Button>
        </div>
      </div>

      <div className="mt-8 grid gap-3">
        <PendingBanner at={result.reminderAfter} certId={c.id} fileName={c.file.name} />
        <Alert tone="warning" title={t.keepTitle}>
          {t.keepBody}
        </Alert>
      </div>
    </section>
  )
}
