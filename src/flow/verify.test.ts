// @vitest-environment node
import { beforeAll, describe, expect, test } from 'vitest'
import { serializeCertificate } from '@/core/cert/certificate'
import { upgradeOts } from '@/core/ots/ots'
import { renderAttestato } from '@/core/pdf/renderAttestato'
import {
  BLOCK_358391,
  CONFIRMED_HASH,
  CONFIRMED_OTS,
  confirmedCert,
  PENDING_HASH,
  PENDING_OTS,
  pendingCert,
  testFonts,
} from '@/test/certFixtures'
import { buildAttestato, checkBitcoin, EvidenceError, loadEvidence, verifyOffline } from './verify'

// A serialized timestamp holding a single Bitcoin attestation at height 123.
const BITCOIN_123 = new Uint8Array([0x00, 0x05, 0x88, 0x96, 0x0d, 0x73, 0xd7, 0x19, 0x01, 0x01, 0x7b])
const fonts = testFonts()
const asJson = (c: unknown, name = 'opera_ricevuta.json') => new File([JSON.stringify(c)], name, { type: 'application/json' })

let receiptJson: File
let receiptPdf: File
let attestationJson: File
let upgradedOts: Uint8Array<ArrayBuffer>

beforeAll(async () => {
  receiptJson = asJson(pendingCert())
  const doc = await renderAttestato(pendingCert(), { ots: PENDING_OTS }, { fonts })
  receiptPdf = new File([new Uint8Array(await doc.save())], 'opera_ricevuta.pdf', { type: 'application/pdf' })
  attestationJson = asJson(confirmedCert(), 'hello_attestato.json')
  upgradedOts = (await upgradeOts(PENDING_OTS, { fetchImpl: (async () => new Response(BITCOIN_123)) as unknown as typeof fetch })).ots
}, 30_000)

describe('loadEvidence', () => {
  test('reads a JSON certificate and its embedded proof', async () => {
    const ev = await loadEvidence(receiptJson)
    expect(ev.cert.file.sha256).toBe(PENDING_HASH)
    expect(ev.ots).toEqual(PENDING_OTS)
    expect(ev.pdf).toBeUndefined()
  })

  test('reads the attachments of a ProofMark PDF', async () => {
    const ev = await loadEvidence(receiptPdf)
    expect(ev.cert.kind).toBe('ricevuta')
    expect(ev.ots).toEqual(PENDING_OTS)
    expect(ev.pdf).toBeDefined()
  })

  test('rejects a PDF without the ProofMark attachments', async () => {
    const { PDFDocument } = await import('pdf-lib')
    const blank = await PDFDocument.create()
    blank.addPage()
    await expect(loadEvidence(new File([new Uint8Array(await blank.save())], 'altro.pdf'))).rejects.toMatchObject({
      code: 'missing',
    })
  })

  test('rejects other file types', async () => {
    await expect(loadEvidence(new File(['x'], 'note.txt'))).rejects.toBeInstanceOf(EvidenceError)
  })
})

describe('verifyOffline', () => {
  test('a receipt: archive and proof match, the date is not attested yet', async () => {
    const checks = await verifyOffline(PENDING_HASH, await loadEvidence(receiptJson))
    expect(checks.map((c) => [c.id, c.status])).toEqual([
      ['hash', 'ok'],
      ['ots-hash', 'ok'],
      ['meta', 'warn'],
    ])
    expect(checks[2].label).toBe('Ricevuta: la data non è ancora attestata. Controlla la conferma Bitcoin.')
  })

  test('an attestation: the proof contains the declared block', async () => {
    const checks = await verifyOffline(CONFIRMED_HASH, await loadEvidence(attestationJson))
    expect(checks.map((c) => [c.id, c.status])).toEqual([
      ['hash', 'ok'],
      ['ots-hash', 'ok'],
      ['meta', 'ok'],
    ])
  })

  test('flags an archive that differs by one character and still runs the other checks', async () => {
    const other = (PENDING_HASH[0] === '0' ? '1' : '0') + PENDING_HASH.slice(1)
    const checks = await verifyOffline(other, await loadEvidence(receiptJson))
    expect(checks[0]).toMatchObject({
      id: 'hash',
      status: 'fail',
      label: "L'impronta non corrisponde: l'archivio è diverso da quello certificato",
    })
    expect(checks.find((c) => c.id === 'ots-hash')?.status).toBe('ok')
  })

  test('fails an attestation whose declared block was edited', async () => {
    const forged = { ...confirmedCert(), opentimestamps: { ...confirmedCert().opentimestamps, block: 1 } }
    const checks = await verifyOffline(CONFIRMED_HASH, await loadEvidence(asJson(forged)))
    expect(checks.find((c) => c.id === 'meta')).toMatchObject({
      status: 'fail',
      label: 'Il certificato dichiara un blocco diverso da quello della prova',
    })
  })

  test('fails a certificate whose proof belongs to another archive', async () => {
    const swapped = { ...pendingCert(), opentimestamps: { ...pendingCert().opentimestamps, otsBase64: confirmedCert().opentimestamps.otsBase64 } }
    const checks = await verifyOffline(PENDING_HASH, await loadEvidence(asJson(swapped)))
    expect(checks.find((c) => c.id === 'ots-hash')?.status).toBe('fail')
  })
})

