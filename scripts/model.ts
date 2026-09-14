/**
 * npm run model — the balance harness.
 *
 * Nothing in the design document is believed until this agrees with it. The
 * questions it exists to answer are listed in docs/GDD.md; the metrics below
 * are the ones those questions name.
 */
import { chooseMove, type BotName } from '../src/game/bots'
import { DECADE, POPULATION_PER_CHARGE } from '../src/game/constants'
import { bulldoze, newGame, place } from '../src/game/engine'
import type { State } from '../src/game/types'

interface RunStats {
  population: number
  placements: number
  lines: number
  blight: number
  clearsPerPlacement: number
  overlaps: number
  proactiveOverlaps: number
  roads: number
  parks: number
  firstOverflow: number
  harvestedByDensity: [number, number, number]
  spiral: boolean
}

function countEmpty(s: State): number {
  let n = 0
  for (const c of s.board) if (c.kind === 'empty') n++
  return n
}

function runOnce(bot: BotName, seed: number): RunStats {
  let s = newGame(seed)
  let overlaps = 0
  let proactive = 0
  let roads = 0
  let parks = 0
  let firstOverflow = -1
  const byDensity: [number, number, number] = [0, 0, 0]

  for (let guard = 0; guard < 1000; guard++) {
    if (s.over) break
    if (s.mustBulldoze) {
      // Spend a charge on the cell that opens the most room: blight first.
      const i = s.board.findIndex((c) => c.kind === 'blight')
      const target = i >= 0 ? i : s.board.findIndex((c) => c.kind !== 'empty')
      if (target < 0 || s.charges <= 0) break
      s = bulldoze(s, target)
      continue
    }
    const move = chooseMove(s, bot)
    if (!move) break

    const emptyBefore = countEmpty(s)
    const wasOverlap = move.piece.cells.some(([ox, oy]) => {
      const c = s.board[(move.y + oy) * 10 + (move.x + ox)]
      return c.kind === 'zone'
    })

    const before = s
    s = place(s, move)
    if (s === before) break

    if (wasOverlap) {
      overlaps++
      if (emptyBefore >= 20) proactive++
    }
    if (move.piece.kind === 'road') roads++
    if (move.piece.kind === 'park') parks++
    if (firstOverflow < 0 && s.blightEvents > 0) firstOverflow = s.placements
    if (s.lastClear) {
      for (const cell of s.lastClear.cells) {
        const c = before.board[cell.idx]
        if (c && c.kind === 'zone' && c.density >= 1 && c.density <= 3) byDensity[c.density - 1]++
      }
    }
  }

  return {
    population: s.population,
    placements: s.placements,
    lines: s.lines,
    blight: s.blightEvents,
    clearsPerPlacement: s.placements ? s.lines / s.placements : 0,
    overlaps,
    proactiveOverlaps: proactive,
    roads,
    parks,
    firstOverflow,
    harvestedByDensity: byDensity,
    spiral: s.blightEvents >= 5 && s.lines < 8,
  }
}

function median(xs: number[]): number {
  const s = xs.slice().sort((a, b) => a - b)
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
}
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1)
const pct = (x: number) => `${(x * 100).toFixed(1)}%`
const f1 = (x: number) => x.toFixed(1)

function summarise(bot: BotName, runs: RunStats[]) {
  const d = runs.reduce(
    (a, r) => [a[0] + r.harvestedByDensity[0], a[1] + r.harvestedByDensity[1], a[2] + r.harvestedByDensity[2]],
    [0, 0, 0],
  )
  const dTotal = d[0] + d[1] + d[2] || 1
  return {
    bot,
    pop: Math.round(median(runs.map((r) => r.population))),
    meanPop: Math.round(mean(runs.map((r) => r.population))),
    placements: Math.round(median(runs.map((r) => r.placements))),
    lines: Math.round(median(runs.map((r) => r.lines))),
    clearRate: mean(runs.map((r) => r.clearsPerPlacement)),
    blight: mean(runs.map((r) => r.blight)),
    spiral: runs.filter((r) => r.spiral).length / runs.length,
    overlap: mean(runs.map((r) => (r.placements ? r.overlaps / r.placements : 0))),
    proactive: mean(runs.map((r) => (r.overlaps ? r.proactiveOverlaps / r.overlaps : 0))),
    roads: mean(runs.map((r) => r.roads)),
    parks: mean(runs.map((r) => r.parks)),
    firstOverflow: median(runs.filter((r) => r.firstOverflow > 0).map((r) => r.firstOverflow)) || 0,
    density: [d[0] / dTotal, d[1] / dTotal, d[2] / dTotal] as [number, number, number],
  }
}

const RUNS = Number(process.env.RUNS ?? 120)
const bots: BotName[] = ['greedy', 'reacting', 'thinking']

console.log(`INFILL — ${RUNS} runs per bot · decade ${DECADE} · charge every ${POPULATION_PER_CHARGE}\n`)

const summaries = bots.map((bot) => {
  const t0 = Date.now()
  const runs = Array.from({ length: RUNS }, (_, i) => runOnce(bot, 1000 + i))
  const s = summarise(bot, runs)
  console.log(`${bot.padEnd(9)} ${((Date.now() - t0) / 1000).toFixed(1)}s`)
  return s
})

console.log('')
const rows: [string, (s: ReturnType<typeof summarise>) => string][] = [
  ['median population', (s) => s.pop.toLocaleString()],
  ['mean population', (s) => s.meanPop.toLocaleString()],
  ['median placements', (s) => `${s.placements}`],
  ['median lines', (s) => `${s.lines}`],
  ['clears per placement', (s) => s.clearRate.toFixed(3)],
  ['blight events', (s) => f1(s.blight)],
  ['runs in a blight spiral', (s) => pct(s.spiral)],
  ['placements that overlap', (s) => pct(s.overlap)],
  ['  ...with space to spare', (s) => pct(s.proactive)],
  ['roads placed', (s) => f1(s.roads)],
  ['parks placed', (s) => f1(s.parks)],
  ['first overflow at', (s) => `${s.firstOverflow || '-'}`],
  ['harvested at density 1', (s) => pct(s.density[0])],
  ['harvested at density 2', (s) => pct(s.density[1])],
  ['harvested at density 3', (s) => pct(s.density[2])],
]

const w0 = Math.max(...rows.map((r) => r[0].length)) + 2
console.log(' '.repeat(w0) + bots.map((b) => b.padStart(12)).join(''))
for (const [name, fn] of rows) {
  console.log(name.padEnd(w0) + summaries.map((s) => fn(s).padStart(12)).join(''))
}

const g = summaries[0].meanPop
const t = summaries[2].meanPop
console.log(`\nlookahead is worth ${g > 0 ? pct(t / g - 1) : 'n/a'} over greedy`)
console.log(`(the design asks for >40%; below that the game is solitaire)`)
