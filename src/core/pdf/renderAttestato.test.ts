// @vitest-environment node
import { decodePDFRawStream, PDFArray, PDFDocument, PDFRawStream, type PDFPage } from 'pdf-lib'
import { describe, expect, test } from 'vitest'
import { confirmedCert, pendingCert, PENDING_OTS, TSA, testFonts, worstCaseCert } from '@/test/certFixtures'
import { extractAttachments, renderAttestato, verifyUrl } from './renderAttestato'

const fonts = testFonts()

/** Baselines of every text run drawn on the page (pdf-lib positions text with `a b c d x y Tm`). */
function textBaselines(page: PDFPage): number[] {
  const contents = page.node.Contents()
  const streams = contents instanceof PDFArray ? contents.asArray().map((r) => page.doc.context.lookup(r)) : [contents]
  const ops = streams
    .filter((s): s is PDFRawStream => s instanceof PDFRawStream)
    .map((s) => new TextDecoder().decode(decodePDFRawStream(s).decode()))
    .join('\n')
  return [...ops.matchAll(/(-?[\d.]+) (-?[\d.]+) Tm/g)].map((m) => Number(m[2]))
}

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

  test.each([true, false])('keeps the longest accepted inputs clear of the footer (sealed: %s)', async (sealed) => {
    const doc = await renderAttestato(worstCaseCert(), { tsr: TSA.token, ots: PENDING_OTS }, { fonts, sealed })
    const saved = await PDFDocument.load(await doc.save())
    for (const page of saved.getPages()) {
      // The footer rule sits at y = 46 and its text at y = 34; content boxes need room above the rule.
      const body = textBaselines(page).filter((y) => y > 40)
      expect(body.length).toBeGreaterThan(20)
      expect(Math.min(...body)).toBeGreaterThanOrEqual(60)
    }
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
  expect(verifyUrl('ab'.repeat(32))).toBe(`https://proofmark.pages.dev/verifica#sha256=${'ab'.repeat(32)}`)
})
