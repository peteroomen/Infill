import { drawRoadPiece, drawZonePiece, makeParkPiece } from './bag'
import {
  BLIGHT_PER_PLACEMENT,
  CHARGES_MAX,
  DECADE,
  DEMAND_MAX,
  DEMAND_RESET,
  GROWTH_BASE,
  GROWTH_MAX,
  OVERFLOW_GROWTH,
  OVERFLOW_GROWTH_MAX,
  PARK_EVERY,
  POPULATION_PER_CHARGE,
  WORKS_COOLDOWN,
} from './constants'
import { cloneState, completeLines } from './grid'
import { allRotations } from './pieces'
import { nextInt } from './rng'
import { multiLineMultiplier, scoreCell, topZones } from './score'
import { applyPiece, canPlace, hasPlacement } from './rules'
import type { Cell, LastClear, Piece, State, Zone } from './types'
import { emptyCell, ZONES } from './types'

const MAX_SKYLINE = 400

export function growthFor(s: State, z: Zone): number {
  const ramp = GROWTH_BASE + Math.floor(s.placements / DECADE)
  return Math.min(ramp, GROWTH_MAX) + s.growthBonus[z]
}

/**
 * The settlement contract.
 *
 * Every simultaneously completed line scores against ONE snapshot of the board,
 * taken after the placement and before any removal. Resolving a row first would
 * delete neighbours a column was going to score against, which makes iteration
 * order change the result — the single most dangerous class of bug in this design.
 *
 *   1. commit the placement
 *   2. identify every completed line
 *   3. score the unique harvested cells against the pre-removal snapshot,
 *      against a demand priority frozen before the placement
 *   4. remove all harvested cells simultaneously
 *   5. apply demand growth, then relief
 *   6. resolve overflows and blight spawns
 *   7. resolve rewards, hand refill and the works cooldown
 *   8. check failure
 *
 * Newly spawned blight never triggers another clear check: one settlement per
 * placement, always.
 */
export function settlePlacement(
  prev: State,
  piece: Piece,
  ax: number,
  ay: number,
  source: 'hand' | 'works',
  slot: number,
): State {
  const s = cloneState(prev)

  // Frozen before the placement — serving demand must not change which zone
  // deserved the reward.
  const priority = topZones(prev.demand)

  // 1. commit
  applyPiece(s.board, piece, ax, ay)
  s.placements++
  if (source === 'hand') s.hand[slot] = null
  else s.works = null

  // 2. completed lines
  const lines = completeLines(s.board)

  // 3. score against one snapshot; a cell in both a row and a column is one building
  const harvested = new Set<number>()
  for (const line of lines) for (const i of line) harvested.add(i)

  let lineSum = 0
  const detail: LastClear['cells'] = []
  const relief: Record<Zone, number> = { R: 0, C: 0, I: 0 }

  for (const i of harvested) {
    const c = s.board[i]
    const raw = scoreCell(s.board, i)
    const doubled = c.kind === 'zone' && c.zone !== null && priority.has(c.zone)
    const value = doubled ? raw * 2 : raw
    lineSum += value
    detail.push({ idx: i, value, doubled })
    if (c.kind === 'zone' && c.zone !== null) relief[c.zone] += c.density
  }

  const multiplier = multiLineMultiplier(lines.length)
  const total = Math.round(lineSum * multiplier)

  // 4. simultaneous removal
  for (const i of harvested) {
    const c = s.board[i]
    if (c.kind === 'zone' && c.zone !== null) s.skyline.push({ zone: c.zone, density: c.density })
    s.board[i] = emptyCell()
  }
  if (s.skyline.length > MAX_SKYLINE) s.skyline.splice(0, s.skyline.length - MAX_SKYLINE)

  // 5. demand growth, then relief. Only development advances demand — roads and
  //    parks are infrastructure, and taxing them made the works slot a trap.
  const develops = piece.kind === 'zone'
  for (const z of ZONES) {
    const grown = s.demand[z] + (develops ? growthFor(prev, z) : 0)
    s.demand[z] = Math.max(0, grown - relief[z])
  }

  // 6. overflow. A clear can avert a crossing on the turn it would have happened.
  //    Blight counts as filled, so it is free line-completion material — capped
  //    per placement, because uncapped it feeds the clear engine that generates it.
  let spawned = 0
  for (const z of ZONES) {
    if (s.demand[z] >= DEMAND_MAX) {
      s.demand[z] = DEMAND_RESET
      s.growthBonus[z] = Math.min(s.growthBonus[z] + OVERFLOW_GROWTH, OVERFLOW_GROWTH_MAX)
      s.blightEvents++
      if (spawned < BLIGHT_PER_PLACEMENT) {
        spawnBlight(s)
        spawned++
      }
    }
  }

  // 7. rewards, refills, cooldown
  s.lines += lines.length
  s.population += total
  s.parkProgress += total
  while (s.parkProgress >= PARK_EVERY) {
    s.parkProgress -= PARK_EVERY
    s.parkQueue++
  }
  s.chargeProgress += total
  while (s.chargeProgress >= POPULATION_PER_CHARGE && s.charges < CHARGES_MAX) {
    s.chargeProgress -= POPULATION_PER_CHARGE
    s.charges++
  }

  if (s.hand.every((p) => p === null)) refillHand(s)

  if (source === 'works') {
    s.worksCooldown = WORKS_COOLDOWN
  } else if (s.worksCooldown > 0) {
    s.worksCooldown--
  }
  if (s.works === null && s.worksCooldown === 0) refillWorks(s)

  s.lastClear = lines.length > 0 ? { cells: detail, lineCount: lines.length, multiplier, total } : null

  // 8. failure
  checkFailure(s)
  return s
}

