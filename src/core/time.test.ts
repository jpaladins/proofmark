import { describe, expect, test } from 'vitest'
import { localTimeZone, utcOffset } from './time'

describe('utcOffset', () => {
  test.each([
    ['2015-05-28T15:41:18Z', 'Europe/Rome', 'UTC+2'],
    ['2026-01-15T12:00:00Z', 'Europe/Rome', 'UTC+1'],
    ['2015-05-28T15:41:18Z', 'America/New_York', 'UTC-4'],
    ['2015-05-28T15:41:18Z', 'Asia/Kolkata', 'UTC+5:30'],
    ['2015-05-28T15:41:18Z', 'UTC', 'UTC'],
  ])('%s in %s is %s', (iso, tz, label) => {
    expect(utcOffset(new Date(iso), tz)).toBe(label)
  })
})

test('localTimeZone returns the device time zone', () => {
  expect(localTimeZone()).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone)
})
