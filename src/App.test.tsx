import { render, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import App from './App'

test('renders the ProofMark brand link', () => {
  render(<App />)
  expect(within(screen.getByRole('banner')).getByRole('link', { name: /ProofMark/ })).toBeInTheDocument()
})