export function refillHand(s: State): void {
  for (let i = 0; i < s.hand.length; i++) {
    s.hand[i] = drawZonePiece(s.rng, s.shapeBag, s.demand)
  }
}

export function refillWorks(s: State): void {
  if (s.parkQueue > 0) {
    s.parkQueue--
    s.works = makeParkPiece()
  } else {
    s.works = drawRoadPiece(s.rng)
  }
}

function spawnBlight(s: State): void {
  const empties: number[] = []
  for (let i = 0; i < s.board.length; i++) if (s.board[i].kind === 'empty') empties.push(i)
  if (empties.length === 0) return // skipped, never retried
  const i = empties[nextInt(s.rng, empties.length)]
  s.board[i] = { kind: 'blight', zone: null, density: 1 }
}

export function livePieces(s: State): Piece[] {
  const out: Piece[] = []
  for (const p of s.hand) if (p) out.push(p)
  if (s.works) out.push(s.works)
  return out
}

/** Any legal placement, in any rotation, for anything currently in hand. */
export function anyMove(board: Cell[], pieces: Piece[]): boolean {
  for (const p of pieces) {
    for (const r of allRotations(p)) {
      if (hasPlacement(board, r)) return true
    }
  }
  return false
}

/**
 * A run ends only when nothing fits AND no single bulldoze would open a move.
 * Confiscating the rescue resource at the exact moment it is needed is not a
 * difficulty curve — so if a charge would help, the player is put into bulldoze
 * mode instead of being told the run is over.
 */
export function checkFailure(s: State): void {
  const pieces = livePieces(s)
  if (anyMove(s.board, pieces)) {
    s.over = false
    s.mustBulldoze = false
    return
  }
  if (s.charges > 0 && bulldozeWouldOpen(s, pieces)) {
    s.mustBulldoze = true
    s.over = false
    return
  }
  s.over = true
  s.mustBulldoze = false
}

function bulldozeWouldOpen(s: State, pieces: Piece[]): boolean {
  for (let i = 0; i < s.board.length; i++) {
    if (s.board[i].kind === 'empty') continue
    const saved = s.board[i]
    s.board[i] = emptyCell()
    const ok = anyMove(s.board, pieces)
    s.board[i] = saved
    if (ok) return true
  }
  return false
}

export { canPlace }
