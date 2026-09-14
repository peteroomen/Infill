/**
 * Drives the real app in a browser: places pieces by pointer, opens the menu,
 * flips settings, and fast-forwards to the late game and to a finished run.
 *
 * Fails on any console error or page exception. Screenshots land in shots/.
 *
 *   npm run playtest
 */
import { chromium } from 'playwright-core'
import { createServer } from 'node:http'
import { readFileSync, existsSync, mkdirSync } from 'node:fs'
import { extname, join } from 'node:path'

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }
const root = 'dist'
const server = createServer((req, res) => {
  let p = join(root, decodeURIComponent((req.url || '/').split('?')[0]))
  if (!existsSync(p) || p.endsWith('/')) p = join(root, 'index.html')
  res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' })
  res.end(readFileSync(p))
})
await new Promise((r) => server.listen(4179, r))
mkdirSync('shots', { recursive: true })

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
})
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true })

const problems = []
page.on('pageerror', (e) => problems.push(`pageerror: ${e}`))
page.on('console', (m) => m.type() === 'error' && problems.push(`console: ${m.text()}`))

await page.goto('http://localhost:4179/', { waitUntil: 'networkidle' })
await page.waitForTimeout(400)

const box = await page.locator('canvas').boundingBox()
const L = await page.evaluate(() => window.__infill.layout())
const shot = (n) => page.screenshot({ path: `shots/${n}.png` })
const state = () => page.evaluate(() => window.__infill.state)

async function drag(from, to) {
  await page.mouse.move(box.x + from[0], box.y + from[1])
  await page.mouse.down()
  await page.mouse.move(box.x + to[0], box.y + to[1], { steps: 10 })
  await page.mouse.up()
  await page.waitForTimeout(90)
}
const slotCentre = (i) => [L.slots[i].x + L.slots[i].w / 2, L.slots[i].y + L.slots[i].h / 2]

console.log('1. the opening tip')
await shot('01-tutorial')
const tipText = await page.locator('.tip h2').first().textContent()
if (!tipText) problems.push('no opening tip shown')
else console.log(`   "${tipText}"`)

console.log('2. placing by pointer')
// Ask the running game where the piece may go, and work out the drop point the
// way the app does: the piece is centred on the finger, one cell clear of it.
// Targeting the anchor cell directly puts the piece half its own width off.
async function bestDrop(slot) {
  return page.evaluate(
    ({ slot, L }) => {
      const g = window.__infill
      const piece = g.state.hand[slot]
      if (!piece) return null
      let pw = 0
      let ph = 0
      for (const [ox, oy] of piece.cells) {
        pw = Math.max(pw, ox + 1)
        ph = Math.max(ph, oy + 1)
      }
      const filled = (i) => g.state.board[i].kind !== 'empty'
      let best = null
      for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 10; x++) {
          if (!g.canPlace(piece, x, y)) continue
          // Prefer placements that push rows and columns toward completing.
          const rows = new Set()
          const cols = new Set()
          for (const [ox, oy] of piece.cells) {
            rows.add(y + oy)
            cols.add(x + ox)
          }
          let score = 0
          for (const r of rows) {
            let n = 0
            for (let i = 0; i < 10; i++) if (filled(r * 10 + i)) n++
            score += n * n
          }
          for (const c of cols) {
            let n = 0
            for (let i = 0; i < 10; i++) if (filled(i * 10 + c)) n++
            score += n * n
          }
          if (!best || score > best.score) {
            best = {
              score,
              x,
              y,
              px: L.board.x + (x + pw / 2) * L.cell,
              py: L.board.y + (y + ph / 2) * L.cell + L.cell * 1.15,
            }
          }
        }
      }
      return best
    },
    { slot, L },
  )
}

