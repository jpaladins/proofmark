import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test } from 'vitest'
import App from '@/App'
import { CSP } from '@/csp'
import { PAGES } from '@/pages'
import { PrivacyPage } from './pages/PrivacyPage'

afterEach(() => window.history.replaceState(null, '', '/'))

/** External hosts the CSP lets the site talk to, reduced to their registrable domain. */
function cspDomains(): string[] {
  const connect = CSP.split(';').map((d) => d.trim()).find((d) => d.startsWith('connect-src '))!
  return connect
    .split(' ')
    .slice(1)
    .filter((s) => s.startsWith('https://'))
    .map((s) => new URL(s.replace('*.', 'x.')).hostname.split('.').slice(-2).join('.'))
}

describe('Privacy e sicurezza', () => {
  test('is linked from the footer and has its own address', async () => {
    const user = userEvent.setup()
    render(<App />)
    const footer = screen.getByRole('contentinfo')
    await user.click(within(footer).getByRole('link', { name: 'Privacy e sicurezza' }))
    expect(window.location.pathname).toBe('/proofmark/privacy')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Privacy e sicurezza')
  })

  test('opens directly from its URL', () => {
    window.history.replaceState(null, '', '/proofmark/privacy')
    render(<App />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Privacy e sicurezza')
  })

  test('is published as its own static page', () => {
    expect(PAGES).toContain('/privacy')
  })

  test('discloses every external service the site is allowed to contact', () => {
    const { container } = render(<PrivacyPage />)
    const text = container.textContent ?? ''
    const domains = cspDomains()
    expect(domains.sort()).toEqual(['blockstream.info', 'eternitywall.com', 'opentimestamps.org'])
    for (const domain of domains) expect(text).toContain(domain)
  })

  test('states plainly that the archive never leaves the device', () => {
    render(<PrivacyPage />)
    expect(screen.getAllByText(/non lascia mai il tuo dispositivo/).length).toBeGreaterThan(0)
  })

  test('discloses the only value stored in the browser', () => {
    const { container } = render(<PrivacyPage />)
    expect(container.textContent).toContain('pm-theme')
  })
})
