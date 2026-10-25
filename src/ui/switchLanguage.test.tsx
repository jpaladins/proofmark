// What survives a language switch: Verify starts over in the new language; a receipt, an in-flight
// certification and a failed one stay, with every text in the new language.
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { PDFDocument } from 'pdf-lib'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import App from '@/App'
import type { CertifyDeps } from '@/flow/certify'
import { messages, type Lang } from '@/i18n'
import type { Check } from '@/core/verify/check'
import { PENDING_HASH, PENDING_OTS, pendingCert } from '@/test/certFixtures'
import type { VerifyPageDeps } from './pages/VerifyPage'
import { resetLangMemory } from './useLangChoice'

const PK = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3])
const zip = () => new File([PK], 'work.zip')

beforeEach(() => {
  resetLangMemory()
  localStorage.clear()
})
afterEach(() => {
  localStorage.clear()
  window.history.replaceState(null, '', '/proofmark/')
})

const switchToItalian = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(within(screen.getByRole('contentinfo')).getByRole('link', { name: 'Italiano' }))

function certifyDeps(over: Partial<CertifyDeps> = {}): CertifyDeps {
  const doc = { save: vi.fn(async () => new Uint8Array([1])) } as unknown as PDFDocument
  return {
    hashFile: vi.fn(async () => PENDING_HASH),
    stampHash: vi.fn(async () => PENDING_OTS),
    renderAttestato: vi.fn(async () => doc),
    ...over,
  }
}

async function startCertifying(user: ReturnType<typeof userEvent.setup>) {
  await user.upload(screen.getByLabelText('Select .zip archive'), zip())
  await user.click(await screen.findByRole('button', { name: 'Certify archive' }))
}

describe('switching language on Verify', () => {
  test('starts the page over in the new language', async () => {
    window.history.replaceState(null, '', '/proofmark/verify')
    const deps: VerifyPageDeps = {
      hashFile: vi.fn(async () => PENDING_HASH),
      loadEvidence: vi.fn(async () => ({ cert: pendingCert(undefined, { lang: 'en' }), ots: PENDING_OTS })),
      verifyOffline: vi.fn(async (_h: string, _ev: unknown, lang: Lang) => [
        { id: 'hash', status: 'ok', label: messages(lang).flow.checks.hashOk } as Check,
      ]),
      checkBitcoin: vi.fn(async () => ({ check: { id: 'bitcoin', status: 'warn', label: 'pending' } as Check })),
      buildAttestato: vi.fn(),
    }
    const user = userEvent.setup()
    render(<App verifyDeps={deps} />)
    await user.upload(screen.getByLabelText('Select .zip archive'), zip())
    await user.upload(
      screen.getByLabelText('Select receipt or attestation (PDF or JSON)'),
      new File(['{}'], 'work_receipt.json', { type: 'application/json' }),
    )
    await user.click(screen.getByRole('button', { name: 'Verify' }))
    expect(await screen.findByRole('list', { name: 'Verification result' })).toBeInTheDocument()

    await switchToItalian(user)
    expect(window.location.pathname).toBe('/proofmark/it/verifica')
    expect(screen.queryByRole('list', { name: 'Verification result' })).toBeNull()
    expect(screen.queryByRole('list', { name: 'Esito della verifica' })).toBeNull()
    expect(screen.queryByText(messages('en').flow.checks.hashOk)).toBeNull()
    expect(screen.queryByText('work.zip')).toBeNull()
    expect(screen.getByRole('button', { name: 'Verifica' })).toBeDisabled()
    expect(screen.getByLabelText('Seleziona archivio .zip')).toBeInTheDocument()
  })
})

describe('switching language on Certify', () => {
  test('keeps a finished receipt', async () => {
    const user = userEvent.setup()
    render(<App certifyDeps={certifyDeps()} />)
    await startCertifying(user)
    expect(await screen.findByRole('region', { name: 'Receipt generated' })).toBeInTheDocument()

    await switchToItalian(user)
    expect(window.location.pathname).toBe('/proofmark/it/')
    expect(screen.getByRole('region', { name: 'Ricevuta generata' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Scarica ricevuta PDF' })).toBeInTheDocument()
  })

  test('keeps an anchoring in flight and shows its steps in the new language', async () => {
    let finish!: (doc: PDFDocument) => void
    const deps = certifyDeps({ renderAttestato: vi.fn(() => new Promise<PDFDocument>((r) => (finish = r))) })
    const user = userEvent.setup()
    render(<App certifyDeps={deps} />)
    await startCertifying(user)
    const steps = await screen.findByRole('list', { name: 'Certification progress' })
    await waitFor(() => expect(within(steps).getByText(messages('en').flow.calendars(1))).toBeInTheDocument())

    await switchToItalian(user)
    const itSteps = screen.getByRole('list', { name: messages('it').stepper.label })
    expect(within(itSteps).getByText(messages('it').flow.calendars(1))).toBeInTheDocument()
    expect(within(itSteps).queryByText(messages('en').flow.calendars(1))).toBeNull()
    for (const step of Object.values(messages('it').stepper.steps)) expect(itSteps).toHaveTextContent(step)

    finish({ save: async () => new Uint8Array([1]) } as unknown as PDFDocument)
    expect(await screen.findByRole('region', { name: 'Ricevuta generata' })).toBeInTheDocument()
    expect(deps.hashFile).toHaveBeenCalledTimes(1)
  })

  test('shows a failure in the new language and retries in it', async () => {
    const deps = certifyDeps()
    vi.mocked(deps.stampHash).mockRejectedValueOnce(new Error('offline'))
    const user = userEvent.setup()
    render(<App certifyDeps={deps} />)
    await startCertifying(user)
    expect(await screen.findAllByText(messages('en').errors.ots)).not.toHaveLength(0)

    await switchToItalian(user)
    expect(screen.queryAllByText(messages('en').errors.ots)).toHaveLength(0)
    expect(screen.getAllByText(messages('it').errors.ots)).not.toHaveLength(0)
    expect(screen.getByText(messages('it').certify.stopped)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Riprova' }))
    expect(await screen.findByRole('region', { name: 'Ricevuta generata' })).toBeInTheDocument()
    expect(vi.mocked(deps.renderAttestato).mock.calls[0][0].lang).toBe('it')
    expect(deps.hashFile).toHaveBeenCalledTimes(1)
  })
})
