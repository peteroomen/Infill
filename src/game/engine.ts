import { CHARGES_START, DEMAND_START } from './constants'
import { cloneState, emptyBoard } from './grid'
import { makeRng } from './rng'
import { canPlace } from './rules'
import { checkFailure, refillHand, refillWorks, settlePlacement } from './settle'
import type { Piece, State } from './types'
import { emptyCell } from './types'

export function newGame(seed = (Math.random() * 2 ** 31) | 0): State {
  const s: State = {
    board: emptyBoard(),
    hand: [null, null, null],
    works: null,
    worksCooldown: 0,
    parkQueue: 0,
    demand: { ...DEMAND_START },
    growthBonus: { R: 0, C: 0, I: 0 },
    placements: 0,
    lines: 0,
    population: 0,
    blightEvents: 0,
    charges: CHARGES_START,
    chargeProgress: 0,
    parkProgress: 0,
    skyline: [],
    rng: makeRng(seed),
    shapeBag: [],
    over: false,
    mustBulldoze: false,
    lastClear: null,
  }
  refillHand(s)
  refillWorks(s)
  return s
}

export interface Move {
  source: 'hand' | 'works'
  slot: number
  piece: Piece
  x: number
  y: number
}

export function pieceAt(s: State, source: 'hand' | 'works', slot: number): Piece | null {
  return source === 'works' ? s.works : s.hand[slot] ?? null
}

/** The only way the board changes by placement. Pure: returns a new state. */
export function place(s: State, m: Move): State {
  if (s.over || s.mustBulldoze) return s
  if (!canPlace(s.board, m.piece, m.x, m.y)) return s
  return settlePlacement(s, m.piece, m.x, m.y, m.source, m.slot)
}

/**
 * Erases one cell. Consumes a charge but does NOT advance demand growth or the
 * works cooldown — it is a rescue action, not another tax on a failing board.
 */
export function bulldoze(s: State, i: number): State {
  if (s.over || s.charges <= 0) return s
  if (s.board[i].kind === 'empty') return s
  const n = cloneState(s)
  n.board[i] = emptyCell()
  n.charges--
  n.lastClear = null
  checkFailure(n)
  return n
}

/** Rotation is free: it is not a turn and must never advance the random state. */
export function rotateSlot(s: State, source: 'hand' | 'works', slot: number, rotate: (p: Piece) => Piece): State {
  const p = pieceAt(s, source, slot)
  if (!p) return s
  const n = cloneState(s)
  if (source === 'works') n.works = rotate(p)
  else n.hand[slot] = rotate(p)
  n.lastClear = s.lastClear
  return n
}

export { refillWorks }
