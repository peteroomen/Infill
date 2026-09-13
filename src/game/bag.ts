import { BAG_UNIFORM_SHARE } from './constants'
import { makePiece, ROAD_KEYS, TETROMINO_KEYS } from './pieces'
import { nextFloat, nextInt, shuffle } from './rng'
import type { Demand, Piece, Rng, Zone } from './types'
import { ZONES } from './types'

/**
 * Shape and zone are drawn independently, and must stay that way.
 *
 * Shape comes from a shuffled seven-bag, so there are no I-piece droughts.
 * Zone is a mixture: BAG_UNIFORM_SHARE uniform, the rest weighted by demand.
 * That keeps every zone between 25% and 50% of draws — urgency biases supply
 * without taking it over. Demand must never touch shape probability.
 *
 * The bag lives in the state, not in this module. A module-level bag would make
 * `place()` impure and would leak between cloned states, which is exactly what
 * the bot harness does thousands of times a second.
 */

function drawShape(rng: Rng, bag: string[]): string {
  if (bag.length === 0) bag.push(...shuffle(rng, TETROMINO_KEYS.slice()))
  return bag.pop()!
}

export function drawZone(rng: Rng, demand: Demand): Zone {
  const total = demand.R + demand.C + demand.I
  if (total <= 0 || nextFloat(rng) < BAG_UNIFORM_SHARE) {
    return ZONES[nextInt(rng, ZONES.length)]
  }
  let t = nextFloat(rng) * total
  for (const z of ZONES) {
    t -= demand[z]
    if (t <= 0) return z
  }
  return ZONES[ZONES.length - 1]
}

/** Mutates `bag` — callers pass the bag belonging to the state they are building. */
export function drawZonePiece(rng: Rng, bag: string[], demand: Demand): Piece {
  return makePiece('zone', drawShape(rng, bag), drawZone(rng, demand))
}

export function drawRoadPiece(rng: Rng): Piece {
  return makePiece('road', ROAD_KEYS[nextInt(rng, ROAD_KEYS.length)], null)
}

export function makeParkPiece(): Piece {
  return makePiece('park', 'park', null)
}
