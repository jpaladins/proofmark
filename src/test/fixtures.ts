import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Bytes } from '@/core/hash/sha256'

const dir = join(process.cwd(), 'src', 'test', 'fixtures')

/** Reads a binary file from src/test/fixtures (tests only). */
export function fixture(name: string): Bytes {
  return new Uint8Array(readFileSync(join(dir, name)))
}

export function fixtureText(name: string): string {
  return readFileSync(join(dir, name), 'utf8').trim()
}
