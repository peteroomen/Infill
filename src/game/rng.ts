import type { Rng } from './types'

/** mulberry32 — small, fast, and deterministic, so a seed reproduces a run exactly. */
export function nextFloat(rng: Rng): number {
  rng.seed = (rng.seed + 0x6d2b79f5) | 0
  let t = rng.seed
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

export function nextInt(rng: Rng, n: number): number {
  return Math.floor(nextFloat(rng) * n)
}

export function makeRng(seed: number): Rng {
  return { seed: seed | 0 }
}

/** Fisher-Yates, in place, using the supplied stream. */
export function shuffle<T>(rng: Rng, xs: T[]): T[] {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = nextInt(rng, i + 1)
    const a = xs[i]
    xs[i] = xs[j]
    xs[j] = a
  }
  return xs
}
