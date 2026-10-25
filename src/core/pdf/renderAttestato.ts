// Draws the two-page A4 attestation with pdf-lib and
// embeds the raw proofs as PDF attachments. Returns the unsaved document so the PAdES seal can be
// added before saving.
import fontkit from '@pdf-lib/fontkit'
import {
  decodePDFRawStream,
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFRawStream,
  PDFString,
  rgb,
  type PDFFont,
  type PDFPage,
  type RGB,
} from 'pdf-lib'
import QRCode from 'qrcode'
import { APP_URL, APP_VERSION, verifyUrlFor } from '@/core/app'
import type { Bytes } from '@/core/hash/sha256'
import { certLang, serializeCertificate, type Certificate } from '@/core/cert/certificate'
import { proofFileNames } from '@/core/cert/fileNames'
import { localeOf, messages, type Lang } from '@/i18n'
import { buildAttestatoContent, type AttestatoContent, type Pill, type Row } from './content'
import { loadFontBytes, type FontBytes } from './fonts'

/** Address of the QR code: Verify in the document's language, with the hash in the fragment. */
export function verifyUrl(sha256Hex: string, lang: Lang): string {
  return `${verifyUrlFor(lang)}#sha256=${sha256Hex}`
}

const hex = (h: string): RGB => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255)
const C = {
  ink: hex('#0f172a'),
  ink2: hex('#334155'),
  muted: hex('#64748b'),
  line: hex('#e2e8f0'),
  soft: hex('#f8fafc'),
  white: hex('#ffffff'),
  emerald: hex('#047857'),
  emeraldMid: hex('#059669'),
  emeraldSoft: hex('#ecfdf5'),
  emeraldBorder: hex('#a7f3d0'),
  emeraldText: hex('#064e3b'),
  blue: hex('#1d4ed8'),
  amber: hex('#b45309'),
  amberSoft: hex('#fffbeb'),
  amberBorder: hex('#fde68a'),
  amberText: hex('#78350f'),
  dashed: hex('#94a3b8'),
  code: hex('#e2e8f0'),
  codeComment: hex('#94a3b8'),
}

const W = 595.28
const H = 841.89
const M = 48
const CW = W - 2 * M
// Page-1 content must end this far above the bottom edge to clear the footer rule (y = 46).
const CONTENT_FLOOR = 54

/** Row typography and vertical rhythm; page 1 switches to DENSE when the longest inputs would reach the footer. */
type Density = { size: number; mono: number; lead: number; pad: number; gap: number }
const NORMAL: Density = { size: 8.8, mono: 8, lead: 1.4, pad: 5, gap: 14 }
const DENSE: Density = { size: 8.2, mono: 7.4, lead: 1.3, pad: 3, gap: 10 }

// Stand-in page for a measuring pass: text is still measured with the real fonts, nothing is drawn.
const noop = () => {}
const DRY_PAGE = { drawText: noop, drawSvgPath: noop, drawCircle: noop, drawRectangle: noop, drawLine: noop } as unknown as PDFPage

type Face = { pdf: PDFFont; has: (cp: number) => boolean }
type Faces = Record<keyof FontBytes, Face>

class Pen {
  readonly page: PDFPage
  readonly f: Faces
  constructor(page: PDFPage, faces: Faces) {
    this.page = page
    this.f = faces
  }

  /** Replaces characters the font cannot draw (emoji, CJK…) with '?'. */
  clean(text: string, face: Face): string {
    return Array.from(text, (ch) => (ch === '\n' || face.has(ch.codePointAt(0)!) ? ch : '?')).join('')
  }

  width(text: string, face: Face, size: number) {
    return face.pdf.widthOfTextAtSize(this.clean(text, face), size)
  }

  text(text: string, x: number, baseline: number, face: Face, size: number, color: RGB) {
    this.page.drawText(this.clean(text, face), { x, y: baseline, font: face.pdf, size, color })
  }

  textRight(text: string, right: number, baseline: number, face: Face, size: number, color: RGB) {
    this.text(text, right - this.width(text, face, size), baseline, face, size, color)
  }

