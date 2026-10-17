import * as pkijs from 'pkijs'
import { describe, expect, test } from 'vitest'
import { makeTestTsa } from '@/test/testTsa'
import { fixture, fixtureText } from '@/test/fixtures'
import { requestTimestamp } from './client'
import { parseTimeStampToken, parseTimeStampResp } from './rfc3161'

const HASH = fixtureText('data.sha256')
const TSR_BYTES = fixture('data.tsr')
const NONCE = parseTimeStampToken(parseTimeStampResp(TSR_BYTES).token).nonce!
const reply = (body: BodyInit) => async () =>
  new Response(body, { headers: { 'Content-Type': 'application/timestamp-reply' } })

describe('requestTimestamp', () => {
  test('resolves with token and info when imprint and nonce match', async () => {
    const res = await requestTimestamp(HASH, { fetchImpl: reply(TSR_BYTES), nonce: NONCE })
    expect(res.info.imprintHex).toBe(HASH)
    expect(res.token.length).toBeGreaterThan(1000)
  })

  test('posts the DER request to /api/tsa by default', async () => {
    let seen: [string, RequestInit] | undefined
    const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
      seen = [String(url), init!]
      return reply(TSR_BYTES)()
    }
    await requestTimestamp(HASH, { fetchImpl: fetchImpl as typeof fetch, nonce: NONCE })
    expect(seen![0]).toBe('/api/tsa')
    expect(seen![1].method).toBe('POST')
    expect(new Headers(seen![1].headers).get('Content-Type')).toBe('application/timestamp-query')
  })

  test('throws mismatch when the token covers a different hash', async () => {
    const other = 'ab'.repeat(32)
    await expect(requestTimestamp(other, { fetchImpl: reply(TSR_BYTES), nonce: NONCE })).rejects.toMatchObject({
      code: 'mismatch',
    })
  })

  test('throws mismatch when the nonce differs', async () => {
    await expect(requestTimestamp(HASH, { fetchImpl: reply(TSR_BYTES), nonce: NONCE + 1n })).rejects.toMatchObject({
      code: 'mismatch',
    })
  })

  test('throws mismatch when the response omits the requested nonce', async () => {
    const tsa = await makeTestTsa()
    const { token } = await tsa.timestamp(HASH) // the test TSA never echoes a nonce
    const resp = new pkijs.TimeStampResp({
      status: new pkijs.PKIStatusInfo({ status: pkijs.PKIStatus.granted }),
      timeStampToken: pkijs.ContentInfo.fromBER(token),
    })
    const der = new Uint8Array(resp.toSchema().toBER(false))
    await expect(requestTimestamp(HASH, { fetchImpl: reply(der), nonce: NONCE })).rejects.toMatchObject({
      code: 'mismatch',
    })
  })

  test('aborts the request when the caller signal fires', async () => {
    const caller = new AbortController()
    let seen: AbortSignal | undefined
    const fetchImpl = (_: unknown, init?: RequestInit) =>
      new Promise<Response>((_, reject) => {
        seen = init?.signal ?? undefined
        seen?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
        caller.abort()
      })
    await expect(
      requestTimestamp(HASH, { fetchImpl: fetchImpl as typeof fetch, signal: caller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(seen?.aborted).toBe(true)
  })

  test('throws network when fetch rejects', async () => {
    const fetchImpl = async () => {
      throw new TypeError('Failed to fetch')
    }
    await expect(requestTimestamp(HASH, { fetchImpl })).rejects.toMatchObject({ code: 'network' })
  })

  test('throws timeout when the relay never answers', async () => {
    const fetchImpl = (_: unknown, init?: RequestInit) =>
      new Promise<Response>((_, reject) =>
        init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))),
      )
    await expect(requestTimestamp(HASH, { fetchImpl: fetchImpl as typeof fetch, timeoutMs: 50 })).rejects.toMatchObject({
      code: 'timeout',
    })
  })

  test('throws malformed for an HTML body', async () => {
    await expect(requestTimestamp(HASH, { fetchImpl: reply('<html>502</html>') })).rejects.toMatchObject({
      code: 'malformed',
    })
  })
})
