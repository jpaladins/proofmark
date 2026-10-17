// PAdES document timestamp (ISO 32000-2 /DocTimeStamp, SubFilter ETSI.RFC3161): the whole PDF
// except the /Contents hole is hashed and sealed with an RFC 3161 token, which Adobe Acrobat shows
// as a document timestamp.
import * as asn1js from 'asn1js'
import { PDFArray, PDFDocument, PDFHexString, PDFName, PDFNumber, PDFString } from 'pdf-lib'
import { bytesToHex, hexToBytes, type Bytes } from '@/core/hash/sha256'
import { parseTimeStampToken } from '@/core/tsa/rfc3161'
import { verifyTimestampToken, type Check } from '@/core/verify/verifyToken'

const CONTENTS_BYTES = 16_384
const CONTENTS_HEX = CONTENTS_BYTES * 2
const BYTE_RANGE_SLOT = '**********'
const BYTE_RANGE_PLACEHOLDER = `[ 0 /${BYTE_RANGE_SLOT} /${BYTE_RANGE_SLOT} /${BYTE_RANGE_SLOT} ]`

const latin1 = (b: Uint8Array) => new TextDecoder('latin1').decode(b)
const ascii = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0))

async function sha256Hex(...parts: Uint8Array[]): Promise<string> {
  const total = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let off = 0
  for (const p of parts) {
    total.set(p, off)
    off += p.length
  }
  return bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256', total)))
}

export async function sealPdf(
  doc: PDFDocument,
  timestamp: (sha256Hex: string) => Promise<{ token: Uint8Array }>,
  opts: { trustPem?: string } = {},
): Promise<Bytes> {
  const ctx = doc.context
  const byteRange = PDFArray.withContext(ctx)
  byteRange.push(PDFNumber.of(0))
  for (let i = 0; i < 3; i++) byteRange.push(PDFName.of(BYTE_RANGE_SLOT))
  const sigRef = ctx.register(
    ctx.obj({
      Type: 'DocTimeStamp',
      Filter: 'Adobe.PPKLite',
      SubFilter: 'ETSI.RFC3161',
      ByteRange: byteRange,
      Contents: PDFHexString.of('0'.repeat(CONTENTS_HEX)),
    }),
  )
  const page = doc.getPage(0)
  const widgetRef = ctx.register(
    ctx.obj({
      Type: 'Annot',
      Subtype: 'Widget',
      FT: 'Sig',
      Rect: [0, 0, 0, 0],
      V: sigRef,
      T: PDFString.of('ProofMark'),
      F: 132,
      P: page.ref,
    }),
  )
  page.node.addAnnot(widgetRef)
  doc.catalog.set(PDFName.of('AcroForm'), ctx.obj({ Fields: [widgetRef], SigFlags: 3 }))

  const pdf = new Uint8Array(await doc.save({ useObjectStreams: false }))
  const text = latin1(pdf)
  const rangeAt = text.indexOf(BYTE_RANGE_PLACEHOLDER)
  const a = text.indexOf(`<${'0'.repeat(CONTENTS_HEX)}>`)
  if (rangeAt < 0 || a < 0) throw new Error('Segnaposto della firma non trovato nel PDF.')
  const b = a + CONTENTS_HEX + 2
  const range = `[0 ${a} ${b} ${pdf.length - b}]`
  if (range.length > BYTE_RANGE_PLACEHOLDER.length) throw new Error('ByteRange troppo lungo.')
  pdf.set(ascii(range.padEnd(BYTE_RANGE_PLACEHOLDER.length, ' ')), rangeAt)

  const covered = await sha256Hex(pdf.subarray(0, a), pdf.subarray(b))
  const { token } = await timestamp(covered)
  const checks = await verifyTimestampToken(new Uint8Array(token), covered, opts)
  if (checks.some((c) => c.status !== 'ok')) throw new Error('Il token del sigillo non è valido.')
  const tokenHex = bytesToHex(token).toUpperCase()
  if (tokenHex.length > CONTENTS_HEX) throw new Error('Token di marca temporale troppo grande per il sigillo.')
  pdf.set(ascii(tokenHex.padEnd(CONTENTS_HEX, '0')), a + 1)
  return pdf
}

/** Checks the last document timestamp in a PDF: coverage, imprint, signature and chain. */
export async function verifyPdfSeal(pdf: Uint8Array, opts: { trustPem?: string } = {}): Promise<Check> {
  const fail = (detail: string): Check => ({ id: 'pdf-seal', status: 'fail', label: 'Sigillo del PDF non valido', detail })
  const matches = [...latin1(pdf).matchAll(/\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g)]
  if (matches.length === 0) {
    return { id: 'pdf-seal', status: 'warn', label: 'Il PDF non contiene un sigillo temporale' }
  }
  const [start, a, b, c] = matches[matches.length - 1].slice(1).map(Number)
  if (start !== 0 || a >= b || b + c !== pdf.length) return fail('Il PDF è stato modificato dopo il sigillo.')
  if (pdf[a] !== 0x3c || pdf[b - 1] !== 0x3e) return fail('Struttura del sigillo non valida.')

  let token: Bytes
  try {
    const raw = hexToBytes(latin1(pdf.subarray(a + 1, b - 1)))
    const parsed = asn1js.fromBER(raw)
    if (parsed.offset <= 0) throw new Error('bad DER')
    token = raw.slice(0, parsed.offset)
  } catch {
    return fail('Token del sigillo non leggibile.')
  }
  const covered = await sha256Hex(pdf.subarray(0, a), pdf.subarray(b))
  const checks = await verifyTimestampToken(token, covered, opts)
  const bad = checks.find((x) => x.status !== 'ok')
  if (bad) return fail(bad.id === 'imprint' ? "L'impronta del documento non corrisponde al sigillo." : bad.label)
  const when = parseTimeStampToken(token).genTime
  return {
    id: 'pdf-seal',
    status: 'ok',
    label: 'Sigillo del PDF valido',
    detail: `Marca temporale del documento: ${when.toISOString().replace('T', ' ').slice(0, 19)} UTC`,
  }
}