  wrap(text: string, face: Face, size: number, maxWidth: number): string[] {
    const lines: string[] = []
    for (const paragraph of this.clean(text, face).split('\n')) {
      let line = ''
      for (const word of paragraph.split(' ')) {
        const candidate = line ? `${line} ${word}` : word
        if (face.pdf.widthOfTextAtSize(candidate, size) <= maxWidth) {
          line = candidate
          continue
        }
        if (line) lines.push(line)
        line = ''
        // Break words longer than the column (hashes, file names) character by character.
        for (const ch of word) {
          if (face.pdf.widthOfTextAtSize(line + ch, size) > maxWidth && line) {
            lines.push(line)
            line = ''
          }
          line += ch
        }
      }
      lines.push(line)
    }
    return lines
  }

  /** Draws wrapped text whose first line's top sits at `top`; returns the height used. */
  para(text: string, x: number, top: number, width: number, face: Face, size: number, color: RGB, leading = 1.42) {
    const lines = this.wrap(text, face, size, width)
    lines.forEach((l, i) => this.page.drawText(l, { x, y: top - size * 0.8 - i * size * leading, font: face.pdf, size, color }))
    return lines.length * size * leading
  }

  roundRect(x: number, top: number, w: number, h: number, r: number, fill?: RGB, border?: RGB, borderWidth = 0.75) {
    const path = `M ${r} 0 H ${w - r} A ${r} ${r} 0 0 1 ${w} ${r} V ${h - r} A ${r} ${r} 0 0 1 ${w - r} ${h} H ${r} A ${r} ${r} 0 0 1 0 ${h - r} V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`
    this.page.drawSvgPath(path, {
      x,
      y: top,
      color: fill,
      borderColor: border,
      borderWidth: border ? borderWidth : 0,
    })
  }

  hline(x1: number, x2: number, y: number, color = C.line, dash?: number[]) {
    this.page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: 0.6, color, dashArray: dash })
  }
}

function drawLogo(pen: Pen, x: number, top: number, size: number) {
  const s = size / 64
  const shield = 'M 32 4 L 54 12 V 30 C 54 44 44.5 54.5 32 60 C 19.5 54.5 10 44 10 30 V 12 Z'
  pen.page.drawSvgPath(shield, { x, y: top, scale: s, color: C.emeraldMid })
  pen.page.drawSvgPath('M 32 4 L 54 12 V 30 C 54 44 44.5 54.5 32 60 Z', { x, y: top, scale: s, color: C.blue, opacity: 0.35 })
  const cx = x + 32 * s
  const cy = top - 31 * s
  pen.page.drawCircle({ x: cx, y: cy, size: 11 * s, borderColor: C.white, borderWidth: 3 * s })
  pen.page.drawSvgPath('M 32 24.5 V 31 L 36.5 33.8', { x, y: top, scale: s, borderColor: C.white, borderWidth: 3 * s, borderLineCap: 1 })
  for (const [nx, ny] of [
    [32, 13],
    [18.5, 44],
    [45.5, 44],
  ]) {
    pen.page.drawCircle({ x: x + nx * s, y: top - ny * s, size: 2.6 * s, color: C.white })
  }
}

function drawLock(pen: Pen, x: number, baseline: number) {
  pen.page.drawSvgPath('M 1 5 H 9 V 11 H 1 Z M 3 5 V 3.5 A 2 2 0 0 1 7 3.5 V 5', {
    x,
    y: baseline + 8,
    scale: 0.8,
    borderColor: C.emerald,
    borderWidth: 1.2,
  })
}

function drawGradientBar(page: PDFPage) {
  const steps = 60
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1)
    const color = rgb(
      C.emerald.red + (C.blue.red - C.emerald.red) * t,
      C.emerald.green + (C.blue.green - C.emerald.green) * t,
      C.emerald.blue + (C.blue.blue - C.emerald.blue) * t,
    )
    page.drawRectangle({ x: (W / steps) * i, y: H - 4, width: W / steps + 0.5, height: 4, color })
  }
}

