import {
  DENSITY_VALUE,
  MULTI_CAP,
  MULTI_STEP,
  PAIR_BLIGHT,
  PAIR_CI,
  PAIR_PARK,
  PAIR_RC,
  PAIR_RI,
} from './constants'
import { neighbourIndices } from './rays'
import type { Cell, Demand, Zone } from './types'
import { ZONES } from './types'

export function pairValue(a: Cell, b: Cell): number {
  if (a.kind !== 'zone') return 0
  if (b.kind === 'blight') return PAIR_BLIGHT
  if (b.kind === 'park') return PAIR_PARK
  if (b.kind !== 'zone' || a.zone === b.zone) return 0
  const p = `${a.zone}${b.zone}`
  if (p === 'RC' || p === 'CR') return PAIR_RC
  if (p === 'CI' || p === 'IC') return PAIR_CI
  return PAIR_RI
}

/** A park behaves as a neighbour of unlimited density, so min() yields the recipient's. */
function neighbourDensity(b: Cell): number {
  return b.kind === 'park' ? Infinity : b.density
}

/**
 * cell = max(0, DENSITY_VALUE[own] + Σ pair * min(own_density, neighbour_density))
 *
 * Two halves, and both are load-bearing.
 *
 * The min() kills donor farming. Scaling by the neighbour's density alone let a
 * density-1 cell collect a density-3 neighbour's full bonus, which made cheap
 * recipients *more* efficient per unit invested (25 against 15) and made the
 * optimal play farming permanently unharvested donor strips.
 *
 * The superlinear base gives upzoning a reason to exist. min() alone flattened
 * the return to 15 per unit at every density, and since an upzone fills no new
 * cell it also costs tempo — so the harness found bots that never upzoned at all.
 */
export function scoreCell(board: Cell[], i: number): number {
  const c = board[i]
  if (c.kind !== 'zone') return 0
  let s = DENSITY_VALUE[c.density]
  for (const n of neighbourIndices(board, i)) {
    if (n === null) continue
    const nb = board[n]
    const pv = pairValue(c, nb)
    if (pv !== 0) s += pv * Math.min(c.density, neighbourDensity(nb))
  }
  return Math.max(0, s)
}

/** Highest-demand zones. Ties all qualify. Frozen before the placement. */
export function topZones(d: Demand): Set<Zone> {
  let max = -Infinity
  for (const z of ZONES) if (d[z] > max) max = d[z]
  return new Set(ZONES.filter((z) => d[z] === max))
}

export function multiLineMultiplier(n: number): number {
  if (n <= 1) return 1
  return Math.min(1 + MULTI_STEP * (n - 1), MULTI_CAP)
}
