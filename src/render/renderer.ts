import { DEMAND_MAX, H, W } from '../game/constants'
import { idx } from '../game/grid'
import { neighbourIndices } from '../game/rays'
import { canPlace } from '../game/rules'
import { scoreCell } from '../game/score'
import type { Piece, State, Zone } from '../game/types'
import { ZONES } from '../game/types'
import { artReady, drawArtLot, drawArtModel, drawArtPips, drawArtShadow, drawArtSkyline, drawArtSwatch } from './art'
import { hit, layout, type Layout, type Rect } from './layout'
import * as T from './theme'
import { drawCell, drawGhostCell, drawPieceSwatch, roundRect } from './tiles'

export interface DragView {
  piece: Piece
  ax: number
  ay: number
  legal: boolean
}

export interface View {
  state: State
  drag: DragView | null
  bulldozeArmed: boolean
  inspect: number | null
  /** 0..1 — pulses the last clear. */
  clearPulse: number
  /** High contrast falls back to the drawn tiles: wider colour steps beat fidelity. */
  drawnTiles?: boolean
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size = 10, color = T.INK_DIM) {
  ctx.fillStyle = color
  ctx.font = `600 ${size}px ${T.FONT}`
  ctx.letterSpacing = '0.14em'
  ctx.fillText(text.toUpperCase(), x, y)
  ctx.letterSpacing = '0px'
}

function roadAxes(s: State, x: number, y: number) {
  const isRoad = (px: number, py: number) =>
    px < 0 || px >= W || py < 0 || py >= H ? false : s.board[idx(px, py)].kind === 'road'
  const h = isRoad(x - 1, y) || isRoad(x + 1, y)
  const v = isRoad(x, y - 1) || isRoad(x, y + 1)
  return h || v ? { h, v } : { h: true, v: true }
}

export function render(ctx: CanvasRenderingContext2D, view: View, w: number, h: number): Layout {
  const L = layout(w, h)
  const s = view.state

  ctx.fillStyle = T.PAGE
  ctx.fillRect(0, 0, w, h)
  ctx.textBaseline = 'alphabetic'

  const useArt = artReady() && !view.drawnTiles

  drawHeader(ctx, L, s)
  drawSkyline(ctx, L.skyline, s, useArt)
  drawBoard(ctx, L, view, useArt)
  drawRail(ctx, L, view, useArt)
  if (view.inspect !== null) drawInspect(ctx, L, s, view.inspect)

  return L
}

function drawHeader(ctx: CanvasRenderingContext2D, L: Layout, s: State): void {
  const r = L.header
  label(ctx, 'Population', r.x, r.y + 12)

  ctx.fillStyle = T.INK
  ctx.font = `700 34px ${T.FONT}`
  const pop = s.population.toLocaleString()
  ctx.fillText(pop, r.x, r.y + 48)

  const gain = s.lastClear?.total ?? 0
  if (gain > 0) {
    ctx.fillStyle = T.ZONE_ACCENT.R
    ctx.font = `600 12px ${T.FONT}`
    ctx.fillText(`+${gain.toLocaleString()}`, r.x, r.y + 66)
  }

  // Demand bars
  const barsX = r.x + Math.max(120, ctx.measureText(pop).width + 40)
  const barW = r.x + r.w - barsX
  ZONES.forEach((z, i) => {
    const y = r.y + 10 + i * 30
    ctx.fillStyle = T.ZONE_ACCENT[z]
    ctx.beginPath()
    ctx.arc(barsX + 8, y + 8, 8, 0, Math.PI * 2)
    ctx.fill()

    label(ctx, T.ZONE_LABEL[z], barsX + 22, y + 6, 8.5)

    const track: Rect = { x: barsX + 22, y: y + 11, w: barW - 22, h: 6 }
    ctx.fillStyle = T.PAGE_DEEP
    roundRect(ctx, track.x, track.y, track.w, track.h, 3)
    ctx.fill()
    const pct = Math.max(0, Math.min(1, s.demand[z] / DEMAND_MAX))
    ctx.fillStyle = T.ZONE_ACCENT[z]
    roundRect(ctx, track.x, track.y, Math.max(3, track.w * pct), track.h, 3)
    ctx.fill()

    ctx.fillStyle = T.INK_DIM
    ctx.font = `600 9px ${T.FONT}`
    ctx.fillText(`${Math.round(s.demand[z])}`, track.x + track.w - 16, y + 6)
  })
}

