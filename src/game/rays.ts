import { H, W } from './constants'
import { idx, xOf, yOf } from './grid'
import type { Cell } from './types'

const DIRS: readonly (readonly [number, number])[] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
]

/**
 * Roads make adjacency see through them.
 *
 * From a cell, step outward in each of the four directions through consecutive
 * road cells; the first non-road cell is that direction's neighbour. Empty cells,
 * blight and parks all stop the ray. The board edge returns no neighbour.
 *
 * Rays do not turn corners: every road cell conducts independently along its own
 * row and column, so an L-bend does not connect its two ends. That is why the art
 * must not draw lane markings — they would imply a rule the game does not have.
 *
 * The consequence that makes this affordable: a cell always has at most four
 * neighbours. A longer road changes *which* four, never how many.
 */
export function neighbourIndices(board: Cell[], i: number): (number | null)[] {
  const x0 = xOf(i)
  const y0 = yOf(i)
  const out: (number | null)[] = []
  for (const [dx, dy] of DIRS) {
    let x = x0 + dx
    let y = y0 + dy
    while (x >= 0 && x < W && y >= 0 && y < H && board[idx(x, y)].kind === 'road') {
      x += dx
      y += dy
    }
    out.push(x >= 0 && x < W && y >= 0 && y < H ? idx(x, y) : null)
  }
  return out
}
