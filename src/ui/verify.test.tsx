import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { confirmedCert, PENDING_HASH, PENDING_OTS, pendingCert } from '@/test/certFixtures'
import type { Check } from '@/core/verify/check'
import { downloadBytes } from './download'
import { VerifyPage, type VerifyPageDeps } from './pages/VerifyPage'

vi.mock('./download', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./download')>()),
  downloadBytes: vi.fn(),
}))

const HASH = PENDING_HASH
const PK = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1])
const zip = () => new File([PK], 'opera.zip')
const json = () => new File(['{}'], 'opera_ricevuta.json', { type: 'application/json' })
const OK: Check[] = [
  { id: 'hash', status: 'ok', label: "L'impronta dell'archivio corrisponde al certificato" },
  { id: 'ots-hash', status: 'ok', label: 'La prova Bitcoin si riferisce a questo archivio' },
]

function fakeDeps(over: Partial<VerifyPageDeps> = {}): VerifyPageDeps {
  return {
    hashFile: vi.fn(async () => HASH),
    loadEvidence: vi.fn(async () => ({ cert: pendingCert(), ots: PENDING_OTS })),
    verifyOffline: vi.fn(async () => OK),
    checkBitcoin: vi.fn(async () => ({
      check: { id: 'bitcoin', status: 'warn', label: 'Conferma non ancora disponibile, riprova tra qualche ora' } as Check,
    })),
    buildAttestato: vi.fn(async () => ({
      certificate: confirmedCert(),
      pdf: new Uint8Array([1]),
      json: '{}',
      ots: new Uint8Array([2]),
    })),
    ...over,
  }
}

const zipInput = () => screen.getByLabelText('Seleziona archivio .zip')
const evidenceInput = () => screen.getByLabelText('Seleziona ricevuta o attestato (PDF o JSON)')

afterEach(() => {
  window.history.replaceState(null, '', '/proofmark/it/')
  vi.mocked(downloadBytes).mockClear()
})

