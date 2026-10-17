// @vitest-environment node
import { beforeAll, describe, expect, test, vi } from 'vitest'
import { buildCertificate, serializeCertificate } from '@/core/cert/certificate'
import { inspectOts, stampHash, upgradeOts } from '@/core/ots/ots'
import { renderAttestato } from '@/core/pdf/renderAttestato'
import { fixture, fixtureText } from '@/test/fixtures'
import { TSA, testFonts } from '@/test/certFixtures'
import { buildRevision2, checkBitcoin, EvidenceError, loadEvidence, verifyOffline, type Evidence } from './verify'

const HASH = fixtureText('data.sha256')
const BITCOIN_123 = new Uint8Array([0x00, 0x05, 0x88, 0x96, 0x0d, 0x73, 0xd7, 0x19, 0x01, 0x01, 0x7b])
const calendar = (async () => new Response(fixture('calendar-response.bin'))) as unknown as typeof fetch
const fonts = testFonts()

let pendingOts: Uint8Array<ArrayBuffer>
let confirmedOts: Uint8Array<ArrayBuffer>
let jsonFile: File
let pdfFile: File

beforeAll(async () => {
  pendingOts = await stampHash(HASH, { fetchImpl: calendar })
  confirmedOts = (await upgradeOts(pendingOts, { fetchImpl: (async () => new Response(BITCOIN_123)) as unknown as typeof fetch })).ots
  const zip = new File([new Uint8Array([0x50, 0x4b, 3, 4])], 'opera.zip')
  const cert = buildCertificate({ file: zip, sha256: HASH, tsa: TSA, ots: pendingOts, otsInfo: inspectOts(pendingOts) })
  jsonFile = new File([serializeCertificate(cert)], 'opera_certificato.json', { type: 'application/json' })
  const doc = await renderAttestato(cert, { tsr: TSA.token, ots: pendingOts }, { fonts })
  pdfFile = new File([new Uint8Array(await doc.save())], 'opera_attestato.pdf', { type: 'application/pdf' })
}, 30_000)

describe('loadEvidence', () => {
  test('reads a JSON certificate and its embedded proofs', async () => {
    const ev = await loadEvidence(jsonFile)
    expect(ev.cert.file.sha256).toBe(HASH)
    expect(ev.tsr).toEqual(TSA.token)
    expect(ev.ots).toEqual(pendingOts)
    expect(ev.pdf).toBeUndefined()
  })

  test('reads the attachments of an attestation PDF', async () => {
    const ev = await loadEvidence(pdfFile)
    expect(ev.cert.file.sha256).toBe(HASH)
    expect(ev.tsr).toEqual(TSA.token)
    expect(ev.pdf).toBeDefined()
  })

  test('rejects a PDF without the timestamp attachment', async () => {
    const { PDFDocument } = await import('pdf-lib')
    const blank = await PDFDocument.create()
    blank.addPage()
    const file = new File([new Uint8Array(await blank.save())], 'altro.pdf')
    await expect(loadEvidence(file)).rejects.toMatchObject({ code: 'missing' })
  })

  test('rejects other file types', async () => {
    await expect(loadEvidence(new File(['x'], 'note.txt'))).rejects.toBeInstanceOf(EvidenceError)
    await expect(loadEvidence(new File(['x'], 'note.txt'))).rejects.toMatchObject({ code: 'format' })
  })
})

describe('verifyOffline', () => {
  test('passes every check for the certified archive', async () => {
    const checks = await verifyOffline(HASH, await loadEvidence(jsonFile))
    expect(checks.map((c) => [c.id, c.status])).toEqual([
      ['hash', 'ok'],
      ['imprint', 'ok'],
      ['signature', 'ok'],
      ['chain', 'ok'],
      ['meta', 'ok'],
      ['ots-hash', 'ok'],
    ])
  })

  test('flags an archive that differs by one character and still runs the other checks', async () => {
    const other = (HASH[0] === '0' ? '1' : '0') + HASH.slice(1)
    const checks = await verifyOffline(other, await loadEvidence(jsonFile))
    expect(checks[0]).toMatchObject({
      id: 'hash',
      status: 'fail',
      label: "L'impronta non corrisponde: l'archivio è diverso da quello certificato",
    })
    expect(checks.find((c) => c.id === 'signature')?.status).toBe('ok')
  })

  test('adds the PDF seal check when a PDF was provided', async () => {
    const checks = await verifyOffline(HASH, await loadEvidence(pdfFile))
    expect(checks.at(-1)).toMatchObject({ id: 'pdf-seal', status: 'warn' })
  })
})

