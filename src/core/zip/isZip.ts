export type ZipValidation = { ok: true } | { ok: false; reason: 'extension' | 'signature' | 'empty' }

/** Accepts only `.zip` files (any case) whose first bytes are a ZIP local-header or empty-archive signature. */
export async function validateZip(file: File): Promise<ZipValidation> {
  if (!/\.zip$/i.test(file.name)) return { ok: false, reason: 'extension' }
  if (file.size === 0) return { ok: false, reason: 'empty' }
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer())
  const isPk = head[0] === 0x50 && head[1] === 0x4b
  const isZip = isPk && ((head[2] === 0x03 && head[3] === 0x04) || (head[2] === 0x05 && head[3] === 0x06))
  return isZip ? { ok: true } : { ok: false, reason: 'signature' }
}
