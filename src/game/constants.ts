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

/**
 * Base population by density, indexed 0..3. Deliberately SUPERLINEAR.
 *
 * With a linear base, min()-scaled synergy makes every density worth exactly the
 * same per unit invested — and since upzoning fills no new cell, it also costs
 * tempo. Flat return plus a tempo cost means a rational player never upzones and
 * the core verb is decoration; the harness measured exactly that, at 98% of all
 * harvest happening at density 1. Superlinear makes density pay 15 / 17.5 / 20
 * per unit while leaving the donor exploit dead, because the *neighbour* side is
 * still capped by min().
 */
export const DENSITY_VALUE = [0, 10, 25, 45]

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
/** Every DECADE placements, every bar's growth rises by 1 — up to GROWTH_MAX. */
export const DECADE = 25            // HARNESS
/** The ramp has to asymptote. Unbounded, it diverges and the economy stops meaning anything. */
export const GROWTH_MAX = 3         // HARNESS
/** A zone's own overflow permanently adds this to its growth, up to a cap. */
export const OVERFLOW_GROWTH = 1
export const OVERFLOW_GROWTH_MAX = 2
/** Blight spawns per placement, however many bars overflow at once. */
export const BLIGHT_PER_PLACEMENT = 1

/** Bag: zone draw is a mixture of uniform and demand-weighted. */
export const BAG_UNIFORM_SHARE = 0.75

/** Works slot: successful placements after spending it before it refills. */
export const WORKS_COOLDOWN = 3

/** Bulldozer. */
export const CHARGES_START = 1
export const CHARGES_MAX = 3
export const POPULATION_PER_CHARGE = 1500   // HARNESS

/**
 * A park is owed every PARK_EVERY population banked — not every N lines. Line
 * count is farmable with cheap, low-value lines; population is not.
 */
export const PARK_EVERY = 2200              // HARNESS