const QR_BOX_W = 96
const QR_SIZE = 70
const QR_CAPTION_SIZE = 7
const QR_CAPTION_CAP = QR_CAPTION_SIZE * 0.7
const QR_GAP = 9
const QR_PAD = 11

/**
 * Vertical layout of the QR panel, in points from the top of the box: the code and its caption sit
 * as one block, centred, with a fixed gap between them. `height` is at least `heroH`.
 */
export function qrPanelLayout(heroH: number) {
  const block = QR_SIZE + QR_GAP + QR_CAPTION_CAP
  const height = Math.max(heroH, block + 2 * QR_PAD)
  const qrTop = (height - block) / 2
  return {
    height,
    qrSize: QR_SIZE,
    qrTop,
    captionBaseline: qrTop + QR_SIZE + QR_GAP + QR_CAPTION_CAP,
    captionCapHeight: QR_CAPTION_CAP,
  }
}

function drawQr(pen: Pen, text: string, x: number, top: number, size: number) {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'M' })
  const n = qr.modules.size
  const cell = size / n
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.modules.get(r, c)) {
        pen.page.drawRectangle({ x: x + c * cell, y: top - (r + 1) * cell, width: cell + 0.05, height: cell + 0.05, color: C.ink })
      }
    }
  }
}

function sectionHeader(pen: Pen, n: number, label: string, x: number, top: number, width: number): number {
  const r = 6
  pen.page.drawCircle({ x: x + r, y: top - r, size: r, color: C.emerald })
  const num = String(n)
  pen.text(num, x + r - pen.width(num, pen.f.sansSemiBold, 6.5) / 2, top - r - 2.3, pen.f.sansSemiBold, 6.5, C.white)
  const upper = label.toUpperCase()
  pen.text(upper, x + 2 * r + 6, top - r - 2.6, pen.f.sansSemiBold, 7.6, C.emerald)
  const after = x + 2 * r + 12 + pen.width(upper, pen.f.sansSemiBold, 7.6)
  if (after < x + width) pen.hline(after, x + width, top - r)
  return top - 2 * r - 6
}

function drawRows(pen: Pen, rows: Row[], x: number, top: number, width: number, labelRatio = 0.38, d = NORMAL): number {
  const size = d.size
  const lead = size * d.lead
  const labelW = width * labelRatio
  const valueW = width - labelW - 6
  let y = top
  for (const row of rows) {
    const valueFace = row.mono ? pen.f.mono : pen.f.sans
    const valueSize = row.mono ? d.mono : size
    const labelLines = pen.wrap(row.label, pen.f.sans, size, labelW - 6)
    const valueText = row.note ? `${row.value} ${row.note}` : row.value
    const valueLines = pen.wrap(valueText, valueFace, valueSize, valueW)
    const h = Math.max(labelLines.length, valueLines.length) * lead + d.pad
    labelLines.forEach((l, i) => pen.page.drawText(l, { x, y: y - 3 - size * 0.8 - i * lead, font: pen.f.sans.pdf, size, color: C.muted }))
    valueLines.forEach((l, i) =>
      pen.page.drawText(l, { x: x + labelW, y: y - 3 - size * 0.8 - i * lead, font: valueFace.pdf, size: valueSize, color: C.ink }),
    )
    y -= h
    pen.hline(x, x + width, y, C.line, [1, 1.5])
  }
  return y
}

function drawPill(pen: Pen, pill: Pill, x: number, baseline: number) {
  const tone =
    pill.tone === 'ok'
      ? { fill: C.emeraldSoft, border: C.emeraldBorder, text: C.emerald }
      : pill.tone === 'warn'
        ? { fill: C.amberSoft, border: C.amberBorder, text: C.amber }
        : { fill: C.soft, border: C.line, text: C.muted }
  const w = pen.width(pill.text, pen.f.sansSemiBold, 7.2) + 12
  pen.roundRect(x, baseline + 8, w, 12, 6, tone.fill, tone.border, 0.6)
  pen.text(pill.text, x + 6, baseline + 0.3, pen.f.sansSemiBold, 7.2, tone.text)
}

