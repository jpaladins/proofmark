import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { PDFDocument } from 'pdf-lib'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import App from '@/App'
import type { CertifyDeps } from '@/flow/certify'
import { buildAttestato, checkBitcoin, verifyOffline } from '@/flow/verify'
import { BLOCK_358391, CONFIRMED_OTS, PENDING_HASH, PENDING_OTS, pendingCert } from '@/test/certFixtures'
import { downloadBytes } from './download'
import { formatEta } from './formatEta'
import { LangProvider } from './LangContext'
import { CertifyPage } from './pages/CertifyPage'
import { PrivacyPage } from './pages/PrivacyPage'
import { VerifyPage, type VerifyPageDeps } from './pages/VerifyPage'

vi.mock('./download', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./download')>()),
  downloadBytes: vi.fn(),
}))

const PK = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3])
const savedNames = () => vi.mocked(downloadBytes).mock.calls.map((c) => c[1])

beforeEach(() => window.history.replaceState(null, '', '/proofmark/'))
afterEach(() => {
  window.history.replaceState(null, '', '/proofmark/')
  vi.mocked(downloadBytes).mockClear()
})

describe('English layout', () => {
  test('header shows the zero-knowledge badge and English navigation', () => {
    render(<App />)
    expect(screen.getByText('Zero-Knowledge: files are processed only in your browser')).toBeInTheDocument()
    const nav = screen.getByRole('navigation', { name: 'Sections' })
    expect(within(nav).getByRole('link', { name: 'Certify' })).toHaveAttribute('href', '/proofmark/')
    expect(within(nav).getByRole('link', { name: 'Verify' })).toHaveAttribute('href', '/proofmark/verify')
    expect(screen.getByRole('button', { name: /theme/i })).toBeInTheDocument()
  })

  test('the skip link targets the main content', () => {
    render(<App />)
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#content')
    expect(screen.getByRole('main')).toHaveAttribute('id', 'content')
  })

  test('footer links Privacy & security and the source code', async () => {
    const user = userEvent.setup()
    render(<App />)
    const footer = screen.getByRole('contentinfo')
    expect(footer).toHaveTextContent('AGPL-3.0 licence')
    expect(within(footer).getByRole('link', { name: 'Source code' })).toBeInTheDocument()
    const privacy = within(footer).getByRole('link', { name: 'Privacy & security' })
    expect(privacy).toHaveAttribute('href', '/proofmark/privacy')
    await user.click(privacy)
    expect(window.location.pathname).toBe('/proofmark/privacy')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Privacy & security')
  })

  test('formatEta speaks English', () => {
    expect(formatEta(0.4, 'en')).toBe('almost done')
    expect(formatEta(12.2, 'en')).toBe('about 13 s left')
    expect(formatEta(61, 'en')).toBe('about 1 min left')
  })
})

describe('English certify flow', () => {
  function fakeDeps(): CertifyDeps {
    const doc = { save: vi.fn(async () => new Uint8Array([1])) } as unknown as PDFDocument
    return {
      hashFile: vi.fn(async () => PENDING_HASH),
      stampHash: vi.fn(async () => PENDING_OTS),
      renderAttestato: vi.fn(async () => doc),
    }
  }

  test('certifies and downloads the receipt under English names', async () => {
    const deps = fakeDeps()
    const user = userEvent.setup()
    render(
      <LangProvider>
        <CertifyPage deps={deps} />
      </LangProvider>,
    )
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/existed/i)
    await user.upload(screen.getByLabelText('Select .zip archive'), new File([PK], 'opera.zip'))
    const summary = await screen.findByRole('region', { name: 'Selected archive' })
    expect(summary).toHaveTextContent('7 bytes')
    await user.click(within(summary).getByRole('button', { name: 'Certify archive' }))

    const result = await screen.findByRole('region', { name: 'Receipt generated' })
    expect(vi.mocked(deps.renderAttestato).mock.calls[0][0].lang).toBe('en')
    expect(within(result).getByRole('status', { name: 'Bitcoin confirmation on its way' })).toHaveTextContent(
      'come back to jpaladins.github.io/proofmark/verify',
    )
    await user.click(within(result).getByRole('button', { name: 'Download PDF receipt' }))
    await user.click(within(result).getByRole('button', { name: 'Download JSON receipt' }))
    await user.click(within(result).getByRole('button', { name: 'Download Bitcoin proof (.ots)' }))
    await user.click(within(result).getByRole('button', { name: 'Add reminder to calendar' }))
    const [pdf, json, ots, ics] = savedNames()
    expect([pdf, json, ots]).toEqual(['opera_receipt.pdf', 'opera_receipt.json', 'opera.ots'])
    expect(ics).toMatch(/-reminder\.ics$/)
  })
})

describe('English verify flow', () => {
  test('shows English check labels and downloads the English attestation', async () => {
    const receipt = pendingCert(undefined, { lang: 'en' })
    receipt.file.name = 'opera.zip'
    const doc = { save: vi.fn(async () => new Uint8Array([1])) } as unknown as PDFDocument
    const deps: VerifyPageDeps = {
      hashFile: vi.fn(async () => PENDING_HASH),
      loadEvidence: vi.fn(async () => ({ cert: receipt, ots: PENDING_OTS })),
      verifyOffline,
      checkBitcoin: (ev, lang) =>
        checkBitcoin(ev, lang, {
          upgradeOts: async () => ({ ots: CONFIRMED_OTS, changed: true }),
          verifyOtsOnline: async () => BLOCK_358391,
        }),
      buildAttestato: (ev, upgraded) => buildAttestato(ev, upgraded, { renderAttestato: async () => doc }),
    }
    window.history.replaceState(null, '', '/proofmark/verify')
    const user = userEvent.setup()
    render(
      <LangProvider>
        <VerifyPage deps={deps} />
      </LangProvider>,
    )
    await user.upload(screen.getByLabelText('Select .zip archive'), new File([PK], 'opera.zip'))
    await user.upload(
      screen.getByLabelText('Select receipt or attestation (PDF or JSON)'),
      new File(['{}'], 'opera_receipt.json', { type: 'application/json' }),
    )
    await user.click(screen.getByRole('button', { name: 'Verify' }))
    const list = await screen.findByRole('list', { name: 'Verification result' })
    expect(list).toHaveTextContent("The archive's fingerprint matches the certificate")
    expect(list).toHaveTextContent('The Bitcoin proof refers to this archive')
    expect(list).toHaveTextContent('Passed')

    await user.click(screen.getByRole('button', { name: 'Check Bitcoin confirmation (needs a connection)' }))
    expect(await screen.findByText(/Confirmed in block #358391 on/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Generate attestation' }))
    await user.click(await screen.findByRole('button', { name: 'Download PDF attestation' }))
    expect(savedNames()).toEqual(['opera_attestation.pdf'])
  })
})

test('the Privacy page is in English at /proofmark/privacy', () => {
  window.history.replaceState(null, '', '/proofmark/privacy')
  render(
    <LangProvider>
      <PrivacyPage />
    </LangProvider>,
  )
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Privacy & security')
  expect(screen.getAllByText(/never leaves your device/).length).toBeGreaterThan(0)
})
