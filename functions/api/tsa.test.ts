import { afterEach, describe, expect, test, vi } from 'vitest'
import { onRequest, onRequestPost } from './tsa'

const TSQ = 'application/timestamp-query'
const TSR = 'application/timestamp-reply'
const post = (body: BodyInit, type = TSQ) =>
  new Request('https://proofmark.pages.dev/api/tsa', { method: 'POST', headers: { 'Content-Type': type }, body })
const der = (n = 59) => new Uint8Array([0x30, ...new Array(n - 1).fill(1)])

afterEach(() => vi.unstubAllGlobals())

describe('/api/tsa', () => {
  test('rejects non-POST methods with 405', async () => {
    const res = await onRequest({ request: new Request('https://x/api/tsa') })
    expect(res.status).toBe(405)
  })

  test('rejects a wrong content type with 415', async () => {
    expect((await onRequestPost({ request: post(der(), 'text/plain') })).status).toBe(415)
  })

  test('rejects bodies over 1 KB with 413', async () => {
    expect((await onRequestPost({ request: post(der(1025)) })).status).toBe(413)
  })

  test('stops reading an unbounded streamed body after 1 KB and answers 413', async () => {
    let pulled = 0
    const endless = new ReadableStream<Uint8Array>({
      pull(c) {
        pulled += 256
        c.enqueue(new Uint8Array(256).fill(0x30))
      },
    })
    const request = new Request('https://proofmark.pages.dev/api/tsa', {
      method: 'POST',
      headers: { 'Content-Type': TSQ },
      body: endless,
      duplex: 'half',
    } as RequestInit)
    expect((await onRequestPost({ request })).status).toBe(413)
    expect(pulled).toBeLessThan(8 * 1024)
  })

  test('rejects bodies that are not a DER SEQUENCE with 400', async () => {
    expect((await onRequestPost({ request: post(new Uint8Array([0x31, 1, 2])) })).status).toBe(400)
  })

  test('forwards a valid request to DigiCert and relays the reply', async () => {
    const upstream = vi.fn(async () => new Response(new Uint8Array([0x30, 9]), { headers: { 'Content-Type': TSR } }))
    vi.stubGlobal('fetch', upstream)
    const res = await onRequestPost({ request: post(der()) })
    const [url, init] = upstream.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('http://timestamp.digicert.com')
    expect(new Headers(init.headers).get('Content-Type')).toBe(TSQ)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe(TSR)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([0x30, 9]))
  })

  test('returns 502 on an upstream server error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('oops', { status: 503 })))
    expect((await onRequestPost({ request: post(der()) })).status).toBe(502)
  })

  test('returns 502 when upstream answers with a non-timestamp content type', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html/>', { headers: { 'Content-Type': 'text/html' } })))
    expect((await onRequestPost({ request: post(der()) })).status).toBe(502)
  })
})
