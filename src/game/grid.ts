import { AREA, H, W } from './constants'
import type { Cell, State } from './types'
import { emptyCell } from './types'

export const idx = (x: number, y: number) => y * W + x
export const xOf = (i: number) => i % W
export const yOf = (i: number) => (i / W) | 0
export const inBounds = (x: number, y: number) => x >= 0 && x < W && y >= 0 && y < H

export function emptyBoard(): Cell[] {
  return Array.from({ length: AREA }, emptyCell)
}

export function cloneBoard(b: Cell[]): Cell[] {
  const out = new Array<Cell>(b.length)
  for (let i = 0; i < b.length; i++) {
    const c = b[i]
    out[i] = { kind: c.kind, zone: c.zone, density: c.density }
  }
  return out
}

/** Total clone. The bot harness runs this thousands of times a second. */
export function cloneState(s: State): State {
  return {
    board: cloneBoard(s.board),
    hand: s.hand.map((p) => (p ? { ...p } : null)),
    works: s.works ? { ...s.works } : null,
    worksCooldown: s.worksCooldown,
    parkQueue: s.parkQueue,
    demand: { ...s.demand },
    growthBonus: { ...s.growthBonus },
    placements: s.placements,
    lines: s.lines,
    population: s.population,
    blightEvents: s.blightEvents,
    charges: s.charges,
    chargeProgress: s.chargeProgress,
    parkProgress: s.parkProgress,
    skyline: s.skyline.slice(),
    rng: { ...s.rng },
    shapeBag: s.shapeBag.slice(),
    over: s.over,
    mustBulldoze: s.mustBulldoze,
    lastClear: null,
  }
}

export function rowIndices(y: number): number[] {
  const out: number[] = []
  for (let x = 0; x < W; x++) out.push(idx(x, y))
  return out
}

export function colIndices(x: number): number[] {
  const out: number[] = []
  for (let y = 0; y < H; y++) out.push(idx(x, y))
  return out
}

/**
 * A line completes when every cell is built and none is blighted.
 *
 * Roads count as filled — they are infrastructure, and closing a row with one is
 * a real trade. Blight does the opposite: it BLOCKS its row and its column until
 * bulldozed, which is the only pressure in the design that actually accumulates.
 *
 * This was measured, not assumed. With blight counting as filled and clearing
 * with its line, the harness found the board sitting 60-80% empty for a thousand
 * placements: clears removed cells exactly as fast as placements added them, so
 * the board could never saturate and the run could never end. Blight that blocks
 * is what closes the loop — and unlike terrain, it is caused by your own play,
 * arrives gradually, and can be removed.
 */
export function lineIsClearable(board: Cell[], line: number[]): boolean {
  for (const i of line) {
    const k = board[i].kind
    if (k === 'empty' || k === 'blight') return false
  }
  return true
}

export function completeLines(board: Cell[]): number[][] {
  const lines: number[][] = []
  for (let y = 0; y < H; y++) {
    const r = rowIndices(y)
    if (lineIsClearable(board, r)) lines.push(r)
  }
  for (let x = 0; x < W; x++) {
    const c = colIndices(x)
    if (lineIsClearable(board, c)) lines.push(c)
  }
  return lines
}