function drawFooter(pen: Pen, left: string, pageLabel: string) {
  const y = 34
  pen.hline(M, W - M, y + 12)
  drawLock(pen, M, y)
  pen.text(left, M + 12, y, pen.f.sans, 7, C.ink2)
  pen.textRight(`${APP_URL.replace(/^https:\/\//, '')} · ${pageLabel}`, W - M, y, pen.f.sans, 7, C.muted)
}

/** Draws page 1 and returns the lowest y its content reaches. */
function drawPage1(pen: Pen, c: AttestatoContent, qrUrl: string, d = NORMAL): number {
  const { f } = pen
  drawGradientBar(pen.page)
  let y = H - M + 6

  // Header
  drawLogo(pen, M, y, 30)
  pen.text('ProofMark', M + 38, y - 13, f.sansSemiBold, 14, C.ink)
  pen.text(c.brandCredit, M + 38 + pen.width('ProofMark', f.sansSemiBold, 14) + 6, y - 13, f.sansMedium, 6.5, C.muted)
  pen.text(c.tagline, M + 38, y - 24, f.sans, 6.5, C.muted)
  pen.textRight(c.docLabel, W - M, y - 7, f.sans, 7.5, C.muted)
  pen.textRight(c.id, W - M, y - 18, f.monoMedium, 9, C.ink)
  pen.textRight(c.issued, W - M, y - 28, f.sans, 7.5, C.muted)
  y -= 36
  pen.hline(M, W - M, y)

  // Title
  y -= 12
  y -= pen.para(c.title, M, y, CW, f.serifSemiBold, 20, C.ink, 1.2)
  y -= pen.para(c.subtitle, M, y, CW, f.sans, 9.4, C.ink2) + 8

  // Hero: existence box + QR
  const qrBox = QR_BOX_W
  const heroW = CW - qrBox - 12
  const textX = M + 40
  const heroTextW = heroW - 52
  // An attestation leads with the attested moment, set large; a receipt keeps a heading and text.
  const stamp = c.hero.stamp
  const bodySize = stamp ? 8.6 : 9
  const bodyLead = stamp ? 11.8 : 12.8
  const bodyLines = pen.wrap(c.hero.body, f.sans, bodySize, heroTextW).length
  const STAMP_KICKER = 12
  const STAMP_DATE = 29
  const STAMP_TIME = 18
  const STAMP_GAP = 9
  const textH = stamp
    ? STAMP_KICKER + STAMP_DATE + STAMP_TIME + STAMP_GAP + bodyLines * bodyLead
    : pen.wrap(c.hero.heading, f.sansSemiBold, 10.5, heroTextW).length * 14 + bodyLines * bodyLead
  const heroH = qrPanelLayout(textH + 26).height
  const hero =
    c.tone === 'confirmed'
      ? { fill: C.emeraldSoft, border: C.emeraldBorder, ink: C.emeraldText, icon: C.emerald,
          path: 'M 12 22 C 12 22 20 18 20 12 V 5 L 12 2 L 4 5 V 12 C 4 18 12 22 12 22 Z M 9 12 L 11 14 L 15 10' }
      : { fill: C.amberSoft, border: C.amberBorder, ink: C.amberText, icon: C.amber,
          path: 'M 12 2 A 10 10 0 1 0 12.01 2 Z M 12 6 V 12 L 16 14' }
  pen.roundRect(M, y, heroW, heroH, 6, hero.fill, hero.border)
  if (stamp) {
    let ty = y - (heroH - textH) / 2
    pen.page.drawSvgPath(hero.path, { x: M + 10, y: ty, scale: 1.15, borderColor: hero.icon, borderWidth: 1.8 })
    pen.text(stamp.kicker, textX, ty - 8.5, f.sansMedium, 8.6, hero.ink)
    ty -= STAMP_KICKER
    pen.text(stamp.date, textX, ty - 21.5, f.serifSemiBold, 23, hero.ink)
    ty -= STAMP_DATE
    pen.text(stamp.time, textX, ty - 12, f.monoMedium, 12.5, hero.ink)
    ty -= STAMP_TIME + STAMP_GAP
    pen.para(c.hero.body, textX, ty, heroTextW, f.sans, bodySize, hero.ink, bodyLead / bodySize)
  } else {
    pen.page.drawSvgPath(hero.path, { x: M + 10, y: y - 10, scale: 1.15, borderColor: hero.icon, borderWidth: 1.8 })
    let hy = y - 10
    hy -= pen.para(c.hero.heading, textX, hy, heroTextW, f.sansSemiBold, 10.5, hero.ink, 1.33) + 2
    pen.para(c.hero.body, textX, hy, heroTextW, f.sans, bodySize, hero.ink, bodyLead / bodySize)
  }
  const qx = M + heroW + 12
  pen.roundRect(qx, y, qrBox, heroH, 6, C.white, C.line)
  const qr = qrPanelLayout(heroH)
  drawQr(pen, qrUrl, qx + (qrBox - qr.qrSize) / 2, y - qr.qrTop, qr.qrSize)
  const captionW = pen.width(c.qrCaption, f.sans, QR_CAPTION_SIZE)
  pen.text(c.qrCaption, qx + (qrBox - captionW) / 2, y - qr.captionBaseline, f.sans, QR_CAPTION_SIZE, C.muted)
  y -= heroH + d.gap

  let n = 1
  if (c.declared) {
    y = sectionHeader(pen, n++, c.sections.declared, M, y, CW)
    const boxTop = y
    let by = y - 8
    pen.text(c.declared.tag.toUpperCase(), M + 10, by - 6, f.sans, 6.6, C.muted)
    by = drawRows(pen, c.declared.rows, M + 10, by - 10, CW - 20, undefined, d)
    const bh = boxTop - by + 6
    pen.page.drawRectangle({ x: M, y: boxTop - bh, width: CW, height: bh, borderColor: C.dashed, borderWidth: 0.8, borderDashArray: [3, 2] })
    y = boxTop - bh - d.gap + 2
  }

  y = sectionHeader(pen, n++, c.sections.subject, M, y, CW)
  y = drawRows(pen, c.subject.rows, M, y, CW, undefined, d)
  y -= 6
  const hashH = 26
  pen.roundRect(M, y, CW, hashH, 4, C.soft, C.line)
  pen.page.drawRectangle({ x: M, y: y - hashH, width: 3, height: hashH, color: C.emerald })
  pen.text(c.subject.hash, M + 12, y - 16.5, f.monoMedium, 10.2, C.ink)
  y -= hashH + d.gap

  // Bitcoin anchor
  y = sectionHeader(pen, n++, c.sections.bitcoin, M, y, CW)
  drawPill(pen, c.bitcoin.pill, M, y - 10)
  y = drawRows(pen, c.bitcoin.rows, M, y - 16, CW, 0.3, d)
  if (c.bitcoin.reminder) {
    y -= 6
    const text = `${c.bitcoin.reminder.heading} ${c.bitcoin.reminder.body}`
    const lines = pen.wrap(text, f.sans, 8.4, CW - 20)
    const bh = lines.length * 11.6 + 10
    pen.roundRect(M, y, CW, bh, 5, C.amberSoft, C.amberBorder)
    pen.para(text, M + 10, y - 6, CW - 20, f.sans, 8.4, C.amberText, 1.38)
    y -= bh
  }
  y -= d.gap

  y = sectionHeader(pen, n++, c.sections.statement, M, y, CW)
  const stLines = pen.wrap(c.statement, f.serifSemiBold, 9, CW - 24)
  const stH = stLines.length * 13 + 14
  pen.roundRect(M, y, CW, stH, 6, C.soft)
  pen.para(c.statement, M + 12, y - 8, CW - 24, f.serifSemiBold, 9, C.ink2, 1.45)

  drawFooter(pen, c.footer[0], c.pageLabels[0])
  return y - stH
}

