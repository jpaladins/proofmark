// Every string printed on the PDF, resolved for one certificate. The renderer only lays this out,
// so the copy can be tested without parsing PDF content streams. Two documents share the layout:
// the receipt (ricevuta, proof still pending: no date attested) and the attestation (attestato,
// existence attested at the time of the Bitcoin block). The copy comes from `messages(lang).pdf`, in
// the certificate's language; certificates without `lang` are Italian.
import { APP_VERSION, DEVELOPER, verifyDisplayFor } from '@/core/app'
import { certLang, type Certificate } from '@/core/cert/certificate'
import { proofFileNames } from '@/core/cert/fileNames'
import { localTimeZone, utcOffset } from '@/core/time'
import { formatBytes, localeOf, messages } from '@/i18n'

export type Row = { label: string; value: string; mono?: boolean; note?: string }
export type Pill = { text: string; tone: 'ok' | 'warn' | 'muted' }
export type VerifyStep = { title: string; code?: string[]; text?: string }

export type AttestatoContent = {
  id: string
  /** Credit printed in small capitals next to the ProofMark name. */
  brandCredit: string
  /** Small-capitals line under the ProofMark name. */
  tagline: string
  /** Bare document name ("receipt", "attestato"), printed before the id in the page-2 header. */
  docName: string
  docLabel: string
  tone: 'pending' | 'confirmed'
  issued: string
  title: string
  subtitle: string
  /** `stamp` (attestation only) is the attested moment, laid out large in the hero box. */
  hero: { heading: string; body: string; stamp?: { kicker: string; date: string; time: string } }
  qrCaption: string
  declared?: { tag: string; rows: Row[] }
  subject: { rows: Row[]; hash: string }
  bitcoin: { pill: Pill; rows: Row[]; reminder?: { heading: string; body: string } }
  statement: string
  verify: { intro: string; steps: VerifyStep[]; attachmentsLabel: string; attachments: string[] }
  warnings: { heading: string; body: string; bullets: string[] }
  limits: Row[]
  footer: [string, string]
  /** Right side of each page footer ("Page 1 of 2"). */
  pageLabels: [string, string]
  /** Kicker in the header of page 2. */
  page2Heading: string
  sections: Record<'declared' | 'subject' | 'bitcoin' | 'statement' | 'verify' | 'warnings' | 'limits', string>
}

type Locale = ReturnType<typeof localeOf>

const fmtDate = (d: Date, timeZone: string, locale: Locale) =>
  new Intl.DateTimeFormat(locale, { timeZone, day: '2-digit', month: '2-digit', year: 'numeric' }).format(d)
