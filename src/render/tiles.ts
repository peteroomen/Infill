import type { Cell, Zone } from '../game/types'
import * as T from './theme'

/**
 * The tile-drawing seam.
 *
 * Everything that decides what one cell looks like lives here, so swapping in
 * real massing-model art is this module and nothing else. The rest of the
 * renderer only ever asks for "draw this cell in this rect".
 *
 * Three channels carry density — colour, block height, shadow length — and a
 * fourth, the pips, is authoritative. Zone is carried by FORM as well as hue:
 * residential has a pitched ridge, commercial a window grid, industrial a
 * chimney. A player who cannot separate the hues can still read the board.
 */

const INSET = 0.1
const LIFT = 0.16 // per density step, as a fraction of cell size

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

function poly(ctx: CanvasRenderingContext2D, pts: number[][]): void {
  ctx.beginPath()
  ctx.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
  ctx.closePath()
}

/** The bare lot: chipboard with a ruled grid, the thing everything sits on. */
export function drawLot(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.fillStyle = T.BOARD_BASE
  ctx.fillRect(x, y, s, s)
  ctx.strokeStyle = T.BOARD_GRID
  ctx.lineWidth = 1
  ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1)
}

function drawBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  shade: T.Shade,
  density: number,
  radius: number,
): { fx: number; fy: number; fw: number; tx: number; ty: number } {
  const inset = s * INSET
  const fx = x + inset
  const fy = y + inset
  const fw = s - inset * 2
  const lift = s * LIFT * density
  const dx = -lift * 0.18
  const dy = -lift * 0.55

  // Shadow, cast down-right from a light in the upper left. Its length is the
  // third density channel.
  ctx.save()
  ctx.fillStyle = T.SHADOW
  ctx.filter = `blur(${Math.max(1, s * 0.04)}px)`
  roundRect(ctx, fx + lift * 0.3, fy + lift * 0.42, fw, fw, radius)
  ctx.fill()
  ctx.restore()

  const tx = fx + dx
  const ty = fy + dy

  // Facades: bottom is darkest, right is mid.
  ctx.fillStyle = shade.dark
  poly(ctx, [
    [fx, fy + fw],
    [fx + fw, fy + fw],
    [tx + fw, ty + fw],
    [tx, ty + fw],
  ])
  ctx.fill()

  ctx.fillStyle = shade.side
  poly(ctx, [
    [fx + fw, fy],
    [fx + fw, fy + fw],
    [tx + fw, ty + fw],
    [tx + fw, ty],
  ])
  ctx.fill()

  ctx.fillStyle = shade.top
  roundRect(ctx, tx, ty, fw, fw, radius)
  ctx.fill()

  return { fx, fy, fw, tx, ty }
}

/** Zone form, drawn on the top face. Carries zone without relying on hue. */
function drawForm(
  ctx: CanvasRenderingContext2D,
  zone: Zone,
  tx: number,
  ty: number,
  fw: number,
  shade: T.Shade,
): void {
  ctx.save()
  if (zone === 'R') {
    // Pitched ridge across the roof.
    ctx.fillStyle = shade.side
    poly(ctx, [
      [tx + fw * 0.5, ty + fw * 0.16],
      [tx + fw * 0.86, ty + fw * 0.5],
      [tx + fw * 0.5, ty + fw * 0.84],
      [tx + fw * 0.14, ty + fw * 0.5],
    ])
    ctx.fill()
    ctx.strokeStyle = shade.dark
    ctx.lineWidth = Math.max(1, fw * 0.045)
    ctx.beginPath()
    ctx.moveTo(tx + fw * 0.14, ty + fw * 0.5)
    ctx.lineTo(tx + fw * 0.86, ty + fw * 0.5)
    ctx.stroke()
  } else if (zone === 'C') {
    // Window grid.
    ctx.fillStyle = shade.dark
    const n = 2
    const pad = fw * 0.26
    const cell = (fw - pad * 2) / (n * 2 - 1)
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        ctx.fillRect(tx + pad + i * cell * 2, ty + pad + j * cell * 2, cell, cell)
      }
    }
  } else {
    // Chimney.
    ctx.fillStyle = shade.dark
    ctx.beginPath()
    ctx.arc(tx + fw * 0.68, ty + fw * 0.34, fw * 0.13, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = shade.side
    ctx.fillRect(tx + fw * 0.2, ty + fw * 0.56, fw * 0.5, fw * 0.14)
  }
  ctx.restore()
}

