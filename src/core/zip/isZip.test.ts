import { describe, expect, test } from 'vitest'
import { validateZip } from './isZip'

const PK0304 = new Uint8Array([0x50, 0x4b, 0x03, 0x04])
const PK0506 = new Uint8Array([0x50, 0x4b, 0x05, 0x06])
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0])
const file = (parts: BlobPart[], name: string) => new File(parts, name)

describe('validateZip', () => {
  test('accepts a zip with a local file header', async () => {
    expect(await validateZip(file([PK0304, 'x'], 'a.zip'))).toEqual({ ok: true })
  })
  test('accepts an uppercase .ZIP extension', async () => {
    expect(await validateZip(file([PK0304, 'x'], 'ARCHIVIO.ZIP'))).toEqual({ ok: true })
  })
  test('accepts an empty archive (end of central directory only)', async () => {
    expect(await validateZip(file([PK0506, new Uint8Array(18)], 'd.zip'))).toEqual({ ok: true })
  })
  test('rejects a JPEG renamed to .zip', async () => {
    expect(await validateZip(file([JPEG], 'b.zip'))).toEqual({ ok: false, reason: 'signature' })
  })
  test('rejects a non-zip extension', async () => {
    expect(await validateZip(file([PK0304], 'c.rar'))).toEqual({ ok: false, reason: 'extension' })
  })
  test('rejects an empty file', async () => {
    expect(await validateZip(file([], 'e.zip'))).toEqual({ ok: false, reason: 'empty' })
  })
})
