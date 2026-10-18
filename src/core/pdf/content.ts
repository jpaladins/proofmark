// Every string printed on the PDF, resolved for one certificate. The renderer only lays this out,
// so the copy can be tested without parsing PDF content streams. Two documents share the layout:
// the receipt (ricevuta, proof still pending: no date attested) and the attestation (attestato,
// existence attested at the time of the Bitcoin block).
import { APP_VERSION, DEVELOPER, VERIFY_DISPLAY } from '@/core/app'
import type { Certificate } from '@/core/cert/certificate'

export type Row = { label: string; value: string; mono?: boolean; note?: string }
export type Pill = { text: string; tone: 'ok' | 'warn' | 'muted' }
export type VerifyStep = { title: string; code?: string[]; text?: string }

export type AttestatoContent = {
  id: string
  /** Credit printed in small capitals next to the ProofMark name. */
  brandCredit: string
  docLabel: string
  tone: 'pending' | 'confirmed'
  issued: string
  title: string
  subtitle: string
  hero: { heading: string; body: string }
  qrCaption: string
  declared?: { tag: string; rows: Row[] }
  subject: { rows: Row[]; hash: string }
  bitcoin: { pill: Pill; rows: Row[]; reminder?: { heading: string; body: string } }
  statement: string
  verify: { intro: string; steps: VerifyStep[]; attachmentsLabel: string; attachments: string[] }
  warnings: { heading: string; body: string; bullets: string[] }
  limits: Row[]
  footer: [string, string]
  sections: Record<'declared' | 'subject' | 'bitcoin' | 'statement' | 'verify' | 'warnings' | 'limits', string>
}

