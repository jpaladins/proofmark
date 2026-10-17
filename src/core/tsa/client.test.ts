import { describe, expect, test } from 'vitest'
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
