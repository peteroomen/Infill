import { describe, expect, it } from 'vitest'
import { DEMAND_START, H, MAX_DENSITY, PARK_EVERY, W } from './constants'
import { bulldoze, newGame, place } from './engine'
import { cloneState, completeLines, emptyBoard, idx } from './grid'
import { makePiece } from './pieces'
import { neighbourIndices } from './rays'
import { applyPiece, canPlace } from './rules'
import { multiLineMultiplier, pairValue, scoreCell, topZones } from './score'
import { checkFailure, settlePlacement } from './settle'
import type { Cell, State, Zone } from './types'
import { emptyCell } from './types'

function zone(z: Zone, d: number): Cell {
  return { kind: 'zone', zone: z, density: d }
}
function road(): Cell {
  return { kind: 'road', zone: null, density: 1 }
}

function boardWith(cells: Record<number, Cell>): Cell[] {
  const b = emptyBoard()
  for (const [k, v] of Object.entries(cells)) b[Number(k)] = v
  return b
}

describe('placement legality', () => {
  it('accepts empty ground', () => {
    expect(canPlace(emptyBoard(), makePiece('zone', 'O', 'R'), 0, 0)).toBe(true)
  })

  it('accepts same-zone overlap below the ceiling', () => {
    const b = boardWith({ [idx(0, 0)]: zone('R', 2) })
    expect(canPlace(b, makePiece('zone', 'O', 'R'), 0, 0)).toBe(true)
  })

  it('rejects overlap at the density ceiling', () => {
    const b = boardWith({ [idx(0, 0)]: zone('R', MAX_DENSITY) })
    expect(canPlace(b, makePiece('zone', 'O', 'R'), 0, 0)).toBe(false)
  })

  it('rejects overlap of a different zone', () => {
    const b = boardWith({ [idx(0, 0)]: zone('C', 1) })
    expect(canPlace(b, makePiece('zone', 'O', 'R'), 0, 0)).toBe(false)
  })

  it('rejects roads and parks on anything but bare ground', () => {
    const b = boardWith({ [idx(0, 0)]: zone('R', 1) })
    expect(canPlace(b, makePiece('road', 'r2', null), 0, 0)).toBe(false)
    expect(canPlace(b, makePiece('park', 'park', null), 0, 0)).toBe(false)
  })

  it('rejects a piece that leaves the board', () => {
    expect(canPlace(emptyBoard(), makePiece('zone', 'I', 'R'), 8, 0)).toBe(false)
  })

  it('raises density rather than adding a cell when overlapping', () => {
    const b = boardWith({ [idx(0, 0)]: zone('R', 1), [idx(1, 0)]: zone('R', 2) })
    applyPiece(b, makePiece('zone', 'O', 'R'), 0, 0)
    expect(b[idx(0, 0)].density).toBe(2)
    expect(b[idx(1, 0)].density).toBe(3)
    expect(b[idx(0, 1)].density).toBe(1)
  })
})

describe('road line of sight', () => {
  it('sees through consecutive roads', () => {
    const b = boardWith({
      [idx(0, 0)]: zone('R', 1),
      [idx(1, 0)]: road(),
      [idx(2, 0)]: road(),
      [idx(3, 0)]: zone('C', 1),
    })
    expect(neighbourIndices(b, idx(0, 0))[1]).toBe(idx(3, 0))
  })

  it('stops at empty, blight and the edge', () => {
    const b = boardWith({
      [idx(1, 1)]: zone('R', 1),
      [idx(2, 1)]: road(),
      [idx(3, 1)]: emptyCell(),
    })
    const n = neighbourIndices(b, idx(1, 1))
    expect(n[1]).toBe(idx(3, 1)) // empty stops the ray and is a neighbour worth 0
    expect(n[3]).toBe(idx(0, 1))
    expect(neighbourIndices(b, idx(0, 0))[0]).toBeNull() // edge
  })

  it('does not turn corners', () => {
    // An L of road: a house below the bend must not see a shop beside the arm.
    const b = boardWith({
      [idx(0, 0)]: zone('R', 1),
      [idx(0, 1)]: road(),
      [idx(1, 1)]: road(),
      [idx(2, 1)]: zone('C', 3),
    })
    const n = neighbourIndices(b, idx(0, 0))
    expect(n).not.toContain(idx(2, 1))
  })

  it('never yields more than four neighbours however long the road', () => {
    const b = emptyBoard()
    for (let x = 1; x < W; x++) b[idx(x, 0)] = road()
    b[idx(0, 0)] = zone('R', 1)
    expect(neighbourIndices(b, idx(0, 0)).length).toBe(4)
  })
})

