import type { State } from './types'

/**
 * Saving is a straight serialisation of the state, because the state is plain
 * data and `place()` is pure — there is nothing live in it to rebuild.
 *
 * The version tag matters more than it looks. A rules change can make an old
 * save nonsense (a board holding blight that used to clear, a demand curve that
 * no longer exists), and silently restoring one produces a game that behaves
 * like neither version. Bump VERSION whenever the shape or the rules move, and
 * old saves are dropped rather than half-honoured.
 */
const VERSION = 3
const KEY = 'infill.save.v1'
const BEST_KEY = 'infill.best.v1'

export interface Save {
  version: number
  state: State
  savedAt: number
}

/** localStorage throws in private mode and in some embedded webviews. */
function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* full, blocked, or private — the game still plays, it just won't resume */
  }
}

function safeRemove(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    /* as above */
  }
}

export function encodeSave(state: State): string {
  return JSON.stringify({ version: VERSION, state, savedAt: Date.now() } satisfies Save)
}

export function decodeSave(raw: string | null): State | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<Save>
    if (parsed?.version !== VERSION) return null
    const s = parsed.state
    if (!s || !Array.isArray(s.board) || s.board.length !== 100) return null
    if (!Array.isArray(s.hand) || typeof s.population !== 'number') return null
    if (s.over) return null // a finished run is not worth resuming
    return s as State
  } catch {
    return null
  }
}

export function saveGame(state: State): void {
  if (state.over) return clearSave()
  safeSet(KEY, encodeSave(state))
}

export function loadGame(): State | null {
  return decodeSave(safeGet(KEY))
}

export function clearSave(): void {
  safeRemove(KEY)
}

export function loadBest(): number {
  const n = Number(safeGet(BEST_KEY))
  return Number.isFinite(n) && n > 0 ? n : 0
}

export function recordBest(population: number): number {
  const best = Math.max(loadBest(), population)
  safeSet(BEST_KEY, String(best))
  return best
}