/** The harvest. Buildings that left the board, as an elevation that only grows. */
function drawSkyline(ctx: CanvasRenderingContext2D, r: Rect, s: State, useArt: boolean): void {
  if (useArt) {
    const storeys: Record<'R' | 'C' | 'I', number> = { R: 0, C: 0, I: 0 }
    for (const e of s.skyline) storeys[e.zone] += e.density
    drawArtSkyline(ctx, r, storeys)
    // A ground line, so the elevation stands on something rather than floating.
    ctx.fillStyle = T.BOARD_FRAME
    ctx.fillRect(r.x, r.y + r.h - 1, r.w, 1)
    if (s.skyline.length === 0) {
      label(ctx, 'the city, so far', r.x, r.y + r.h - 10, 9, T.INK_FAINT)
    }
    return
  }

  ctx.fillStyle = T.PAGE_DEEP
  roundRect(ctx, r.x, r.y, r.w, r.h, 8)
  ctx.fill()

  const entries = s.skyline.slice(-Math.floor(r.w / 5))
  if (entries.length === 0) {
    label(ctx, 'the city, so far', r.x + 12, r.y + r.h - 18, 9, T.INK_FAINT)
    ctx.fillStyle = T.BOARD_FRAME
    ctx.fillRect(r.x + 6, r.y + r.h - 6, r.w - 12, 1.5)
    return
  }
  const bw = Math.min(9, r.w / Math.max(entries.length, 1))
  const baseY = r.y + r.h - 6
  entries.forEach((e, i) => {
    const shade = T.ZONE_SHADES[e.zone][e.density - 1]
    const bh = 8 + e.density * 11
    const x = r.x + 8 + i * bw
    ctx.fillStyle = shade.side
    ctx.fillRect(x, baseY - bh, Math.max(2, bw - 1.6), bh)
    ctx.fillStyle = shade.top
    ctx.fillRect(x, baseY - bh, Math.max(2, bw - 1.6), 3)
  })
  ctx.fillStyle = T.BOARD_FRAME
  ctx.fillRect(r.x + 6, baseY, r.w - 12, 1.5)
}

function drawBoard(ctx: CanvasRenderingContext2D, L: Layout, view: View, useArt: boolean): void {
  const s = view.state
  const b = L.board
  const c = L.cell

  // Chipboard base with a frame, like a model on a drafting table.
  ctx.save()
  ctx.fillStyle = T.SHADOW
  ctx.filter = 'blur(10px)'
  roundRect(ctx, b.x + 2, b.y + 8, b.w, b.h, 10)
  ctx.fill()
  ctx.restore()

  ctx.fillStyle = T.BOARD_FRAME
  roundRect(ctx, b.x - 7, b.y - 7, b.w + 14, b.h + 14, 8)
  ctx.fill()

  // Buildings are drawn larger than their cell and overhang upward, so the
  // board clips them rather than letting one spill onto the frame.
  ctx.save()
  ctx.beginPath()
  ctx.rect(b.x, b.y, b.w, b.h)
  ctx.clip()

  // Three passes, and the order is the point. Ground first, so the board is one
  // continuous surface. Then every shadow, so no shadow lands on a roof. Then
  // the buildings in row order, so a nearer one overlaps the lot behind it.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const cell = s.board[idx(x, y)]
      const axes = cell.kind === 'road' ? roadAxes(s, x, y) : { h: false, v: false }
      const px = b.x + x * c
      const py = b.y + y * c
      if (useArt) drawArtLot(ctx, cell, px, py, c, axes)
      else drawCell(ctx, cell, px, py, c, axes)
    }
  }
  if (useArt) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) drawArtShadow(ctx, s.board[idx(x, y)], b.x + x * c, b.y + y * c, c)
    }
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const cell = s.board[idx(x, y)]
        const px = b.x + x * c
        const py = b.y + y * c
        drawArtModel(ctx, cell, px, py, c)
        if (cell.kind === 'zone') drawArtPips(ctx, px, py, c, cell.density)
      }
    }
  }

  ctx.restore()

  // Sightlines for the road being dragged — the one rule that is invisible
  // without help.
  if (view.drag && view.drag.piece.kind === 'road' && view.drag.legal) {
    drawSightlines(ctx, L, view.drag)
  }

  if (view.drag) {
    const { piece, ax, ay, legal } = view.drag
    for (const [ox, oy] of piece.cells) {
      const x = ax + ox
      const y = ay + oy
      if (x < 0 || x >= W || y < 0 || y >= H) continue
      drawGhostCell(ctx, b.x + x * c, b.y + y * c, c, legal)
    }
  }

  if (view.bulldozeArmed) {
    ctx.strokeStyle = T.GHOST_BAD
    ctx.lineWidth = 2.5
    ctx.setLineDash([6, 5])
    roundRect(ctx, b.x - 5, b.y - 5, b.w + 10, b.h + 10, 7)
    ctx.stroke()
    ctx.setLineDash([])
  }

  // Clear pulse: the harvested strip flashes as it lifts.
  if (view.clearPulse > 0 && s.lastClear) {
    ctx.save()
    ctx.globalAlpha = view.clearPulse * 0.75
    for (const cellInfo of s.lastClear.cells) {
      const x = cellInfo.idx % W
      const y = (cellInfo.idx / W) | 0
      ctx.fillStyle = '#FFFFFF'
      roundRect(ctx, b.x + x * c + 2, b.y + y * c + 2, c - 4, c - 4, 4)
      ctx.fill()
    }
    ctx.restore()
  }
}

