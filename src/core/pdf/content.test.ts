// @vitest-environment node
import { describe, expect, test } from 'vitest'
import { confirmedCert, pendingCert } from '@/test/certFixtures'
import { buildAttestatoContent, groupHash, type AttestatoContent } from './content'

const ATTACH = [{ name: 'prova.tsr', size: 5999 }]
const allText = (c: AttestatoContent) => JSON.stringify(c)

describe('buildAttestatoContent', () => {
  test('a pending certificate carries the Bitcoin reminder in the box and first in the warnings', () => {
    const c = buildAttestatoContent(pendingCert(), { sealed: true, attachments: ATTACH })
    expect(c.bitcoin.reminder?.body).toContain('proofmark.pages.dev/verifica')
    expect(c.bitcoin.pill).toEqual({ text: 'In attesa di conferma', tone: 'warn' })
    expect(c.bitcoin.rows[0].label).toBe("Stato all'emissione")
    expect(c.warnings.bullets[0]).toContain('attestato aggiornato')
  })

  test('a confirmed revision 2 shows the block and no reminder', () => {
    const c = buildAttestatoContent(confirmedCert(), { sealed: true, attachments: ATTACH })
    expect(c.bitcoin.reminder).toBeUndefined()
    expect(c.bitcoin.pill).toEqual({ text: 'Confermato', tone: 'ok' })
    expect(allText(c)).toContain('358391')
    expect(c.warnings.bullets.join(' ')).not.toContain('attestato aggiornato (rev. 2)')
    expect(c.id).toMatch(/-R2$/)
  })

  test('declared data appears only when provided, labelled as not certified', () => {
    expect(buildAttestatoContent(pendingCert(), { sealed: true, attachments: ATTACH }).declared).toBeUndefined()
    const c = buildAttestatoContent(pendingCert({ author: 'Ada Lovelace' }), { sealed: true, attachments: ATTACH })
    expect(c.declared?.tag).toBe('Dati dichiarati dal richiedente — non verificati né certificati')
    expect(c.declared?.rows).toEqual([{ label: 'Autore', value: 'Ada Lovelace' }])
  })

  test('never uses forbidden legal claims and states the eIDAS limit', () => {
    for (const cert of [pendingCert({ author: 'A', title: 'T' }), confirmedCert()]) {
      const text = allText(buildAttestatoContent(cert, { sealed: false, attachments: ATTACH })).toLowerCase()
      expect(text).not.toContain('marca temporale qualificata')
      expect(text).not.toContain('data certa ai sensi di legge')
      expect(text).toContain('910/2014')
    }
  })

  test('the footer tells the truth about the seal', () => {
    expect(buildAttestatoContent(pendingCert(), { sealed: true, attachments: ATTACH }).footer[0]).toContain(
      'sigillato con marca temporale',
    )
    expect(buildAttestatoContent(pendingCert(), { sealed: false, attachments: ATTACH }).footer[0]).toContain(
      'non sigillato',
    )
  })

  test('verification commands use the real file name and hash', () => {
    const cert = pendingCert()
    const code = buildAttestatoContent(cert, { sealed: true, attachments: ATTACH })
      .verify.steps.flatMap((s) => s.code ?? [])
      .join('\n')
    expect(code).toContain(`certutil -hashfile "${cert.file.name}" SHA256`)
    expect(code).toContain(`-digest ${cert.file.sha256}`)
  })
})

test('groupHash splits a hash into 8-character groups', () => {
  expect(groupHash('0123456789abcdef0123')).toBe('01234567 89abcdef 0123')
})

test('the exact byte count is shown only when the size is abbreviated', () => {
  const c = buildAttestatoContent(pendingCert(), { sealed: true, attachments: ATTACH })
  expect(c.subject.rows[1]).toEqual({ label: 'Dimensione', value: '4 byte' })
})

test('the openssl command reads prova.tsr as a bare token', () => {
  const code = buildAttestatoContent(pendingCert(), { sealed: true, attachments: ATTACH })
    .verify.steps.flatMap((s) => s.code ?? [])
    .join(' ')
  expect(code).toContain('-in prova.tsr -token_in')
})

test('the eIDAS limit is stated about the public TSA service, not about DigiCert as a company', () => {
  const limits = JSON.stringify(buildAttestatoContent(pendingCert(), { sealed: true, attachments: ATTACH }).limits)
  expect(limits).toContain('timestamp.digicert.com')
  expect(limits).not.toContain('che non è un prestatore qualificato')
})
