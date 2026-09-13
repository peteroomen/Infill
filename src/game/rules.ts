import { H, MAX_DENSITY, W } from './constants'
import { idx, inBounds } from './grid'
import type { Cell, Piece } from './types'

/**
 * A placement is legal if every cell it covers is empty, or — for a zone piece —
 * the same zone below the density ceiling. Roads and parks need bare ground.
 *
 * This is a placement rule, not a scoring rule: it changes which moves exist.
 * A piece landing entirely on existing buildings consumes no new ground at the
 * cost of future stacking capacity, and that trade is the game's core verb.
 */
export function canPlace(board: Cell[], piece: Piece, ax: number, ay: number): boolean {
  for (const [ox, oy] of piece.cells) {
    const x = ax + ox
    const y = ay + oy
    if (!inBounds(x, y)) return false
    const c = board[idx(x, y)]
    if (piece.kind === 'zone') {
      if (c.kind === 'empty') continue
      if (c.kind === 'zone' && c.zone === piece.zone && c.density < MAX_DENSITY) continue
      return false
    } else if (c.kind !== 'empty') {
      return false
    }
  }
  return true
}

/** Mutates `board`. Callers pass a board they already own. */
export function applyPiece(board: Cell[], piece: Piece, ax: number, ay: number): void {
  for (const [ox, oy] of piece.cells) {
    const i = idx(ax + ox, ay + oy)
    const c = board[i]
    if (piece.kind === 'zone') {
      if (c.kind === 'empty') {
        board[i] = { kind: 'zone', zone: piece.zone, density: 1 }
      } else {
        board[i] = { kind: 'zone', zone: c.zone, density: c.density + 1 }
      }
    } else {
      board[i] = { kind: piece.kind, zone: null, density: 1 }
    }
  }
}

/** Any anchor at which this piece fits. */
export function hasPlacement(board: Cell[], piece: Piece): boolean {
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (canPlace(board, piece, x, y)) return true
    }
  }
  return false
}