function drawPage2(pen: Pen, c: AttestatoContent) {
  const { f } = pen
  drawGradientBar(pen.page)
  let y = H - M + 6
  pen.text('ProofMark', M, y - 10, f.sansSemiBold, 11, C.ink)
  pen.text(c.brandCredit, M + pen.width('ProofMark', f.sansSemiBold, 11) + 5, y - 10, f.sansMedium, 5.8, C.muted)
  pen.text(`${c.docName.toUpperCase()} ${c.id}`, M, y - 21, f.sans, 6.5, C.muted)
  pen.textRight(c.page2Heading, W - M, y - 10, f.sans, 8, C.muted)
  y -= 30
  pen.hline(M, W - M, y)
  y -= 14

  let n = c.declared ? 5 : 4
  y = sectionHeader(pen, n++, c.sections.verify, M, y, CW)
  y -= pen.para(c.verify.intro, M, y, CW, f.sans, 9, C.ink2) + 4
  for (const step of c.verify.steps) {
    if (step.code) {
      pen.text(step.title, M, y - 8, f.sansSemiBold, 9, C.ink)
      y -= 14
      const lines = step.code.flatMap((l) => pen.wrap(l, f.mono, 7.8, CW - 20).map((w) => ({ w, comment: l.startsWith('#') })))
      const bh = lines.length * 11 + 12
      pen.roundRect(M, y, CW, bh, 5, C.ink)
      lines.forEach((l, i) => pen.text(l.w, M + 10, y - 13 - i * 11, f.mono, 7.8, l.comment ? C.codeComment : C.code))
      y -= bh + 8
    } else if (step.text) {
      const label = `${step.title} `
      pen.text(label, M, y - 8, f.sansSemiBold, 9, C.ink)
      y -= pen.para(step.text, M + pen.width(label, f.sansSemiBold, 9), y, CW - pen.width(label, f.sansSemiBold, 9), f.sans, 9, C.ink2) + 6
    }
  }
  pen.text(c.verify.attachmentsLabel, M, y - 8, f.sans, 8.5, C.ink2)
  y -= 14
  let ax = M
  for (const a of c.verify.attachments) {
    const w = pen.width(a, f.mono, 7.6) + 12
    pen.roundRect(ax, y, w, 14, 3, C.soft, C.line)
    pen.text(a, ax + 6, y - 10, f.mono, 7.6, C.ink)
    ax += w + 6
  }
  y -= 28

  y = sectionHeader(pen, n++, c.sections.warnings, M, y, CW)
  const inner = CW - 24
  const bulletLines = c.warnings.bullets.map((b) => pen.wrap(b, f.sans, 8.6, inner - 10))
  const bodyLines = pen.wrap(c.warnings.body, f.sans, 8.8, inner)
  const wh = 14 + 12.5 + bodyLines.length * 12.5 + bulletLines.reduce((s, l) => s + l.length * 12, 0) + 8
  pen.roundRect(M, y, CW, wh, 6, C.amberSoft, C.amberBorder)
  let wy = y - 9
  pen.text(c.warnings.heading, M + 12, wy - 8, f.sansSemiBold, 9, C.amberText)
  wy -= 13
  wy -= pen.para(c.warnings.body, M + 12, wy, inner, f.sans, 8.8, C.amberText, 1.42) + 3
  bulletLines.forEach((lines) => {
    pen.page.drawCircle({ x: M + 15, y: wy - 5, size: 1.4, color: C.amberText })
    lines.forEach((l, i) => pen.page.drawText(l, { x: M + 22, y: wy - 7 - i * 12, font: f.sans.pdf, size: 8.6, color: C.amberText }))
    wy -= lines.length * 12
  })
  y -= wh + 14

  y = sectionHeader(pen, n++, c.sections.limits, M, y, CW)
  drawRows(pen, c.limits, M, y, CW, 0.26)

  drawFooter(pen, c.footer[1], c.pageLabels[1])
}

