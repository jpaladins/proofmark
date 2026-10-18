import type { HashWorkerMessage } from './hash.worker'

export type HashProgress = { bytesDone: number; total: number; mbPerSec: number; etaSec: number }

/** Hashes a file in a dedicated Web Worker so the UI stays responsive on multi-GB archives. */
export function hashFile(
  file: File,
  onProgress: (p: HashProgress) => void,
  signal?: AbortSignal,
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'))
    const worker = new Worker(new URL('./hash.worker.ts', import.meta.url), { type: 'module' })
    const started = performance.now()
    const finish = () => {
      worker.terminate()
      signal?.removeEventListener('abort', onAbort)
    }
    const onAbort = () => {
      finish()
      reject(new DOMException('Aborted', 'AbortError'))
    }
    signal?.addEventListener('abort', onAbort)
    worker.onmessage = (event: MessageEvent<HashWorkerMessage>) => {
      const msg = event.data
      if (msg.type === 'progress') {
        const seconds = Math.max((performance.now() - started) / 1000, 0.001)
        const bytesPerSec = msg.bytesDone / seconds
        onProgress({
          bytesDone: msg.bytesDone,
          total: file.size,
          mbPerSec: bytesPerSec / (1024 * 1024),
          etaSec: bytesPerSec > 0 ? (file.size - msg.bytesDone) / bytesPerSec : 0,
        })
      } else if (msg.type === 'done') {
        finish()
        resolve(msg.hex)
      } else {
        finish()
        reject(new Error(msg.message))
      }
    }
    worker.onerror = (event) => {
      finish()
      reject(new Error(event.message || 'Hash worker failed'))
    }
    worker.postMessage({ file })
  })
}
