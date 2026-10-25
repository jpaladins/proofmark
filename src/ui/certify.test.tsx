import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { PDFDocument } from 'pdf-lib'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { PENDING_HASH, PENDING_OTS } from '@/test/certFixtures'
import type { CertifyDeps } from '@/flow/certify'
import { CertifyPage } from './pages/CertifyPage'
import { Stepper } from './components/Stepper'
import { buildReminderIcs } from './ics'

// Italian pages: the copy asserted below is the Italian one.
beforeEach(() => window.history.replaceState(null, '', '/proofmark/it/'))
afterEach(() => window.history.replaceState(null, '', '/proofmark/it/'))

const HASH = PENDING_HASH
const PK = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3])

function fakeDeps(): CertifyDeps {
  const doc = { save: vi.fn(async () => new Uint8Array([1])) } as unknown as PDFDocument
  return {
    hashFile: vi.fn(async () => HASH),
    stampHash: vi.fn(async () => PENDING_OTS),
    renderAttestato: vi.fn(async () => doc),
  }
}

const input = () => screen.getByLabelText('Seleziona archivio .zip') as HTMLInputElement

/** Chooses a file and presses the confirmation button: nothing starts on upload alone. */
async function chooseAndConfirm(user: ReturnType<typeof userEvent.setup>, file: File) {
  await user.upload(input(), file)
  await user.click(await screen.findByRole('button', { name: 'Certifica archivio' }))
}

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
    await chooseAndConfirm(user, new File([PK], 'opera.zip'))
    const result = await screen.findByRole('region', { name: 'Ricevuta generata' })
    const cert = vi.mocked(deps.renderAttestato).mock.calls[0][0]
    expect(cert.declared?.author).toBe('Ada Lovelace')
    expect(within(result).getAllByText(HASH.slice(0, 8)).length).toBeGreaterThan(0)
    for (const name of [
      'Scarica ricevuta PDF',
      'Scarica ricevuta JSON',
      'Scarica prova Bitcoin (.ots)',
    ]) {
      expect(within(result).getByRole('button', { name })).toBeInTheDocument()
    }
    expect(within(result).getByText("Conserva l'archivio esattamente com'è.")).toBeInTheDocument()
    expect(within(result).getByText(/alle ore \d{2}:\d{2}:\d{2} UTC([+-]\d{1,2}(:\d{2})?)?$/)).toBeInTheDocument()
  })

  test('copies the hash to the clipboard', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    render(<CertifyPage deps={fakeDeps()} />)
    await chooseAndConfirm(user, new File([PK], 'opera.zip'))
    await user.click(await screen.findByRole('button', { name: "Copia l'impronta" }))
    expect(writeText).toHaveBeenCalledWith(HASH)
  })

  test('shows the Bitcoin reminder with an approximate time while the proof is pending', async () => {
    const user = userEvent.setup()
    const deps = fakeDeps()
    render(<CertifyPage deps={deps} />)
    await chooseAndConfirm(user, new File([PK], 'opera.zip'))
    await screen.findByRole('region', { name: 'Ricevuta generata' })
    const requested = vi.mocked(deps.renderAttestato).mock.calls[0][0].requestedAt
    const at = new Date(new Date(requested).getTime() + 3 * 3600_000)
    const hhmm = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' }).format(at)
    const banner = await screen.findByRole('status', { name: 'Conferma Bitcoin in arrivo' })
    expect(banner).toHaveTextContent('Tra qualche ora torna su jpaladins.github.io/proofmark/it/verifica')
    expect(banner).toHaveTextContent(`dopo le ${hhmm} circa`)
    expect(within(banner).getByRole('button', { name: 'Aggiungi promemoria al calendario' })).toBeInTheDocument()
  })

  test('offers a retry when the Bitcoin calendars cannot be reached', async () => {
    const deps = fakeDeps()
    vi.mocked(deps.stampHash).mockRejectedValueOnce(new Error('offline'))
    const user = userEvent.setup()
    render(<CertifyPage deps={deps} />)
    await chooseAndConfirm(user, new File([PK], 'opera.zip'))
    await user.click(await screen.findByRole('button', { name: 'Riprova' }))
    await waitFor(() => expect(screen.getByRole('region', { name: 'Ricevuta generata' })).toBeInTheDocument())
    expect(deps.hashFile).toHaveBeenCalledTimes(1)
  })
})

