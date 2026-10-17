import { createSHA256 } from 'hash-wasm'

/** Byte arrays backed by a plain ArrayBuffer (what WebCrypto and pkijs accept). */
export type Bytes = Uint8Array<ArrayBuffer>

export const DEFAULT_CHUNK_SIZE = 16 * 1024 * 1024

/** Streams a Blob through SHA-256 chunk by chunk; memory use is bounded by chunkSize. */
export async function sha256Stream(
  blob: Blob,
  onProgress?: (bytesDone: number) => void,
  chunkSize = DEFAULT_CHUNK_SIZE,
): Promise<string> {
  const hasher = await createSHA256()
  hasher.init()
  for (let offset = 0; offset < blob.size; offset += chunkSize) {
    const chunk = await blob.slice(offset, offset + chunkSize).arrayBuffer()
    hasher.update(new Uint8Array(chunk))
    onProgress?.(Math.min(offset + chunkSize, blob.size))
  }
  if (blob.size === 0) onProgress?.(0)
  return hasher.digest('hex')
}

export function bytesToHex(bytes: Uint8Array): string {
  let out = ''
  for (const b of bytes) out += b.toString(16).padStart(2, '0')
  return out
}

export function hexToBytes(hex: string): Bytes {
  if (hex.length % 2 !== 0 || /[^0-9a-f]/i.test(hex)) throw new Error('Invalid hex string')
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}
