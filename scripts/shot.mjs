import { chromium } from 'playwright-core'
import { createServer } from 'node:http'
import { readFileSync, existsSync, mkdirSync } from 'node:fs'
import { extname, join } from 'node:path'

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' }
const root = 'dist'
const server = createServer((req, res) => {
  let p = join(root, decodeURIComponent((req.url || '/').split('?')[0]))
  if (!existsSync(p) || p.endsWith('/')) p = join(root, 'index.html')
  res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' })
  res.end(readFileSync(p))
})
await new Promise((r) => server.listen(4178, r))

mkdirSync('shots', { recursive: true })
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
await page.goto('http://localhost:4178/', { waitUntil: 'networkidle' })
await page.waitForTimeout(600)

// Play a scripted opening so the shot shows a real working state, not an empty board.
const box = await page.locator('canvas').boundingBox()
const L = await page.evaluate(() => ({ dpr: window.devicePixelRatio }))
void L
async function drag(fromX, fromY, toX, toY) {
  await page.mouse.move(box.x + fromX, box.y + fromY)
  await page.mouse.down()
  await page.mouse.move(box.x + toX, box.y + toY, { steps: 12 })
  await page.mouse.up()
  await page.waitForTimeout(140)
}
const cell = 35.8
const bx = 16 + 1.5
const by = 16 + 104 + 12 + 88 + 12 + 46
const at = (cx, cy) => [bx + cx * cell + cell / 2, by + cy * cell + cell / 2 + cell * 1.15]
const slots = [[16 + 33, 844 - 16 - 126 + 70], [16 + 100, 844 - 16 - 126 + 70], [16 + 168, 844 - 16 - 126 + 70]]
for (let i = 0; i < 14; i++) {
  const s = slots[i % 3]
  const [tx, ty] = at((i * 3) % 8, Math.floor(i / 3) % 8)
  await drag(s[0], s[1], tx, ty)
}
await page.screenshot({ path: 'shots/game.png' })

// Mid-drag, to capture the ghost.
await page.mouse.move(box.x + slots[0][0], box.y + slots[0][1])
await page.mouse.down()
await page.mouse.move(box.x + bx + 4 * cell, box.y + by + 5 * cell, { steps: 10 })
await page.waitForTimeout(120)
await page.screenshot({ path: 'shots/drag.png' })
await page.mouse.up()

await browser.close()
server.close()
if (errors.length) {
  console.error('PAGE ERRORS:\n' + errors.join('\n'))
  process.exit(1)
}
console.log('shots/game.png, shots/drag.png')
