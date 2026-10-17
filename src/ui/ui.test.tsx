import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import App from '@/App'
import { useRoute } from './router'

beforeEach(() => {
  window.history.replaceState(null, '', '/')
  document.documentElement.classList.remove('dark')
  try {
    localStorage.clear()
  } catch {
    /* storage may be unavailable */
  }
})
afterEach(() => window.history.replaceState(null, '', '/'))

describe('header', () => {
  test('shows the brand and the zero-knowledge badge', () => {
    render(<App />)
    expect(screen.getAllByText('ProofMark')[0]).toBeInTheDocument()
    expect(screen.getByText('Zero-Knowledge: i file vengono elaborati solo nel tuo browser')).toBeInTheDocument()
  })

  test('navigation switches between Certifica and Verifica', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/esisteva/i)
    await user.click(screen.getByRole('link', { name: 'Verifica' }))
    expect(window.location.pathname).toBe('/verifica')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/verifica/i)
    await user.click(screen.getByRole('link', { name: 'Certifica' }))
    expect(window.location.pathname).toBe('/')
  })

  test('the theme toggle switches the dark class on <html>', async () => {
    const user = userEvent.setup()
    render(<App />)
    const toggle = screen.getByRole('button', { name: /tema/i })
    await user.click(toggle)
    expect(document.documentElement).toHaveClass('dark')
    await user.click(toggle)
    expect(document.documentElement).not.toHaveClass('dark')
  })
})

describe('router', () => {
  function Probe() {
    const r = useRoute()
    return (
      <p>
        {r.path}|{r.hashParams.get('sha256')}
      </p>
    )
  }

  test('exposes the sha256 fragment on /verifica', () => {
    window.history.replaceState(null, '', '/verifica#sha256=abc')
    render(<Probe />)
    expect(screen.getByText('/verifica|abc')).toBeInTheDocument()
  })

  test('falls back to / for unknown paths and follows history', () => {
    window.history.replaceState(null, '', '/nope')
    render(<Probe />)
    expect(screen.getByText('/|')).toBeInTheDocument()
    act(() => {
      window.history.pushState(null, '', '/verifica')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(screen.getByText('/verifica|')).toBeInTheDocument()
  })
})
