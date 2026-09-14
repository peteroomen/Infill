import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { H, W } from './game/constants'
import { bulldoze, newGame, place, rotateSlot } from './game/engine'
import { idx } from './game/grid'
import { clearSave, loadBest, loadGame, recordBest, saveGame } from './game/persist'
import { allRotations, pieceExtent, rotated } from './game/pieces'
import { canPlace } from './game/rules'
import { loadSeen, nextTip, saveSeen } from './game/tips'
import type { Piece, State } from './game/types'
import { hit, layout } from './render/layout'
import { onArtReady } from './render/art'
import { render, type DragView } from './render/renderer'
import { setHighContrast } from './render/theme'
import { buzz, loadSettings, saveSettings, type Settings } from './settings'
import { GameOver, PauseButton, PauseMenu, TipCard } from './ui/Overlays'

interface Grab {
  source: 'hand' | 'works'
  slot: number
  piece: Piece
  startX: number
  startY: number
  moved: boolean
  x: number
  y: number
}

const DRAG_THRESHOLD = 8
const HOLD_MS = 340

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [settings, setSettings] = useState<Settings>(() => loadSettings())
  const [state, setState] = useState<State>(() => loadGame() ?? newGame())
  const [best, setBest] = useState<number>(() => loadBest())
  const [paused, setPaused] = useState(false)
  const [armed, setArmed] = useState(false)
  const [inspect, setInspect] = useState<number | null>(null)
  const [seen, setSeen] = useState<Set<string>>(() => loadSeen())
  const [dismissedThisRun, setDismissedThisRun] = useState(false)

  const grabRef = useRef<Grab | null>(null)
  const holdRef = useRef<number | null>(null)
  const pulseRef = useRef(0)
  const sizeRef = useRef({ w: 390, h: 844 })
  const [tick, forceDraw] = useState(0)

  const tip = useMemo(
    () => (settings.hints && !paused && !state.over ? nextTip(state, seen) : null),
    [settings.hints, paused, state, seen],
  )
  void dismissedThisRun

  // Contrast swaps live bindings in the theme, so a redraw has to follow it.
  useEffect(() => {
    setHighContrast(settings.highContrast)
    saveSettings(settings)
    forceDraw((n) => n + 1)
  }, [settings])

  useEffect(() => {
    if (state.over) {
      clearSave()
      setBest(recordBest(state.population))
    } else {
      saveGame(state)
    }
  }, [state])

  const anchorFor = useCallback(
    (piece: Piece, px: number, py: number) => {
      const L = layout(sizeRef.current.w, sizeRef.current.h)
      const c = L.cell
      const { w: pw, h: ph } = pieceExtent(piece)
      // The piece sits clear of the finger. Near the top edge it flips below,
      // because otherwise the top rows cannot be reached at all.
      let ty = settings.leftHanded ? py + c * 0.9 : py - c * 1.15
      if (!settings.leftHanded && ty - (ph / 2) * c < L.board.y - c * 0.5) ty = py + c * 0.75
      return {
        ax: Math.round((px - L.board.x) / c - pw / 2),
        ay: Math.round((ty - L.board.y) / c - ph / 2),
      }
    },
    [settings.leftHanded],
  )

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
    render(
      ctx,
      {
        state,
        drag: dragView(),
        bulldozeArmed: armed || state.mustBulldoze,
        inspect,
        clearPulse: settings.reducedMotion ? 0 : pulseRef.current,
        drawnTiles: settings.highContrast,
      },
      w,
      h,
    )
  }, [state, armed, inspect, dragView, settings.reducedMotion, settings.highContrast])

  useEffect(() => onArtReady(() => forceDraw((n) => n + 1)), [])

  useEffect(() => {
    const onResize = () => {
      const el = canvasRef.current?.parentElement
      sizeRef.current = {
        w: el?.clientWidth || window.innerWidth,
        h: el?.clientHeight || window.innerHeight,
      }
      forceDraw((n) => n + 1)
    }
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    draw()
  }, [draw, tick])

  // A thin clear is over instantly; a big one holds the screen.
  useEffect(() => {
    if (!state.lastClear || settings.reducedMotion) return
    pulseRef.current = 1
    const hold = 90 + state.lastClear.lineCount * 70
    const t0 = performance.now()
    let raf = requestAnimationFrame(function step() {
      pulseRef.current = Math.max(0, 1 - (performance.now() - t0) / hold)
      forceDraw((n) => n + 1)
      if (pulseRef.current > 0) raf = requestAnimationFrame(step)
    })
    return () => cancelAnimationFrame(raf)
  }, [state.lastClear, settings.reducedMotion])

  const pointFrom = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  const boardCell = (px: number, py: number): number | null => {
    const L = layout(sizeRef.current.w, sizeRef.current.h)
    if (!hit(L.board, px, py)) return null
    const x = Math.floor((px - L.board.x) / L.cell)
    const y = Math.floor((py - L.board.y) / L.cell)
    return x < 0 || x >= W || y < 0 || y >= H ? null : idx(x, y)
  }

  const blocked = paused || state.over

  const onPointerDown = (e: React.PointerEvent) => {
    if (blocked) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const { x, y } = pointFrom(e)
    const L = layout(sizeRef.current.w, sizeRef.current.h)

    if (hit(L.tool, x, y)) {
      if (state.charges > 0) {
        setArmed((a) => !a)
        buzz(settings, 8)
      }
      return
    }
    for (let i = 0; i < L.slots.length; i++) {
      if (hit(L.slots[i], x, y) && state.hand[i]) {
        grabRef.current = { source: 'hand', slot: i, piece: state.hand[i]!, startX: x, startY: y, moved: false, x, y }
        return
      }
    }
    if (hit(L.works, x, y) && state.works) {
      grabRef.current = { source: 'works', slot: 0, piece: state.works, startX: x, startY: y, moved: false, x, y }
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
    if (blocked) return
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
    if (blocked) return
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
        setState((s) => rotateSlot(s, g.source, g.slot, rotated))
        buzz(settings, 5)
        return
      }
      const { ax, ay } = anchorFor(g.piece, x, y)
      setState((s) => {
        const next = place(s, { source: g.source, slot: g.slot, piece: g.piece, x: ax, y: ay })
        if (next === s) {
          buzz(settings, 22) // refused
        } else {
          buzz(settings, next.lastClear ? 28 : 10)
          setArmed(false)
        }
        return next
      })
      return
    }

    const cell = boardCell(x, y)
    if (cell !== null && (armed || state.mustBulldoze) && state.charges > 0) {
      setState((s) => bulldoze(s, cell))
      setArmed(false)
      buzz(settings, 18)
    }
  }

  // A playtest-only handle, so the browser harness can drive to late-game states
  // without a thousand scripted drags. `vite build` (production mode) never
  // includes this branch — it is dead code the bundler drops.
  useEffect(() => {
    if (import.meta.env.MODE !== 'playtest') return
    ;(window as unknown as Record<string, unknown>).__infill = {
      get state() {
        return state
      },
      setState,
      layout: () => layout(sizeRef.current.w, sizeRef.current.h),
      settings,
      setSettings,
      // Exposed so the harness tests the real rule rather than a copy of it.
      canPlace: (piece: Piece, x: number, y: number) => canPlace(state.board, piece, x, y),
      rotations: (piece: Piece) => allRotations(piece).length,
    }
  }, [state, settings])

  const restart = () => {
    clearSave()
    setState(newGame())
    setArmed(false)
    setPaused(false)
    setDismissedThisRun(false)
  }

  const dismissTip = () => {
    if (!tip) return
    const next = new Set(seen)
    next.add(tip.id)
    setSeen(next)
    saveSeen(next)
    setDismissedThisRun(true)
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
      {!state.over && <PauseButton onClick={() => setPaused(true)} />}
      {tip && <TipCard tip={tip} onDismiss={dismissTip} />}
      {paused && !state.over && (
        <PauseMenu
          state={state}
          best={best}
          settings={settings}
          onSettings={setSettings}
          onResume={() => setPaused(false)}
          onRestart={restart}
        />
      )}
      {state.over && (
        <GameOver state={state} best={best} isBest={state.population >= best && state.population > 0} onRestart={restart} />
      )}
    </div>
  )
}
