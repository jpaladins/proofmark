// @vitest-environment node
import { describe, expect, test } from 'vitest'
import { confirmedCert, pendingCert } from '@/test/certFixtures'
import { buildAttestatoContent, groupHash, type AttestatoContent } from './content'

const ATTACH = [{ name: 'le-stagioni-del-vetro_v3.ots', size: 1032 }]
const allText = (c: AttestatoContent) => JSON.stringify(c)
// Times follow the device's time zone; tests pin one so they pass on any machine (CI runs in UTC).
const TZ = 'Europe/Rome'
const receipt = (declared?: { author?: string; title?: string }) =>
  buildAttestatoContent(pendingCert(declared), { attachments: ATTACH, timeZone: TZ })
const attestation = (timeZone = TZ) => buildAttestatoContent(confirmedCert(), { attachments: ATTACH, timeZone })

describe('receipt (ricevuta)', () => {
  test('is titled as a receipt and never claims an attested date', () => {
    const c = receipt()
    expect(c.title).toBe('Ricevuta di registrazione')
    expect(c.docLabel).toBe('Ricevuta n.')
    expect(c.tone).toBe('pending')
    expect(c.hero.heading).toBe('Registrazione inviata: la data non è ancora attestata')
    expect(allText(c)).not.toMatch(/Esistenza attestata/)
  })

  test('shows the request time as declared by the device, not certified', () => {
    const row = receipt().bitcoin.rows.find((r) => r.label === 'Richiesta inviata il')
    expect(row?.note).toBe('(orologio del dispositivo, non certificato)')
  })

  test('carries the reminder in the Bitcoin box and first in the warnings', () => {
    const c = receipt()
    expect(c.bitcoin.reminder?.body).toContain('jpaladins.github.io/proofmark/it/verifica')
    expect(c.bitcoin.pill).toEqual({ text: 'In attesa di conferma', tone: 'warn' })
    expect(c.warnings.bullets[0]).toContain("scarica l'attestato")
  })

  test('tells the user to upgrade the proof before verifying it', () => {
    const code = receipt().verify.steps.flatMap((s) => s.code ?? []).join(' ')
    expect(code).toContain('ots upgrade "le-stagioni-del-vetro_v3.ots"')
  })
})

describe('attestation (attestato)', () => {
  test('attests existence at the time of the Bitcoin block', () => {
    const c = attestation()
    expect(c.title).toBe('Attestato di Esistenza Digitale')
    expect(c.docLabel).toBe('Attestato n.')
    expect(c.tone).toBe('confirmed')
    expect(c.hero.heading).toBe('Esistenza attestata al 28 maggio 2015, 15:41:18 UTC')
    expect(c.hero.body).toContain('blocco Bitcoin #358391')
    expect(c.bitcoin.pill).toEqual({ text: 'Confermato', tone: 'ok' })
    expect(c.bitcoin.reminder).toBeUndefined()
  })

  test('states the precision of the block time', () => {
    expect(attestation().bitcoin.rows.find((r) => r.label === 'Precisione')?.value).toContain('due ore')
  })

  test('drops the reminder from the warnings', () => {
    expect(attestation().warnings.bullets.join(' ')).not.toContain('torna su')
  })
})

describe('both documents', () => {
  test('declared data appears only when provided, labelled as not certified', () => {
    expect(receipt().declared).toBeUndefined()
    const c = receipt({ author: 'Ada Lovelace' })
    expect(c.declared?.tag).toBe('Dati dichiarati dal richiedente — non verificati né certificati')
    expect(c.declared?.rows).toEqual([{ label: 'Autore', value: 'Ada Lovelace' }])
  })

  test('never use forbidden legal claims, never mention DigiCert, and state the eIDAS limit', () => {
    for (const c of [receipt({ author: 'A', title: 'T' }), attestation()]) {
      const text = allText(c).toLowerCase()
      expect(text).not.toContain('marca temporale qualificata')
      expect(text).not.toContain('data certa ai sensi di legge')
      expect(text).not.toContain('digicert')
      expect(text).not.toContain('rfc 3161')
      expect(text).toContain('910/2014')
    }
  })

  test('the footer points to the attached OpenTimestamps proof', () => {
    expect(receipt().footer[0]).toContain('file .ots allegato')
  })

  test('verification commands use the real file name', () => {
    const cert = pendingCert()
    const code = buildAttestatoContent(cert, { attachments: ATTACH })
      .verify.steps.flatMap((s) => s.code ?? [])
      .join('\n')
    expect(code).toContain(`certutil -hashfile "${cert.file.name}" SHA256`)
    expect(code).toContain(`ots verify "le-stagioni-del-vetro_v3.ots" -f "${cert.file.name}"`)
  })

  test('the exact byte count is shown only when the size is abbreviated', () => {
    expect(receipt().subject.rows[1]).toEqual({ label: 'Dimensione', value: '4 byte' })
  })
})

