import { beforeEach, describe, expect, it } from 'vitest'
import { WORKS_COOLDOWN } from './constants'
import { newGame, place } from './engine'
import { emptyBoard, idx } from './grid'
import { makePiece } from './pieces'
import { decodeSave, encodeSave } from './persist'
import { settlePlacement } from './settle'
import { loadSeen, nextTip, saveSeen, TIPS } from './tips'
import type { Cell, State, Zone } from './types'

function zone(z: Zone, d: number): Cell {
  return { kind: 'zone', zone: z, density: d }
}

/** Vitest runs in node; the storage-backed helpers need somewhere to write. */
function installStorage(): void {
  const map = new Map<string, string>()
  ;(globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size
    },
  } as Storage
}

describe('saving', () => {
  it('round-trips a game in progress', () => {
    let s = newGame(77)
    s = place(s, { source: 'hand', slot: 0, piece: s.hand[0]!, x: 0, y: 0 })
    const back = decodeSave(encodeSave(s))
    expect(back).not.toBeNull()
    expect(back!.population).toBe(s.population)
    expect(back!.placements).toBe(s.placements)
    expect(back!.board).toEqual(s.board)
    expect(back!.rng).toEqual(s.rng)
    expect(back!.shapeBag).toEqual(s.shapeBag)
  })

  it('resumes into the same future, because the rng rides along', () => {
    let a = newGame(99)
    for (let i = 0; i < 6; i++) {
      const p = a.hand.find(Boolean)
      if (!p) break
      a = place(a, { source: 'hand', slot: a.hand.indexOf(p), piece: p, x: 0, y: i })
    }
    const b = decodeSave(encodeSave(a))!
    const step = (s: State) => {
      const p = s.hand.find(Boolean)!
      return place(s, { source: 'hand', slot: s.hand.indexOf(p), piece: p, x: 4, y: 8 })
    }
    expect(step(b).hand.map((p) => p && `${p.shape}${p.zone}`)).toEqual(
      step(a).hand.map((p) => p && `${p.shape}${p.zone}`),
    )
  })

  it('refuses a save from another version', () => {
    const raw = JSON.parse(encodeSave(newGame(1)))
    raw.version = 999
    expect(decodeSave(JSON.stringify(raw))).toBeNull()
  })

  it('refuses a finished run, corrupt json, and a wrong-sized board', () => {
    const over = { ...newGame(1), over: true }
    expect(decodeSave(encodeSave(over))).toBeNull()
    expect(decodeSave('{ not json')).toBeNull()
    expect(decodeSave(null)).toBeNull()
    const short = JSON.parse(encodeSave(newGame(1)))
    short.state.board = short.state.board.slice(0, 40)
    expect(decodeSave(JSON.stringify(short))).toBeNull()
  })
})

describe('tips', () => {
  beforeEach(installStorage)

  it('opens by telling you how to place', () => {
    expect(nextTip(newGame(1), new Set())?.id).toBe('place')
  })

  it('shows each card once, ever', () => {
    const s = newGame(1)
    const first = nextTip(s, new Set())!
    expect(nextTip(s, new Set([first.id]))?.id).not.toBe(first.id)
  })

  it('says nothing once the run is over', () => {
    expect(nextTip({ ...newGame(1), over: true }, new Set())).toBeNull()
  })

  it('holds the overlap card until an overlap is actually available', () => {
    const tip = TIPS.find((t) => t.id === 'overlap')!
    const bare = { ...newGame(5), placements: 9 }
    bare.board = emptyBoard()
    expect(tip.when(bare)).toBe(false)

    const ready = { ...bare }
    ready.board = emptyBoard()
    ready.hand = [makePiece('zone', 'O', 'R'), null, null]
    for (const i of [idx(0, 0), idx(1, 0), idx(0, 1), idx(1, 1)]) ready.board[i] = zone('R', 1)
    expect(tip.when(ready)).toBe(true)
  })

  it('holds the blight card until there is blight', () => {
    const tip = TIPS.find((t) => t.id === 'blight')!
    const s = newGame(5)
    expect(tip.when(s)).toBe(false)
    s.board[idx(3, 3)] = { kind: 'blight', zone: null, density: 1 }
    expect(tip.when(s)).toBe(true)
  })

  it('persists what has been seen', () => {
    saveSeen(new Set(['place', 'line']))
    expect(loadSeen()).toEqual(new Set(['place', 'line']))
  })

  it('has no duplicate ids', () => {
    expect(new Set(TIPS.map((t) => t.id)).size).toBe(TIPS.length)
  })
})

