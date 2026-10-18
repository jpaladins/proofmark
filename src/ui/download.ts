/** Saves bytes or text as a file through a temporary object URL; nothing leaves the browser. */
export function downloadBytes(data: Uint8Array | string, filename: string, mime: string): void {
  if (typeof URL.createObjectURL !== 'function') return
  const blob = new Blob([typeof data === 'string' ? data : new Uint8Array(data)], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** "archivio.zip" → "archivio" */
export function baseName(zipName: string): string {
  return zipName.replace(/\.zip$/i, '') || 'archivio'
}
