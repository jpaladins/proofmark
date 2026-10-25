import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { PDFDocument } from 'pdf-lib'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { HashProgress as Progress } from '@/core/hash/hashFile'
import type { CertifyDeps } from '@/flow/certify'
import { PENDING_HASH, PENDING_OTS, pendingCert } from '@/test/certFixtures'
import { HashProgress } from './components/HashProgress'
import { formatEta } from './formatEta'
import { CertifyPage } from './pages/CertifyPage'
import { VerifyPage, type VerifyPageDeps } from './pages/VerifyPage'

// Italian pages: the copy asserted below is the Italian one.
beforeEach(() => window.history.replaceState(null, '', '/proofmark/it/'))
afterEach(() => window.history.replaceState(null, '', '/proofmark/it/'))

const MB = 1024 * 1024
const PK = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1])

/** A hash that reports half the file read, then waits until the test lets it finish. */
function slowHash() {
  let finish!: (hex: string) => void
  const hashFile = vi.fn(
    (_file: File, onProgress: (p: Progress) => void) =>
      new Promise<string>((resolve) => {
        onProgress({ bytesDone: 50 * MB, total: 100 * MB, mbPerSec: 25, etaSec: 2 })
        finish = resolve
      }),
  )
  return { hashFile, finish: (hex: string) => finish(hex) }
}

describe('HashProgress', () => {
  test('shows percentage, bytes read, speed and time left', () => {
    render(<HashProgress progress={{ bytesDone: 48.7 * MB, total: 97.4 * MB, mbPerSec: 85, etaSec: 130 }} />)
    const bar = screen.getByRole('progressbar', { name: "Calcolo dell'impronta SHA-256" })
    expect(bar).toHaveAttribute('aria-valuenow', '50')
    expect(screen.getByText('50%')).toBeInTheDocument()
    expect(screen.getByText(/48,7 MB di 97,4 MB/)).toBeInTheDocument()
    expect(screen.getByText(/85 MB\/s/)).toBeInTheDocument()
    expect(screen.getByText(/circa 2 min rimanenti/)).toBeInTheDocument()
  })

  test('reassures that the page is working, not frozen', () => {
    render(<HashProgress progress={{ bytesDone: 1, total: 10, mbPerSec: 1, etaSec: 9 }} />)
    expect(screen.getByText(/La pagina non è bloccata/)).toBeInTheDocument()
  })

  test('animates without a value before the first progress report', () => {
    render(<HashProgress />)
    const bar = screen.getByRole('progressbar', { name: "Calcolo dell'impronta SHA-256" })
    expect(bar).not.toHaveAttribute('aria-valuenow')
    expect(screen.getByText('Avvio del calcolo…')).toBeInTheDocument()
  })
})

test.each([
  [0.4, 'quasi finito'],
  [12.2, 'circa 13 s rimanenti'],
  [59, 'circa 59 s rimanenti'],
  [61, 'circa 1 min rimanenti'],
  [3 * 3600, 'circa 180 min rimanenti'],
])('formatEta(%s) → %s', (sec, text) => {
  expect(formatEta(sec, 'it')).toBe(text)
})

test('the Certify page shows the progress panel while a large file is hashed', async () => {
  const slow = slowHash()
  const doc = { save: vi.fn(async () => new Uint8Array([1])) } as unknown as PDFDocument
  const deps: CertifyDeps = { hashFile: slow.hashFile, stampHash: vi.fn(async () => PENDING_OTS), renderAttestato: vi.fn(async () => doc) }
  const user = userEvent.setup()
  render(<CertifyPage deps={deps} />)
  await user.upload(screen.getByLabelText('Seleziona archivio .zip'), new File([PK], 'grande.zip'))
  await user.click(await screen.findByRole('button', { name: 'Certifica archivio' }))
  const bar = await screen.findByRole('progressbar', { name: "Calcolo dell'impronta SHA-256" })
  expect(bar).toHaveAttribute('aria-valuenow', '50')
  slow.finish(PENDING_HASH)
  await screen.findByRole('region', { name: 'Ricevuta generata' })
})

test('the Verify page shows the progress panel while the archive is hashed', async () => {
  const slow = slowHash()
  const deps: VerifyPageDeps = {
    hashFile: slow.hashFile,
    loadEvidence: vi.fn(async () => ({ cert: pendingCert(), ots: PENDING_OTS })),
    verifyOffline: vi.fn(async () => [{ id: 'hash', status: 'ok', label: 'ok' }] as const),
    checkBitcoin: vi.fn(),
    buildAttestato: vi.fn(),
  } as unknown as VerifyPageDeps
  const user = userEvent.setup()
  render(<VerifyPage deps={deps} />)
  await user.upload(screen.getByLabelText('Seleziona archivio .zip'), new File([PK], 'grande.zip'))
  await user.upload(screen.getByLabelText('Seleziona ricevuta o attestato (PDF o JSON)'), new File(['{}'], 'r.json'))
  await user.click(screen.getByRole('button', { name: 'Verifica' }))
  const panel = await screen.findByRole('progressbar', { name: "Calcolo dell'impronta SHA-256" })
  expect(panel).toHaveAttribute('aria-valuenow', '50')
  expect(within(document.body).getByText(/50 MB di 100 MB/)).toBeInTheDocument()
  slow.finish(PENDING_HASH)
  await screen.findByRole('list', { name: 'Esito della verifica' })
})