const fmtTime = (d: Date, timeZone: string, locale: Locale) =>
  new Intl.DateTimeFormat(locale, { timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(d)
const fmtLongDate = (d: Date, timeZone: string, locale: Locale) =>
  new Intl.DateTimeFormat(locale, { timeZone, day: 'numeric', month: 'long', year: 'numeric' }).format(d)

export function groupHash(hex: string): string {
  return hex.match(/.{1,8}/g)?.join(' ') ?? hex
}

export function buildAttestatoContent(
  cert: Certificate,
  opts: { attachments: { name: string; size: number }[]; timeZone?: string },
): AttestatoContent {
  const lang = certLang(cert)
  const locale = localeOf(lang)
  const t = messages(lang).pdf
  const verifyAddress = verifyDisplayFor(lang)
  // Local times are shown in the time zone of the device generating the document, with its offset.
  const tz = opts.timeZone ?? localTimeZone()
  const date = (d: Date, zone = tz) => fmtDate(d, zone, locale)
  const time = (d: Date, zone = tz) => fmtTime(d, zone, locale)
  const local = (d: Date) => `${time(d)} ${utcOffset(d, tz)}`
  const confirmed = cert.kind === 'attestato' && cert.opentimestamps.status === 'confirmed'
  const doc = confirmed ? t.attestation : t.receipt
  const ots = cert.opentimestamps
  const created = new Date(cert.createdAt)
  const requested = new Date(cert.requestedAt)
  const modified = new Date(cert.file.lastModified)
  const blockTime = ots.blockTime ? new Date(ots.blockTime) : undefined
  const block = ots.block ?? 0
  const name = cert.file.name
  const files = proofFileNames(cert)

  const declaredRows: Row[] = []
  if (cert.declared?.author) declaredRows.push({ label: t.declared.author, value: cert.declared.author })
  if (cert.declared?.title) declaredRows.push({ label: t.declared.title, value: cert.declared.title })

  const requestRow: Row = {
    label: t.bitcoin.requested,
    value: t.dateAtTime(date(requested), local(requested)),
    note: t.bitcoin.requestedNote,
  }

  const bitcoin: AttestatoContent['bitcoin'] =
    confirmed && blockTime
      ? {
          pill: { text: t.bitcoin.confirmedPill, tone: 'ok' },
          rows: [
            { label: t.bitcoin.status, value: t.bitcoin.confirmedStatus },
            { label: t.bitcoin.block, value: `#${block}` },
            {
              label: t.bitcoin.blockDate,
              value: `${date(blockTime, 'UTC')} ${time(blockTime, 'UTC')} UTC`,
              ...(utcOffset(blockTime, tz) === 'UTC' ? {} : { note: `(${local(blockTime)})` }),
            },
            { label: t.bitcoin.precision, value: t.bitcoin.precisionValue },
            { label: t.bitcoin.protocol, value: 'OpenTimestamps' },
            requestRow,
          ],
        }
      : {
          pill: { text: t.bitcoin.pendingPill, tone: 'warn' },
          rows: [
            { label: t.bitcoin.status, value: t.bitcoin.pendingStatus },
            requestRow,
            { label: t.bitcoin.protocol, value: 'OpenTimestamps' },
            { label: t.bitcoin.calendars, value: ots.calendars.map((c) => c.replace(/^https:\/\//, '')).join('\n'), mono: true },
          ],
          reminder: { heading: t.bitcoin.reminderHeading, body: t.pendingReminder(verifyAddress) },
        }

  const blockHeading = blockTime ? `${fmtLongDate(blockTime, 'UTC', locale)}, ${time(blockTime, 'UTC')} UTC` : ''

  return {
    id: cert.id,
    brandCredit: `BY ${DEVELOPER.name.toUpperCase()}`,
    tagline: t.tagline,
    docName: confirmed ? messages(lang).files.attestation : messages(lang).files.receipt,
    docLabel: doc.docLabel,
    tone: confirmed ? 'confirmed' : 'pending',
    issued: t.issued(date(created), time(created), utcOffset(created, tz)),
    title: doc.title,
    subtitle: doc.subtitle,
    hero: confirmed
      ? {
          heading: t.attestation.heroHeading(blockHeading),
          stamp: blockTime && {
            kicker: t.attestation.stampKicker,
            // One time, in the device time zone with its offset; the date follows the same zone.
            date: fmtLongDate(blockTime, tz, locale),
            time: local(blockTime),
          },
          body: t.attestation.heroBody(block),
        }
      : { heading: t.receipt.heroHeading, body: t.receipt.heroBody },
    qrCaption: t.qrCaption,
    ...(declaredRows.length > 0 ? { declared: { tag: t.declared.tag, rows: declaredRows } } : {}),
    subject: {
      rows: [
        { label: t.subject.fileName, value: name, mono: true },
        {
          label: t.subject.size,
          value: formatBytes(cert.file.size, lang),
          ...(cert.file.size >= 1024 ? { note: t.subject.exactBytes(cert.file.size.toLocaleString(locale)) } : {}),
        },
        {
          label: t.subject.lastModified,
          value: `${date(modified)} ${time(modified).slice(0, 5)} ${utcOffset(modified, tz)}`,
          note: t.subject.lastModifiedNote,
        },
        { label: t.subject.algorithm, value: 'SHA-256' },
      ],
      hash: groupHash(cert.file.sha256),
    },
    bitcoin,
    statement: confirmed ? t.attestation.statement(blockHeading, block) : t.receipt.statement,
    verify: {
      intro: t.verify.intro,
      steps: [
        {
          title: t.verify.hashStep,
          code: [t.verify.windowsComment, `certutil -hashfile "${name}" SHA256`, t.verify.unixComment, `shasum -a 256 "${name}"`],
        },
        {
          title: t.verify.otsStep,
          code: [
            ...(confirmed ? [] : [`ots upgrade "${files.ots}"   ${t.verify.upgradeComment}`]),
            `ots verify "${files.ots}" -f "${name}"`,
          ],
        },
        { title: t.verify.otherStep, text: t.verify.otherText(verifyAddress) },
      ],
      attachmentsLabel: t.verify.attachmentsLabel,
      attachments: opts.attachments.map((a) => `${a.name} · ${formatBytes(a.size, lang)}`),
    },
    warnings: {
      heading: t.warnings.heading,
      body: doc.warningsBody,
      bullets: [...(confirmed ? [] : [t.warnings.pending(verifyAddress)]), doc.keepTogether, t.warnings.copies, t.warnings.noRename],
    },
    limits: [
      { label: t.limits.proves, value: doc.proves },
      { label: t.limits.notProves, value: t.limits.notProvesValue },
      { label: t.limits.blockchain, value: t.limits.blockchainValue },
      { label: t.limits.value, value: t.limits.valueValue },
    ],
    footer: [t.footer.proof, t.footer.generated(APP_VERSION)],
    pageLabels: [t.pageOf(1, 2), t.pageOf(2, 2)],
    page2Heading: t.page2Heading,
    sections: t.sections,
  }
}
