import { describe, expect, test } from 'vitest'
import { BLOCK_358391, CONFIRMED_OTS, confirmedCert, PENDING_HASH, pendingCert, REQUESTED_AT } from '@/test/certFixtures'
import {
  CertError,
  certLang,
  confirmCertificate,
  makeCertificateId,
  parseCertificate,
  serializeCertificate,
} from './certificate'

describe('makeCertificateId', () => {
  test('uses PM-, the first 12 hash chars uppercased and the UTC date of the request', () => {
    expect(makeCertificateId('9f2c41a7e03b5d18' + '0'.repeat(48), new Date('2026-10-17T16:20:58Z'))).toBe(
      'PM-9F2C41A7E03B-20261017',
    )
  })

  test('uses the UTC day even when Rome is already on the next day', () => {
    expect(makeCertificateId('a'.repeat(64), new Date('2026-10-17T23:30:00Z'))).toBe('PM-AAAAAAAAAAAA-20261017')
  })
})

describe('buildCertificate (receipt)', () => {
  test('is a receipt with a pending Bitcoin proof and the declared request time', () => {
    const c = pendingCert()
    expect(c.schema).toBe('proofmark/v1')
    expect(c.kind).toBe('ricevuta')
    expect(c.file).toEqual({
      name: 'le-stagioni-del-vetro_v3.zip',
      size: 4,
      lastModified: '2026-10-16T21:41:00.000Z',
      sha256: PENDING_HASH,
    })
    expect(c.requestedAt).toBe(REQUESTED_AT.toISOString())
    expect(c.opentimestamps.status).toBe('pending')
    expect(c.opentimestamps.otsBase64).toBeTruthy()
    expect(c.opentimestamps.calendars.length).toBeGreaterThan(0)
    expect(c.app.url).toBe('https://jpaladins.github.io/proofmark')
    expect(c.id).toBe(makeCertificateId(PENDING_HASH, REQUESTED_AT))
    expect(c).not.toHaveProperty('rfc3161')
  })

  test('omits declared data when both fields are blank', () => {
    expect(pendingCert({ author: '  ', title: '' }).declared).toBeUndefined()
  })

  test('trims declared fields and cuts them to 120 characters', () => {
    expect(pendingCert({ author: '  Ada Lovelace ', title: 'x'.repeat(200) }).declared).toEqual({
      author: 'Ada Lovelace',
      title: 'x'.repeat(120),
      note: 'dichiarati dal richiedente, non certificati',
    })
  })
})

describe('confirmCertificate (attestation)', () => {
  test('turns the receipt into an attestation with the confirmed block and the same id', () => {
    const c = confirmedCert()
    expect(c.kind).toBe('attestato')
    expect(c.opentimestamps).toMatchObject({
      status: 'confirmed',
      block: 358391,
      blockTime: '2015-05-28T15:41:18.000Z',
    })
    expect(c.id).toMatch(/^PM-[0-9A-F]{12}-20261018$/)
  })

  test('keeps the id of the receipt', () => {
    const receipt = pendingCert()
    expect(confirmCertificate(receipt, CONFIRMED_OTS, BLOCK_358391).id).toBe(receipt.id)
  })
})

describe('JSON', () => {
  test('round-trips through serialize and parse', () => {
    for (const c of [pendingCert({ author: 'Ada' }), confirmedCert()]) {
      expect(parseCertificate(serializeCertificate(c))).toEqual(c)
    }
  })

  test('rejects another schema', () => {
    expect(() => parseCertificate('{"schema":"other"}')).toThrowError(expect.objectContaining({ code: 'schema' }))
  })

  test('rejects invalid JSON', () => {
    expect(() => parseCertificate('{nope')).toThrow(CertError)
  })

  test('rejects a certificate with a malformed hash', () => {
    const c = JSON.parse(serializeCertificate(pendingCert()))
    c.file.sha256 = 'xyz'
    expect(() => parseCertificate(JSON.stringify(c))).toThrowError(expect.objectContaining({ code: 'schema' }))
  })

  test('rejects a certificate without the Bitcoin proof', () => {
    const c = JSON.parse(serializeCertificate(pendingCert()))
    delete c.opentimestamps.otsBase64
    expect(() => parseCertificate(JSON.stringify(c))).toThrowError(expect.objectContaining({ code: 'schema' }))
  })

  test('rejects an unknown document kind', () => {
    const c = JSON.parse(serializeCertificate(pendingCert()))
    c.kind = 'altro'
    expect(() => parseCertificate(JSON.stringify(c))).toThrowError(expect.objectContaining({ code: 'schema' }))
  })
})

describe('language', () => {
  test('a new certificate records its language and writes the declared note in it', () => {
    const c = pendingCert({ author: 'Ada' }, { lang: 'en' })
    expect(c.lang).toBe('en')
    expect(c.declared?.note).toBe('declared by the applicant, not certified')
    expect(pendingCert({ author: 'Ada' }, { lang: 'it' }).declared?.note).toBe('dichiarati dal richiedente, non certificati')
  })

  test('the attestation keeps the language of the receipt', () => {
    expect(confirmedCert(undefined, { lang: 'en' }).lang).toBe('en')
    expect(confirmCertificate(pendingCert(undefined, { lang: 'it' }), CONFIRMED_OTS, BLOCK_358391).lang).toBe('it')
  })

  test('a certificate issued before the English version has no lang and reads as Italian', () => {
    const json = JSON.parse(serializeCertificate(pendingCert({ author: 'Ada' }, { lang: 'it' })))
    delete json.lang
    const c = parseCertificate(JSON.stringify(json))
    expect(c.lang).toBeUndefined()
    expect(certLang(c)).toBe('it')
    expect(certLang(pendingCert(undefined, { lang: 'en' }))).toBe('en')
  })

  test.each([['fr'], [3]])('rejects an unknown language (%s)', (lang) => {
    const json = JSON.parse(serializeCertificate(pendingCert(undefined, { lang: 'en' })))
    json.lang = lang
    expect(() => parseCertificate(JSON.stringify(json))).toThrowError(expect.objectContaining({ code: 'schema' }))
  })

  test('lang round-trips through JSON', () => {
    const c = confirmedCert({ title: 'Work' }, { lang: 'en' })
    expect(parseCertificate(serializeCertificate(c))).toEqual(c)
  })
})
