import { DEMAND_MAX, H, W } from './constants'
import { idx } from './grid'
import { allRotations } from './pieces'
import { canPlace } from './rules'
import type { State } from './types'

/**
 * The tutorial is progressive disclosure, not a scripted level.
 *
 * Each card waits for the moment its rule first becomes relevant in a real game
 * and then explains that one rule, once, ever. A forced tutorial level would
 * teach the same things in an order the player did not choose, cost a separate
 * mode to build and maintain, and be skipped by most people anyway.
 *
 * The predicates are pure functions of the state so they can be tested without
 * a renderer, which is the only reason this is a separate module.
 */

export interface Tip {
  id: string
  title: string
  body: string
  when: (s: State) => boolean
}

function anyOverlapAvailable(s: State): boolean {
  for (const p of s.hand) {
    if (!p || p.kind !== 'zone') continue
    for (const rot of allRotations(p)) {
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (!canPlace(s.board, rot, x, y)) continue
          const overlaps = rot.cells.some(([ox, oy]) => s.board[idx(x + ox, y + oy)].kind === 'zone')
          if (overlaps) return true
        }
      }
    }
  }
  return false
}

function hasKind(s: State, kind: string): boolean {
  return s.board.some((c) => c.kind === kind)
}

function hasResidentialIndustrialContact(s: State): boolean {
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const a = s.board[idx(x, y)]
      if (a.kind !== 'zone') continue
      for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
        const nx = x + dx
        const ny = y + dy
        if (nx >= W || ny >= H) continue
        const b = s.board[idx(nx, ny)]
        if (b.kind !== 'zone') continue
        const pair = `${a.zone}${b.zone}`
        if (pair === 'RI' || pair === 'IR') return true
      }
    }
  }
  return false
}

export const TIPS: Tip[] = [
  {
    id: 'place',
    title: 'Drag a piece onto the lot',
    body: 'It goes exactly where you put it. No gravity, no clock — take as long as you like. Tap a piece to rotate it first.',
    when: (s) => s.placements === 0,
  },
  {
    id: 'line',
    title: 'Fill a row or a column',
    body: 'A complete line is harvested: the buildings leave the board and bank their population. Both rows and columns count.',
    when: (s) => s.placements >= 1 && s.lines === 0,
  },
  {
    id: 'harvest',
    title: 'That is the city now',
    body: 'Harvested buildings rise into the skyline above the board. The lot is the building site; the skyline only ever grows.',
    when: (s) => s.lines >= 1,
  },
  {
    id: 'overlap',
    title: 'Build on top of yourself',
    body: 'A piece can land on cells of its own zone, raising them a level instead of taking new ground. Denser pays more per cell — and costs you nothing but the room to do it again.',
    when: (s) => s.placements >= 3 && anyOverlapAvailable(s),
  },
  {
    id: 'adjacency',
    title: 'What you build next to what',
    body: 'Homes beside factories lose most of their value. Shops beside either gain. Same zone pays nothing — it pays in density instead.',
    when: (s) => s.lines >= 1 && hasResidentialIndustrialContact(s),
  },
  {
    id: 'demand',
    title: 'Demand is the clock',
    body: 'Every placement pushes all three bars up. Harvest a line and the zones in it come back down. You can hold one bar. Not three.',
    when: (s) => Math.max(s.demand.R, s.demand.C, s.demand.I) >= DEMAND_MAX * 0.7,
  },
  {
    id: 'road',
    title: 'Roads see through',
    body: 'A road scores nothing, but it fills a line — and adjacency looks straight through it, so a house three cells from a shop still counts as its neighbour. Rays travel straight: a bend does not connect its two ends.',
    when: (s) => s.placements >= 4 && s.works?.kind === 'road',
  },
  {
    id: 'blight',
    title: 'Blight blocks the line',
    body: 'A bar that fills drops blight, and blight stops its whole row and column from ever completing. It is the only thing that accumulates — and the only thing that ends the run.',
    when: (s) => hasKind(s, 'blight'),
  },
  {
    id: 'bulldozer',
    title: 'Clear one cell',
    body: 'Tap the bulldozer, then a cell. Charges come from population, so they are worth spending on blight that is blocking a good line.',
    when: (s) => s.charges >= 1 && hasKind(s, 'blight'),
  },
  {
    id: 'park',
    title: 'A park is owed',
    body: 'Parks arrive in the works slot in place of a road. A park scores nothing itself and lifts every neighbour, at that neighbour’s own density.',
    when: (s) => s.works?.kind === 'park' || s.parkQueue > 0,
  },
]

/** The first unseen card whose moment has arrived, or nothing. One at a time. */
export function nextTip(s: State, seen: ReadonlySet<string>): Tip | null {
  if (s.over) return null
  for (const tip of TIPS) {
    if (seen.has(tip.id)) continue
    if (tip.when(s)) return tip
  }
  return null
}

const KEY = 'infill.tips.v1'

export function loadSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY)
    return new Set<string>(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

export function saveSeen(seen: ReadonlySet<string>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify([...seen]))
  } catch {
    /* ignore */
  }
}
