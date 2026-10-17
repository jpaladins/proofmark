// Every string printed on the attestation PDF, resolved for one certificate. The renderer only
// lays this out, so the copy can be tested without parsing PDF content streams.
import { APP_VERSION, VERIFY_URL } from '@/core/app'
import type { Certificate } from '@/core/cert/certificate'

export type Row = { label: string; value: string; mono?: boolean; note?: string }
export type Pill = { text: string; tone: 'ok' | 'warn' | 'muted' }
export type VerifyStep = { title: string; code?: string[]; text?: string }

export type AttestatoContent = {
  id: string
  issued: string
  title: string
  subtitle: string
  hero: { heading: string; body: string }
  qrCaption: string
  declared?: { tag: string; rows: Row[] }
  subject: { rows: Row[]; hash: string }
  rfc3161: { pill: Pill; rows: Row[] }
  bitcoin: { pill: Pill; rows: Row[]; reminder?: { heading: string; body: string } }
  statement: string
  verify: { intro: string; steps: VerifyStep[]; attachmentsLabel: string; attachments: string[] }
  warnings: { heading: string; body: string; bullets: string[] }
  limits: Row[]
  footer: [string, string]
  sections: Record<'declared' | 'subject' | 'rfc3161' | 'bitcoin' | 'statement' | 'verify' | 'warnings' | 'limits', string>
}

