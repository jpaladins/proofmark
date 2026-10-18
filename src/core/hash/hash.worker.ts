/// <reference lib="webworker" />
import { sha256Stream } from './sha256'

export type HashWorkerRequest = { file: File }
export type HashWorkerMessage =
  | { type: 'progress'; bytesDone: number }
  | { type: 'done'; hex: string }
  | { type: 'error'; message: string }

const post = (msg: HashWorkerMessage) => self.postMessage(msg)

self.onmessage = async (event: MessageEvent<HashWorkerRequest>) => {
  let last = 0
  try {
    const hex = await sha256Stream(event.data.file, (bytesDone) => {
      const now = performance.now()
      if (now - last >= 100) {
        last = now
        post({ type: 'progress', bytesDone })
      }
    })
    post({ type: 'progress', bytesDone: event.data.file.size })
    post({ type: 'done', hex })
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}