describe('scoring', () => {
  it('scales a pair by the lower of the two densities', () => {
    const b = boardWith({ [idx(0, 0)]: zone('R', 1), [idx(1, 0)]: zone('C', 3) })
    expect(scoreCell(b, idx(0, 0))).toBe(10 + 5 * 1)
  })

  it('makes density pay more per unit, without reviving donor farming', () => {
    const per = [1, 2, 3].map((d) => {
      const b = boardWith({ [idx(0, 0)]: zone('R', d), [idx(1, 0)]: zone('C', 3) })
      return scoreCell(b, idx(0, 0)) / d
    })
    expect(per).toEqual([15, 17.5, 20])
    // Rising, so upzoning is worth the tempo it costs...
    expect(per[2]).toBeGreaterThan(per[0])
    // ...and a cheap cell still cannot milk a dense neighbour: min() caps the pair.
    const cheap = boardWith({ [idx(0, 0)]: zone('R', 1), [idx(1, 0)]: zone('C', 3) })
    const dense = boardWith({ [idx(0, 0)]: zone('R', 1), [idx(1, 0)]: zone('C', 1) })
    expect(scoreCell(cheap, idx(0, 0))).toBe(scoreCell(dense, idx(0, 0)))
  })

  it('floors a poisoned cell at zero rather than going negative', () => {
    const b = boardWith({ [idx(0, 0)]: zone('R', 1), [idx(1, 0)]: zone('I', 3) })
    expect(scoreCell(b, idx(0, 0))).toBe(Math.max(0, 10 - 8))
  })

  it('gives roads, blight and parks no score of their own', () => {
    const b = boardWith({
      [idx(0, 0)]: road(),
      [idx(1, 0)]: { kind: 'blight', zone: null, density: 1 },
      [idx(2, 0)]: { kind: 'park', zone: null, density: 1 },
    })
    expect(scoreCell(b, idx(0, 0))).toBe(0)
    expect(scoreCell(b, idx(1, 0))).toBe(0)
    expect(scoreCell(b, idx(2, 0))).toBe(0)
  })

  it('treats a park as a neighbour of unlimited density', () => {
    const b = boardWith({
      [idx(0, 0)]: zone('R', 3),
      [idx(1, 0)]: { kind: 'park', zone: null, density: 1 },
    })
    expect(scoreCell(b, idx(0, 0))).toBe(45 + 5 * 3)
  })

  it('pays nothing for same-zone adjacency', () => {
    const b = boardWith({ [idx(0, 0)]: zone('R', 2), [idx(1, 0)]: zone('R', 3) })
    expect(scoreCell(b, idx(0, 0))).toBe(25)
    expect(pairValue(zone('R', 1), zone('R', 1))).toBe(0)
  })

  it('caps the multi-line bonus at x2', () => {
    expect(multiLineMultiplier(1)).toBe(1)
    expect(multiLineMultiplier(2)).toBe(1.25)
    expect(multiLineMultiplier(5)).toBe(2)
    expect(multiLineMultiplier(9)).toBe(2)
  })

  it('lets every tied zone qualify for the demand bonus', () => {
    expect(topZones({ R: 40, C: 40, I: 10 })).toEqual(new Set(['R', 'C']))
  })
})

describe('the worked example from the design doc', () => {
  // Four R at d2, four C at d1, two roads; one d3 industrial below the leftmost R.
  function row(withFactory: Cell | null): Cell[] {
    const b = emptyBoard()
    for (let x = 0; x < 4; x++) b[idx(x, 0)] = zone('R', 2)
    for (let x = 4; x < 8; x++) b[idx(x, 0)] = zone('C', 1)
    b[idx(8, 0)] = road()
    b[idx(9, 0)] = road()
    if (withFactory) b[idx(0, 1)] = withFactory
    return b
  }

  it('scores 134 raw, 223 with residential demand doubled', () => {
    const b = row(zone('I', 3))
    const values = [0, 1, 2, 3, 4, 5, 6, 7].map((x) => scoreCell(b, idx(x, 0)))
    expect(values).toEqual([9, 25, 25, 30, 15, 10, 10, 10])
    const raw = values.reduce((a, c) => a + c, 0)
    expect(raw).toBe(134)
    const doubled = values.slice(0, 4).reduce((a, c) => a + c, 0) * 2 + values.slice(4).reduce((a, c) => a + c, 0)
    expect(doubled).toBe(223)
  })

  it('scores 255 with the factory out of contact and 275 as a shop', () => {
    for (const [neighbour, expected] of [[null, 255], [zone('C', 3), 275]] as const) {
      const b = row(neighbour)
      const values = [0, 1, 2, 3, 4, 5, 6, 7].map((x) => scoreCell(b, idx(x, 0)))
      const total = values.slice(0, 4).reduce((a, c) => a + c, 0) * 2 + values.slice(4).reduce((a, c) => a + c, 0)
      expect(total).toBe(expected)
    }
  })
})

