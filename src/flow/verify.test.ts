// @vitest-environment node
import { beforeAll, describe, expect, test } from 'vitest'
import { certLang, serializeCertificate, type Certificate } from '@/core/cert/certificate'
import { OtsError } from '@/core/ots/format'
import { buildAttestatoContent } from '@/core/pdf/content'
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
    const ev = await loadEvidence(receiptJson, 'it')
    expect(ev.cert.file.sha256).toBe(PENDING_HASH)
    expect(ev.ots).toEqual(PENDING_OTS)
    expect(ev.pdf).toBeUndefined()
  })

  test('reads the attachments of a ProofMark PDF', async () => {
    const ev = await loadEvidence(receiptPdf, 'it')
    expect(ev.cert.kind).toBe('ricevuta')
    expect(ev.ots).toEqual(PENDING_OTS)
    expect(ev.pdf).toBeDefined()
  })

  test('still reads PDFs issued before the rename (prova.ots, certificato.json)', async () => {
    const { PDFDocument } = await import('pdf-lib')
    const legacy = await PDFDocument.create()
    legacy.addPage()
    await legacy.attach(new Uint8Array(PENDING_OTS), 'prova.ots', { mimeType: 'application/vnd.opentimestamps.v1' })
    await legacy.attach(new TextEncoder().encode(JSON.stringify(pendingCert())), 'certificato.json', { mimeType: 'application/json' })
    const ev = await loadEvidence(new File([new Uint8Array(await legacy.save())], 'vecchio.pdf'), 'it')
    expect(ev.ots).toEqual(PENDING_OTS)
    expect(ev.cert.kind).toBe('ricevuta')
  })

  test('rejects a PDF without the ProofMark attachments', async () => {
    const { PDFDocument } = await import('pdf-lib')
    const blank = await PDFDocument.create()
    blank.addPage()
    await expect(loadEvidence(new File([new Uint8Array(await blank.save())], 'altro.pdf'), 'it')).rejects.toMatchObject({
      code: 'missing',
    })
  })

  test('rejects other file types', async () => {
    await expect(loadEvidence(new File(['x'], 'note.txt'), 'it')).rejects.toBeInstanceOf(EvidenceError)
  })
})

describe('verifyOffline', () => {
  test('a receipt: archive and proof match, the date is not attested yet', async () => {
    const checks = await verifyOffline(PENDING_HASH, await loadEvidence(receiptJson, 'it'), 'it')
    expect(checks.map((c) => [c.id, c.status])).toEqual([
      ['hash', 'ok'],
      ['ots-hash', 'ok'],
      ['meta', 'warn'],
    ])
    expect(checks[2].label).toBe('Ricevuta: la data non è ancora attestata. Controlla la conferma Bitcoin.')
  })

  test('an attestation: the proof contains the declared block', async () => {
    const checks = await verifyOffline(CONFIRMED_HASH, await loadEvidence(attestationJson, 'it'), 'it')
    expect(checks.map((c) => [c.id, c.status])).toEqual([
      ['hash', 'ok'],
      ['ots-hash', 'ok'],
      ['meta', 'ok'],
    ])
  })

  test('flags an archive that differs by one character and still runs the other checks', async () => {
    const other = (PENDING_HASH[0] === '0' ? '1' : '0') + PENDING_HASH.slice(1)
    const checks = await verifyOffline(other, await loadEvidence(receiptJson, 'it'), 'it')
    expect(checks[0]).toMatchObject({
      id: 'hash',
      status: 'fail',
      label: "L'impronta non corrisponde: l'archivio è diverso da quello certificato",
    })
    expect(checks.find((c) => c.id === 'ots-hash')?.status).toBe('ok')
  })

  test('fails an attestation whose declared block was edited', async () => {
    const forged = { ...confirmedCert(), opentimestamps: { ...confirmedCert().opentimestamps, block: 1 } }
    const checks = await verifyOffline(CONFIRMED_HASH, await loadEvidence(asJson(forged), 'it'), 'it')
    expect(checks.find((c) => c.id === 'meta')).toMatchObject({
      status: 'fail',
      label: 'Il certificato dichiara un blocco diverso da quello della prova',
    })
  })

  test('fails a certificate whose proof belongs to another archive', async () => {
    const swapped = { ...pendingCert(), opentimestamps: { ...pendingCert().opentimestamps, otsBase64: confirmedCert().opentimestamps.otsBase64 } }
    const checks = await verifyOffline(PENDING_HASH, await loadEvidence(asJson(swapped), 'it'), 'it')
    expect(checks.find((c) => c.id === 'ots-hash')?.status).toBe('fail')
  })
})