const ROME = 'Europe/Rome'
const VERIFY_HOST = VERIFY_URL.replace(/^https:\/\//, '')
export const PENDING_REMINDER = `Tra qualche ora torna su ${VERIFY_HOST}, carica l'archivio e questo PDF e scarica l'attestato aggiornato con la conferma Bitcoin.`

const fmtDate = (d: Date, timeZone = ROME) =>
  new Intl.DateTimeFormat('it-IT', { timeZone, day: '2-digit', month: '2-digit', year: 'numeric' }).format(d)
const fmtTime = (d: Date, timeZone = ROME) =>
  new Intl.DateTimeFormat('it-IT', { timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(d)
const fmtLongDate = (d: Date) =>
  new Intl.DateTimeFormat('it-IT', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }).format(d)

export function formatBytes(size: number): string {
  const units = ['byte', 'KB', 'MB', 'GB', 'TB']
  let v = size
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return i === 0 ? `${size} byte` : `${v.toLocaleString('it-IT', { maximumFractionDigits: 1 })} ${units[i]}`
}

export function groupHash(hex: string): string {
  return hex.match(/.{1,8}/g)?.join(' ') ?? hex
}

export function buildAttestatoContent(
  cert: Certificate,
  opts: { sealed: boolean; attachments: { name: string; size: number }[] },
): AttestatoContent {
  const gen = new Date(cert.rfc3161.genTime)
  const created = new Date(cert.createdAt)
  const ots = cert.opentimestamps
  const pending = ots.status === 'pending'
  const utc = `${fmtDate(gen, 'UTC')} ${fmtTime(gen, 'UTC')} UTC`
  const name = cert.file.name

  const declaredRows: Row[] = []
  if (cert.declared?.author) declaredRows.push({ label: 'Autore', value: cert.declared.author })
  if (cert.declared?.title) declaredRows.push({ label: "Titolo dell'opera", value: cert.declared.title })

  const bitcoin: AttestatoContent['bitcoin'] =
    ots.status === 'confirmed'
      ? {
          pill: { text: 'Confermato', tone: 'ok' },
          rows: [
            { label: 'Stato', value: 'Confermato sulla blockchain Bitcoin' },
            { label: 'Blocco', value: `#${ots.block}` },
            ...(ots.blockTime
              ? [{ label: 'Data del blocco', value: `${fmtDate(new Date(ots.blockTime), 'UTC')} ${fmtTime(new Date(ots.blockTime), 'UTC')} UTC` }]
              : []),
            { label: 'Protocollo', value: 'OpenTimestamps' },
          ],
        }
      : pending
        ? {
            pill: { text: 'In attesa di conferma', tone: 'warn' },
            rows: [
              { label: "Stato all'emissione", value: 'In attesa di conferma' },
              { label: 'Protocollo', value: 'OpenTimestamps' },
              { label: 'Calendari', value: ots.calendars.map((c) => c.replace(/^https:\/\//, '')).join('\n'), mono: true },
            ],
            reminder: { heading: 'Ottieni la conferma.', body: PENDING_REMINDER },
          }
        : {
            pill: { text: 'Non disponibile', tone: 'muted' },
            rows: [
              { label: "Stato all'emissione", value: 'Ancoraggio non disponibile' },
              { label: 'Come rimediare', value: `Puoi aggiungerlo in seguito dalla sezione Verifica di ${VERIFY_HOST.split('/')[0]}.` },
            ],
          }

  const bullets = [
    ...(pending
      ? [
          `Ancoraggio Bitcoin in attesa: dopo qualche ora torna su ${VERIFY_HOST}, carica l'archivio e questo PDF e scarica l'attestato aggiornato (rev. 2) con la conferma. Conserva poi entrambe le versioni.`,
        ]
      : []),
    "Conserva insieme: l'archivio .zip originale, questo PDF e il file prova.ots aggiornato.",
    'Fai più copie su supporti diversi (disco esterno, cloud).',
    "Non rinominare l'archivio: il nome non incide sull'impronta, ma semplifica la verifica.",
  ]

  return {
    id: cert.id,
    issued: `Emesso il ${fmtDate(created)} alle ${fmtTime(created)} (Europe/Rome)`,
    title: 'Attestato di Esistenza Digitale',
    subtitle: 'Prova di anteriorità tramite marca temporale RFC 3161 e ancoraggio sulla blockchain Bitcoin',
    hero: {
      heading: `Esistenza attestata al ${fmtLongDate(gen)}, ${fmtTime(gen, 'UTC')} UTC`,
      body: `Un archivio con l'impronta SHA-256 riportata sotto esisteva non oltre questa data e ora, come risulta dalla marca temporale emessa da ${cert.rfc3161.tsa.startsWith('DigiCert') ? 'DigiCert, Inc.' : cert.rfc3161.tsa}.`,
    },
    qrCaption: 'Scansiona per verificare',
    ...(declaredRows.length > 0
      ? { declared: { tag: 'Dati dichiarati dal richiedente — non verificati né certificati', rows: declaredRows } }
      : {}),
    subject: {
      rows: [
        { label: 'Nome del file', value: name, mono: true },
        {
          label: 'Dimensione',
          value: formatBytes(cert.file.size),
          ...(cert.file.size >= 1024 ? { note: `(${cert.file.size.toLocaleString('it-IT')} byte)` } : {}),
        },
        {
          label: "Ultima modifica (dal sistema dell'utente)",
          value: `${fmtDate(new Date(cert.file.lastModified))} ${fmtTime(new Date(cert.file.lastModified)).slice(0, 5)}`,
          note: '— informazione non certificata',
        },
        { label: 'Algoritmo di impronta', value: 'SHA-256' },
      ],
      hash: groupHash(cert.file.sha256),
    },
    rfc3161: {
      pill: { text: 'Valida', tone: 'ok' },
      rows: [
        { label: 'Autorità (TSA)', value: cert.rfc3161.tsa },
        { label: 'Data e ora', value: utc, note: `${fmtTime(gen)} ora italiana` },
        { label: 'N. di serie', value: `0x${cert.rfc3161.serial.toUpperCase()}`, mono: true },
        { label: 'Policy', value: cert.rfc3161.policy, mono: true },
        ...(cert.rfc3161.nonce ? [{ label: 'Nonce', value: `0x${cert.rfc3161.nonce}`, mono: true }] : []),
      ],
    },
    bitcoin,
    statement: `Il presente attestato documenta che un file avente l'impronta crittografica SHA-256 sopra indicata esisteva in data non successiva al ${fmtLongDate(gen)}, ore ${fmtTime(gen, 'UTC')} UTC. L'impronta è stata calcolata esclusivamente sul dispositivo del richiedente: il contenuto del file non è mai stato trasmesso a ProofMark né a terzi. L'attestato non certifica la paternità, il contenuto o l'originalità dell'opera, né i dati dichiarati dal richiedente.`,
    verify: {
      intro: 'La verifica non richiede ProofMark: bastano strumenti standard e i file allegati a questo PDF.',
      steps: [
        {
          title: "1. Ricalcola l'impronta dell'archivio",
          code: [
            '# Windows (Prompt dei comandi o PowerShell)',
            `certutil -hashfile "${name}" SHA256`,
            '# macOS / Linux',
            `shasum -a 256 "${name}"`,
          ],
        },
        {
          title: '2. Verifica la marca temporale DigiCert',
          code: [
            '# radice: DigiCert Trusted Root G4 (digicert.com, Root Certificates)',
            `openssl ts -verify -digest ${cert.file.sha256} \\`,
            '  -in prova.tsr -CAfile DigiCertTrustedRootG4.pem',
          ],
        },
        {
          title: "3. Verifica l'ancoraggio Bitcoin",
          code: [
            ...(pending ? ['ots upgrade prova.ots   # una volta, dopo la conferma'] : []),
            `ots verify prova.ots -f "${name}"`,
          ],
        },
        {
          title: '4. Oppure',
          text: `scansiona il QR code o vai su ${VERIFY_HOST} e carica l'archivio con questo PDF.`,
        },
      ],
      attachmentsLabel: 'File allegati a questo PDF:',
      attachments: opts.attachments.map((a) => `${a.name} · ${formatBytes(a.size)}`),
    },
    warnings: {
      heading: "Conserva l'archivio esattamente com'è.",
      body: "Se estrai i file e li ricomprimi, anche senza modificarli, l'impronta cambia e questo attestato non sarà più riconducibile all'archivio.",
      bullets,
    },
    limits: [
      { label: 'Cosa dimostra', value: 'Che il file esisteva non oltre la data indicata e che da allora non è stato alterato.' },
      { label: 'Cosa non dimostra', value: "Chi è l'autore, l'originalità dell'opera o la veridicità dei dati dichiarati." },
      {
        label: 'Marca temporale',
        value:
          'Marca RFC 3161 rilasciata dalla TSA pubblica di DigiCert, Inc., che non è un prestatore qualificato ai sensi del Regolamento (UE) 910/2014 (eIDAS): non ha il valore di una validazione temporale elettronica qualificata.',
      },
      {
        label: 'Blockchain',
        value:
          "L'ancoraggio Bitcoin è un riscontro indipendente e pubblico, verificabile da chiunque senza fidarsi di ProofMark né di DigiCert.",
      },
      {
        label: 'Valore',
        value: 'Elemento di prova liberamente valutabile. Per esigenze legali specifiche rivolgiti a un professionista.',
      },
    ],
    footer: [
      opts.sealed
        ? 'Documento sigillato con marca temporale RFC 3161 · verificabile in Adobe Acrobat'
        : `Documento non sigillato: rigeneralo da ${VERIFY_HOST.split('/')[0]} per aggiungere il sigillo`,
      `Generato localmente nel browser · ProofMark v${APP_VERSION} · open source (MIT)`,
    ],
    sections: {
      declared: 'Dati dichiarati',
      subject: 'Oggetto della certificazione',
      rfc3161: 'Marca temporale RFC 3161',
      bitcoin: 'Ancoraggio Bitcoin',
      statement: 'Dichiarazione',
      verify: 'Come verificare in modo indipendente',
      warnings: 'Avvertenze importanti',
      limits: 'Natura e limiti della prova',
    },
  }
}
