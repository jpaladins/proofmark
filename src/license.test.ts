// @vitest-environment node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { confirmedCert } from '@/test/certFixtures'
import { buildAttestatoContent } from '@/core/pdf/content'

const read = (f: string) => readFileSync(join(process.cwd(), f), 'utf8')

describe('licence: GNU AGPL v3 with an attribution term', () => {
  test('package.json declares AGPL-3.0-only', () => {
    expect(JSON.parse(read('package.json')).license).toBe('AGPL-3.0-only')
  })

  test('LICENSE holds the complete official AGPL v3 text', () => {
    const text = read('LICENSE')
    expect(text).toContain('GNU AFFERO GENERAL PUBLIC LICENSE')
    expect(text).toContain('Version 3, 19 November 2007')
    expect(text).toContain('13. Remote Network Interaction; Use with the GNU General Public License.')
    expect(text).toContain('END OF TERMS AND CONDITIONS')
    expect(text).not.toMatch(/^MIT License/m)
  })

  test('LICENSE is the unmodified official text, so GitHub recognises it', () => {
    expect(read('LICENSE').trimStart().startsWith('GNU AFFERO GENERAL PUBLIC LICENSE')).toBe(true)
  })

  test('NOTICE adds the section 7(b) term that keeps "Developed by JPaladins" visible', () => {
    const text = read('NOTICE')
    expect(text).toContain('Additional terms under section 7(b)')
    expect(text).toContain('Developed by JPaladins')
    expect(text).toContain('https://github.com/jpaladins')
  })

  test('the README states the AGPL and no longer the MIT licence', () => {
    const readme = read('README.md')
    expect(readme).toContain('AGPL-3.0')
    expect(readme).toContain('[NOTICE](NOTICE)')
    expect(readme).not.toMatch(/licenza-MIT|\[MIT\]\(LICENSE\)/)
  })

  test('the PDF footer names the AGPL', () => {
    const c = buildAttestatoContent(confirmedCert(), { attachments: [], timeZone: 'UTC' })
    expect(c.footer[1]).toContain('AGPL-3.0')
    expect(c.footer[1]).not.toContain('MIT')
  })
})
