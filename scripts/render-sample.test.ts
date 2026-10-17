// @vitest-environment node
// Dev-only: writes sample attestations to out/ for visual review. Run: npx vitest run scripts/render-sample.test.ts
import { mkdirSync, writeFileSync } from 'node:fs'
import { test } from 'vitest'
import { confirmedCert, pendingCert, PENDING_OTS, TSA, testFonts, worstCaseCert } from '@/test/certFixtures'
import { renderAttestato } from '@/core/pdf/renderAttestato'

test('render samples', async () => {
  mkdirSync('out', { recursive: true })
  const fonts = testFonts()
  const pending = pendingCert({ author: 'Nome Cognome', title: 'Romanzo "Le stagioni del vetro" — manoscritto e illustrazioni' })
  writeFileSync('out/sample-pending.pdf', await (await renderAttestato(pending, { tsr: TSA.token, ots: PENDING_OTS }, { fonts })).save())
  const worst = { tsr: TSA.token, ots: PENDING_OTS }
  writeFileSync('out/sample-worst-case.pdf', await (await renderAttestato(worstCaseCert(), worst, { fonts })).save())
  writeFileSync('out/sample-worst-case-unsealed.pdf', await (await renderAttestato(worstCaseCert(), worst, { fonts, sealed: false })).save())
  writeFileSync('out/sample-confirmed.pdf', await (await renderAttestato(confirmedCert(), { tsr: TSA.token, ots: PENDING_OTS }, { fonts })).save())
}, 30000)
