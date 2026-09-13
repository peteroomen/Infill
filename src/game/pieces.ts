import type { Offsets, Piece, PieceKind, Zone } from './types'

/**
 * Shape tables. Each entry is the four rotations, as offsets from the anchor,
 * normalised so the minimum x and y of every rotation is 0. Normalising matters:
 * it means a piece's footprint is always [0..w) x [0..h) and the drag ghost and
 * the legality check agree about where the piece sits.
 */

type Raw = readonly (readonly [number, number])[]

function rotate(cells: Raw): Raw {
  // (x, y) -> (y, -x), then normalise.
  const r = cells.map(([x, y]) => [y, -x] as const)
  return normalise(r)
}

function normalise(cells: Raw): Raw {
  let minX = Infinity
  let minY = Infinity
  for (const [x, y] of cells) {
    if (x < minX) minX = x
    if (y < minY) minY = y
  }
  return cells
    .map(([x, y]) => [x - minX, y - minY] as const)
    .slice()
    .sort((a, b) => a[1] - b[1] || a[0] - b[0])
}

function key(cells: Raw): string {
  return cells.map(([x, y]) => `${x},${y}`).join(' ')
}

/** Build the distinct rotations, de-duplicated — an O-piece has one, an I two. */
function rotations(base: Raw): Offsets[] {
  const out: Offsets[] = []
  const seen = new Set<string>()
  let cur = normalise(base)
  for (let i = 0; i < 4; i++) {
    const k = key(cur)
    if (!seen.has(k)) {
      seen.add(k)
      out.push(cur)
    }
    cur = rotate(cur)
  }
  return out
}

const TETROMINOES: Record<string, Raw> = {
  I: [[0, 0], [1, 0], [2, 0], [3, 0]],
  O: [[0, 0], [1, 0], [0, 1], [1, 1]],
  T: [[0, 0], [1, 0], [2, 0], [1, 1]],
  S: [[1, 0], [2, 0], [0, 1], [1, 1]],
  Z: [[0, 0], [1, 0], [1, 1], [2, 1]],
  J: [[0, 0], [0, 1], [1, 1], [2, 1]],
  L: [[2, 0], [0, 1], [1, 1], [2, 1]],
}

const ROADS: Record<string, Raw> = {
  r2: [[0, 0], [1, 0]],
  r3: [[0, 0], [1, 0], [2, 0]],
  r4: [[0, 0], [1, 0], [2, 0], [3, 0]],
  rL: [[0, 0], [0, 1], [1, 1]],
}

const PARK: Record<string, Raw> = {
  park: [[0, 0]],
}

export const SHAPES: Record<string, Offsets[]> = {}
for (const [k, v] of Object.entries({ ...TETROMINOES, ...ROADS, ...PARK })) {
  SHAPES[k] = rotations(v)
}

export const TETROMINO_KEYS = Object.keys(TETROMINOES)
export const ROAD_KEYS = Object.keys(ROADS)

export function makePiece(kind: PieceKind, shape: string, zone: Zone | null, rot = 0): Piece {
  const table = SHAPES[shape]
  const r = ((rot % table.length) + table.length) % table.length
  return { kind, shape, zone, rot: r, cells: table[r] }
}

export function rotated(p: Piece): Piece {
  return makePiece(p.kind, p.shape, p.zone, p.rot + 1)
}

/** All distinct rotations of a piece — used by the bots and the failure check. */
export function allRotations(p: Piece): Piece[] {
  return SHAPES[p.shape].map((_, i) => makePiece(p.kind, p.shape, p.zone, i))
}

export function pieceExtent(p: Piece): { w: number; h: number } {
  let w = 0
  let h = 0
  for (const [x, y] of p.cells) {
    if (x + 1 > w) w = x + 1
    if (y + 1 > h) h = y + 1
  }
  return { w, h }
}
