// @vitest-environment node
import { describe, expect, test } from 'vitest'
import { confirmedCert, pendingCert } from '@/test/certFixtures'
import { buildAttestatoContent, groupHash, type AttestatoContent } from './content'

const ATTACH = [{ name: 'prova.ots', size: 1032 }]
const allText = (c: AttestatoContent) => JSON.stringify(c)
const receipt = (declared?: { author?: string; title?: string }) =>
  buildAttestatoContent(pendingCert(declared), { attachments: ATTACH })
const attestation = () => buildAttestatoContent(confirmedCert(), { attachments: ATTACH })

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
    expect(c.bitcoin.reminder?.body).toContain('jpaladins.github.io/proofmark/verifica')
    expect(c.bitcoin.pill).toEqual({ text: 'In attesa di conferma', tone: 'warn' })
    expect(c.warnings.bullets[0]).toContain("scarica l'attestato")
  })

  test('tells the user to upgrade the proof before verifying it', () => {
    const code = receipt().verify.steps.flatMap((s) => s.code ?? []).join(' ')
    expect(code).toContain('ots upgrade prova.ots')
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
    expect(receipt().footer[0]).toContain('prova.ots')
  })

  test('verification commands use the real file name', () => {
    const cert = pendingCert()
    const code = buildAttestatoContent(cert, { attachments: ATTACH })
      .verify.steps.flatMap((s) => s.code ?? [])
      .join('\n')
    expect(code).toContain(`certutil -hashfile "${cert.file.name}" SHA256`)
    expect(code).toContain(`ots verify prova.ots -f "${cert.file.name}"`)
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
      time: '15:41:18 UTC',
      note: '17:41:18 ora italiana',
    })
  })

  test('the receipt highlights no date', () => {
    expect(receipt().hero.stamp).toBeUndefined()
  })
})
