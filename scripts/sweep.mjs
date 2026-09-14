/**
 * Sweeps the demand knobs and reports what each costs in run length.
 * Blight is what ends a run, and blight comes from overflow, so the levers are
 * how fast growth ramps and how high it is allowed to get.
 *
 *   node scripts/sweep.mjs
 */
import { execFileSync } from 'node:child_process'

const TARGET = 120
// SWEEP='[{"DECADE":18,"GROWTH_MAX":4}]' node scripts/sweep.mjs
const combos = process.env.SWEEP
  ? JSON.parse(process.env.SWEEP)
  : [25, 18, 14, 10].flatMap((DECADE) => [3, 4, 5].map((GROWTH_MAX) => ({ DECADE, GROWTH_MAX })))

console.log(`target ~${TARGET} placements · reacting bot · 12 runs each\n`)
const keys = [...new Set(combos.flatMap((c) => Object.keys(c)))]
console.log(keys.map((k) => k.padStart(12)).join('') + '  placements  lines  blight  population  overlap')

const rows = []
for (const c of combos) {
  const out = execFileSync('npx', ['vite-node', 'scripts/model.ts'], {
    env: { ...process.env, ...Object.fromEntries(Object.entries(c).map(([k, v]) => [k, String(v)])), RUNS: '12', BOTS: 'reacting' },
    encoding: 'utf8',
  })
  const get = (label) => {
    const m = out.match(new RegExp(`^${label}\\s+(\\S+)`, 'm'))
    return m ? m[1] : '?'
  }
  const row = {
    ...c,
    placements: Number(get('median placements')),
    lines: get('median lines'),
    blight: get('blight events'),
    pop: get('mean population'),
    overlap: get('placements that overlap'),
  }
  rows.push(row)
  console.log(
    keys.map((k) => String(c[k] ?? '-').padStart(12)).join('') +
    `${String(row.placements).padStart(12)}${row.lines.padStart(7)}${row.blight.padStart(8)}` +
    `${row.pop.padStart(12)}${row.overlap.padStart(9)}`,
  )
}

const best = rows.slice().sort((a, b) => Math.abs(a.placements - TARGET) - Math.abs(b.placements - TARGET))[0]
console.log(`\nclosest to ${TARGET}: ${keys.map((k) => `${k}=${best[k]}`).join(' ')} -> ${best.placements} placements`)
