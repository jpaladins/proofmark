import { APP_HOST, VERIFY_URL } from '@/core/app'

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
const escape = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

/** A local .ics reminder to come back for the Bitcoin confirmation (no external service). */
export function buildReminderIcs(opts: { at: Date; certId: string; fileName: string }): string {
  const end = new Date(opts.at.getTime() + 15 * 60_000)
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ProofMark//Promemoria//IT',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${opts.certId}@${APP_HOST}`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(opts.at)}`,
    `DTEND:${stamp(end)}`,
    'SUMMARY:ProofMark — conferma Bitcoin',
    `DESCRIPTION:${escape(
      `Apri ${VERIFY_URL}, carica l'archivio ${opts.fileName} e l'attestato ${opts.certId} e scarica l'attestato aggiornato con la conferma Bitcoin.`,
    )}`,
    `URL:${VERIFY_URL}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.join('\r\n') + '\r\n'
}