function drawSightlines(ctx: CanvasRenderingContext2D, L: Layout, drag: DragView): void {
  const b = L.board
  const c = L.cell
  ctx.save()
  ctx.strokeStyle = T.SIGHTLINE
  ctx.lineWidth = Math.max(2, c * 0.1)
  ctx.setLineDash([c * 0.2, c * 0.16])
  for (const [ox, oy] of drag.piece.cells) {
    const x = drag.ax + ox
    const y = drag.ay + oy
    if (x < 0 || x >= W || y < 0 || y >= H) continue
    ctx.beginPath()
    ctx.moveTo(b.x + x * c + c / 2, b.y)
    ctx.lineTo(b.x + x * c + c / 2, b.y + b.h)
    ctx.moveTo(b.x, b.y + y * c + c / 2)
    ctx.lineTo(b.x + b.w, b.y + y * c + c / 2)
    ctx.stroke()
  }
  ctx.setLineDash([])
  ctx.restore()
}

function card(ctx: CanvasRenderingContext2D, r: Rect): void {
  ctx.fillStyle = T.CARD
  roundRect(ctx, r.x, r.y, r.w, r.h, 10)
  ctx.fill()
  ctx.strokeStyle = T.CARD_EDGE
  ctx.lineWidth = 1
  roundRect(ctx, r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, 10)
  ctx.stroke()
}