describe('lines', () => {
  it('counts roads as filled', () => {
    const b = emptyBoard()
    for (let x = 0; x < W; x++) b[idx(x, 0)] = x < 5 ? road() : zone('R', 1)
    expect(completeLines(b).length).toBe(1)
  })

  it('lets one blight cell block its whole row and column', () => {
    const b = emptyBoard()
    for (let x = 0; x < W; x++) b[idx(x, 0)] = zone('R', 1)
    for (let y = 0; y < H; y++) b[idx(0, y)] = zone('R', 1)
    expect(completeLines(b).length).toBe(2) // the row and the column
    b[idx(0, 0)] = { kind: 'blight', zone: null, density: 1 }
    expect(completeLines(b).length).toBe(0) // one cell at the intersection kills both
  })

  it('never clears blight, so it accumulates until bulldozed', () => {
    const b = emptyBoard()
    for (let x = 0; x < W; x++) b[idx(x, 0)] = zone('R', 1)
    b[idx(3, 1)] = { kind: 'blight', zone: null, density: 1 }
    const s = newGame(2)
    s.board = b
    const out = settlePlacement(s, makePiece('park', 'park', null), 5, 5, 'works', 0)
    expect(out.board[idx(3, 1)].kind).toBe('blight')
  })

  it('does not complete a line containing an empty cell', () => {
    const b = emptyBoard()
    for (let x = 0; x < W - 1; x++) b[idx(x, 0)] = zone('R', 1)
    expect(completeLines(b).length).toBe(0)
  })
})

describe('settlement', () => {
  function stateWith(board: Cell[], over: Partial<State> = {}): State {
    const s = newGame(1)
    s.board = board
    return { ...s, ...over }
  }

  it('scores a row and a column against one pre-removal snapshot', () => {
    // Fill row 0 and column 0 except their shared corner, then drop a single cell in.
    const b = emptyBoard()
    for (let x = 1; x < W; x++) b[idx(x, 0)] = zone('C', 1)
    for (let y = 1; y < H; y++) b[idx(0, y)] = zone('C', 1)
    const s = stateWith(b)
    const out = settlePlacement(s, makePiece('park', 'park', null), 0, 0, 'works', 0)
    expect(out.lines).toBe(2)
    // The corner is one building: counted once for population, twice for the bonus.
    const harvested = out.lastClear!.cells.map((c) => c.idx)
    expect(new Set(harvested).size).toBe(harvested.length)
    expect(harvested.length).toBe(W + H - 1)
  })

  it('removes harvested cells and banks them into the skyline', () => {
    const b = emptyBoard()
    for (let x = 1; x < W; x++) b[idx(x, 0)] = zone('R', 2)
    const s = stateWith(b)
    const out = settlePlacement(s, makePiece('park', 'park', null), 0, 0, 'works', 0)
    expect(out.board.slice(0, W).every((c) => c.kind === 'empty')).toBe(true)
    expect(out.skyline.length).toBe(W - 1)
    expect(out.skyline[0]).toEqual({ zone: 'R', density: 2 })
  })

  it('does not advance demand for a road or a park', () => {
    const s = newGame(7)
    const before = { ...s.demand }
    const out = settlePlacement(s, makePiece('road', 'r2', null), 0, 5, 'works', 0)
    expect(out.demand).toEqual(before)
  })

  it('advances demand for a zone placement', () => {
    const s = newGame(7)
    const out = settlePlacement(s, makePiece('zone', 'O', 'R'), 0, 5, 'hand', 0)
    expect(out.demand.C).toBe(DEMAND_START.C + 1)
  })

  it('lets a clear avert an overflow on the turn it would have happened', () => {
    const b = emptyBoard()
    for (let x = 1; x < W; x++) b[idx(x, 0)] = zone('R', 3)
    const s = stateWith(b)
    s.demand.R = 99
    const out = settlePlacement(s, makePiece('zone', 'O', 'R'), 0, 0, 'hand', 0)
    expect(out.blightEvents).toBe(0)
    expect(out.demand.R).toBeLessThan(99)
  })

  it('owes a park on population banked, not on line count', () => {
    let s = newGame(3)
    s.parkProgress = PARK_EVERY - 1
    const b = emptyBoard()
    for (let x = 1; x < W; x++) b[idx(x, 0)] = zone('R', 2)
    s.board = b
    s = settlePlacement(s, makePiece('zone', 'O', 'R'), 0, 0, 'hand', 0)
    expect(s.parkQueue + (s.works?.kind === 'park' ? 1 : 0)).toBeGreaterThanOrEqual(1)

    // A cheap line must not buy one: line count is farmable, population is not.
    let t = newGame(3)
    t.parkProgress = 0
    const c = emptyBoard()
    for (let x = 1; x < W; x++) c[idx(x, 0)] = { kind: 'road', zone: null, density: 1 }
    t.board = c
    t = settlePlacement(t, makePiece('road', 'r2', null), 0, 0, 'works', 0)
    expect(t.lines).toBe(1)
    expect(t.parkQueue).toBe(0)
  })
})