/** Density pips, bottom-left of the top face. The authoritative read. */
function drawPips(
  ctx: CanvasRenderingContext2D,
  tx: number,
  ty: number,
  fw: number,
  density: number,
): void {
  const r = Math.max(1.1, fw * 0.055)
  const gap = r * 2.6
  const x0 = tx + fw * 0.16
  const y0 = ty + fw * 0.9
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  for (let i = 0; i < density; i++) {
    ctx.beginPath()
    ctx.arc(x0 + i * gap, y0, r, 0, Math.PI * 2)
    ctx.fill()
  }
}

/** Which axes this road runs along, from its road neighbours. */
export interface RoadAxes {
  h: boolean
  v: boolean
}

/**
 * Roads are white tape. The dashes run along the axes a ray actually travels,
 * and a bend renders as a crossing rather than a curve — because rays do not
 * turn corners, and the art must not draw a rule the game does not have.
 */
function drawRoad(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, axes: RoadAxes): void {
  const band = s * 0.74
  const off = (s - band) / 2
  ctx.fillStyle = T.ROAD_TAPE
  if (axes.h || (!axes.h && !axes.v)) ctx.fillRect(x, y + off, s, band)
  if (axes.v) ctx.fillRect(x + off, y, band, s)

  ctx.strokeStyle = T.ROAD_DASH
  ctx.lineWidth = Math.max(1, s * 0.035)
  ctx.setLineDash([s * 0.14, s * 0.12])
  if (axes.h || (!axes.h && !axes.v)) {
    ctx.beginPath()
    ctx.moveTo(x, y + s / 2)
    ctx.lineTo(x + s, y + s / 2)
    ctx.stroke()
  }
  if (axes.v) {
    ctx.beginPath()
    ctx.moveTo(x + s / 2, y)
    ctx.lineTo(x + s / 2, y + s)
    ctx.stroke()
  }
  ctx.setLineDash([])
}

