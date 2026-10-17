import type { Bytes } from '@/core/hash/sha256'

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

export function base64ToBytes(b64: string): Bytes {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}
