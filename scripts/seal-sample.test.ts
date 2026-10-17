// @vitest-environment node
// Dev-only: seals a sample attestation with the live DigiCert TSA and checks it.
// Run: PM_SAMPLES=1 npx vitest run scripts/seal-sample
import { mkdirSync, writeFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { pendingCert, PENDING_OTS, TSA, testFonts } from '@/test/certFixtures'
import { renderAttestato } from '@/core/pdf/renderAttestato'
import { sealPdf, verifyPdfSeal } from '@/core/pdf/pades'
import { requestTimestamp } from '@/core/tsa/client'

test('seal sample with DigiCert', async () => {
  mkdirSync('out', { recursive: true })
  const cert = pendingCert({ author: 'Nome Cognome', title: 'Opera di prova' })
  const doc = await renderAttestato(cert, { tsr: TSA.token, ots: PENDING_OTS }, { fonts: testFonts() })
  const pdf = await sealPdf(doc, (h) => requestTimestamp(h, { endpoint: 'http://timestamp.digicert.com' }))
  writeFileSync('out/sample-sealed.pdf', pdf)
  const check = await verifyPdfSeal(pdf)
  writeFileSync('out/sample-sealed.check.json', JSON.stringify(check, null, 2))
  expect(check.status).toBe('ok')
}, 60_000)
