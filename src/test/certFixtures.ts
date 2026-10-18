import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildCertificate, confirmCertificate, DECLARED_MAX, type Certificate } from '@/core/cert/certificate'
import { inspectOts } from '@/core/ots/ots'
import type { FontBytes } from '@/core/pdf/fonts'
import { fixture } from './fixtures'

const sha256Of = (name: string) => createHash('sha256').update(fixture(name)).digest('hex')

/** incomplete.txt.ots is a pending OpenTimestamps proof for incomplete.txt (official example). */
export const PENDING_HASH = sha256Of('incomplete.txt')
export const PENDING_OTS = fixture('incomplete.txt.ots')
/** hello-world.txt.ots is confirmed in Bitcoin block 358391 (official example). */
export const CONFIRMED_HASH = sha256Of('hello-world.txt')
export const CONFIRMED_OTS = fixture('hello-world.txt.ots')
export const BLOCK_358391 = { block: 358391, blockTime: new Date(1432827678000) }
export const REQUESTED_AT = new Date('2026-10-18T10:32:15Z')

const zip = (name: string) =>
  new File([new Uint8Array([0x50, 0x4b, 3, 4])], name, { lastModified: Date.UTC(2026, 9, 16, 21, 41) })

export function pendingCert(declared?: { author?: string; title?: string }): Certificate {
  return buildCertificate({
    file: zip('le-stagioni-del-vetro_v3.zip'),
    sha256: PENDING_HASH,
    ots: PENDING_OTS,
    otsInfo: inspectOts(PENDING_OTS),
    requestedAt: REQUESTED_AT,
    declared,
  })
}

/** A receipt for hello-world.txt, then confirmed into an attestation for block 358391. */
export function confirmedCert(declared?: { author?: string; title?: string }): Certificate {
  const receipt = buildCertificate({
    file: zip('hello-world.zip'),
    sha256: CONFIRMED_HASH,
    ots: CONFIRMED_OTS,
    otsInfo: { ...inspectOts(CONFIRMED_OTS), status: 'pending' },
    requestedAt: REQUESTED_AT,
    declared,
  })
  return confirmCertificate(receipt, CONFIRMED_OTS, BLOCK_358391)
}

/** Longest inputs the app accepts: a 255-character file name and both declared fields at DECLARED_MAX, in wide glyphs. */
export function worstCaseCert(): Certificate {
  const field = (word: string) => Array.from({ length: 20 }, () => word).join(' ').slice(0, DECLARED_MAX)
  return buildCertificate({
    file: zip(`${'WM'.repeat(125)}W.zip`),
    sha256: PENDING_HASH,
    ots: PENDING_OTS,
    otsInfo: inspectOts(PENDING_OTS),
    requestedAt: REQUESTED_AT,
    declared: { author: field('WWWWW'), title: field('MMMMM') },
  })
}

export function testFonts(): FontBytes {
  const dir = join(process.cwd(), 'src', 'assets', 'fonts', 'pdf')
  const f = (n: string) => new Uint8Array(readFileSync(join(dir, n)))
  return {
    sans: f('IBMPlexSans-Regular.ttf'),
    sansMedium: f('IBMPlexSans-Medium.ttf'),
    sansSemiBold: f('IBMPlexSans-SemiBold.ttf'),
    serifSemiBold: f('IBMPlexSerif-SemiBold.ttf'),
    mono: f('IBMPlexMono-Regular.ttf'),
    monoMedium: f('IBMPlexMono-Medium.ttf'),
  }
}
