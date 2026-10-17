// @vitest-environment node
import { describe, expect, test, vi } from 'vitest'
import type { PDFDocument } from 'pdf-lib'
import { fixture, fixtureText } from '@/test/fixtures'
import { TSA } from '@/test/certFixtures'
import { TsaError } from '@/core/tsa/rfc3161'
import { OtsError } from '@/core/ots/format'
import { runCertification, type CertifyDeps, type StepId, type StepState } from './certify'

const HASH = fixtureText('data.sha256')
const zip = () => new File([new Uint8Array([0x50, 0x4b, 3, 4])], 'opera.zip')

function fakeDeps(over: Partial<CertifyDeps> = {}): CertifyDeps {
  const doc = { save: vi.fn(async () => new Uint8Array([1, 2, 3])) } as unknown as PDFDocument
  return {
    hashFile: vi.fn(async (_f, onProgress) => {
      onProgress({ bytesDone: 4, total: 4, mbPerSec: 100, etaSec: 0 })
      return HASH
    }),
    requestTimestamp: vi.fn(async () => TSA),
    stampHash: vi.fn(async () => fixture('incomplete.txt.ots')),
    renderAttestato: vi.fn(async () => doc),
    sealPdf: vi.fn(async () => new Uint8Array([9, 9, 9])),
    ...over,
  }
}

function recorder() {
  const log: [StepId, StepState['status']][] = []
  const last: Partial<Record<StepId, StepState>> = {}
  return {
    log,
    last,
    onStep: (id: StepId, s: StepState) => {
      log.push([id, s.status])
      last[id] = s
    },
  }
}

describe('runCertification', () => {
  test('runs hash → DigiCert → Bitcoin → certificate and returns sealed outputs', async () => {
    const rec = recorder()
    const res = await runCertification({ file: zip(), declared: { author: 'Ada' } }, fakeDeps(), rec.onStep)
    const done = rec.log.filter(([, s]) => s === 'done').map(([id]) => id)
    expect(done).toEqual(['hash', 'tsa', 'ots', 'cert'])
    expect(res.pdfSealed).toBe(true)
    expect(res.pdf).toEqual(new Uint8Array([9, 9, 9]))
    expect(res.certificate.declared?.author).toBe('Ada')
    expect(JSON.parse(res.json).id).toBe(res.certificate.id)
    expect(res.reminderAfter?.getTime()).toBe(TSA.info.genTime.getTime() + 3 * 3600_000)
  })

  test('stops with a retry message and no certificate when DigiCert times out', async () => {
    const rec = recorder()
    const deps = fakeDeps({ requestTimestamp: vi.fn(async () => Promise.reject(new TsaError('timeout', 'x'))) })
    await expect(runCertification({ file: zip() }, deps, rec.onStep)).rejects.toMatchObject({ step: 'tsa' })
    expect(rec.last.tsa).toMatchObject({ status: 'error', message: 'DigiCert non risponde. Riprova tra qualche istante.' })
    expect(rec.last.ots).toBeUndefined()
    expect(rec.last.cert).toBeUndefined()
    expect(deps.renderAttestato).not.toHaveBeenCalled()
  })

  test('still produces a certificate when OpenTimestamps is unavailable', async () => {
    const rec = recorder()
    const deps = fakeDeps({ stampHash: vi.fn(async () => Promise.reject(new OtsError('network', 'x'))) })
    const res = await runCertification({ file: zip() }, deps, rec.onStep)
    expect(rec.last.ots).toMatchObject({
      status: 'warn',
      message: 'Ancoraggio Bitcoin non disponibile: potrai aggiungerlo dalla sezione Verifica',
    })
    expect(res.certificate.opentimestamps.status).toBe('unavailable')
    expect(res.ots).toBeUndefined()
    expect(res.reminderAfter).toBeUndefined()
  })

  test('falls back to an unsealed PDF when the seal fails', async () => {
    const rec = recorder()
    const deps = fakeDeps({ sealPdf: vi.fn(async () => Promise.reject(new TsaError('network', 'x'))) })
    const res = await runCertification({ file: zip() }, deps, rec.onStep)
    expect(rec.last.cert?.status).toBe('warn')
    expect(res.pdfSealed).toBe(false)
    expect(res.pdf).toEqual(new Uint8Array([1, 2, 3]))
    expect(deps.renderAttestato).toHaveBeenLastCalledWith(expect.anything(), expect.anything(), { sealed: false })
  })

  test('aborting during hashing rejects with AbortError and calls nothing else', async () => {
    const controller = new AbortController()
    const deps = fakeDeps({
      hashFile: vi.fn(async () => {
        controller.abort()
        throw new DOMException('Aborted', 'AbortError')
      }),
    })
    await expect(runCertification({ file: zip() }, deps, () => {}, controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    })
    expect(deps.requestTimestamp).not.toHaveBeenCalled()
  })

  test('resuming with a known hash skips hashing', async () => {
    const deps = fakeDeps()
    await runCertification({ file: zip() }, deps, () => {}, undefined, { sha256: HASH })
    expect(deps.hashFile).not.toHaveBeenCalled()
  })
})

test('rejects a DigiCert token whose signature does not verify', async () => {
  const token = new Uint8Array(TSA.token)
  token[token.length - 5] ^= 0x01
  const rec = recorder()
  const deps = fakeDeps({ requestTimestamp: vi.fn(async () => ({ ...TSA, token })) })
  await expect(runCertification({ file: zip() }, deps, rec.onStep)).rejects.toMatchObject({ step: 'tsa' })
  expect(rec.last.tsa).toMatchObject({ status: 'error', message: 'Risposta di DigiCert non valida. Riprova tra qualche istante.' })
  expect(deps.renderAttestato).not.toHaveBeenCalled()
})
