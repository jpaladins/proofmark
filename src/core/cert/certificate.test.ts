import { describe, expect, test } from 'vitest'
import { fixture, fixtureText } from '@/test/fixtures'
import { parseTimeStampResp } from '@/core/tsa/rfc3161'
import { inspectOts } from '@/core/ots/ots'
import {
  buildCertificate,
  makeCertificateId,
  parseCertificate,
  serializeCertificate,
  upgradeCertificate,
  CertError,
} from './certificate'

const HASH = fixtureText('data.sha256')
const TSA = parseTimeStampResp(fixture('data.tsr'))
const OTS = fixture('incomplete.txt.ots')
const zip = new File([new Uint8Array([0x50, 0x4b, 3, 4])], 'opera.zip', { lastModified: Date.UTC(2026, 9, 16, 21, 41) })
const build = (declared?: { author?: string; title?: string }) =>
  buildCertificate({ file: zip, sha256: HASH, tsa: TSA, ots: OTS, otsInfo: inspectOts(OTS), declared })

describe('makeCertificateId', () => {
  test('uses PM-, the first 12 hash chars uppercased and the UTC date of the stamp', () => {
    const t = new Date('2026-10-17T16:20:58Z')
    expect(makeCertificateId('9f2c41a7e03b5d18' + '0'.repeat(48), t, 1)).toBe('PM-9F2C41A7E03B-20261017')
    expect(makeCertificateId('9f2c41a7e03b5d18' + '0'.repeat(48), t, 2)).toBe('PM-9F2C41A7E03B-20261017-R2')
  })

  test('uses the UTC day even when Rome is already on the next day', () => {
    expect(makeCertificateId('a'.repeat(64), new Date('2026-10-17T23:30:00Z'), 1)).toBe('PM-AAAAAAAAAAAA-20261017')
  })
})

describe('buildCertificate', () => {
  test('captures file, timestamp and pending OpenTimestamps data', () => {
    const c = build()
    expect(c.schema).toBe('proofmark/v1')
    expect(c.revision).toBe(1)
    expect(c.file).toEqual({ name: 'opera.zip', size: 4, lastModified: '2026-10-16T21:41:00.000Z', sha256: HASH })
    expect(c.rfc3161.tsa).toContain('DigiCert')
    expect(c.rfc3161.genTime).toBe(TSA.info.genTime.toISOString())
    expect(c.opentimestamps.status).toBe('pending')
    expect(c.opentimestamps.otsBase64).toBeTruthy()
    expect(c.app.url).toBe('https://proofmark.pages.dev')
    expect(c.id).toBe(makeCertificateId(HASH, TSA.info.genTime, 1))
  })

  test('omits declared data when both fields are blank', () => {
    expect(build({ author: '  ', title: '' }).declared).toBeUndefined()
  })

  test('trims declared fields and cuts them to 120 characters', () => {
    const c = build({ author: '  Ada Lovelace ', title: 'x'.repeat(200) })
    expect(c.declared).toEqual({
      author: 'Ada Lovelace',
      title: 'x'.repeat(120),
      note: 'dichiarati dal richiedente, non certificati',
    })
  })

  test('marks OpenTimestamps unavailable when no proof was obtained', () => {
    const c = buildCertificate({ file: zip, sha256: HASH, tsa: TSA })
    expect(c.opentimestamps).toEqual({ status: 'unavailable', calendars: [] })
  })
})

describe('JSON', () => {
  test('round-trips through serialize and parse', () => {
    const c = build({ author: 'Ada' })
    expect(parseCertificate(serializeCertificate(c))).toEqual(c)
  })

  test('rejects another schema', () => {
    expect(() => parseCertificate('{"schema":"other"}')).toThrowError(expect.objectContaining({ code: 'schema' }))
  })

  test('rejects invalid JSON', () => {
    expect(() => parseCertificate('{nope')).toThrow(CertError)
  })

  test('rejects a certificate with a malformed hash', () => {
    const c = JSON.parse(serializeCertificate(build()))
    c.file.sha256 = 'xyz'
    expect(() => parseCertificate(JSON.stringify(c))).toThrowError(expect.objectContaining({ code: 'schema' }))
  })
})

describe('upgradeCertificate', () => {
  test('produces revision 2 with the Bitcoin confirmation and the same RFC 3161 data', () => {
    const c = build()
    const up = upgradeCertificate(c, fixture('hello-world.txt.ots'), { block: 358391, blockTime: new Date(1432827678000) })
    expect(up.revision).toBe(2)
    expect(up.id).toBe(`${c.id}-R2`)
    expect(up.rfc3161).toEqual(c.rfc3161)
    expect(up.opentimestamps).toMatchObject({ status: 'confirmed', block: 358391, blockTime: '2015-05-28T15:41:18.000Z' })
  })
})