function drawRail(ctx: CanvasRenderingContext2D, L: Layout, view: View, useArt: boolean): void {
  const swatch = useArt ? drawArtSwatch : drawPieceSwatch
  const s = view.state
  label(ctx, 'Next pieces', L.slots[0].x, L.rail.y + 12, 9)
  label(ctx, 'Works', L.works.x, L.rail.y + 12, 9)
  label(ctx, 'Tools', L.tool.x, L.rail.y + 12, 9)

  L.slots.forEach((r, i) => {
    card(ctx, r)
    const p = s.hand[i]
    if (!p) return
    const unit = Math.min(r.w / 5, (r.h - 22) / 4)
    swatch(ctx, p.cells, p.kind, p.zone as Zone | null, r.x + r.w / 2, r.y + r.h / 2 - 6, unit)
    ctx.fillStyle = T.ZONE_ACCENT[p.zone ?? 'R']
    ctx.font = `700 8.5px ${T.FONT}`
    ctx.letterSpacing = '0.1em'
    const t = T.ZONE_LABEL[p.zone ?? 'R'].slice(0, 3)
    ctx.fillText(t, r.x + r.w / 2 - ctx.measureText(t).width / 2, r.y + r.h - 8)
    ctx.letterSpacing = '0px'
  })

  card(ctx, L.works)
  if (s.works) {
    const r = L.works
    const unit = Math.min(r.w / 4.5, (r.h - 22) / 4)
    swatch(ctx, s.works.cells, s.works.kind, null, r.x + r.w / 2, r.y + r.h / 2 - 6, unit)
    ctx.fillStyle = T.INK_DIM
    ctx.font = `700 8.5px ${T.FONT}`
    const t = s.works.kind === 'park' ? 'PARK' : 'ROAD'
    ctx.fillText(t, r.x + r.w / 2 - ctx.measureText(t).width / 2, r.y + r.h - 8)
  } else {
    const r = L.works
    ctx.fillStyle = T.INK_FAINT
    ctx.font = `600 11px ${T.FONT}`
    const t = `${s.worksCooldown}`
    ctx.fillText(t, r.x + r.w / 2 - ctx.measureText(t).width / 2, r.y + r.h / 2)
    ctx.font = `600 8px ${T.FONT}`
    const t2 = 'PLACEMENTS'
    ctx.fillText(t2, r.x + r.w / 2 - ctx.measureText(t2).width / 2, r.y + r.h / 2 + 14)
  }

  const r = L.tool
  card(ctx, r)
  drawBulldozer(ctx, r.x + r.w / 2, r.y + r.h / 2 - 8, Math.min(r.w * 0.42, 22), view.bulldozeArmed)
  ctx.fillStyle = view.bulldozeArmed ? T.GHOST_BAD : T.INK_DIM
  ctx.font = `700 8.5px ${T.FONT}`
  const bt = s.mustBulldoze ? 'CLEAR ONE' : 'BULLDOZER'
  ctx.fillText(bt, r.x + r.w / 2 - ctx.measureText(bt).width / 2, r.y + r.h - 8)

  // Charge badge
  ctx.fillStyle = s.charges > 0 ? T.ZONE_ACCENT.R : T.INK_FAINT
  ctx.beginPath()
  ctx.arc(r.x + r.w - 12, r.y + 12, 9, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#FFFFFF'
  ctx.font = `700 11px ${T.FONT}`
  const c = `${s.charges}`
  ctx.fillText(c, r.x + r.w - 12 - ctx.measureText(c).width / 2, r.y + 16)
}

function drawBulldozer(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, armed: boolean): void {
  ctx.save()
  ctx.fillStyle = armed ? T.GHOST_BAD : T.INK
  ctx.fillRect(cx - s * 0.6, cy - s * 0.15, s * 0.9, s * 0.42)
  ctx.fillRect(cx - s * 0.3, cy - s * 0.5, s * 0.5, s * 0.36)
  ctx.beginPath()
  ctx.moveTo(cx + s * 0.45, cy - s * 0.45)
  ctx.lineTo(cx + s * 0.75, cy + s * 0.28)
  ctx.lineTo(cx + s * 0.45, cy + s * 0.28)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.arc(cx - s * 0.35, cy + s * 0.38, s * 0.2, 0, Math.PI * 2)
  ctx.arc(cx + s * 0.15, cy + s * 0.38, s * 0.2, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

/**
 * Hold a cell to inspect it. Clear-time scoring is right; clear-time-only
 * understanding is not — the player needs the consequences of the one decision
 * in front of them, not a hundred numbers at once.
 */
function drawInspect(ctx: CanvasRenderingContext2D, L: Layout, s: State, i: number): void {
  const cell = s.board[i]
  const x = i % W
  const y = (i / W) | 0
  const c = L.cell

  const bw = 168
  const bh = 84
  let bx = L.board.x + x * c + c / 2 - bw / 2
  let by = L.board.y + y * c - bh - 8
  bx = Math.max(L.pad, Math.min(bx, L.w - L.pad - bw))
  if (by < L.board.y - 4) by = L.board.y + y * c + c + 8

  ctx.save()
  ctx.fillStyle = 'rgba(28,28,24,0.93)'
  roundRect(ctx, bx, by, bw, bh, 8)
  ctx.fill()

  const name =
    cell.kind === 'zone'
      ? `${T.ZONE_LABEL[cell.zone ?? 'R']} · ${cell.density}`
      : cell.kind.toUpperCase()
  ctx.fillStyle = '#FFFFFF'
  ctx.font = `700 10px ${T.FONT}`
  ctx.letterSpacing = '0.1em'
  ctx.fillText(name, bx + 12, by + 20)
  ctx.letterSpacing = '0px'

  if (cell.kind === 'zone') {
    ctx.font = `700 22px ${T.FONT}`
    ctx.fillStyle = '#FFFFFF'
    ctx.fillText(`${scoreCell(s.board, i)}`, bx + 12, by + 48)
    ctx.font = `500 9px ${T.FONT}`
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.fillText('if harvested now', bx + 12, by + 62)

    const ns = neighbourIndices(s.board, i)
    let nx = bx + bw - 16
    for (let k = ns.length - 1; k >= 0; k--) {
      const n = ns[k]
      const nb = n === null ? null : s.board[n]
      ctx.fillStyle =
        nb === null || nb.kind === 'empty'
          ? 'rgba(255,255,255,0.14)'
          : nb.kind === 'zone'
            ? T.ZONE_ACCENT[nb.zone ?? 'R']
            : nb.kind === 'park'
              ? T.PARK_TREE
              : T.BLIGHT.top
      roundRect(ctx, nx - 14, by + 30, 14, 14, 3)
      ctx.fill()
      nx -= 18
    }
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.font = `600 8px ${T.FONT}`
    ctx.letterSpacing = '0.1em'
    ctx.fillText('NEIGHBOURS', bx + bw - 16 - ctx.measureText('NEIGHBOURS').width, by + 60)
    ctx.letterSpacing = '0px'
  } else {
    ctx.font = `500 10px ${T.FONT}`
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    const note =
      cell.kind === 'road'
        ? 'Scores nothing. Fills a line.\nAdjacency sees through it.'
        : cell.kind === 'park'
          ? '+5 to every neighbour,\nat their own density.'
          : cell.kind === 'blight'
            ? '-5 to every neighbour.\nClears with its line.'
            : 'Empty lot.'
    note.split('\n').forEach((ln, k) => ctx.fillText(ln, bx + 12, by + 44 + k * 14))
  }
  ctx.restore()
}

export { hit, layout, canPlace }