function drawPark(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  const { tx, ty, fw } = drawBlock(ctx, x, y, s, T.PARK_SHADE, 0.55, s * 0.14)
  const trees: number[][] = [
    [0.34, 0.4, 0.15],
    [0.64, 0.34, 0.12],
    [0.52, 0.66, 0.14],
  ]
  for (const [px, py, pr] of trees) {
    ctx.fillStyle = T.PARK_TREE_DARK
    ctx.beginPath()
    ctx.arc(tx + fw * px, ty + fw * py + fw * 0.05, fw * pr, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = T.PARK_TREE
    ctx.beginPath()
    ctx.arc(tx + fw * px, ty + fw * py, fw * pr, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawBlight(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  const inset = s * INSET
  ctx.fillStyle = T.BLIGHT.top
  roundRect(ctx, x + inset, y + inset, s - inset * 2, s - inset * 2, s * 0.1)
  ctx.fill()
  ctx.fillStyle = T.BLIGHT.dark
  const bits: number[][] = [
    [0.26, 0.32, 0.16],
    [0.58, 0.26, 0.12],
    [0.36, 0.62, 0.13],
    [0.68, 0.58, 0.17],
    [0.5, 0.45, 0.1],
  ]
  for (const [px, py, ps] of bits) {
    ctx.fillRect(x + s * px, y + s * py, s * ps, s * ps * 0.72)
  }
}

export function drawCell(
  ctx: CanvasRenderingContext2D,
  cell: Cell,
  x: number,
  y: number,
  s: number,
  axes: RoadAxes = { h: false, v: false },
): void {
  drawLot(ctx, x, y, s)
  if (cell.kind === 'empty') return
  if (cell.kind === 'road') return drawRoad(ctx, x, y, s, axes)
  if (cell.kind === 'park') return drawPark(ctx, x, y, s)
  if (cell.kind === 'blight') return drawBlight(ctx, x, y, s)

  const shade = T.shadeFor(cell.kind, cell.zone, cell.density)
  const { tx, ty, fw } = drawBlock(ctx, x, y, s, shade, cell.density, s * 0.08)
  drawForm(ctx, (cell.zone ?? 'R') as Zone, tx, ty, fw, shade)
  drawPips(ctx, tx, ty, fw, cell.density)
}

/** The glowing drag preview from the reference: lit blocks over a dashed footprint. */
export function drawGhostCell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  ok: boolean,
): void {
  const inset = s * 0.1
  ctx.save()
  ctx.strokeStyle = T.GHOST_FOOTPRINT
  ctx.lineWidth = Math.max(1.2, s * 0.045)
  ctx.setLineDash([s * 0.16, s * 0.12])
  roundRect(ctx, x + inset, y + inset, s - inset * 2, s - inset * 2, s * 0.08)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.restore()

  ctx.save()
  ctx.globalAlpha = 0.55
  ctx.fillStyle = ok ? T.GHOST_OK : T.GHOST_BAD
  roundRect(ctx, x + inset, y + inset, s - inset * 2, s - inset * 2, s * 0.08)
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.strokeStyle = ok ? T.GHOST_OK : T.GHOST_BAD
  ctx.lineWidth = Math.max(1.5, s * 0.06)
  ctx.shadowColor = ok ? T.GHOST_OK_GLOW : 'rgba(217,112,95,0.5)'
  ctx.shadowBlur = s * 0.4
  roundRect(ctx, x + inset, y + inset, s - inset * 2, s - inset * 2, s * 0.08)
  ctx.stroke()
  ctx.restore()
}

/** A piece rendered flat in a rail card — chunky beveled blocks, per the reference. */
export function drawPieceSwatch(
  ctx: CanvasRenderingContext2D,
  cells: readonly (readonly [number, number])[],
  kind: string,
  zone: Zone | null,
  cx: number,
  cy: number,
  unit: number,
): void {
  let w = 0
  let h = 0
  for (const [ox, oy] of cells) {
    if (ox + 1 > w) w = ox + 1
    if (oy + 1 > h) h = oy + 1
  }
  const x0 = cx - (w * unit) / 2
  const y0 = cy - (h * unit) / 2
  for (const [ox, oy] of cells) {
    const x = x0 + ox * unit
    const y = y0 + oy * unit
    if (kind === 'road') {
      const band = unit * 0.66
      ctx.fillStyle = T.ROAD_TAPE
      ctx.fillRect(x, y + (unit - band) / 2, unit, band)
      ctx.fillRect(x + (unit - band) / 2, y, band, unit)
      ctx.strokeStyle = T.ROAD_TAPE_EDGE
      ctx.lineWidth = 1
      ctx.strokeRect(x + 0.5, y + (unit - band) / 2 + 0.5, unit - 1, band - 1)
      continue
    }
    if (kind === 'park') {
      const sh = T.PARK_SHADE
      ctx.fillStyle = sh.side
      roundRect(ctx, x + 2, y + 2, unit - 4, unit - 4, unit * 0.16)
      ctx.fill()
      ctx.fillStyle = T.PARK_TREE
      ctx.beginPath()
      ctx.arc(x + unit / 2, y + unit / 2, unit * 0.22, 0, Math.PI * 2)
      ctx.fill()
      continue
    }
    const sh = T.ZONE_SHADES[zone ?? 'R'][1]
    ctx.fillStyle = sh.dark
    roundRect(ctx, x + 1, y + 1 + unit * 0.1, unit - 2, unit - 2, unit * 0.14)
    ctx.fill()
    ctx.fillStyle = sh.top
    roundRect(ctx, x + 1, y + 1, unit - 2, unit - 2 - unit * 0.1, unit * 0.14)
    ctx.fill()
    ctx.fillStyle = sh.side
    roundRect(ctx, x + unit * 0.22, y + unit * 0.2, unit * 0.56, unit * 0.4, unit * 0.08)
    ctx.fill()
  }
}
