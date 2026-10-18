// @vitest-environment node
import { describe, expect, test, vi } from 'vitest'
import type { PDFDocument } from 'pdf-lib'
import { CONFIRMED_OTS, PENDING_HASH, PENDING_OTS } from '@/test/certFixtures'
import { OtsError } from '@/core/ots/format'
import { REMINDER_DELAY_MS, runCertification, type CertifyDeps, type StepId, type StepState } from './certify'

const zip = () => new File([new Uint8Array([0x50, 0x4b, 3, 4])], 'opera.zip')

function fakeDeps(over: Partial<CertifyDeps> = {}): CertifyDeps {
  const doc = { save: vi.fn(async () => new Uint8Array([9, 9, 9])) } as unknown as PDFDocument
  return {
    hashFile: vi.fn(async (_f, onProgress) => {
      onProgress({ bytesDone: 4, total: 4, mbPerSec: 100, etaSec: 0 })
      return PENDING_HASH
    }),
    stampHash: vi.fn(async () => PENDING_OTS),
    renderAttestato: vi.fn(async () => doc),
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
  test('runs hash → Bitcoin → receipt and returns the receipt with its proof', async () => {
    const rec = recorder()
    const before = Date.now()
    const res = await runCertification({ file: zip(), declared: { author: 'Ada' } }, fakeDeps(), rec.onStep)
    expect(rec.log.filter(([, s]) => s === 'done').map(([id]) => id)).toEqual(['hash', 'ots', 'cert'])
    expect(res.certificate.kind).toBe('ricevuta')
    expect(res.certificate.declared?.author).toBe('Ada')
    expect(res.pdf).toEqual(new Uint8Array([9, 9, 9]))
    expect(res.ots).toEqual(PENDING_OTS)
    expect(JSON.parse(res.json).id).toBe(res.certificate.id)
    const requested = new Date(res.certificate.requestedAt).getTime()
    expect(requested).toBeGreaterThanOrEqual(before - 1000)
    expect(res.reminderAfter.getTime()).toBe(requested + REMINDER_DELAY_MS)
  })

  test('stops with a retry message and no receipt when no calendar answers', async () => {
    const rec = recorder()
    const deps = fakeDeps({ stampHash: vi.fn(async () => Promise.reject(new OtsError('network', 'x'))) })
    await expect(runCertification({ file: zip() }, deps, rec.onStep)).rejects.toMatchObject({
      step: 'ots',
      resume: { sha256: PENDING_HASH },
    })
    expect(rec.last.ots).toMatchObject({
      status: 'error',
      message: 'Impossibile raggiungere i calendari Bitcoin. Controlla la connessione e riprova.',
    })
    expect(rec.last.cert).toBeUndefined()
    expect(deps.renderAttestato).not.toHaveBeenCalled()
  })

  test('rejects a proof that does not commit to the archive hash', async () => {
    const rec = recorder()
    const deps = fakeDeps({ stampHash: vi.fn(async () => CONFIRMED_OTS) })
    await expect(runCertification({ file: zip() }, deps, rec.onStep)).rejects.toMatchObject({ step: 'ots' })
    expect(rec.last.ots?.status).toBe('error')
    expect(deps.renderAttestato).not.toHaveBeenCalled()
  })

  test('reports a PDF failure as a retryable error on the last step', async () => {
    const rec = recorder()
    const deps = fakeDeps({ renderAttestato: vi.fn(async () => Promise.reject(new Error('font'))) })
    await expect(runCertification({ file: zip() }, deps, rec.onStep)).rejects.toMatchObject({ step: 'cert' })
    expect(rec.last.cert).toMatchObject({ status: 'error', message: 'Impossibile generare la ricevuta PDF. Riprova.' })
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
    expect(deps.stampHash).not.toHaveBeenCalled()
  })

  test('resuming with a known hash skips hashing', async () => {
    const deps = fakeDeps()
    await runCertification({ file: zip() }, deps, () => {}, undefined, { sha256: PENDING_HASH })
    expect(deps.hashFile).not.toHaveBeenCalled()
  })
})