describe('failure', () => {
  it('does not end the run while a bulldoze would open a move', () => {
    const b = emptyBoard()
    for (let i = 0; i < b.length; i++) b[i] = zone('R', 3)
    b[idx(0, 0)] = { kind: 'blight', zone: null, density: 1 }
    const s = newGame(5)
    s.board = b
    s.hand = [makePiece('zone', 'O', 'C'), null, null]
    s.works = null
    s.charges = 1
    const out = bulldoze(s, idx(0, 0))
    expect(out.board[idx(0, 0)].kind).toBe('empty')
    expect(out.charges).toBe(0)
  })

  it('ends the run when nothing fits and no charge remains', () => {
    const s = newGame(5)
    for (let i = 0; i < s.board.length; i++) s.board[i] = zone('R', 3)
    s.hand = [makePiece('zone', 'O', 'C'), null, null]
    s.works = null
    s.charges = 0
    checkFailure(s)
    expect(s.over).toBe(true)
    expect(s.mustBulldoze).toBe(false)
  })

  it('asks for a bulldoze instead of ending when a charge would open a move', () => {
    const s = newGame(5)
    for (let i = 0; i < s.board.length; i++) s.board[i] = zone('R', 3)
    s.hand = [makePiece('park', 'park', null), null, null]
    s.works = null
    s.charges = 1
    checkFailure(s)
    expect(s.over).toBe(false)
    expect(s.mustBulldoze).toBe(true)
  })

  it('refuses an illegal placement without changing anything', () => {
    const s = newGame(5)
    for (let i = 0; i < s.board.length; i++) s.board[i] = zone('R', 3)
    const piece = makePiece('zone', 'O', 'C')
    expect(place(s, { source: 'hand', slot: 0, piece, x: 0, y: 0 })).toBe(s)
  })
})

describe('purity', () => {
  it('leaves the previous state untouched', () => {
    const s = newGame(11)
    const before = JSON.stringify(s)
    const piece = s.hand[0]!
    place(s, { source: 'hand', slot: 0, piece, x: 0, y: 0 })
    expect(JSON.stringify(s)).toBe(before)
  })

  it('reproduces a run exactly from a seed', () => {
    const run = (seed: number) => {
      let s = newGame(seed)
      for (let i = 0; i < 40 && !s.over; i++) {
        const piece = s.hand.find((p) => p) ?? s.works
        if (!piece) break
        const slot = s.hand.findIndex((p) => p === piece)
        let done = false
        for (let y = 0; y < 10 && !done; y++) {
          for (let x = 0; x < 10 && !done; x++) {
            const next = place(s, {
              source: slot >= 0 ? 'hand' : 'works',
              slot: Math.max(slot, 0),
              piece,
              x,
              y,
            })
            if (next !== s) {
              s = next
              done = true
            }
          }
        }
        if (!done) break
      }
      return s.population
    }
    expect(run(99)).toBe(run(99))
  })

  it('does not advance the random state on a rejected placement', () => {
    const s = newGame(21)
    const b = emptyBoard()
    for (let i = 0; i < b.length; i++) b[i] = zone('R', 3)
    const blocked = { ...cloneState(s), board: b }
    const out = place(blocked, { source: 'hand', slot: 0, piece: makePiece('zone', 'O', 'C'), x: 0, y: 0 })
    expect(out.rng.seed).toBe(blocked.rng.seed)
  })
})
