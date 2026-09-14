import { DENSITY_VALUE, H, W } from './constants'
import { place, type Move } from './engine'
import { colIndices, rowIndices } from './grid'
import { allRotations } from './pieces'
import { neighbourIndices } from './rays'
import { pairValue } from './score'
import { canPlace } from './rules'
import type { State } from './types'
import { ZONES } from './types'

export type BotName = 'greedy' | 'reacting' | 'thinking'

/** Every legal placement, across every piece in hand and every rotation. */
export function candidates(s: State): Move[] {
  const out: Move[] = []
  const sources: { source: 'hand' | 'works'; slot: number; piece: State['works'] }[] = []
  s.hand.forEach((p, i) => p && sources.push({ source: 'hand', slot: i, piece: p }))
  if (s.works) sources.push({ source: 'works', slot: 0, piece: s.works })

  for (const src of sources) {
    if (!src.piece) continue
    for (const rot of allRotations(src.piece)) {
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (canPlace(s.board, rot, x, y)) {
            out.push({ source: src.source, slot: src.slot, piece: rot, x, y })
          }
        }
      }
    }
  }
  return out
}

/**
 * How good a board is to be holding, apart from points already banked.
 *
 * An earlier version rewarded line-fill and open space, and measured *worse*
 * than the greedy bot — it was advice to spread out and clear fast, which is
 * precisely wrong now that density pays superlinearly. What a board is worth is
 * mostly the value stored in it: a density-3 block is 45 population waiting to
 * be harvested, and it occupies one cell rather than three.
 */
export function heuristic(s: State): number {
  let h = 0
  let empty = 0
  let blight = 0
  let stored = 0

  for (const c of s.board) {
    if (c.kind === 'empty') empty++
    else if (c.kind === 'blight') blight++
    else if (c.kind === 'zone') stored += DENSITY_VALUE[c.density]
  }

  // Value already built, waiting to be harvested.
  h += stored * 0.55

  // Progress toward lines that can actually clear. A blighted line is worth
  // nothing to fill, so it must not be counted.
  for (let y = 0; y < H; y++) {
    const line = rowIndices(y)
    if (line.some((i) => s.board[i].kind === 'blight')) continue
    const f = line.filter((i) => s.board[i].kind !== 'empty').length
    h += f * f * 0.22
  }
  for (let x = 0; x < W; x++) {
    const line = colIndices(x)
    if (line.some((i) => s.board[i].kind === 'blight')) continue
    const f = line.filter((i) => s.board[i].kind !== 'empty').length
    h += f * f * 0.22
  }

  h += empty * 0.8
  h -= blight * 70 // each one kills a row and a column
  for (const z of ZONES) h -= s.demand[z] * 1.2

  // Standing adjacency quality, so the bot is not blind to what it is building.
  for (let i = 0; i < s.board.length; i++) {
    const c = s.board[i]
    if (c.kind !== 'zone') continue
    for (const n of neighbourIndices(s.board, i)) {
      if (n === null || n < i) continue
      h += pairValue(c, s.board[n]) * 0.6
    }
  }
  return h
}

function gain(s: State, next: State): number {
  return next.population - s.population
}

export function chooseMove(s: State, bot: BotName, lookahead = 8): Move | null {
  const moves = candidates(s)
  if (moves.length === 0) return null

  if (bot === 'greedy') {
    let best = moves[0]
    let bestScore = -Infinity
    for (const m of moves) {
      const g = gain(s, place(s, m))
      if (g > bestScore) {
        bestScore = g
        best = m
      }
    }
    return best
  }

  const scored = moves.map((m) => {
    const next = place(s, m)
    return { m, next, score: gain(s, next) + heuristic(next) }
  })
  scored.sort((a, b) => b.score - a.score)

  if (bot === 'reacting') return scored[0].m

  // thinking: one more ply, over the most promising few.
  let best = scored[0].m
  let bestScore = -Infinity
  for (const cand of scored.slice(0, lookahead)) {
    if (cand.next.over) {
      if (cand.score > bestScore) {
        bestScore = cand.score
        best = cand.m
      }
      continue
    }
    const follow = candidates(cand.next)
    let bestFollow = -Infinity
    for (const f of follow.slice(0, 40)) {
      const n2 = place(cand.next, f)
      const v = gain(cand.next, n2) + heuristic(n2)
      if (v > bestFollow) bestFollow = v
    }
    const total = cand.score + (bestFollow === -Infinity ? 0 : bestFollow) * 0.6
    if (total > bestScore) {
      bestScore = total
      best = cand.m
    }
  }
  return best
}
