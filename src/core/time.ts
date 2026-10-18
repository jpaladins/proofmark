/** The time zone of the user's device, e.g. "Europe/Rome". */
export function localTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

/**
 * UTC offset of a time zone at a given moment, as "UTC+2", "UTC-4", "UTC+5:30" or "UTC".
 * Computed per date, so daylight saving time is taken into account.
 */
export function utcOffset(date: Date, timeZone: string = localTimeZone()): string {
  const part = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' })
    .formatToParts(date)
    .find((p) => p.type === 'timeZoneName')?.value
  const match = part?.match(/^GMT([+-]\d{1,2}(?::\d{2})?)?$/)
  const offset = match?.[1]
  // "GMT", "GMT+0" and "GMT-0" all mean no offset.
  if (!offset || /^[+-]0+(?::00)?$/.test(offset)) return 'UTC'
  return `UTC${offset}`
}
