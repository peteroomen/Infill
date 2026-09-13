/**
 * Every tunable in the game, in one block.
 *
 * Numbers marked HARNESS are guesses that `npm run model` exists to settle.
 * Nothing outside this file should contain a balance constant.
 */

export const W = 10
export const H = 10
export const AREA = W * H

/** Density ceiling. Overlapping a cell already at MAX_DENSITY is illegal. */
export const MAX_DENSITY = 3

/** cell = max(0, BASE_PER_DENSITY * d + Σ pair * min(d_own, d_neighbour)) */
export const BASE_PER_DENSITY = 10

export const PAIR_RC = 5
export const PAIR_CI = 5
export const PAIR_RI = -8
export const PAIR_BLIGHT = -5
export const PAIR_PARK = 5

/** Cells of the highest-demand zone count this many times. */
export const DEMAND_BONUS = 2

/** Multi-line bonus: 1 + STEP * (n - 1), capped. */
export const MULTI_STEP = 0.25
export const MULTI_CAP = 2

/** Demand bars. */
export const DEMAND_MAX = 100
export const DEMAND_START = { R: 30, C: 25, I: 20 }
export const DEMAND_RESET = 60
/** Base growth per bar per zone placement. Roads and the bulldozer do not advance it. */
export const GROWTH_BASE = 1
/** Every DECADE placements, every bar's growth rises by 1. */
export const DECADE = 25            // HARNESS
/** A zone's own overflow permanently adds this to its growth. */
export const OVERFLOW_GROWTH = 1

/** Bag: zone draw is a mixture of uniform and demand-weighted. */
export const BAG_UNIFORM_SHARE = 0.75

/** Works slot: successful placements after spending it before it refills. */
export const WORKS_COOLDOWN = 3

/** Bulldozer. */
export const CHARGES_START = 1
export const CHARGES_MAX = 3
export const POPULATION_PER_CHARGE = 1500   // HARNESS

/** A park is owed every PARK_EVERY lines cleared. */
export const PARK_EVERY = 5                 // HARNESS