const ROME = 'Europe/Rome'
export const PENDING_REMINDER = `Tra qualche ora torna su ${VERIFY_DISPLAY}, carica l'archivio e questa ricevuta e scarica l'attestato con la data certificata dalla blockchain.`

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
  opts: { attachments: { name: string; size: number }[] },
): AttestatoContent {
  const confirmed = cert.kind === 'attestato' && cert.opentimestamps.status === 'confirmed'
  const ots = cert.opentimestamps
  const created = new Date(cert.createdAt)
  const requested = new Date(cert.requestedAt)
  const blockTime = ots.blockTime ? new Date(ots.blockTime) : undefined
  const name = cert.file.name
  const docWord = confirmed ? 'attestato' : 'ricevuta'

  const declaredRows: Row[] = []
  if (cert.declared?.author) declaredRows.push({ label: 'Autore', value: cert.declared.author })
  if (cert.declared?.title) declaredRows.push({ label: "Titolo dell'opera", value: cert.declared.title })

  const requestRow: Row = {
    label: 'Richiesta inviata il',
    value: `${fmtDate(requested)} alle ${fmtTime(requested)}`,
    note: '(orologio del dispositivo, non certificato)',
  }

  const bitcoin: AttestatoContent['bitcoin'] =
    confirmed && blockTime
      ? {
          pill: { text: 'Confermato', tone: 'ok' },
          rows: [
            { label: 'Stato', value: 'Confermato sulla blockchain Bitcoin' },
            { label: 'Blocco', value: `#${ots.block}` },
            {
              label: 'Data del blocco',
              value: `${fmtDate(blockTime, 'UTC')} ${fmtTime(blockTime, 'UTC')} UTC`,
              note: `(${fmtTime(blockTime)} ora italiana)`,
            },
            {
              label: 'Precisione',
              value: "Circa due ore: è l'orario registrato dai miner nell'intestazione del blocco.",
            },
            { label: 'Protocollo', value: 'OpenTimestamps' },
            requestRow,
          ],
        }
      : {
          pill: { text: 'In attesa di conferma', tone: 'warn' },
          rows: [
            { label: 'Stato', value: 'In attesa di conferma in un blocco Bitcoin' },
            requestRow,
            { label: 'Protocollo', value: 'OpenTimestamps' },
            { label: 'Calendari', value: ots.calendars.map((c) => c.replace(/^https:\/\//, '')).join('\n'), mono: true },
          ],
          reminder: { heading: "Ottieni l'attestato.", body: PENDING_REMINDER },
        }

  const bullets = [
    ...(confirmed
      ? []
      : [
          `Questa ricevuta non attesta una data. Dopo qualche ora torna su ${VERIFY_DISPLAY}, carica l'archivio e questa ricevuta e scarica l'attestato. Conserva poi anche l'attestato e la sua prova.ots.`,
        ]),
    `Conserva insieme: l'archivio .zip originale, questo ${docWord} e il file prova.ots.`,
    'Fai più copie su supporti diversi (disco esterno, cloud).',
    "Non rinominare l'archivio: il nome non incide sull'impronta, ma semplifica la verifica.",
  ]

  const blockHeading = blockTime ? `${fmtLongDate(blockTime)}, ${fmtTime(blockTime, 'UTC')} UTC` : ''

  return {
    id: cert.id,
    brandCredit: `BY ${DEVELOPER.name.toUpperCase()}`,
    docLabel: confirmed ? 'Attestato n.' : 'Ricevuta n.',
    tone: confirmed ? 'confirmed' : 'pending',
    issued: `Emesso il ${fmtDate(created)} alle ${fmtTime(created)} (Europe/Rome)`,
    title: confirmed ? 'Attestato di Esistenza Digitale' : 'Ricevuta di registrazione',
    subtitle: confirmed
      ? 'Prova di anteriorità tramite ancoraggio sulla blockchain Bitcoin (OpenTimestamps)'
      : "Impronta dell'archivio inviata alla blockchain Bitcoin tramite OpenTimestamps",
    hero: confirmed
      ? {
          heading: `Esistenza attestata al ${blockHeading}`,
          body: `Un archivio con l'impronta SHA-256 riportata sotto esisteva non oltre questa data, come risulta dal blocco Bitcoin #${ots.block} che ne contiene la prova.`,
        }
      : {
          heading: 'Registrazione inviata: la data non è ancora attestata',
          body: "L'impronta è stata inviata ai calendari OpenTimestamps, che la scriveranno in un blocco Bitcoin entro qualche ora. Solo allora potrai scaricare l'attestato con la data certificata dalla blockchain.",
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
    bitcoin,
    statement: confirmed
      ? `Il presente attestato documenta che un file avente l'impronta crittografica SHA-256 sopra indicata esisteva in data non successiva al ${blockHeading}, data del blocco Bitcoin #${ots.block} che ne contiene la prova. L'impronta è stata calcolata esclusivamente sul dispositivo del richiedente: il contenuto del file non è mai stato trasmesso a ProofMark né a terzi. L'attestato non certifica la paternità, il contenuto o l'originalità dell'opera, né i dati dichiarati dal richiedente.`
      : "La presente ricevuta documenta che l'impronta crittografica SHA-256 sopra indicata è stata inviata ai calendari OpenTimestamps per la registrazione sulla blockchain Bitcoin. Non attesta ancora alcuna data: la data di esistenza sarà quella del blocco Bitcoin che conterrà la prova, riportata nell'attestato. L'impronta è stata calcolata esclusivamente sul dispositivo del richiedente: il contenuto del file non è mai stato trasmesso a ProofMark né a terzi.",
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
          title: "2. Verifica l'ancoraggio Bitcoin (client OpenTimestamps: opentimestamps.org)",
          code: [
            ...(confirmed ? [] : ['ots upgrade prova.ots   # dopo la conferma, una volta']),
            `ots verify prova.ots -f "${name}"`,
          ],
        },
        {
          title: '3. Oppure',
          text: `scansiona il QR code o vai su ${VERIFY_DISPLAY} e carica l'archivio con questo PDF.`,
        },
      ],
      attachmentsLabel: 'File allegati a questo PDF:',
      attachments: opts.attachments.map((a) => `${a.name} · ${formatBytes(a.size)}`),
    },
    warnings: {
      heading: "Conserva l'archivio esattamente com'è.",
      body: `Se estrai i file e li ricomprimi, anche senza modificarli, l'impronta cambia e questo ${docWord === 'attestato' ? 'attestato' : 'documento'} non sarà più riconducibile all'archivio.`,
      bullets,
    },
    limits: [
      {
        label: 'Cosa dimostra',
        value: confirmed
          ? 'Che il file esisteva non oltre la data del blocco Bitcoin indicato e che da allora non è stato alterato.'
          : "Solo che l'impronta è stata inviata per la registrazione. La data sarà dimostrata dall'attestato.",
      },
      { label: 'Cosa non dimostra', value: "Chi è l'autore, l'originalità dell'opera o la veridicità dei dati dichiarati." },
      {
        label: 'Blockchain',
        value:
          'La prova è ancorata alla blockchain Bitcoin, un registro pubblico che nessuno può modificare a posteriori. Chiunque può verificarla con OpenTimestamps senza fidarsi di ProofMark.',
      },
      {
        label: 'Valore',
        value:
          'Elemento di prova liberamente valutabile. Non è una validazione temporale elettronica qualificata ai sensi del Regolamento (UE) 910/2014 (eIDAS). Per esigenze legali specifiche rivolgiti a un professionista.',
      },
    ],
    footer: [
      'La prova crittografica è il file prova.ots allegato, verificabile con OpenTimestamps',
      `Generato localmente nel browser · ProofMark v${APP_VERSION} · open source (MIT)`,
    ],
    sections: {
      declared: 'Dati dichiarati',
      subject: 'Oggetto della certificazione',
      bitcoin: 'Ancoraggio Bitcoin',
      statement: 'Dichiarazione',
      verify: 'Come verificare in modo indipendente',
      warnings: 'Avvertenze importanti',
      limits: 'Natura e limiti della prova',
    },
  }
}