describe('checkBitcoin', () => {
  test('warns while the calendars have no confirmation yet', async () => {
    const res = await checkBitcoin(await loadEvidence(receiptJson, 'it'), 'it', {
      upgradeOts: async (o) => ({ ots: new Uint8Array(o), changed: false }),
    })
    expect(res.check).toMatchObject({ id: 'bitcoin', status: 'warn', label: 'Conferma non ancora disponibile, riprova tra qualche ora' })
    expect(res.upgraded).toBeUndefined()
  })

  test('confirms a receipt from the blockchain and returns the upgraded proof', async () => {
    const blockTime = new Date('2026-10-18T14:02:00Z')
    const res = await checkBitcoin(await loadEvidence(receiptJson, 'it'), 'it', {
      upgradeOts: async () => ({ ots: upgradedOts, changed: true }),
      verifyOtsOnline: async () => ({ block: 123, blockTime }),
    })
    expect(res.check.status).toBe('ok')
    expect(res.check.label).toMatch(/^Confermato nel blocco #123 del /)
    expect(res.check.label).toMatch(/ UTC([+-]\d{1,2}(:\d{2})?)?$/)
    expect(res.upgraded).toEqual({ ots: upgradedOts, block: 123, blockTime })
  })

  test('confirms an attestation whose block and date match the blockchain', async () => {
    const res = await checkBitcoin(await loadEvidence(attestationJson, 'it'), 'it', { verifyOtsOnline: async () => BLOCK_358391 })
    expect(res.check.status).toBe('ok')
    expect(res.upgraded).toBeUndefined()
  })

  test('fails an attestation whose date does not match the blockchain', async () => {
    const forged = { ...confirmedCert(), opentimestamps: { ...confirmedCert().opentimestamps, blockTime: '2010-01-01T00:00:00.000Z' } }
    const res = await checkBitcoin(await loadEvidence(asJson(forged), 'it'), 'it', { verifyOtsOnline: async () => BLOCK_358391 })
    expect(res.check).toMatchObject({ status: 'fail', label: 'La data del certificato non corrisponde alla blockchain' })
  })
})

test('buildAttestato issues the attestation with the block data from the blockchain, keeping the id', async () => {
  const ev = await loadEvidence(receiptJson, 'it')
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

describe('in English', () => {
  test('loadEvidence explains what to upload', async () => {
    await expect(loadEvidence(new File(['x'], 'note.txt'), 'en')).rejects.toMatchObject({
      code: 'format',
      message: 'Upload a ProofMark receipt, attestation PDF or JSON certificate.',
    })
  })

  test('loadEvidence reports an unreadable certificate in the page language', async () => {
    await expect(loadEvidence(new File(['{nope'], 'x.json'), 'en')).rejects.toMatchObject({
      code: 'format',
      message: 'The certificate is not a valid JSON file.',
    })
    await expect(loadEvidence(new File(['{"schema":"other"}'], 'x.json'), 'en')).rejects.toMatchObject({
      message: 'This certificate cannot be read.',
    })
  })

  test('verifyOffline labels the checks', async () => {
    const checks = await verifyOffline(CONFIRMED_HASH, await loadEvidence(attestationJson, 'en'), 'en')
    expect(checks[0].label).toBe("The archive's fingerprint matches the certificate")
  })

  test('checkBitcoin dates the block with the English locale', async () => {
    const previous = process.env.TZ
    process.env.TZ = 'Europe/Rome'
    try {
      const res = await checkBitcoin(await loadEvidence(attestationJson, 'en'), 'en', { verifyOtsOnline: async () => BLOCK_358391 })
      expect(res.check.label).toBe('Confirmed in block #358391 on 28 May 2015, 17:41 UTC+2')
    } finally {
      if (previous === undefined) delete process.env.TZ
      else process.env.TZ = previous
    }
  })

  test('checkBitcoin reports a proof that fails against the blockchain with the block height', async () => {
    const res = await checkBitcoin(await loadEvidence(receiptJson, 'en'), 'en', {
      upgradeOts: async () => ({ ots: upgradedOts, changed: true }),
      verifyOtsOnline: async () => {
        throw new OtsError('invalid', 'developer text', 123)
      },
    })
    expect(res.check).toMatchObject({
      status: 'fail',
      label: 'The Bitcoin proof does not match the blockchain',
      detail: 'The proof does not match Bitcoin block #123.',
    })
  })
})

test('an Italian receipt without a language is turned into an Italian attestation', async () => {
  const ev = await loadEvidence(receiptJson, 'en')
  expect(ev.cert.lang).toBeUndefined()
  const rendered: Certificate[] = []
  const out = await buildAttestato(ev, { ots: upgradedOts, block: 123, blockTime: new Date('2026-10-18T14:02:00Z') }, {
    renderAttestato: (c, p) => {
      rendered.push(c)
      return renderAttestato(c, p, { fonts })
    },
  })
  expect(certLang(out.certificate)).toBe('it')
  expect(certLang(rendered[0])).toBe('it')
  expect(buildAttestatoContent(out.certificate, { attachments: [], timeZone: 'UTC' }).title).toBe('Attestato di Esistenza Digitale')
})

test('serializeCertificate output is accepted by loadEvidence', async () => {
  const ev = await loadEvidence(new File([serializeCertificate(confirmedCert())], 'x.json'), 'it')
  expect(ev.ots).toEqual(CONFIRMED_OTS)
})