export async function renderAttestato(
  cert: Certificate,
  proofs: { ots: Uint8Array },
  opts: { fonts?: FontBytes } = {},
): Promise<PDFDocument> {
  const fontBytes = opts.fonts ?? (await loadFontBytes())
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const faces = {} as Faces
  for (const key of Object.keys(fontBytes) as (keyof FontBytes)[]) {
    const fk = fontkit.create(fontBytes[key] as Uint8Array & Buffer)
    faces[key] = {
      pdf: await doc.embedFont(fontBytes[key], { subset: true }),
      has: (cp) => fk.hasGlyphForCodePoint(cp),
    }
  }

  const lang = certLang(cert)
  const t = messages(lang).pdf
  const json = new TextEncoder().encode(serializeCertificate(cert))
  const names = proofFileNames(cert)
  const files = [
    { name: names.ots, bytes: proofs.ots, mime: 'application/vnd.opentimestamps.v1', description: t.attachments.ots },
    { name: names.json, bytes: json, mime: 'application/json', description: t.attachments.json },
  ]
  const content = buildAttestatoContent(cert, {
    attachments: files.map((x) => ({ name: x.name, size: x.bytes.length })),
  })

  const qrUrl = verifyUrl(cert.file.sha256, lang)
  const fits = drawPage1(new Pen(DRY_PAGE, faces), content, qrUrl) >= CONTENT_FLOOR
  drawPage1(new Pen(doc.addPage([W, H]), faces), content, qrUrl, fits ? NORMAL : DENSE)
  drawPage2(new Pen(doc.addPage([W, H]), faces), content)

  const now = new Date()
  for (const file of files) {
    await doc.attach(new Uint8Array(file.bytes), file.name, {
      mimeType: file.mime,
      description: file.description,
      creationDate: now,
      modificationDate: now,
    })
  }
  doc.setTitle(`${content.title} — ${cert.id}`, { showInWindowTitleBar: true })
  doc.setSubject(t.metaSubject(cert.file.name, cert.file.sha256))
  doc.setAuthor('ProofMark')
  doc.setCreator(`ProofMark v${APP_VERSION}`)
  doc.setProducer(`ProofMark v${APP_VERSION} (pdf-lib)`)
  doc.setKeywords(['ProofMark', 'OpenTimestamps', 'Bitcoin', cert.file.sha256])
  doc.setLanguage(localeOf(lang))
  doc.setCreationDate(now)
  doc.setModificationDate(now)
  return doc
}

