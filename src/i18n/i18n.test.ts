import { describe, expect, it } from 'vitest'
import { formatBytes, messages } from './index'

describe('dictionaries', () => {
  it('names the proof documents in each language', () => {
    expect(messages('en').files).toEqual({ receipt: 'receipt', attestation: 'attestation' })
    expect(messages('it').files).toEqual({ receipt: 'ricevuta', attestation: 'attestato' })
  })

  it('English dictionary has no Italian', () => {
    const italian = /\b(della|degli|archivio|ricevuta|attestato|verifica)\b/i
    const walk = (v: unknown, path: string) => {
      if (typeof v === 'function') return walk((v as (...a: unknown[]) => unknown)(1, 'x'), path)
      if (typeof v === 'string') return expect(v, path).not.toMatch(italian)
      if (Array.isArray(v)) return v.forEach((x, i) => walk(x, `${path}[${i}]`))
      if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => walk(x, `${path}.${k}`))
    }
    walk(messages('en'), 'en')
  })
})

describe('formatBytes', () => {
  it('formats with the language units and locale', () => {
    expect(formatBytes(4, 'en')).toBe('4 bytes')
    expect(formatBytes(1536, 'en')).toBe('1.5 KB')
    expect(formatBytes(1536, 'it')).toBe('1,5 KB')
    expect(formatBytes(4, 'it')).toBe('4 byte')
  })
})