describe('checkBitcoin', () => {
  test('warns while the calendars have no confirmation yet', async () => {
    const res = await checkBitcoin(await loadEvidence(receiptJson), {
      upgradeOts: async (o) => ({ ots: new Uint8Array(o), changed: false }),
    })
    expect(res.check).toMatchObject({ id: 'bitcoin', status: 'warn', label: 'Conferma non ancora disponibile, riprova tra qualche ora' })
    expect(res.upgraded).toBeUndefined()
  })

  test('confirms a receipt from the blockchain and returns the upgraded proof', async () => {
    const blockTime = new Date('2026-10-18T14:02:00Z')
    const res = await checkBitcoin(await loadEvidence(receiptJson), {
      upgradeOts: async () => ({ ots: upgradedOts, changed: true }),
      verifyOtsOnline: async () => ({ block: 123, blockTime }),
    })
    expect(res.check.status).toBe('ok')
    expect(res.check.label).toMatch(/^Confermato nel blocco #123 del /)
    expect(res.check.label).toMatch(/ UTC([+-]\d{1,2}(:\d{2})?)?$/)
    expect(res.upgraded).toEqual({ ots: upgradedOts, block: 123, blockTime })
  })

  test('confirms an attestation whose block and date match the blockchain', async () => {
    const res = await checkBitcoin(await loadEvidence(attestationJson), { verifyOtsOnline: async () => BLOCK_358391 })
    expect(res.check.status).toBe('ok')
    expect(res.upgraded).toBeUndefined()
  })

  test('fails an attestation whose date does not match the blockchain', async () => {
    const forged = { ...confirmedCert(), opentimestamps: { ...confirmedCert().opentimestamps, blockTime: '2010-01-01T00:00:00.000Z' } }
    const res = await checkBitcoin(await loadEvidence(asJson(forged)), { verifyOtsOnline: async () => BLOCK_358391 })
    expect(res.check).toMatchObject({ status: 'fail', label: 'La data del certificato non corrisponde alla blockchain' })
  })
})

test('buildAttestato issues the attestation with the block data from the blockchain, keeping the id', async () => {
  const ev = await loadEvidence(receiptJson)
  const blockTime = new Date('2026-10-18T14:02:00Z')
  const out = await buildAttestato(ev, { ots: upgradedOts, block: 123, blockTime }, {
    renderAttestato: (c, p) => renderAttestato(c, p, { fonts }),
  })
  expect(out.certificate.kind).toBe('attestato')
  expect(out.certificate.id).toBe(ev.cert.id)
  expect(out.certificate.file.sha256).toBe(PENDING_HASH)
  expect(JSON.parse(out.json).opentimestamps).toMatchObject({ status: 'confirmed', block: 123, blockTime: blockTime.toISOString() })
  expect(out.pdf.length).toBeGreaterThan(10_000)
})

test('serializeCertificate output is accepted by loadEvidence', async () => {
  const ev = await loadEvidence(new File([serializeCertificate(confirmedCert())], 'x.json'))
  expect(ev.ots).toEqual(CONFIRMED_OTS)
})
