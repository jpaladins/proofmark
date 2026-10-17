// @vitest-environment node
import { PDFDocument } from 'pdf-lib'
import { describe, expect, test } from 'vitest'
import { confirmedCert, pendingCert, PENDING_OTS, TSA, testFonts } from '@/test/certFixtures'
import { extractAttachments, renderAttestato, verifyUrl } from './renderAttestato'

const fonts = testFonts()

describe('renderAttestato', () => {
  test('renders two A4 pages with metadata', async () => {
    const cert = pendingCert({ author: 'Ada', title: 'Opera' })
    const doc = await renderAttestato(cert, { tsr: TSA.token, ots: PENDING_OTS }, { fonts })
    expect(doc.getPageCount()).toBe(2)
    const { width, height } = doc.getPage(0).getSize()
    expect(width).toBeCloseTo(595.28, 1)
    expect(height).toBeCloseTo(841.89, 1)
    expect(doc.getTitle()).toBe(`Attestato di Esistenza Digitale — ${cert.id}`)
  })

  test('embeds the proofs and the JSON certificate as attachments', async () => {
    const cert = pendingCert()
    const doc = await renderAttestato(cert, { tsr: TSA.token, ots: PENDING_OTS }, { fonts })
    const files = await extractAttachments(await doc.save())
    expect(Object.keys(files).sort()).toEqual(['certificato.json', 'prova.ots', 'prova.tsr'])
    expect(files['prova.tsr']).toEqual(TSA.token)
    expect(JSON.parse(new TextDecoder().decode(files['certificato.json'])).id).toBe(cert.id)
  })

  test('renders a confirmed revision 2', async () => {
    const doc = await renderAttestato(confirmedCert(), { tsr: TSA.token, ots: PENDING_OTS }, { fonts })
    expect(doc.getPageCount()).toBe(2)
  })

  test('survives characters the fonts cannot draw (emoji, CJK)', async () => {
    const cert = pendingCert({ author: 'Zoë Łukasz 😀 山田', title: 'Ünïcødé ✓' })
    const doc = await renderAttestato(cert, { tsr: TSA.token }, { fonts })
    expect((await doc.save()).length).toBeGreaterThan(10_000)
  })

  test('returns no attachments for a PDF without any', async () => {
    const blank = await PDFDocument.create()
    blank.addPage()
    expect(await extractAttachments(await blank.save())).toEqual({})
  })
})

test('verifyUrl puts the hash in the fragment', () => {
  expect(verifyUrl('ab'.repeat(32))).toBe(`https://proofmark.jpaladins.ovh/verifica#sha256=${'ab'.repeat(32)}`)
})

test('the page footer names the production host', async () => {
  const { APP_HOST } = await import('@/core/app')
  expect(APP_HOST).toBe('proofmark.jpaladins.ovh')
})