test('groupHash splits a hash into 8-character groups', () => {
  expect(groupHash('0123456789abcdef0123')).toBe('01234567 89abcdef 0123')
})

test('the brand line credits the developer in small capitals', () => {
  expect(receipt().brandCredit).toBe('BY JPALADINS')
  expect(attestation().brandCredit).toBe('BY JPALADINS')
})

describe('hero date of the attestation', () => {
  test('splits the attested moment into a prominent date and time', () => {
    expect(attestation().hero.stamp).toEqual({
      kicker: 'Esistenza attestata al',
      date: '28 maggio 2015',
      time: '17:41:18 UTC+2',
    })
  })

  test('the receipt highlights no date', () => {
    expect(receipt().hero.stamp).toBeUndefined()
  })
})

describe('local time zone instead of a fixed Italian time', () => {
  test('the attested moment is shown once, in the device time zone with its UTC offset', () => {
    expect(attestation('America/New_York').hero.stamp?.time).toBe('11:41:18 UTC-4')
    expect(attestation('Asia/Kolkata').hero.stamp?.time).toBe('21:11:18 UTC+5:30')
    expect(attestation('UTC').hero.stamp?.time).toBe('15:41:18 UTC')
  })

  test('the large date follows the same time zone as the time', () => {
    // 15:41 UTC is already 05:41 of the next day at UTC+14.
    expect(attestation('Pacific/Kiritimati').hero.stamp).toMatchObject({ date: '29 maggio 2015', time: '05:41:18 UTC+14' })
  })

  test('issue date, request time and block time carry the offset', () => {
    const c = attestation()
    expect(c.issued).toMatch(/\(UTC\+[12]\)$/)
    expect(c.bitcoin.rows.find((r) => r.label === 'Data del blocco')?.note).toBe('(17:41:18 UTC+2)')
    expect(c.bitcoin.rows.find((r) => r.label === 'Richiesta inviata il')?.value).toBe('18/10/2026 alle 12:32:15 UTC+2')
  })

  test('never mentions a fixed Italian time zone', () => {
    for (const c of [receipt(), attestation(), attestation('America/New_York')]) {
      const text = allText(c)
      expect(text).not.toContain('ora italiana')
      expect(text).not.toContain('Europe/Rome')
    }
  })
})

describe('file names match the downloaded files', () => {
  test('commands, warnings and footer use the archive-based names', () => {
    const cert = pendingCert()
    const c = buildAttestatoContent(cert, { attachments: ATTACH, timeZone: TZ })
    const code = c.verify.steps.flatMap((s) => s.code ?? []).join(' ')
    expect(code).toContain('ots upgrade "le-stagioni-del-vetro_v3.ots"')
    expect(code).toContain(`ots verify "le-stagioni-del-vetro_v3.ots" -f "${cert.file.name}"`)
    expect(c.verify.attachments[0]).toContain('le-stagioni-del-vetro_v3.ots')
    expect(c.warnings.bullets.join(' ')).toContain("file .ots con lo stesso nome dell'archivio")
  })

  test('the old generic names no longer appear', () => {
    for (const c of [receipt(), attestation()]) {
      const text = allText(c)
      expect(text).not.toContain('prova.ots')
      expect(text).not.toContain('certificato.json')
    }
  })
})

