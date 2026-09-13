/** INFILL — core types. Everything here is plain data; see rules.ts for the verbs. */

export type Zone = 'R' | 'C' | 'I'
export const ZONES: readonly Zone[] = ['R', 'C', 'I'] as const

/** A cell is exactly one of these. `density` is 0 for empty, 1 for road/blight/park. */
export type CellKind = 'empty' | 'zone' | 'road' | 'blight' | 'park'

export interface Cell {
  kind: CellKind
  /** Only meaningful when kind === 'zone'. */
  zone: Zone | null
  /** 0 empty · 1-3 zone · 1 road/blight/park. */
  density: number
}

export type PieceKind = 'zone' | 'road' | 'park'

/** Offsets from the piece's anchor, already resolved for its rotation. */
export type Offsets = readonly (readonly [number, number])[]

export interface Piece {
  kind: PieceKind
  /** Shape key into SHAPES; identifies the rotation table. */
  shape: string
  zone: Zone | null
  rot: number
  cells: Offsets
}

export interface SkylineEntry {
  zone: Zone
  density: number
}

export interface Rng {
  seed: number
}

export interface Demand {
  R: number
  C: number
  I: number
}

export interface State {
  board: Cell[]
  /** The three zone slots. Batch-refilled only when all three are spent. */
  hand: (Piece | null)[]
  /** The works slot: a road, or a park when one is owed. */
  works: Piece | null
  /** Placements remaining until the works slot refills. 0 = not waiting. */
  worksCooldown: number
  /** Parks owed but not yet handed to the works slot. */
  parkQueue: number

  demand: Demand
  /** Per-zone permanent growth bonus, raised by that zone's own overflows. */
  growthBonus: Demand

  placements: number
  lines: number
  population: number
  blightEvents: number

  charges: number
  /** Population banked toward the next bulldozer charge. */
  chargeProgress: number
  /** Lines cleared toward the next park. */
  parkProgress: number

  skyline: SkylineEntry[]
  rng: Rng
  /** The shuffled seven-bag, drained from the end. Lives here so cloning is total. */
  shapeBag: string[]

  over: boolean
  /** No piece fits, but a bulldoze would open one — the player must clear a cell. */
  mustBulldoze: boolean

  /** Set by the last settlement, for the renderer. Not part of the rules. */
  lastClear: LastClear | null
}

export interface LastClear {
  /** Board indices harvested, with the population each contributed. */
  cells: { idx: number; value: number; doubled: boolean }[]
  lineCount: number
  multiplier: number
  total: number
}

export const EMPTY: Cell = { kind: 'empty', zone: null, density: 0 }

export function emptyCell(): Cell {
  return { kind: 'empty', zone: null, density: 0 }
}