test('the receipt opens at the top of the page with its heading focused', async () => {
  const scrollTo = vi.fn()
  vi.stubGlobal('scrollTo', scrollTo)
  const user = userEvent.setup()
  render(<CertifyPage deps={fakeDeps()} />)
  await chooseAndConfirm(user, new File([PK], 'opera.zip'))
  const heading = await screen.findByRole('heading', { name: 'Registrazione inviata alla blockchain' })
  expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }))
  expect(heading).toHaveFocus()
  vi.unstubAllGlobals()
})

describe('confirmation before certifying', () => {
  test('choosing a zip shows a summary and waits for confirmation', async () => {
    const deps = fakeDeps()
    const user = userEvent.setup()
    render(<CertifyPage deps={deps} />)
    await user.upload(input(), new File([PK], 'opera.zip'))
    const summary = await screen.findByRole('region', { name: 'Archivio selezionato' })
    expect(summary).toHaveTextContent('opera.zip')
    expect(summary).toHaveTextContent('7 byte')
    expect(within(summary).getByRole('button', { name: 'Certifica archivio' })).toBeEnabled()
    expect(deps.hashFile).not.toHaveBeenCalled()
    expect(deps.stampHash).not.toHaveBeenCalled()
  })

  test('uses the declared data as they are when the user confirms', async () => {
    const deps = fakeDeps()
    const user = userEvent.setup()
    render(<CertifyPage deps={deps} />)
    await user.upload(input(), new File([PK], 'opera.zip'))
    await user.type(screen.getByLabelText(/Titolo dell'opera/), 'Il mio romanzo')
    await user.click(screen.getByRole('button', { name: 'Certifica archivio' }))
    await screen.findByRole('region', { name: 'Ricevuta generata' })
    expect(deps.hashFile).toHaveBeenCalledTimes(1)
    expect(vi.mocked(deps.renderAttestato).mock.calls[0][0].declared?.title).toBe('Il mio romanzo')
  })

  test('lets the user change the archive before confirming', async () => {
    const deps = fakeDeps()
    const user = userEvent.setup()
    render(<CertifyPage deps={deps} />)
    await user.upload(input(), new File([PK], 'opera.zip'))
    await user.click(await screen.findByRole('button', { name: 'Cambia archivio' }))
    expect(screen.queryByRole('region', { name: 'Archivio selezionato' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Certifica archivio' })).toBeNull()
    expect(input()).toBeInTheDocument()
    expect(deps.hashFile).not.toHaveBeenCalled()
  })
})

describe('Stepper', () => {
  test('lists the three phases and marks the active one', () => {
    render(
      <Stepper
        steps={{
          hash: { status: 'done' },
          ots: { status: 'active' },
          cert: { status: 'idle' },
        }}
      />,
    )
    const items = screen.getAllByRole('listitem')
    expect(items.map((li) => li.querySelector('[data-label]')?.textContent)).toEqual([
      'Calcolo Hash',
      'Ancoraggio Bitcoin',
      'Ricevuta Generata',
    ])
    expect(items[1]).toHaveAttribute('aria-current', 'step')
    expect(items[0]).not.toHaveAttribute('aria-current')
  })
})

test('buildReminderIcs creates a calendar event pointing to the verify page', () => {
  const ics = buildReminderIcs({ at: new Date('2026-10-17T19:20:58Z'), certId: 'PM-ABC-20261017', fileName: 'opera, v2.zip', lang: 'it' })
  expect(ics).toContain('BEGIN:VCALENDAR\r\n')
  expect(ics).toContain('DTSTART:20261017T192058Z')
  expect(ics).toContain('SUMMARY:ProofMark — conferma Bitcoin')
  expect(ics).toContain('URL:https://jpaladins.github.io/proofmark/it/verifica')
  expect(ics.replace(/\r\n /g, '')).toContain('opera\\, v2.zip')
  expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true)
})

test('buildReminderIcs speaks English and points to the English verify page', () => {
  const ics = buildReminderIcs({ at: new Date('2026-10-17T19:20:58Z'), certId: 'PM-ABC-20261017', fileName: 'work.zip', lang: 'en' })
  expect(ics).toContain('SUMMARY:ProofMark — Bitcoin confirmation')
  expect(ics).toContain('URL:https://jpaladins.github.io/proofmark/verify\r\n')
  expect(ics).toContain('PRODID:-//ProofMark//Reminder//EN')
  expect(ics.replace(/\r\n /g, '')).toContain('upload the archive work.zip')
})

test('buildReminderIcs folds lines at 75 octets without splitting UTF-8 characters', () => {
  const fileName = `${'è'.repeat(60)}-${'a'.repeat(200)}.zip`
  const ics = buildReminderIcs({ at: new Date('2026-10-17T19:20:58Z'), certId: 'PM-ABC-20261017', fileName, lang: 'it' })
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
