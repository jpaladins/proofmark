// @vitest-environment node
// Dev-only: writes sample receipts and attestations (Italian and English) to out/ for visual review.
// Run: PM_SAMPLES=1 npx vitest run scripts
import { mkdirSync, writeFileSync } from 'node:fs'
import { test } from 'vitest'
import { CONFIRMED_OTS, confirmedCert, pendingCert, PENDING_OTS, testFonts, worstCaseCert } from '@/test/certFixtures'
import { renderAttestato } from '@/core/pdf/renderAttestato'

test('render samples', async () => {
  mkdirSync('out', { recursive: true })
  const fonts = testFonts()
  const declared = { author: 'Nome Cognome', title: 'Romanzo "Le stagioni del vetro" — manoscritto e illustrazioni' }
  const declaredEn = { author: 'Jane Doe', title: 'Novel "The Seasons of Glass" — manuscript and illustrations' }
  const save = async (name: string, doc: Awaited<ReturnType<typeof renderAttestato>>) => writeFileSync(`out/${name}`, await doc.save())
  await save('sample-ricevuta.pdf', await renderAttestato(pendingCert(declared), { ots: PENDING_OTS }, { fonts }))
  await save('sample-attestato.pdf', await renderAttestato(confirmedCert(declared), { ots: CONFIRMED_OTS }, { fonts }))
  await save('sample-worst.pdf', await renderAttestato(worstCaseCert(), { ots: PENDING_OTS }, { fonts }))
  const en = { lang: 'en' } as const
  await save('sample-receipt-en.pdf', await renderAttestato(pendingCert(declaredEn, en), { ots: PENDING_OTS }, { fonts }))
  await save('sample-attestation-en.pdf', await renderAttestato(confirmedCert(declaredEn, en), { ots: CONFIRMED_OTS }, { fonts }))
  await save('sample-worst-en.pdf', await renderAttestato(worstCaseCert(en), { ots: PENDING_OTS }, { fonts }))
}, 30000)