let attempted = 0
let placed = 0
for (let i = 0; i < 40; i++) {
  const slot = i % 3
  const target = await bestDrop(slot)
  if (!target) continue
  attempted++
  const before = (await state()).placements
  await drag(slotCentre(slot), [target.px, target.py])
  if ((await state()).placements > before) placed++
  const tipBtn = page.locator('.tip button')
  if (await tipBtn.count()) await tipBtn.click()
}
const afterPlacing = await state()
console.log(`   ${placed}/${attempted} legal drops landed · population ${afterPlacing.population} · lines ${afterPlacing.lines}`)
if (placed < attempted) problems.push(`${attempted - placed} of ${attempted} LEGAL drops did not land — input is dropping placements`)
if (afterPlacing.lines === 0) problems.push('no line ever cleared across 40 placements')
await shot('02-played')

console.log('3. tap to rotate')
const rotSlot = await page.evaluate(() => {
  const g = window.__infill
  return g.state.hand.findIndex((p) => p && g.rotations(p) > 1)
})
if (rotSlot < 0) {
  console.log('   (no multi-rotation piece in hand this time)')
} else {
  const beforeRot = (await state()).hand[rotSlot].rot
  await page.mouse.click(box.x + slotCentre(rotSlot)[0], box.y + slotCentre(rotSlot)[1])
  await page.waitForTimeout(90)
  const after = await state()
  console.log(`   slot ${rotSlot}: rot ${beforeRot} -> ${after.hand[rotSlot]?.rot}`)
  if (after.hand[rotSlot]?.rot === beforeRot) problems.push('tap did not rotate the piece')
  if (after.placements !== afterPlacing.placements) problems.push('a rotate consumed a turn')
  if (after.rng.seed !== afterPlacing.rng.seed) problems.push('a rotate advanced the random state')
}

console.log('4. the menu and settings')
await page.locator('.pause-btn').click()
await page.waitForTimeout(220)
await shot('03-menu')
if (!(await page.locator('.sheet-card').count())) problems.push('menu did not open')
await page.locator('#toggle-high-contrast').click()
await page.waitForTimeout(200)
await shot('04-high-contrast')
const hc = await page.evaluate(() => window.__infill.settings.highContrast)
if (!hc) problems.push('high contrast toggle did not take')
await page.locator('#toggle-high-contrast').click()
await page.locator('.sheet-actions .primary').click()
await page.waitForTimeout(200)

console.log('5. persistence across a reload')
const popBefore = (await state()).population
const placementsBefore = (await state()).placements
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(400)
const resumed = await state()
if (resumed.placements !== placementsBefore || resumed.population !== popBefore) {
  problems.push(`reload lost the game: ${placementsBefore}/${popBefore} -> ${resumed.placements}/${resumed.population}`)
} else {
  console.log(`   resumed at placement ${resumed.placements}, population ${resumed.population}`)
}

console.log('6. the late game')
await page.evaluate(() => {
  const s = window.__infill.state
  const next = JSON.parse(JSON.stringify(s))
  next.demand = { R: 96, C: 92, I: 90 }
  next.placements = 70
  window.__infill.setState(next)
})
for (let i = 0; i < 16; i++) {
  const t2 = await bestDrop(i % 3)
  if (t2) await drag(slotCentre(i % 3), [t2.px, t2.py])
  const t = page.locator('.tip button')
  if (await t.count()) await t.click()
}
const late = await state()
console.log(`   blight on board: ${late.board.filter((c) => c.kind === 'blight').length} · events ${late.blightEvents} · charges ${late.charges}`)
await shot('05-late-game')

console.log('7. the end of a run')
await page.evaluate(() => {
  const s = window.__infill.state
  const next = JSON.parse(JSON.stringify(s))
  for (let i = 0; i < next.board.length; i++) next.board[i] = { kind: 'zone', zone: 'R', density: 3 }
  next.hand = [{ kind: 'zone', shape: 'O', zone: 'C', rot: 0, cells: [[0, 0], [1, 0], [0, 1], [1, 1]] }, null, null]
  next.works = null
  next.charges = 0
  next.over = true
  window.__infill.setState(next)
})
await page.waitForTimeout(300)
await shot('06-game-over')
if (!(await page.locator('.sheet-card h1').count())) problems.push('game over sheet did not render')

await browser.close()
server.close()

if (problems.length) {
  console.error('\nPROBLEMS\n' + problems.map((p) => ` - ${p}`).join('\n'))
  process.exit(1)
}
console.log('\nno console errors · shots in shots/')
