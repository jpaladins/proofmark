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
  return lines.map(fold).join('\r\n') + '\r\n'
}

/** RFC 5545 §3.1: lines longer than 75 octets continue on lines starting with a space. */
function fold(line: string): string {
  const enc = new TextEncoder()
  const out: string[] = []
  let current = ''
  let octets = 0
  for (const ch of line) {
    const n = enc.encode(ch).length
    // Continuation lines spend one octet on the leading space.
    if (octets + n > (out.length === 0 ? 75 : 74)) {
      out.push(current)
      current = ''
      octets = 0
    }
    current += ch
    octets += n
  }
  out.push(current)
  return out.join('\r\n ')
}
