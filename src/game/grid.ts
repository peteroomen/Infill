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

/** A line is complete when no cell in it is empty. Roads and blight count as filled. */
export function completeLines(board: Cell[]): number[][] {
  const lines: number[][] = []
  for (let y = 0; y < H; y++) {
    const r = rowIndices(y)
    if (r.every((i) => board[i].kind !== 'empty')) lines.push(r)
  }
  for (let x = 0; x < W; x++) {
    const c = colIndices(x)
    if (c.every((i) => board[i].kind !== 'empty')) lines.push(c)
  }
  return lines
}
