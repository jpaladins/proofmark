import { describe, expect, test } from 'vitest'
import { confirmedCert, pendingCert } from '@/test/certFixtures'
import { baseName, proofFileNames } from './fileNames'

describe('proof file names', () => {
  test('a receipt is named after the archive', () => {
    expect(proofFileNames(pendingCert())).toEqual({
      pdf: 'le-stagioni-del-vetro_v3_ricevuta.pdf',
      json: 'le-stagioni-del-vetro_v3_ricevuta.json',
      ots: 'le-stagioni-del-vetro_v3.ots',
    })
  })

  test('an attestation uses the attestato suffix', () => {
    expect(proofFileNames(confirmedCert())).toEqual({
      pdf: 'hello-world_attestato.pdf',
      json: 'hello-world_attestato.json',
      ots: 'hello-world.ots',
    })
  })

  test('an English receipt and attestation use English suffixes', () => {
    expect(proofFileNames(pendingCert(undefined, { lang: 'en' }))).toEqual({
      pdf: 'le-stagioni-del-vetro_v3_receipt.pdf',
      json: 'le-stagioni-del-vetro_v3_receipt.json',
      ots: 'le-stagioni-del-vetro_v3.ots',
    })
    expect(proofFileNames(confirmedCert(undefined, { lang: 'en' }))).toEqual({
      pdf: 'hello-world_attestation.pdf',
      json: 'hello-world_attestation.json',
      ots: 'hello-world.ots',
    })
  })

  test('an explicitly Italian certificate keeps the Italian suffixes', () => {
    expect(proofFileNames(confirmedCert(undefined, { lang: 'it' })).pdf).toBe('hello-world_attestato.pdf')
  })

  test('baseName drops the .zip extension in any case', () => {
    expect(baseName('ProofMark.ZIP', 'en')).toBe('ProofMark')
  })

  test('an archive without a name falls back to the word for archive in each language', () => {
    expect(baseName('.zip', 'en')).toBe('archive')
    expect(baseName('.zip', 'it')).toBe('archivio')
    const nameless = (lang: 'en' | 'it') => ({ ...pendingCert(undefined, { lang }), file: { ...pendingCert().file, name: '.zip' } })
    expect(proofFileNames(nameless('en')).pdf).toBe('archive_receipt.pdf')
    expect(proofFileNames(nameless('it')).pdf).toBe('archivio_ricevuta.pdf')
  })
})
