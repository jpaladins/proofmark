// Renders public/icon.svg into a multi-size public/favicon.ico. Run once: npm run favicon
import { readFile, writeFile } from 'node:fs/promises'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'

const svg = await readFile(new URL('../public/icon.svg', import.meta.url))
const pngs = await Promise.all(
  [16, 32, 48].map((size) => sharp(svg, { density: 384 }).resize(size, size).png().toBuffer()),
)
await writeFile(new URL('../public/favicon.ico', import.meta.url), await pngToIco(pngs))
console.log('wrote public/favicon.ico')