/** Reads the files embedded in a PDF's /EmbeddedFiles name tree. */
export async function extractAttachments(pdf: Uint8Array): Promise<Record<string, Bytes>> {
  const doc = await PDFDocument.load(pdf, { updateMetadata: false })
  const out: Record<string, Bytes> = {}
  const names = doc.catalog.lookupMaybe(PDFName.of('Names'), PDFDict)
  const tree = names?.lookupMaybe(PDFName.of('EmbeddedFiles'), PDFDict)
  const walk = (node: PDFDict) => {
    const pairs = node.lookupMaybe(PDFName.of('Names'), PDFArray)
    if (pairs) {
      for (let i = 0; i + 1 < pairs.size(); i += 2) {
        const key = pairs.lookup(i)
        const spec = pairs.lookup(i + 1)
        if (!(spec instanceof PDFDict) || !(key instanceof PDFString || key instanceof PDFHexString)) continue
        const stream = spec.lookupMaybe(PDFName.of('EF'), PDFDict)?.lookup(PDFName.of('F'))
        if (stream instanceof PDFRawStream) out[key.decodeText()] = new Uint8Array(decodePDFRawStream(stream).decode())
      }
    }
    const kids = node.lookupMaybe(PDFName.of('Kids'), PDFArray)
    for (let i = 0; kids && i < kids.size(); i++) {
      const kid = kids.lookup(i)
      if (kid instanceof PDFDict) walk(kid)
    }
  }
  if (tree) walk(tree)
  return out
}
