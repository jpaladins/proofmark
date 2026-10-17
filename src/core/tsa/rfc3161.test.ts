import * as pkijs from 'pkijs'
import { describe, expect, test } from 'vitest'
import { fixture, fixtureText } from '@/test/fixtures'
import { bytesToHex } from '@/core/hash/sha256'
import { buildTimeStampReq, parseTimeStampResp, randomNonce, TsaError } from './rfc3161'

const HASH = fixtureText('data.sha256')

describe('buildTimeStampReq', () => {
  test('encodes a v1 SHA-256 request with nonce and certReq', () => {
    const der = buildTimeStampReq(HASH, 42n)
    const req = pkijs.TimeStampReq.fromBER(der)
    expect(req.version).toBe(1)
    expect(req.messageImprint.hashAlgorithm.algorithmId).toBe('2.16.840.1.101.3.4.2.1')
    expect(bytesToHex(req.messageImprint.hashedMessage.valueBlock.valueHexView)).toBe(HASH)
    expect(req.nonce?.toBigInt()).toBe(42n)
    expect(req.certReq).toBe(true)
  })

  test('randomNonce returns distinct positive 64-bit values', () => {
    const a = randomNonce()
    const b = randomNonce()
    expect(a).not.toBe(b)
    expect(a > 0n && a < 1n << 64n).toBe(true)
  })
})

describe('parseTimeStampResp', () => {
  test('parses a real DigiCert response', () => {
    const { token, info } = parseTimeStampResp(fixture('data.tsr'))
    expect(token.length).toBeGreaterThan(1000)
    expect(info.imprintHex).toBe(HASH)
    expect(info.tsa).toContain('DigiCert')
    expect(info.hashAlg).toBe('SHA-256')
    expect(info.policy).toBe('2.16.840.1.114412.7.1')
    expect(Number.isNaN(info.genTime.getTime())).toBe(false)
    expect(typeof info.nonce).toBe('bigint')
  })

  test('throws rejected for a rejection status', () => {
    const resp = new pkijs.TimeStampResp({ status: new pkijs.PKIStatusInfo({ status: 2 }) })
    const der = new Uint8Array(resp.toSchema().toBER())
    expect(() => parseTimeStampResp(der)).toThrowError(expect.objectContaining({ code: 'rejected' }))
  })

  test('throws malformed for garbage', () => {
    const err = (() => {
      try {
        parseTimeStampResp(new TextEncoder().encode('<html>Bad gateway</html>'))
      } catch (e) {
        return e
      }
    })()
    expect(err).toBeInstanceOf(TsaError)
    expect((err as TsaError).code).toBe('malformed')
  })
})
