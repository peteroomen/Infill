import { useCallback, useEffect, useRef, useState } from 'react'
import { W, H } from './game/constants'
import { bulldoze, newGame, place, rotateSlot } from './game/engine'
import { idx } from './game/grid'
import { pieceExtent, rotated } from './game/pieces'
import { canPlace } from './game/rules'
import type { Piece, State } from './game/types'
import { hit, layout } from './render/layout'
import { render, type DragView } from './render/renderer'
import * as T from './render/theme'

interface Grab {
  source: 'hand' | 'works'
  slot: number
  piece: Piece
  startX: number
  startY: number
  startT: number
  moved: boolean
  x: number
  y: number
}

const DRAG_THRESHOLD = 8
const HOLD_MS = 340

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [state, setState] = useState<State>(() => newGame())
  const [armed, setArmed] = useState(false)
  const [inspect, setInspect] = useState<number | null>(null)
  const grabRef = useRef<Grab | null>(null)
  const holdRef = useRef<number | null>(null)
  const pulseRef = useRef(0)
  const sizeRef = useRef({ w: 390, h: 844 })
  const [, forceDraw] = useState(0)

  /** Board cell under a point, with the piece centred and the offset flipped near the top. */
  const anchorFor = useCallback((piece: Piece, px: number, py: number) => {
    const L = layout(sizeRef.current.w, sizeRef.current.h)
    const c = L.cell
    const { w: pw, h: ph } = pieceExtent(piece)
    let ty = py - c * 1.15
    if (ty - (ph / 2) * c < L.board.y - c * 0.5) ty = py + c * 0.75
    const ax = Math.round((px - L.board.x) / c - pw / 2)
    const ay = Math.round((ty - L.board.y) / c - ph / 2)
    return { ax, ay }
  }, [])

  const dragView = useCallback((): DragView | null => {
    const g = grabRef.current
    if (!g || !g.moved) return null
    const { ax, ay } = anchorFor(g.piece, g.x, g.y)
    return { piece: g.piece, ax, ay, legal: canPlace(state.board, g.piece, ax, ay) }
  }, [state, anchorFor])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { w, h } = sizeRef.current
    const dpr = Math.min(window.devicePixelRatio || 1, 3)
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr
      canvas.height = h * dpr
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    render(ctx, { state, drag: dragView(), bulldozeArmed: armed || state.mustBulldoze, inspect, clearPulse: pulseRef.current }, w, h)
  }, [state, armed, inspect, dragView])

  useEffect(() => {
    const onResize = () => {
      const el = canvasRef.current?.parentElement
      sizeRef.current = {
        w: el?.clientWidth || window.innerWidth,
        h: el?.clientHeight || window.innerHeight,
      }
      draw()
    }
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [draw])

  useEffect(() => {
    draw()
  }, [draw])

  // Clear pulse. The one indulgence: a thin clear is over instantly, a big one holds.
  useEffect(() => {
    if (!state.lastClear) return
    pulseRef.current = 1
    let raf = 0
    const hold = 90 + state.lastClear.lineCount * 70
    const t0 = performance.now()
    const step = () => {
      const t = performance.now() - t0
      pulseRef.current = Math.max(0, 1 - t / hold)
      forceDraw((n) => n + 1)
      if (pulseRef.current > 0) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [state.lastClear])

  const pointFrom = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const boardCell = (px: number, py: number): number | null => {
    const L = layout(sizeRef.current.w, sizeRef.current.h)
    if (!hit(L.board, px, py)) return null
    const x = Math.floor((px - L.board.x) / L.cell)
    const y = Math.floor((py - L.board.y) / L.cell)
    if (x < 0 || x >= W || y < 0 || y >= H) return null
    return idx(x, y)
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (state.over) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const { x, y } = pointFrom(e)
    const L = layout(sizeRef.current.w, sizeRef.current.h)

    if (hit(L.tool, x, y)) {
      if (state.charges > 0) setArmed((a) => !a)
      return
    }

    for (let i = 0; i < L.slots.length; i++) {
      if (hit(L.slots[i], x, y) && state.hand[i]) {
        grabRef.current = { source: 'hand', slot: i, piece: state.hand[i]!, startX: x, startY: y, startT: performance.now(), moved: false, x, y }
        return
      }
    }
    if (hit(L.works, x, y) && state.works) {
      grabRef.current = { source: 'works', slot: 0, piece: state.works, startX: x, startY: y, startT: performance.now(), moved: false, x, y }
      return
    }

    const cell = boardCell(x, y)
    if (cell !== null) {
      holdRef.current = window.setTimeout(() => {
        setInspect(cell)
        holdRef.current = null
      }, HOLD_MS)
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const { x, y } = pointFrom(e)
    const g = grabRef.current
    if (g) {
      g.x = x
      g.y = y
      if (!g.moved && Math.hypot(x - g.startX, y - g.startY) > DRAG_THRESHOLD) g.moved = true
      if (g.moved) forceDraw((n) => n + 1)
      return
    }
    if (holdRef.current !== null) {
      clearTimeout(holdRef.current)
      holdRef.current = null
    }
    if (inspect !== null) {
      const cell = boardCell(x, y)
      if (cell !== null && cell !== inspect) setInspect(cell)
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const { x, y } = pointFrom(e)
    if (holdRef.current !== null) {
      clearTimeout(holdRef.current)
      holdRef.current = null
    }
    if (inspect !== null) {
      setInspect(null)
      grabRef.current = null
      return
    }

    const g = grabRef.current
    grabRef.current = null

    if (g) {
      if (!g.moved) {
        // A tap rotates. Rotation is not a turn and must not advance the RNG.
        setState((s) => rotateSlot(s, g.source, g.slot, rotated))
        return
      }
      const { ax, ay } = anchorFor(g.piece, x, y)
      setState((s) => {
        const next = place(s, { source: g.source, slot: g.slot, piece: g.piece, x: ax, y: ay })
        if (next !== s) setArmed(false)
        return next
      })
      return
    }

    const cell = boardCell(x, y)
    if (cell !== null && (armed || state.mustBulldoze) && state.charges > 0) {
      setState((s) => bulldoze(s, cell))
      setArmed(false)
    }
  }

  return (
    <div className="app">
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
      {state.over && (
        <div className="over">
          <div className="over-card">
            <p className="eyebrow">Buildout complete</p>
            <h1>{state.population.toLocaleString()}</h1>
            <p className="sub">population</p>
            <dl>
              <div><dt>Placements</dt><dd>{state.placements}</dd></div>
              <div><dt>Lines</dt><dd>{state.lines}</dd></div>
              <div><dt>Blight</dt><dd>{state.blightEvents}</dd></div>
            </dl>
            <button onClick={() => { setState(newGame()); setArmed(false) }} style={{ background: T.ZONE_ACCENT.R }}>
              New plan
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
