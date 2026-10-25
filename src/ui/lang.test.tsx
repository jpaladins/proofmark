import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import App from '@/App'
import { resetLangMemory } from './useLangChoice'

const HEX = 'a'.repeat(64)
const setLanguages = (langs: string[]) => vi.spyOn(navigator, 'languages', 'get').mockReturnValue(langs)

beforeEach(() => {
  resetLangMemory()
  localStorage.clear()
  window.history.replaceState(null, '', '/proofmark/')
})
afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
  window.history.replaceState(null, '', '/proofmark/')
})

describe('language switch', () => {
  test('lives in the footer, not the header, and offers only the other language with its flag', () => {
    render(<App />)
    expect(within(screen.getByRole('banner')).queryByRole('link', { name: 'Italiano' })).not.toBeInTheDocument()
    expect(within(screen.getByRole('banner')).queryByRole('navigation', { name: 'Language' })).not.toBeInTheDocument()
    const nav = within(screen.getByRole('contentinfo')).getByRole('navigation', { name: 'Language' })
    expect(within(nav).getAllByRole('link')).toHaveLength(1)
    expect(within(nav).getByRole('link', { name: 'Italiano' }).querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  test('an Italian page offers English', () => {
    window.history.replaceState(null, '', '/proofmark/it/')
    render(<App />)
    const nav = within(screen.getByRole('contentinfo')).getByRole('navigation', { name: 'Lingua' })
    expect(within(nav).getAllByRole('link')).toHaveLength(1)
    expect(within(nav).getByRole('link', { name: 'English' })).toHaveAttribute('href', '/proofmark/')
  })

  test('IT and EN swap the page, keep the hash and save the choice', async () => {
    window.history.replaceState(null, '', `/proofmark/verify#sha256=${HEX}`)
    render(<App />)
    const it = screen.getByRole('link', { name: 'Italiano' })
    expect(it).toHaveAttribute('href', `/proofmark/it/verifica#sha256=${HEX}`)
    expect(it).toHaveAttribute('hreflang', 'it')
    await userEvent.click(it)
    expect(window.location.pathname + window.location.hash).toBe(`/proofmark/it/verifica#sha256=${HEX}`)
    expect(localStorage.getItem('pm:lang')).toBe('it')
    await userEvent.click(screen.getByRole('link', { name: 'English' }))
    expect(window.location.pathname).toBe('/proofmark/verify')
    expect(localStorage.getItem('pm:lang')).toBe('en')
  })
})

describe('carrying the hash across languages', () => {
  test('drops a privacy section anchor, whose ids differ per language', async () => {
    setLanguages(['it-IT'])
    window.history.replaceState(null, '', '/proofmark/privacy#network')
    render(<App />)
    expect(screen.getByRole('link', { name: 'Italiano' })).toHaveAttribute('href', '/proofmark/it/privacy')
    expect(screen.getByRole('link', { name: "Passa all'italiano" })).toHaveAttribute('href', '/proofmark/it/privacy')
    await userEvent.click(screen.getByRole('link', { name: 'Italiano' }))
    expect(window.location.pathname + window.location.hash).toBe('/proofmark/it/privacy')
  })

  test('keeps a #sha256= fragment in the notice link too', async () => {
    setLanguages(['it-IT'])
    window.history.replaceState(null, '', `/proofmark/verify#sha256=${HEX}`)
    render(<App />)
    const link = screen.getByRole('link', { name: "Passa all'italiano" })
    expect(link).toHaveAttribute('href', `/proofmark/it/verifica#sha256=${HEX}`)
    await userEvent.click(link)
    expect(window.location.pathname + window.location.hash).toBe(`/proofmark/it/verifica#sha256=${HEX}`)
  })
})

describe('Italian notice', () => {
  test('shows for an Italian browser with no saved choice and hides on Chiudi', async () => {
    setLanguages(['it-IT', 'en'])
    render(<App />)
    expect(screen.getByText('Questo sito è disponibile in italiano.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Chiudi' }))
    expect(screen.queryByText('Questo sito è disponibile in italiano.')).not.toBeInTheDocument()
    expect(localStorage.getItem('pm:lang')).toBe('en')
  })

  test('stays hidden after a reload once English was chosen', () => {
    setLanguages(['it-IT'])
    localStorage.setItem('pm:lang', 'en')
    render(<App />)
    expect(screen.queryByText('Questo sito è disponibile in italiano.')).not.toBeInTheDocument()
  })

  test('the link saves Italian and opens the same page in Italian', async () => {
    setLanguages(['it'])
    window.history.replaceState(null, '', '/proofmark/privacy')
    render(<App />)
    await userEvent.click(screen.getByRole('link', { name: "Passa all'italiano" }))
    expect(window.location.pathname).toBe('/proofmark/it/privacy')
    expect(localStorage.getItem('pm:lang')).toBe('it')
    expect(screen.queryByText('Questo sito è disponibile in italiano.')).not.toBeInTheDocument()
  })

  test('is hidden on Italian pages and for other browser languages', () => {
    setLanguages(['it-IT'])
    window.history.replaceState(null, '', '/proofmark/it/')
    const { unmount } = render(<App />)
    expect(screen.queryByText('Questo sito è disponibile in italiano.')).not.toBeInTheDocument()
    unmount()
    window.history.replaceState(null, '', '/proofmark/')
    setLanguages(['en-US'])
    render(<App />)
    expect(screen.queryByText('Questo sito è disponibile in italiano.')).not.toBeInTheDocument()
  })

  test('hides on Chiudi when storage can be read but not written', async () => {
    setLanguages(['it-IT'])
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    render(<App />)
    expect(screen.getByText('Questo sito è disponibile in italiano.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Chiudi' }))
    expect(screen.queryByText('Questo sito è disponibile in italiano.')).not.toBeInTheDocument()
  })

  test('works when storage throws', async () => {
    setLanguages(['it-IT'])
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    render(<App />)
    expect(screen.getByText('Questo sito è disponibile in italiano.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Chiudi' }))
    expect(screen.queryByText('Questo sito è disponibile in italiano.')).not.toBeInTheDocument()
  })
})
