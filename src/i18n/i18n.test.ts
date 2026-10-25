import { describe, expect, it } from 'vitest'
import { formatBytes, messages } from './index'

describe('dictionaries', () => {
  it('names the proof documents in each language', () => {
    expect(messages('en').files).toEqual({ receipt: 'receipt', attestation: 'attestation', archive: 'archive' })
    expect(messages('it').files).toEqual({ receipt: 'ricevuta', attestation: 'attestato', archive: 'archivio' })
  })

  it('counts calendars in the singular and the plural', () => {
    expect(messages('it').flow.calendars(1)).toBe('1 calendario')
    expect(messages('it').flow.calendars(3)).toBe('3 calendari')
    expect(messages('it').result.calendars(1)).toBe('1 calendario OpenTimestamps')
  })

  it('states the legal value of the English document plainly', () => {
    expect(messages('en').pdf.limits.valueValue).toMatch(/^Evidence that a court may freely assess\. /)
  })

  it('the calendar reminder asks for the archive and the receipt in both languages', () => {
    const en = messages('en').reminder.description('URL', 'work.zip', 'PM-1')
    expect(en).toContain('upload the archive work.zip and the receipt PM-1')
    const itText = messages('it').reminder.description('URL', 'opera.zip', 'PM-1')
    expect(itText).toMatch(/archivio opera\.zip e la ricevuta PM-1/)
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
