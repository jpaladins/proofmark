// @vitest-environment node
import { decodePDFRawStream, PDFArray, PDFDocument, PDFName, PDFRawStream, type PDFPage } from 'pdf-lib'
import QRCode from 'qrcode'
import { describe, expect, test, vi } from 'vitest'
import { LANGS } from '@/i18n'
import { CONFIRMED_OTS, confirmedCert, pendingCert, PENDING_OTS, testFonts, worstCaseCert } from '@/test/certFixtures'
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
  test('renders a receipt on two A4 pages with metadata', async () => {
    const cert = pendingCert({ author: 'Ada', title: 'Opera' })
    const doc = await renderAttestato(cert, { ots: PENDING_OTS }, { fonts })
    expect(doc.getPageCount()).toBe(2)
    const { width, height } = doc.getPage(0).getSize()
    expect(width).toBeCloseTo(595.28, 1)
    expect(height).toBeCloseTo(841.89, 1)
    expect(doc.getTitle()).toBe(`Ricevuta di registrazione — ${cert.id}`)
  })

  test('titles the attestation and renders it on two pages', async () => {
    const cert = confirmedCert()
    const doc = await renderAttestato(cert, { ots: CONFIRMED_OTS }, { fonts })
    expect(doc.getPageCount()).toBe(2)
    expect(doc.getTitle()).toBe(`Attestato di Esistenza Digitale — ${cert.id}`)
  })

  test('embeds the Bitcoin proof and the JSON certificate as attachments', async () => {
    const cert = pendingCert()
    const doc = await renderAttestato(cert, { ots: PENDING_OTS }, { fonts })
    const files = await extractAttachments(await doc.save())
    expect(Object.keys(files).sort()).toEqual(['le-stagioni-del-vetro_v3.ots', 'le-stagioni-del-vetro_v3_ricevuta.json'])
    expect(files['le-stagioni-del-vetro_v3.ots']).toEqual(PENDING_OTS)
    expect(JSON.parse(new TextDecoder().decode(files['le-stagioni-del-vetro_v3_ricevuta.json'])).id).toBe(cert.id)
  })

  test.each(
    LANGS.flatMap((lang) => [
      ['receipt', lang, () => worstCaseCert({ lang }), PENDING_OTS] as const,
      ['attestation', lang, () => confirmedCert({ author: 'W'.repeat(120), title: 'M'.repeat(120) }, { lang }), CONFIRMED_OTS] as const,
    ]),
  )('keeps the longest accepted inputs clear of the footer (%s, %s)', async (_kind, _lang, make, ots) => {
    const doc = await renderAttestato(make(), { ots }, { fonts })
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
    const doc = await renderAttestato(cert, { ots: PENDING_OTS }, { fonts })
    expect((await doc.save()).length).toBeGreaterThan(10_000)
  })

  test('returns no attachments for a PDF without any', async () => {
    const blank = await PDFDocument.create()
    blank.addPage()
    expect(await extractAttachments(await blank.save())).toEqual({})
  })
})

test('verifyUrl points to the Verify page in the document language with the hash in the fragment', () => {
  const h = 'ab'.repeat(32)
  expect(verifyUrl(h, 'it')).toBe(`https://jpaladins.github.io/proofmark/it/verifica#sha256=${h}`)
  expect(verifyUrl(h, 'en')).toBe(`https://jpaladins.github.io/proofmark/verify#sha256=${h}`)
})

describe.each(LANGS)('document language %s', (lang) => {
  const expected =
    lang === 'en'
      ? { suffix: 'receipt', title: 'Registration receipt', locale: 'en-GB', verify: 'https://jpaladins.github.io/proofmark/verify' }
      : { suffix: 'ricevuta', title: 'Ricevuta di registrazione', locale: 'it-IT', verify: 'https://jpaladins.github.io/proofmark/it/verifica' }

  test('names the attachments, the title and the PDF language', async () => {
    const cert = pendingCert(undefined, { lang })
    const doc = await renderAttestato(cert, { ots: PENDING_OTS }, { fonts })
    expect(doc.getTitle()).toBe(`${expected.title} — ${cert.id}`)
    const bytes = await doc.save()
    const files = await extractAttachments(bytes)
    expect(Object.keys(files).sort()).toEqual(['le-stagioni-del-vetro_v3.ots', `le-stagioni-del-vetro_v3_${expected.suffix}.json`])
    const saved = await PDFDocument.load(bytes, { updateMetadata: false })
    expect(String(saved.catalog.get(PDFName.of('Lang')))).toContain(expected.locale)
  })

  test('the QR code points to Verify in the document language', async () => {
    const spy = vi.spyOn(QRCode, 'create')
    try {
      await renderAttestato(pendingCert(undefined, { lang }), { ots: PENDING_OTS }, { fonts })
      expect(String(spy.mock.calls.at(-1)?.[0])).toMatch(new RegExp(`^${expected.verify}#sha256=[0-9a-f]{64}$`))
    } finally {
      spy.mockRestore()
    }
  })
})

describe('QR panel layout', () => {
  test.each([0, 96, 140])('keeps a clear gap between the QR code and its caption (hero height %s)', async (heroH) => {
    const { qrPanelLayout } = await import('./renderAttestato')
    const l = qrPanelLayout(heroH)
    const qrBottom = l.qrTop + l.qrSize
    const captionTop = l.captionBaseline - l.captionCapHeight
    expect(captionTop - qrBottom).toBeGreaterThanOrEqual(8)
    expect(l.qrTop).toBeGreaterThanOrEqual(9)
    expect(l.height - l.captionBaseline).toBeGreaterThanOrEqual(9)
    expect(l.height).toBeGreaterThanOrEqual(heroH)
  })
})
