// @vitest-environment node
import { beforeAll, describe, expect, test } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { bytesToHex } from '@/core/hash/sha256'
import { pendingCert, PENDING_OTS, TSA, testFonts } from '@/test/certFixtures'
import { makeTestTsa } from '@/test/testTsa'
import { verifyTimestampToken } from '@/core/verify/verifyToken'
import { extractAttachments, renderAttestato } from './renderAttestato'
import { sealPdf, verifyPdfSeal } from './pades'

const fonts = testFonts()
let tsa: Awaited<ReturnType<typeof makeTestTsa>>
let sealed: Uint8Array

const latin1 = (b: Uint8Array) => new TextDecoder('latin1').decode(b)
const byteRange = (pdf: Uint8Array) => latin1(pdf).match(/\/ByteRange \[(\d+) (\d+) (\d+) (\d+)\]/)!.slice(1).map(Number)
const sha256 = async (b: Uint8Array) => bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(b))))

beforeAll(async () => {
  tsa = await makeTestTsa()
  const doc = await renderAttestato(pendingCert(), { tsr: TSA.token, ots: PENDING_OTS }, { fonts })
  sealed = await sealPdf(doc, tsa.timestamp)
}, 30_000)

test('the test TSA issues tokens that pass verification against its own root', async () => {
  const { token } = await tsa.timestamp('ab'.repeat(32))
  const checks = await verifyTimestampToken(token, 'ab'.repeat(32), { trustPem: tsa.trustPem })
  expect(checks.map((c) => c.status)).toEqual(['ok', 'ok', 'ok'])
})

describe('sealPdf', () => {
  test('writes a DocTimeStamp signature whose ByteRange spans the whole file except Contents', () => {
    const text = latin1(sealed)
    expect(text).toContain('/Type /DocTimeStamp')
    expect(text).toContain('/SubFilter /ETSI.RFC3161')
    const [start, a, b, c] = byteRange(sealed)
    expect(start).toBe(0)
    expect(b + c).toBe(sealed.length)
    expect(sealed[a]).toBe(0x3c)
    expect(sealed[b - 1]).toBe(0x3e)
  })

  test('timestamps the SHA-256 of the covered bytes', async () => {
    const [, a, b] = byteRange(sealed)
    const covered = new Uint8Array([...sealed.subarray(0, a), ...sealed.subarray(b)])
    expect(tsa.seen[0]).toBe(await sha256(covered))
  })

  test('keeps the attachments readable', async () => {
    expect(Object.keys(await extractAttachments(sealed)).sort()).toEqual(['certificato.json', 'prova.ots', 'prova.tsr'])
  })

  test('produces a PDF that pdf-lib can load again', async () => {
    expect((await PDFDocument.load(sealed)).getPageCount()).toBe(2)
  })
})

describe('verifyPdfSeal', () => {
  test('accepts an intact sealed PDF', async () => {
    expect(await verifyPdfSeal(sealed, { trustPem: tsa.trustPem })).toMatchObject({ id: 'pdf-seal', status: 'ok' })
  })

  test('warns when the PDF has no seal', async () => {
    const doc = await renderAttestato(pendingCert(), { tsr: TSA.token }, { fonts })
    expect(await verifyPdfSeal(await doc.save(), { trustPem: tsa.trustPem })).toMatchObject({ status: 'warn' })
  })

  test('fails when a covered byte was changed', async () => {
    const tampered = new Uint8Array(sealed)
    tampered[200] ^= 0x01
    expect(await verifyPdfSeal(tampered, { trustPem: tsa.trustPem })).toMatchObject({ status: 'fail' })
  })

  test('fails when bytes were appended after sealing', async () => {
    const appended = new Uint8Array([...sealed, ...new TextEncoder().encode('\n% extra\n')])
    expect(await verifyPdfSeal(appended, { trustPem: tsa.trustPem })).toMatchObject({ status: 'fail' })
  })

  test('fails against the DigiCert root for a token from another authority', async () => {
    expect(await verifyPdfSeal(sealed)).toMatchObject({ status: 'fail' })
  })
})
