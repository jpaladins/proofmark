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

describe('OpenTimestamps codec hardening', () => {
  const PENDING = [0x83, 0xdf, 0xe3, 0x0d, 0x2e, 0xf9, 0x0c, 0x8e]
  const BITCOIN = [0x05, 0x88, 0x96, 0x0d, 0x73, 0xd7, 0x19, 0x01]
  const UNKNOWN = [1, 2, 3, 4, 5, 6, 7, 8]
  const uri = [...new TextEncoder().encode('https://a.example')]
  const leaf = [0x00, ...UNKNOWN, 0x01, 0x00]
  // `count` sibling edges, each appending one byte to the parent message and ending in a leaf.
  const fanOut = (count: number) => {
    const branch = [0xf0, 0x01, 0xaa, ...leaf]
    const out: number[] = []
    for (let i = 0; i < count; i++) out.push(...(i < count - 1 ? [0xff] : []), ...branch)
    return Uint8Array.from(out)
  }

  test('rejects a crafted proof whose messages amplify far beyond its size', () => {
    const data = fanOut(1000) // ~14 KB of input, ~4 MB of derived messages
    expect(() => parseTimestamp(data, new Uint8Array(4000))).toThrow(/too large/)
  })

  test('rejects a proof with too many nodes', () => {
    expect(() => parseTimestamp(fanOut(20_000), new Uint8Array(32))).toThrow(/too large/)
  })

  test('accepts a moderately branched proof', () => {
    expect(parseTimestamp(fanOut(100), new Uint8Array(32)).ops).toHaveLength(100)
  })

  test('rejects trailing bytes inside a pending attestation payload', () => {
    const payload = [uri.length, ...uri, 0x00]
    const data = Uint8Array.from([0x00, ...PENDING, payload.length, ...payload])
    expect(() => parseTimestamp(data, new Uint8Array(32))).toThrow(OtsError)
    const ok = [uri.length, ...uri]
    expect(() => parseTimestamp(Uint8Array.from([0x00, ...PENDING, ok.length, ...ok]), new Uint8Array(32))).not.toThrow()
  })

  test('rejects trailing bytes inside a bitcoin attestation payload', () => {
    const data = Uint8Array.from([0x00, ...BITCOIN, 0x02, 0x05, 0x00])
    expect(() => parseTimestamp(data, new Uint8Array(32))).toThrow(OtsError)
  })

  test('caps varuints at 49 bits so values stay exact', () => {
    const at = (varuint: number[]) => Uint8Array.from([0x00, ...BITCOIN, varuint.length, ...varuint])
    const max = parseTimestamp(at([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x7f]), new Uint8Array(32))
    expect(max.attestations[0]).toEqual({ kind: 'bitcoin', height: 2 ** 49 - 1 })
    expect(() => parseTimestamp(at([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x01]), new Uint8Array(32))).toThrow(
      /integer too large/,
    )
  })
})
