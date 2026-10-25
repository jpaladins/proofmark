import { useCallback, useRef, useState } from 'react'
import { hashFile } from '@/core/hash/hashFile'
import type { Lang } from '@/i18n'
import { stampHash } from '@/core/ots/ots'
import {
  CertifyError,
  runCertification,
  type CertifyDeps,
  type CertifyErrorCode,
  type CertifyResult,
  type StepId,
  type StepState,
} from './certify'

// pdf-lib, fontkit and the fonts are only needed at the last step: load them on demand.
export const defaultCertifyDeps: CertifyDeps = {
  hashFile,
  stampHash: (h, signal) => stampHash(h, { signal }),
  renderAttestato: async (...args) => (await import('@/core/pdf/renderAttestato')).renderAttestato(...args),
}

const IDLE: Record<StepId, StepState> = {
  hash: { status: 'idle' },
  ots: { status: 'idle' },
  cert: { status: 'idle' },
}

type Declared = { author?: string; title?: string }

export function useCertify(deps: CertifyDeps = defaultCertifyDeps) {
  const [steps, setSteps] = useState(IDLE)
  const [result, setResult] = useState<CertifyResult>()
  /** A code, not a text: the page words it in its current language. */
  const [error, setError] = useState<CertifyErrorCode>()
  const [running, setRunning] = useState(false)
  const controller = useRef<AbortController | undefined>(undefined)
  const last = useRef<{ file: File; declared?: Declared; lang: Lang; resume: { sha256?: string } } | undefined>(
    undefined,
  )

  const run = useCallback(
    async (file: File, declared: Declared | undefined, lang: Lang, resume: { sha256?: string }) => {
      controller.current?.abort()
      const ctrl = new AbortController()
      controller.current = ctrl
      last.current = { file, declared, lang, resume }
      setError(undefined)
      setResult(undefined)
      setRunning(true)
      try {
        const res = await runCertification(
          { file, declared, lang },
          deps,
          (id, s) => !ctrl.signal.aborted && setSteps((prev) => ({ ...prev, [id]: s })),
          ctrl.signal,
          resume,
        )
        if (!ctrl.signal.aborted) setResult(res)
      } catch (err) {
        if (ctrl.signal.aborted) return
        if (err instanceof CertifyError) {
          last.current = { file, declared, lang, resume: err.resume }
          setError(err.code)
        } else {
          setError('unexpected')
        }
      } finally {
        if (!ctrl.signal.aborted) setRunning(false)
      }
    },
    [deps],
  )

  const start = useCallback(
    (file: File, declared: Declared | undefined, lang: Lang) => {
      setSteps(IDLE)
      void run(file, declared, lang, {})
    },
    [run],
  )

  /** Retries in `lang` (the page's current language), or in the language of the failed run. */
  const retry = useCallback(
    (lang?: Lang) => {
      if (last.current) void run(last.current.file, last.current.declared, lang ?? last.current.lang, last.current.resume)
    },
    [run],
  )

  const reset = useCallback(() => {
    controller.current?.abort()
    last.current = undefined
    setSteps(IDLE)
    setResult(undefined)
    setError(undefined)
    setRunning(false)
  }, [])

  return { steps, result, error, running, start, retry, reset }
}