describe('checkBitcoin', () => {
  test('warns while the calendars have no confirmation yet', async () => {
    const ev = await loadEvidence(jsonFile)
    const res = await checkBitcoin(ev, { upgradeOts: async (o) => ({ ots: new Uint8Array(o), changed: false }) })
    expect(res.check).toMatchObject({ id: 'bitcoin', status: 'warn', label: 'Conferma non ancora disponibile, riprova tra qualche ora' })
    expect(res.upgraded).toBeUndefined()
  })

  test('reports the block and returns the upgraded proof once confirmed', async () => {
    const ev = await loadEvidence(jsonFile)
    const blockTime = new Date('2026-10-17T21:14:00Z')
    const res = await checkBitcoin(ev, {
      upgradeOts: async () => ({ ots: confirmedOts, changed: true }),
      verifyOtsOnline: async () => ({ block: 123, blockTime }),
    })
    expect(res.check.status).toBe('ok')
    expect(res.check.label).toMatch(/^Confermato nel blocco #123 del /)
    expect(res.upgraded).toEqual({ ots: confirmedOts, block: 123, blockTime })
  })
})

test('buildRevision2 issues an -R2 certificate with the confirmed proof', async () => {
  const ev: Evidence = await loadEvidence(jsonFile)
  const seal = vi.fn(async () => new Uint8Array([7]))
  const out = await buildRevision2(
    ev,
    { ots: confirmedOts, block: 123, blockTime: new Date('2026-10-17T21:14:00Z') },
    { renderAttestato: (c, p, o) => renderAttestato(c, p, { ...o, fonts }), sealPdf: seal, timestamp: async () => TSA },
  )
  expect(out.certificate.id).toMatch(/-R2$/)
  expect(out.certificate.revision).toBe(2)
  expect(JSON.parse(out.json).opentimestamps.status).toBe('confirmed')
  expect(out.pdf).toEqual(new Uint8Array([7]))
  expect(out.pdfSealed).toBe(true)
})

async function forgedJson(): Promise<File> {
  const cert = JSON.parse(await jsonFile.text())
  cert.rfc3161.genTime = '2019-01-01T00:00:00.000Z'
  return new File([JSON.stringify(cert)], 'forged.json', { type: 'application/json' })
}

test('a certificate whose date was edited fails the metadata check', async () => {
  const checks = await verifyOffline(HASH, await loadEvidence(await forgedJson()))
  expect(checks.find((c) => c.id === 'meta')).toMatchObject({
    status: 'fail',
    label: 'I dati del certificato non corrispondono alla marca temporale firmata',
  })
})

test('the metadata check states the date proven by the signed token', async () => {
  const checks = await verifyOffline(HASH, await loadEvidence(jsonFile))
  expect(checks.find((c) => c.id === 'meta')?.label).toContain('Data certificata dalla marca temporale:')
})

test('revision 2 takes its timestamp data from the signed token, not from the uploaded JSON', async () => {
  const ev = await loadEvidence(await forgedJson())
  const out = await buildRevision2(
    ev,
    { ots: confirmedOts, block: 123, blockTime: new Date('2026-10-17T21:14:00Z') },
    { renderAttestato: (c, p, o) => renderAttestato(c, p, { ...o, fonts }), sealPdf: async () => new Uint8Array([7]), timestamp: async () => TSA },
  )
  expect(out.certificate.rfc3161.genTime).toBe(TSA.info.genTime.toISOString())
})