describe('the hand and the works slot', () => {
  it('refills all three slots only once all three are spent', () => {
    let s = newGame(31)
    s.board = emptyBoard()
    const ids = () => s.hand.map((p) => (p ? `${p.shape}${p.zone}` : null))
    const before = ids()
    s = settlePlacement(s, s.hand[0]!, 0, 0, 'hand', 0)
    expect(s.hand[1] && ids()[1]).toBe(before[1]) // untouched
    expect(s.hand[0]).toBeNull()
    s = settlePlacement(s, s.hand[1]!, 0, 2, 'hand', 1)
    expect(s.hand[2]).not.toBeNull()
    s = settlePlacement(s, s.hand[2]!, 0, 4, 'hand', 2)
    expect(s.hand.every((p) => p !== null)).toBe(true)
  })

  it('refills the works slot three placements after it is spent', () => {
    let s = newGame(17)
    s.board = emptyBoard()
    expect(s.works).not.toBeNull()
    s = settlePlacement(s, s.works!, 0, 9, 'works', 0)
    expect(s.works).toBeNull()
    expect(s.worksCooldown).toBe(WORKS_COOLDOWN)
    for (let i = 0; i < WORKS_COOLDOWN - 1; i++) {
      s = settlePlacement(s, makePiece('zone', 'O', 'R'), 0, i * 2, 'hand', 0)
      expect(s.works).toBeNull()
    }
    s = settlePlacement(s, makePiece('zone', 'O', 'C'), 6, 0, 'hand', 0)
    expect(s.works).not.toBeNull()
  })

  it('spends a queued park before drawing another road', () => {
    let s = newGame(23)
    s.board = emptyBoard()
    s.works = null
    s.worksCooldown = 1
    s.parkQueue = 1
    s = settlePlacement(s, makePiece('zone', 'O', 'R'), 0, 0, 'hand', 0)
    expect(s.works?.kind).toBe('park')
    expect(s.parkQueue).toBe(0)
  })
})

describe('demand', () => {
  it('relieves each zone by the density it harvested, and no other', () => {
    const s = newGame(41)
    s.board = emptyBoard()
    for (let x = 1; x < 10; x++) s.board[idx(x, 0)] = zone('C', 2)
    s.demand = { R: 50, C: 50, I: 50 }
    const out = settlePlacement(s, makePiece('zone', 'O', 'C'), 0, 0, 'hand', 0)
    // Nine commercial cells at density 2 harvested, plus the two this piece added.
    expect(out.demand.C).toBeLessThan(50)
    expect(out.demand.R).toBe(51)
    expect(out.demand.I).toBe(51)
  })

  it('counts an intersection cell once for relief', () => {
    const s = newGame(43)
    s.board = emptyBoard()
    for (let x = 1; x < 10; x++) s.board[idx(x, 0)] = zone('R', 1)
    for (let y = 1; y < 10; y++) s.board[idx(0, y)] = zone('R', 1)
    s.demand = { R: 90, C: 10, I: 10 }
    const out = settlePlacement(s, makePiece('park', 'park', null), 0, 0, 'works', 0)
    expect(out.lines).toBe(2)
    // 18 residential cells at density 1, each counted exactly once.
    expect(out.demand.R).toBe(90 - 18)
  })
})
