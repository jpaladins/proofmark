import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { PDFDocument } from 'pdf-lib'
import { describe, expect, test, vi } from 'vitest'
import { fixture, fixtureText } from '@/test/fixtures'
import { TSA } from '@/test/certFixtures'
import type { CertifyDeps } from '@/flow/certify'
import { CertifyPage } from './pages/CertifyPage'
import { Stepper } from './components/Stepper'
import { buildReminderIcs } from './ics'

const HASH = fixtureText('data.sha256')
const PK = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3])

function fakeDeps(): CertifyDeps {
  const doc = { save: vi.fn(async () => new Uint8Array([1])) } as unknown as PDFDocument
  return {
    hashFile: vi.fn(async () => HASH),
    requestTimestamp: vi.fn(async () => TSA),
    stampHash: vi.fn(async () => fixture('incomplete.txt.ots')),
    renderAttestato: vi.fn(async () => doc),
    sealPdf: vi.fn(async () => new Uint8Array([2])),
  }
}

const input = () => screen.getByLabelText('Seleziona archivio .zip') as HTMLInputElement

describe('CertifyPage', () => {
  test('rejects a JPEG renamed to .zip without starting', async () => {
    const deps = fakeDeps()
    const user = userEvent.setup({ applyAccept: false })
    render(<CertifyPage deps={deps} />)
    await user.upload(input(), new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], 'foto.zip'))
    expect(await screen.findByText('Il file non è un archivio ZIP valido')).toBeInTheDocument()
    expect(deps.hashFile).not.toHaveBeenCalled()
  })

  test('asks for a .zip when another file type is chosen', async () => {
    const user = userEvent.setup({ applyAccept: false })
    render(<CertifyPage deps={fakeDeps()} />)
    await user.upload(input(), new File(['x'], 'foto.png'))
    expect(await screen.findByText('Carica un file .zip')).toBeInTheDocument()
  })

  test('limits declared fields to 120 characters with a counter', () => {
    render(<CertifyPage deps={fakeDeps()} />)
    const author = screen.getByLabelText(/Autore/)
    expect(author).toHaveAttribute('maxLength', '120')
    expect(screen.getAllByText('0/120')).toHaveLength(2)
  })

  test('certifies a valid zip with trimmed declared data and shows the result', async () => {
    const deps = fakeDeps()
    const user = userEvent.setup()
    render(<CertifyPage deps={deps} />)
    await user.type(screen.getByLabelText(/Autore/), '  Ada Lovelace  ')
    await user.upload(input(), new File([PK], 'opera.zip'))
    const result = await screen.findByRole('region', { name: 'Certificato generato' })
    const cert = vi.mocked(deps.renderAttestato).mock.calls[0][0]
    expect(cert.declared?.author).toBe('Ada Lovelace')
    expect(within(result).getAllByText(HASH.slice(0, 8)).length).toBeGreaterThan(0)
    for (const name of [
      'Scarica attestato PDF',
      'Scarica certificato JSON',
      'Scarica prova DigiCert (.tsr)',
      'Scarica prova Bitcoin (.ots)',
    ]) {
      expect(within(result).getByRole('button', { name })).toBeInTheDocument()
    }
    expect(within(result).getByText("Conserva l'archivio esattamente com'è.")).toBeInTheDocument()
  })

  test('copies the hash to the clipboard', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    render(<CertifyPage deps={fakeDeps()} />)
    await user.upload(input(), new File([PK], 'opera.zip'))
    await user.click(await screen.findByRole('button', { name: "Copia l'impronta" }))
    expect(writeText).toHaveBeenCalledWith(HASH)
  })

  test('shows the Bitcoin reminder with an approximate time while the proof is pending', async () => {
    const user = userEvent.setup()
    render(<CertifyPage deps={fakeDeps()} />)
    await user.upload(input(), new File([PK], 'opera.zip'))
    const at = new Date(TSA.info.genTime.getTime() + 3 * 3600_000)
    const hhmm = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' }).format(at)
    const banner = await screen.findByRole('status', { name: 'Conferma Bitcoin in arrivo' })
    expect(banner).toHaveTextContent('Tra qualche ora torna su proofmark.jpaladins.ovh/verifica')
    expect(banner).toHaveTextContent(`dopo le ${hhmm} circa`)
    expect(within(banner).getByRole('button', { name: 'Aggiungi promemoria al calendario' })).toBeInTheDocument()
  })

  test('offers a retry when DigiCert fails', async () => {
    const deps = fakeDeps()
    vi.mocked(deps.requestTimestamp).mockRejectedValueOnce(new Error('offline'))
    const user = userEvent.setup()
    render(<CertifyPage deps={deps} />)
    await user.upload(input(), new File([PK], 'opera.zip'))
    await user.click(await screen.findByRole('button', { name: 'Riprova' }))
    await waitFor(() => expect(screen.getByRole('region', { name: 'Certificato generato' })).toBeInTheDocument())
    expect(deps.hashFile).toHaveBeenCalledTimes(1)
  })
})

describe('Stepper', () => {
  test('lists the four phases and marks the active one', () => {
    render(
      <Stepper
        steps={{
          hash: { status: 'done' },
          tsa: { status: 'active' },
          ots: { status: 'idle' },
          cert: { status: 'idle' },
        }}
      />,
    )
    const items = screen.getAllByRole('listitem')
    expect(items.map((li) => li.querySelector('[data-label]')?.textContent)).toEqual([
      'Calcolo Hash',
      'Marca DigiCert',
      'Ancoraggio Bitcoin',
      'Certificato Generato',
    ])
    expect(items[1]).toHaveAttribute('aria-current', 'step')
    expect(items[0]).not.toHaveAttribute('aria-current')
  })
})

test('buildReminderIcs creates a calendar event pointing to the verify page', () => {
  const ics = buildReminderIcs({ at: new Date('2026-10-17T19:20:58Z'), certId: 'PM-ABC-20261017', fileName: 'opera, v2.zip' })
  expect(ics).toContain('BEGIN:VCALENDAR\r\n')
  expect(ics).toContain('DTSTART:20261017T192058Z')
  expect(ics).toContain('SUMMARY:ProofMark — conferma Bitcoin')
  expect(ics).toContain('URL:https://proofmark.jpaladins.ovh/verifica')
  expect(ics.replace(/\r\n /g, '')).toContain('opera\\, v2.zip')
  expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true)
})

test('buildReminderIcs folds lines at 75 octets without splitting UTF-8 characters', () => {
  const fileName = `${'è'.repeat(60)}-${'a'.repeat(200)}.zip`
  const ics = buildReminderIcs({ at: new Date('2026-10-17T19:20:58Z'), certId: 'PM-ABC-20261017', fileName })
  const strict = new TextDecoder('utf-8', { fatal: true })
  const lines = ics.split('\r\n').slice(0, -1)
  for (const line of lines) {
    const octets = new TextEncoder().encode(line)
    expect(octets.length).toBeLessThanOrEqual(75)
    expect(() => strict.decode(octets)).not.toThrow()
  }
  expect(lines.some((l) => l.startsWith(' '))).toBe(true)
  expect(ics.replace(/\r\n /g, '')).toContain(`archivio ${fileName} e`)
})