describe('VerifyPage', () => {
  test('shows the two labelled slots', () => {
    render(<VerifyPage deps={fakeDeps()} />)
    expect(screen.getByText('1. Archivio .zip')).toBeInTheDocument()
    expect(screen.getByText('2. Ricevuta o attestato (PDF o JSON)')).toBeInTheDocument()
  })

  test('enables Verifica only when both slots are filled', async () => {
    const user = userEvent.setup()
    render(<VerifyPage deps={fakeDeps()} />)
    const button = screen.getByRole('button', { name: 'Verifica' })
    expect(button).toBeDisabled()
    await user.upload(zipInput(), zip())
    expect(button).toBeDisabled()
    await user.upload(evidenceInput(), json())
    expect(button).toBeEnabled()
  })

  test('lists each result with a text status, not colour alone', async () => {
    const user = userEvent.setup()
    render(<VerifyPage deps={fakeDeps()} />)
    await user.upload(zipInput(), zip())
    await user.upload(evidenceInput(), json())
    await user.click(screen.getByRole('button', { name: 'Verifica' }))
    const list = await screen.findByRole('list', { name: 'Esito della verifica' })
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent("L'impronta dell'archivio corrisponde al certificato")
    expect(items[0]).toHaveTextContent('Superato')
  })

  test('with a QR fragment, compares the archive alone against the expected hash', async () => {
    window.history.replaceState(null, '', `/proofmark/it/verifica#sha256=${HASH}`)
    const user = userEvent.setup()
    const deps = fakeDeps()
    render(<VerifyPage deps={deps} />)
    expect(screen.getByText(HASH)).toBeInTheDocument()
    await user.upload(zipInput(), zip())
    await user.click(screen.getByRole('button', { name: 'Verifica' }))
    const list = await screen.findByRole('list', { name: 'Esito della verifica' })
    expect(list).toHaveTextContent("L'impronta corrisponde a quella del QR code")
    expect(deps.verifyOffline).not.toHaveBeenCalled()
  })

  test('offers the attestation only after a confirmed Bitcoin check', async () => {
    const user = userEvent.setup()
    const deps = fakeDeps()
    render(<VerifyPage deps={deps} />)
    await user.upload(zipInput(), zip())
    await user.upload(evidenceInput(), json())
    await user.click(screen.getByRole('button', { name: 'Verifica' }))
    await user.click(await screen.findByRole('button', { name: 'Controlla conferma Bitcoin (richiede connessione)' }))
    expect(await screen.findByText('Conferma non ancora disponibile, riprova tra qualche ora')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Genera attestato' })).toBeNull()

    vi.mocked(deps.checkBitcoin).mockResolvedValueOnce({
      check: { id: 'bitcoin', status: 'ok', label: 'Confermato nel blocco #123 del 17 ottobre 2026' },
      upgraded: { ots: new Uint8Array([2]), block: 123, blockTime: new Date() },
    })
    await user.click(screen.getByRole('button', { name: 'Controlla conferma Bitcoin (richiede connessione)' }))
    await user.click(await screen.findByRole('button', { name: 'Genera attestato' }))
    expect(deps.buildAttestato).toHaveBeenCalled()
  })

  test('offers each attestation file as its own download', async () => {
    const user = userEvent.setup()
    const deps = fakeDeps({
      checkBitcoin: vi.fn(async () => ({
        check: { id: 'bitcoin', status: 'ok', label: 'Confermato nel blocco #123' } as Check,
        upgraded: { ots: new Uint8Array([2]), block: 123, blockTime: new Date() },
      })),
    })
    render(<VerifyPage deps={deps} />)
    await user.upload(zipInput(), zip())
    await user.upload(evidenceInput(), json())
    await user.click(screen.getByRole('button', { name: 'Verifica' }))
    await user.click(await screen.findByRole('button', { name: 'Controlla conferma Bitcoin (richiede connessione)' }))
    await user.click(await screen.findByRole('button', { name: 'Genera attestato' }))
    expect(downloadBytes).not.toHaveBeenCalled()

    await user.click(await screen.findByRole('button', { name: 'Scarica attestato PDF' }))
    expect(downloadBytes).toHaveBeenCalledTimes(1)
    expect(vi.mocked(downloadBytes).mock.calls[0][1]).toMatch(/_attestato\.pdf$/)
    await user.click(screen.getByRole('button', { name: 'Scarica attestato JSON' }))
    expect(vi.mocked(downloadBytes).mock.calls[1][1]).toMatch(/_attestato\.json$/)
    await user.click(screen.getByRole('button', { name: 'Scarica prova Bitcoin (.ots)' }))
    expect(vi.mocked(downloadBytes).mock.calls[2][1]).toMatch(/\.ots$/)
    expect(downloadBytes).toHaveBeenCalledTimes(3)
    expect(deps.buildAttestato).toHaveBeenCalledTimes(1)
  })

  test.each([
    ['archive', () => zipInput(), () => new File([PK], 'altro.zip')],
    ['evidence', () => evidenceInput(), () => new File(['{}'], 'altro_ricevuta.json', { type: 'application/json' })],
  ])('choosing a new %s clears the previous result', async (_, getInput, file) => {
    const user = userEvent.setup()
    render(<VerifyPage deps={fakeDeps()} />)
    await user.upload(zipInput(), zip())
    await user.upload(evidenceInput(), json())
    await user.click(screen.getByRole('button', { name: 'Verifica' }))
    await user.click(await screen.findByRole('button', { name: 'Controlla conferma Bitcoin (richiede connessione)' }))
    await screen.findByText('Conferma non ancora disponibile, riprova tra qualche ora')

    await user.upload(getInput(), file())
    expect(screen.queryByRole('list', { name: 'Esito della verifica' })).toBeNull()
    expect(screen.queryByText('Conferma non ancora disponibile, riprova tra qualche ora')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Controlla conferma Bitcoin (richiede connessione)' })).toBeNull()
  })

  test('explains an unusable evidence file', async () => {
    const user = userEvent.setup({ applyAccept: false })
    render(<VerifyPage deps={fakeDeps()} />)
    await user.upload(evidenceInput(), new File(['x'], 'note.txt'))
    expect(await screen.findByText("Carica la ricevuta o l'attestato di ProofMark (PDF o JSON)")).toBeInTheDocument()
  })
})

test('never offers the attestation when an offline check failed', async () => {
  const user = userEvent.setup()
  const deps = fakeDeps({
    verifyOffline: vi.fn(async () => [{ id: 'hash', status: 'fail', label: 'diverso' }] as Check[]),
    checkBitcoin: vi.fn(async () => ({
      check: { id: 'bitcoin', status: 'ok', label: 'Confermato nel blocco #1' } as Check,
      upgraded: { ots: new Uint8Array([2]), block: 1, blockTime: new Date() },
    })),
  })
  render(<VerifyPage deps={deps} />)
  await user.upload(zipInput(), zip())
  await user.upload(evidenceInput(), json())
  await user.click(screen.getByRole('button', { name: 'Verifica' }))
  await user.click(await screen.findByRole('button', { name: 'Controlla conferma Bitcoin (richiede connessione)' }))
  await screen.findByText('Confermato nel blocco #1')
  expect(screen.queryByRole('button', { name: 'Genera attestato' })).toBeNull()
})
