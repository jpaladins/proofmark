import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import App from './App'

test('renders the ProofMark brand', () => {
  render(<App />)
  expect(screen.getByText('ProofMark')).toBeInTheDocument()
})
