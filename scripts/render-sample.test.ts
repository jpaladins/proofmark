// @vitest-environment node
// Dev-only: writes sample attestations to out/ for visual review. Run: npx vitest run scripts/render-sample.test.ts
import { mkdirSync, writeFileSync } from 'node:fs'
import { test } from 'vitest'
import { confirmedCert, pendingCert, PENDING_OTS, TSA, testFonts } from '@/test/certFixtures'
import { renderAttestato } from '@/core/pdf/renderAttestato'

test('render samples', async () => {
  mkdirSync('out', { recursive: true })
  const fonts = testFonts()
  const pending = pendingCert({ author: 'Nome Cognome', title: 'Romanzo "Le stagioni del vetro" — manoscritto e illustrazioni' })
  writeFileSync('out/sample-pending.pdf', await (await renderAttestato(pending, { tsr: TSA.token, ots: PENDING_OTS }, { fonts })).save())
  writeFileSync('out/sample-confirmed.pdf', await (await renderAttestato(confirmedCert(), { tsr: TSA.token, ots: PENDING_OTS }, { fonts })).save())
}, 30000)
