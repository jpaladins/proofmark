import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildCertificate, DECLARED_MAX, upgradeCertificate, type Certificate } from '@/core/cert/certificate'
import { inspectOts } from '@/core/ots/ots'
import type { FontBytes } from '@/core/pdf/fonts'
import { parseTimeStampResp } from '@/core/tsa/rfc3161'
import { fixture, fixtureText } from './fixtures'

export const TSA = parseTimeStampResp(fixture('data.tsr'))
export const PENDING_OTS = fixture('incomplete.txt.ots')

export function pendingCert(declared?: { author?: string; title?: string }): Certificate {
  const file = new File([new Uint8Array([0x50, 0x4b, 3, 4])], 'le-stagioni-del-vetro_v3.zip', {
    lastModified: Date.UTC(2026, 9, 16, 21, 41),
  })
  return buildCertificate({
    file,
    sha256: fixtureText('data.sha256'),
    tsa: TSA,
    ots: PENDING_OTS,
    otsInfo: inspectOts(PENDING_OTS),
    declared,
  })
}

/** Longest inputs the app accepts: a 255-character file name and both declared fields at DECLARED_MAX, in wide glyphs. */
export function worstCaseCert(): Certificate {
  const name = `${'WM'.repeat(125)}W.zip`
  const file = new File([new Uint8Array([0x50, 0x4b, 3, 4])], name, { lastModified: Date.UTC(2026, 9, 16, 21, 41) })
  const field = (word: string) => Array.from({ length: 20 }, () => word).join(' ').slice(0, DECLARED_MAX)
  return buildCertificate({
    file,
    sha256: fixtureText('data.sha256'),
    tsa: TSA,
    ots: PENDING_OTS,
    otsInfo: inspectOts(PENDING_OTS),
    declared: { author: field('WWWWW'), title: field('MMMMM') },
  })
}

export function confirmedCert(): Certificate {
  return upgradeCertificate(pendingCert(), fixture('hello-world.txt.ots'), {
    block: 358391,
    blockTime: new Date(1432827678000),
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
