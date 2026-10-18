import { describe, expect, test } from 'vitest'
import { bytesToHex, hexToBytes, sha256Stream } from './sha256'

describe('sha256Stream', () => {
  test('hashes "abc" to the FIPS 180-2 vector', async () => {
    expect(await sha256Stream(new Blob(['abc']))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })

  test('hashes an empty blob', async () => {
    expect(await sha256Stream(new Blob([]))).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    )
  })

  test('matches WebCrypto across uneven chunk boundaries and reports final progress', async () => {
    const bytes = new Uint8Array(1_000_003)
    for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 31 + 7) & 0xff
    const expected = bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)))
    const seen: number[] = []
    const hex = await sha256Stream(new Blob([bytes]), (n) => seen.push(n), 4096)
    expect(hex).toBe(expected)
    expect(seen.at(-1)).toBe(1_000_003)
  })
})

test('hex helpers round-trip', () => {
  expect(bytesToHex(hexToBytes('00ff10ab'))).toBe('00ff10ab')
})
