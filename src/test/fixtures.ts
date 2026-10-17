import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = join(process.cwd(), 'src', 'test', 'fixtures')

/** Reads a binary file from src/test/fixtures (tests only). */
export function fixture(name: string): Uint8Array {
  return new Uint8Array(readFileSync(join(dir, name)))
}

export function fixtureText(name: string): string {
  return readFileSync(join(dir, name), 'utf8').trim()
}