describe('English documents', () => {
  const receiptEn = (declared?: { author?: string; title?: string }) =>
    buildAttestatoContent(pendingCert(declared, { lang: 'en' }), { attachments: ATTACH, timeZone: TZ })
  const attestationEn = (timeZone = TZ) =>
    buildAttestatoContent(confirmedCert(undefined, { lang: 'en' }), { attachments: ATTACH, timeZone })

  test('the receipt is titled as a receipt and never claims an attested date', () => {
    const c = receiptEn()
    expect(c.title).toBe('Registration receipt')
    expect(c.docLabel).toBe('Receipt no.')
    expect(c.tone).toBe('pending')
    expect(c.hero.heading).toBe('Registration sent: the date is not attested yet')
    expect(c.hero.stamp).toBeUndefined()
    expect(allText(c)).not.toMatch(/Existence attested/)
  })

  test('the receipt reminder points to the English Verify page', () => {
    const c = receiptEn()
    expect(c.bitcoin.reminder?.body).toContain('jpaladins.github.io/proofmark/verify')
    expect(c.bitcoin.reminder?.body).not.toContain('verifica')
    expect(c.warnings.bullets[0]).toContain('jpaladins.github.io/proofmark/verify')
  })

  test('the attestation attests existence at the time of the Bitcoin block, in en-GB dates', () => {
    const c = attestationEn()
    expect(c.title).toBe('Certificate of Digital Existence')
    expect(c.docLabel).toBe('Attestation no.')
    expect(c.tone).toBe('confirmed')
    expect(c.hero.heading).toBe('Existence attested on 28 May 2015, 15:41:18 UTC')
    expect(c.hero.body).toContain('Bitcoin block #358391')
    expect(c.hero.stamp).toEqual({ kicker: 'Existence attested on', date: '28 May 2015', time: '17:41:18 UTC+2' })
    expect(c.bitcoin.reminder).toBeUndefined()
  })

  test('the tagline, page footers and the page-2 heading are in English', () => {
    expect(receiptEn().tagline).toBe('DIGITAL PROOF OF EXISTENCE')
    expect(receipt().tagline).toBe('PROVA DI ESISTENZA DIGITALE')
    expect([receiptEn().docName, attestationEn().docName]).toEqual(['receipt', 'attestation'])
    expect([receipt().docName, attestation().docName]).toEqual(['ricevuta', 'attestato'])
    expect(receiptEn().pageLabels).toEqual(['Page 1 of 2', 'Page 2 of 2'])
    expect(receiptEn().page2Heading).toBe('Verification instructions and warnings')
  })

  test('the brand credit is the same in both languages', () => {
    expect(receiptEn().brandCredit).toBe('BY JPALADINS')
    expect(attestationEn().brandCredit).toBe('BY JPALADINS')
  })

  test('verification commands use the real file names', () => {
    const code = receiptEn().verify.steps.flatMap((s) => s.code ?? []).join('\n')
    expect(code).toContain('certutil -hashfile "le-stagioni-del-vetro_v3.zip" SHA256')
    expect(code).toContain('ots upgrade "le-stagioni-del-vetro_v3.ots"')
    expect(code).toContain('ots verify "le-stagioni-del-vetro_v3.ots" -f "le-stagioni-del-vetro_v3.zip"')
  })

  test('byte sizes use English units', () => {
    expect(receiptEn().subject.rows[1]).toEqual({ label: 'Size', value: '4 bytes' })
    expect(receiptEn().verify.attachments[0]).toBe('le-stagioni-del-vetro_v3.ots · 1 KB')
  })

  test('declared data keeps its labels in English', () => {
    expect(receiptEn({ author: 'Ada Lovelace' }).declared?.rows).toEqual([{ label: 'Author', value: 'Ada Lovelace' }])
  })

  test('keeps the eIDAS limit and never makes forbidden legal claims', () => {
    for (const c of [receiptEn({ author: 'A', title: 'T' }), attestationEn()]) {
      const text = allText(c).toLowerCase()
      expect(text).toContain('910/2014')
      expect(text).not.toContain('qualified timestamp')
      expect(text).not.toContain('legally certain date')
      expect(text).not.toContain('digicert')
      expect(text).not.toContain('rfc 3161')
    }
  })

  test('has no Italian left', () => {
    const italian = /\b(della|degli|archivio|ricevuta|attestato|dichiarati|blocco|impronta|alle)\b/i
    for (const c of [receiptEn({ author: 'A', title: 'T' }), attestationEn(), attestationEn('UTC')]) {
      expect(allText(c)).not.toMatch(italian)
    }
  })
})

test('a certificate without lang renders in Italian', () => {
  expect(buildAttestatoContent(pendingCert(), { attachments: ATTACH, timeZone: TZ }).title).toBe('Ricevuta di registrazione')
})
