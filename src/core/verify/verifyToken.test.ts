import { describe, expect, test } from 'vitest'
import { fixture, fixtureText } from '@/test/fixtures'
import { parseTimeStampResp, signedDataOf } from '@/core/tsa/rfc3161'
import { verifyTimestampToken, type Check } from './verifyToken'

const HASH = fixtureText('data.sha256')
const TOKEN = parseTimeStampResp(fixture('data.tsr')).token
const byId = (checks: Check[], id: string) => checks.find((c) => c.id === id)

function withFlippedSignatureByte(token: Uint8Array): Uint8Array<ArrayBuffer> {
  const sig = signedDataOf(new Uint8Array(token)).signerInfos[0].signature.valueBlock.valueHexView
  const tail = sig.slice(-16)
  const copy = new Uint8Array(token)
  outer: for (let i = copy.length - tail.length; i >= 0; i--) {
    for (let j = 0; j < tail.length; j++) if (copy[i + j] !== tail[j]) continue outer
    copy[i + tail.length - 1] ^= 0x01
    return copy
  }
  throw new Error('signature bytes not found in token')
}

describe('verifyTimestampToken', () => {
  test('a genuine DigiCert token passes imprint, signature and chain', async () => {
    const checks = await verifyTimestampToken(TOKEN, HASH)
    expect(checks.map((c) => [c.id, c.status])).toEqual([
      ['imprint', 'ok'],
      ['signature', 'ok'],
      ['chain', 'ok'],
    ])
  })

  test('an unparseable token fails a dedicated token check with the parse error as detail', async () => {
    const checks = await verifyTimestampToken(new Uint8Array([0x30, 0x03, 0x02, 0x01, 0x01]), HASH)
    expect(checks).toHaveLength(1)
    expect(checks[0]).toMatchObject({ id: 'token', status: 'fail', label: 'Token di marca temporale non leggibile' })
    expect(checks[0].detail).toEqual(expect.any(String))
    expect(checks[0].detail!.length).toBeGreaterThan(0)
  })

  test('a different archive hash fails the imprint check', async () => {
    const checks = await verifyTimestampToken(TOKEN, '00'.repeat(32))
    expect(byId(checks, 'imprint')).toMatchObject({
      status: 'fail',
      label: "L'impronta del token non corrisponde all'archivio",
    })
  })

  test('a tampered signature fails the signature check without throwing', async () => {
    const checks = await verifyTimestampToken(withFlippedSignatureByte(TOKEN), HASH)
    expect(byId(checks, 'signature')?.status).toBe('fail')
  })

  test('an unrelated trust anchor fails the chain check', async () => {
    const checks = await verifyTimestampToken(TOKEN, HASH, { trustPem: fixtureText('unrelated-root.pem') })
    expect(byId(checks, 'chain')?.status).toBe('fail')
  })
})

test('a signer certificate without the timeStamping EKU fails the chain check', async () => {
  const { makeTestTsa } = await import('@/test/testTsa')
  const rogue = await makeTestTsa({ eku: false })
  const { token } = await rogue.timestamp('cd'.repeat(32))
  const checks = await verifyTimestampToken(token, 'cd'.repeat(32), { trustPem: rogue.trustPem })
  expect(byId(checks, 'chain')).toMatchObject({
    status: 'fail',
    label: 'Il certificato del firmatario non è abilitato alle marche temporali',
  })
}, 20_000)
