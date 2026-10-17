import { describe, expect, test } from 'vitest'
import { fixture } from '@/test/fixtures'
import { bytesToHex } from '@/core/hash/sha256'
import { inspectOts, OTS_CALENDARS, stampHash, upgradeOts, verifyOtsOnline } from './ots'

const HASH = 'a'.repeat(64)
const okResponse = (body: BodyInit) => new Response(body, { status: 200 })
// A serialized timestamp holding a single Bitcoin attestation at height 123.
const BITCOIN_123 = new Uint8Array([0x00, 0x05, 0x88, 0x96, 0x0d, 0x73, 0xd7, 0x19, 0x01, 0x01, 0x7b])

describe('stampHash', () => {
  test('submits a blinded commitment to every calendar and returns a pending proof for the hash', async () => {
    const urls: string[] = []
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      urls.push(url)
      expect(init?.method).toBe('POST')
      expect((init!.body as Uint8Array).length).toBe(32)
      expect(new Uint8Array(init!.body as Uint8Array)).not.toEqual(Uint8Array.from(Buffer.from(HASH, 'hex')))
      return okResponse(fixture('calendar-response.bin'))
    }) as typeof fetch
    const ots = await stampHash(HASH, { fetchImpl })
    expect(urls).toEqual(OTS_CALENDARS.map((c) => `${c}/digest`))
    const info = inspectOts(ots)
    expect(info).toMatchObject({ digestHex: HASH, status: 'pending' })
    expect(info.calendars).toContain('https://alice.btc.calendar.opentimestamps.org')
  })

  test('succeeds when at least one calendar answers', async () => {
    let n = 0
    const fetchImpl = (async () => (n++ === 0 ? okResponse(fixture('calendar-response.bin')) : new Response('', { status: 503 }))) as typeof fetch
    expect(inspectOts(await stampHash(HASH, { fetchImpl })).status).toBe('pending')
  })

  test('throws network when no calendar answers', async () => {
    const fetchImpl = (async () => {
      throw new TypeError('offline')
    }) as typeof fetch
    await expect(stampHash(HASH, { fetchImpl })).rejects.toMatchObject({ code: 'network' })
  })
  test('cancels every calendar request when the caller signal fires', async () => {
    const caller = new AbortController()
    const signals: AbortSignal[] = []
    const fetchImpl = ((_: string, init?: RequestInit) =>
      new Promise<Response>((_, reject) => {
        signals.push(init!.signal!)
        init!.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
        if (signals.length === OTS_CALENDARS.length) caller.abort()
      })) as typeof fetch
    await expect(stampHash(HASH, { fetchImpl, signal: caller.signal })).rejects.toMatchObject({ name: 'AbortError' })
    expect(signals.every((s) => s.aborted)).toBe(true)
  })
})

describe('inspectOts', () => {
  test('reports the confirmed hello-world proof', async () => {
    const digest = bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256', fixture('hello-world.txt'))))
    expect(inspectOts(fixture('hello-world.txt.ots'))).toMatchObject({ digestHex: digest, status: 'confirmed', block: 358391 })
  })

  test('throws malformed on garbage', () => {
    expect(() => inspectOts(new Uint8Array([1, 2, 3]))).toThrowError(expect.objectContaining({ code: 'malformed' }))
  })
})

describe('upgradeOts', () => {
  test('leaves the proof unchanged while calendars still answer 404', async () => {
    const ots = fixture('incomplete.txt.ots')
    const fetchImpl = (async () => new Response('Pending', { status: 404 })) as typeof fetch
    const res = await upgradeOts(ots, { fetchImpl })
    expect(res.changed).toBe(false)
    expect(bytesToHex(res.ots)).toBe(bytesToHex(ots))
  })

  test('merges a Bitcoin attestation returned by the calendar', async () => {
    const seen: string[] = []
    const fetchImpl = (async (url: string) => {
      seen.push(url)
      return okResponse(BITCOIN_123)
    }) as typeof fetch
    const res = await upgradeOts(fixture('incomplete.txt.ots'), { fetchImpl })
    expect(seen[0]).toMatch(/^https:\/\/alice\.btc\.calendar\.opentimestamps\.org\/timestamp\/[0-9a-f]+$/)
    expect(res.changed).toBe(true)
    expect(inspectOts(res.ots)).toMatchObject({ status: 'confirmed', block: 123 })
  })
})

describe('verifyOtsOnline', () => {
  const block = fixture('block-358391.json')
  const fetchImpl = (async (url: string) => {
    if (url.endsWith('/block-height/358391')) return okResponse(JSON.parse(new TextDecoder().decode(block)).id)
    if (url.includes('/block/')) return okResponse(block)
    return new Response('', { status: 404 })
  }) as typeof fetch

  test('confirms the hello-world proof against the block merkle root', async () => {
    expect(await verifyOtsOnline(fixture('hello-world.txt.ots'), { fetchImpl })).toEqual({
      block: 358391,
      blockTime: new Date(1432827678 * 1000),
    })
  })

  test('returns null for a proof without Bitcoin attestations', async () => {
    expect(await verifyOtsOnline(fixture('incomplete.txt.ots'), { fetchImpl })).toBeNull()
  })

  test('throws invalid when the merkle root does not match', async () => {
    const lying = (async (url: string) =>
      url.includes('/block-height/')
        ? okResponse('00')
        : okResponse(JSON.stringify({ merkle_root: '00'.repeat(32), timestamp: 1 }))) as typeof fetch
    await expect(verifyOtsOnline(fixture('hello-world.txt.ots'), { fetchImpl: lying })).rejects.toMatchObject({
      code: 'invalid',
    })
  })
})
