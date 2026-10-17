import { describe, expect, test } from 'vitest'
import { fixture } from '@/test/fixtures'
import { bytesToHex } from '@/core/hash/sha256'
import { parseDetached, serializeDetached, leaves, parseTimestamp, OtsError } from './format'

describe('OpenTimestamps detached file codec', () => {
  test.each(['hello-world.txt.ots', 'incomplete.txt.ots'])('round-trips %s byte for byte', (name) => {
    const bytes = fixture(name)
    expect(bytesToHex(serializeDetached(parseDetached(bytes)))).toBe(bytesToHex(bytes))
  })

  test('reads the file digest of hello-world.txt.ots', async () => {
    const file = parseDetached(fixture('hello-world.txt.ots'))
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', fixture('hello-world.txt')))
    expect(file.hashOp).toBe(0x08)
    expect(bytesToHex(file.timestamp.msg)).toBe(bytesToHex(digest))
  })

  test('evaluates the operation tree down to the Bitcoin merkle root of block 358391', () => {
    const file = parseDetached(fixture('hello-world.txt.ots'))
    const btc = leaves(file.timestamp).filter((l) => l.attestation.kind === 'bitcoin')
    expect(btc).toHaveLength(1)
    expect(btc[0].attestation).toEqual({ kind: 'bitcoin', height: 358391 })
    // Bitcoin stores the merkle root little-endian; block explorers print it reversed.
    expect(bytesToHex(btc[0].msg.slice().reverse())).toBe(
      '8a1b66ecb7cbd07d8139a7e7d7f2c41aab1f5009b8364aaf61d03ad245e47e00',
    )
  })

  test('finds pending calendar attestations in incomplete.txt.ots', () => {
    const file = parseDetached(fixture('incomplete.txt.ots'))
    const kinds = leaves(file.timestamp).map((l) => l.attestation.kind)
    expect(kinds).toContain('pending')
    expect(kinds).not.toContain('bitcoin')
  })

  test('parses a raw calendar response for its commitment', () => {
    const ts = parseTimestamp(fixture('calendar-response.bin'), fixture('calendar-request.bin'))
    const pending = leaves(ts).map((l) => l.attestation)
    expect(pending[0]).toMatchObject({ kind: 'pending', uri: 'https://alice.btc.calendar.opentimestamps.org' })
  })

  test('rejects bytes without the OpenTimestamps magic header', () => {
    expect(() => parseDetached(new TextEncoder().encode('not an ots file'))).toThrow(OtsError)
  })
})
