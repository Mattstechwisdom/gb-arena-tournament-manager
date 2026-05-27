import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const ROOT = process.cwd()
const GAMES_JSON = path.join(ROOT, 'src', 'data', 'games.json')
const OUT_DIR = path.join(ROOT, 'public', 'covers')

const raw = await readFile(GAMES_JSON, 'utf8')
const games = JSON.parse(raw)

if (!Array.isArray(games)) {
  throw new Error('games.json must be an array')
}

await mkdir(OUT_DIR, { recursive: true })

for (const g of games) {
  if (!g || typeof g !== 'object') continue
  const id = String(g.id ?? '').trim()
  const name = String(g.name ?? '').trim()
  if (!id || !name) continue

  const svg = makeCoverSvg({ id, name })
  const outPath = path.join(OUT_DIR, `${id}.svg`)
  await writeFile(outPath, svg, 'utf8')
}

console.log(`Generated ${games.length} cover(s) in ${path.relative(ROOT, OUT_DIR)}`)

function makeCoverSvg({ id, name }) {
  const { c1, c2, c3 } = paletteFromId(id)

  // 3:4 cover ratio
  const width = 600
  const height = 800

  const title = escapeXml(name)
  const label = 'GB ARENA'

  // A subtle pattern that stays generic and non-copyright.
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="55%" stop-color="${c2}"/>
      <stop offset="100%" stop-color="${c3}"/>
    </linearGradient>

    <radialGradient id="glow" cx="25%" cy="20%" r="75%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>

    <linearGradient id="shade" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.55"/>
      <stop offset="55%" stop-color="#000000" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </linearGradient>

    <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
      <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#ffffff" stroke-opacity="0.06" stroke-width="2"/>
    </pattern>

    <filter id="soft" x="-10%" y="-10%" width="120%" height="120%">
      <feGaussianBlur stdDeviation="10"/>
    </filter>
  </defs>

  <rect x="0" y="0" width="${width}" height="${height}" fill="url(#bg)"/>
  <rect x="0" y="0" width="${width}" height="${height}" fill="url(#grid)"/>

  <circle cx="140" cy="120" r="260" fill="url(#glow)"/>
  <circle cx="520" cy="360" r="190" fill="#ffffff" opacity="0.08" filter="url(#soft)"/>

  <rect x="0" y="0" width="${width}" height="${height}" fill="url(#shade)"/>

  <text x="32" y="56" fill="#ffffff" opacity="0.85" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif" font-size="22" font-weight="700" letter-spacing="4">${label}</text>

  <!-- Embedded title for accessibility; UI overlays the visible title -->
  <title>${title}</title>
</svg>
`
}

function paletteFromId(id) {
  const h = hash(id)
  const hue = h % 360
  const hue2 = (hue + 40) % 360
  const hue3 = (hue + 85) % 360

  return {
    c1: `hsl(${hue} 80% 55%)`,
    c2: `hsl(${hue2} 80% 45%)`,
    c3: `hsl(${hue3} 80% 40%)`,
  }
}

function hash(input) {
  let h = 0
  for (let i = 0; i < input.length; i++) {
    h = (h << 5) - h + input.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
