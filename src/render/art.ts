import type { Cell, Zone } from '../game/types'
import lotsUrl from '../assets/lots.webp'
import modelsUrl from '../assets/models.webp'
import shadowsUrl from '../assets/shadows.webp'
import skylineUrl from '../assets/skyline.webp'
import type { RoadAxes } from './tiles'

/**
 * The photographed massing model, and the painted elevation.
 *
 * Buildings are separate from the ground they stand on. The sheet photographs
 * each model centred on its own slab with a wide chipboard margin; drawn whole,
 * those margins put gutters between the cells of a single piece and a tetromino
 * reads as four marooned houses. So the ground is one repeating lot texture, and
 * the building is drawn larger than its cell and allowed to overhang — which is
 * also what lets a shadow fall on the lot next door instead of stopping dead at
 * a slab edge.
 *
 * `tiles.ts` still draws every cell state in code and remains the fallback:
 * before these load, and in high contrast, where wider colour steps beat
 * photographic fidelity.
 */

const TILE = 192

/** Ground textures — the cell states that are texture to their edges. */
const LOT = {
  empty: [0, 0], blight: [1, 0], park: [2, 0],
  roadNS: [0, 1], roadEW: [1, 1], roadCross: [2, 1],
} as const

const ZONE_ROW: Record<Zone, number> = { R: 0, C: 1, I: 2 }

/** How much bigger than its cell a building is drawn. */
const MODEL_SCALE = 1.46
/** Its base sits a little above the bottom of the lot, as it does on the slab. */
const MODEL_BASE = 0.06

const SEGMENTS: Record<Zone, [number, number]> = { R: [0.0, 0.23], C: [0.23, 0.63], I: [0.63, 1.0] }
const SEGMENT_FULL = 90
const GHOST_ALPHA = 0.15

const lots = new Image()
const models = new Image()
const shadows = new Image()
const skyline = new Image()
const all = [lots, models, shadows, skyline]
let loaded = 0
const listeners = new Set<() => void>()
for (const [img, url] of [[lots, lotsUrl], [models, modelsUrl], [shadows, shadowsUrl], [skyline, skylineUrl]] as const) {
  img.onload = () => {
    loaded++
    listeners.forEach((f) => f())
  }
  img.src = url
}

export function artReady(): boolean {
  return loaded >= all.length
}

export function onArtReady(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function lotFor(cell: Cell, axes: RoadAxes): readonly [number, number] {
  switch (cell.kind) {
    case 'blight':
      return LOT.blight
    case 'park':
      return LOT.park
    case 'road':
      return axes.h && axes.v ? LOT.roadCross : axes.v ? LOT.roadNS : LOT.roadEW
    default:
      return LOT.empty
  }
}

/** Pass one: the ground. Every cell, so the board is a single continuous surface. */
export function drawArtLot(ctx: CanvasRenderingContext2D, cell: Cell, x: number, y: number, s: number, axes: RoadAxes): void {
  const [c, r] = lotFor(cell, axes)
  // A half-pixel outset closes the seams a non-integer cell size opens up.
  ctx.drawImage(lots, c * TILE, r * TILE, TILE, TILE, x - 0.5, y - 0.5, s + 1, s + 1)
}

function modelRect(x: number, y: number, s: number) {
  const size = s * MODEL_SCALE
  return {
    dx: x + (s - size) / 2,
    dy: y + s - size + s * MODEL_BASE,
    size,
  }
}

/** Pass two: shadows, all of them, before any building is drawn. */
export function drawArtShadow(ctx: CanvasRenderingContext2D, cell: Cell, x: number, y: number, s: number): void {
  if (cell.kind !== 'zone' || !cell.zone) return
  const { dx, dy, size } = modelRect(x, y, s)
  const col = Math.min(Math.max(cell.density, 1), 3) - 1
  ctx.drawImage(shadows, col * TILE, ZONE_ROW[cell.zone] * TILE, TILE, TILE, dx, dy, size, size)
}

/** Pass three: the buildings, in row order, so nearer ones overlap farther ones. */
export function drawArtModel(ctx: CanvasRenderingContext2D, cell: Cell, x: number, y: number, s: number): void {
  if (cell.kind !== 'zone' || !cell.zone) return
  const { dx, dy, size } = modelRect(x, y, s)
  const col = Math.min(Math.max(cell.density, 1), 3) - 1
  ctx.drawImage(models, col * TILE, ZONE_ROW[cell.zone] * TILE, TILE, TILE, dx, dy, size, size)
}

/**
 * A piece in a rail card. Buildings only, no lots: at this size the chipboard
 * margins are most of what you see, and the shape of the piece reads better
 * from the cluster of buildings than from a grid of little squares.
 */
export function drawArtSwatch(
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

  if (kind === 'road' || kind === 'park') {
    for (const [ox, oy] of cells) {
      const x = x0 + ox * unit
      const y = y0 + oy * unit
      let sprite: readonly [number, number] = LOT.park
      if (kind === 'road') {
        const hh = cells.some(([a, b]) => b === oy && Math.abs(a - ox) === 1)
        const vv = cells.some(([a, b]) => a === ox && Math.abs(b - oy) === 1)
        sprite = hh && vv ? LOT.roadCross : vv ? LOT.roadNS : LOT.roadEW
      }
      ctx.drawImage(lots, sprite[0] * TILE, sprite[1] * TILE, TILE, TILE, x - 0.5, y - 0.5, unit + 1, unit + 1)
    }
    return
  }

  const row = ZONE_ROW[(zone ?? 'R') as Zone]
  const size = unit * 1.5
  const place = (ox: number, oy: number) => ({
    dx: x0 + ox * unit + (unit - size) / 2,
    dy: y0 + oy * unit + unit - size + unit * 0.1,
  })
  for (const [ox, oy] of cells) {
    const { dx, dy } = place(ox, oy)
    ctx.drawImage(shadows, TILE, row * TILE, TILE, TILE, dx, dy, size, size)
  }
  for (const [ox, oy] of cells) {
    const { dx, dy } = place(ox, oy)
    ctx.drawImage(models, TILE, row * TILE, TILE, TILE, dx, dy, size, size)
  }
}

/** Density pips, over the art. The authoritative read, so they need contrast. */
export function drawArtPips(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, density: number): void {
  if (density < 1) return
  const rad = Math.max(1.1, s * 0.036)
  const gap = rad * 2.7
  const px = x + s * 0.12
  const py = y + s * 0.88
  ctx.save()
  ctx.strokeStyle = 'rgba(42,38,28,0.55)'
  ctx.lineWidth = Math.max(1, rad * 0.55)
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  for (let i = 0; i < density; i++) {
    ctx.beginPath()
    ctx.arc(px + i * gap, py, rad, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fill()
  }
  ctx.restore()
}

/**
 * The elevation inks itself in as you harvest.
 *
 * The whole panorama is always there as a faint underlay, so the empty stretches
 * read as a drawing not yet finished rather than as something missing. Each zone
 * then fills its own measured stretch in proportion to the storeys of that zone
 * actually harvested — a record of what you built, not a progress bar wearing a
 * picture.
 */
export function drawArtSkyline(
  ctx: CanvasRenderingContext2D,
  rect: { x: number; y: number; w: number; h: number },
  storeys: Record<Zone, number>,
): void {
  const scale = rect.w / skyline.width
  const dh = skyline.height * scale
  const dy = rect.y + rect.h - dh

  ctx.save()
  ctx.globalAlpha = GHOST_ALPHA
  ctx.drawImage(skyline, rect.x, dy, rect.w, dh)
  ctx.globalAlpha = 1

  const FEATHER = Math.max(6, rect.w * 0.022)
  for (const zone of ['R', 'C', 'I'] as Zone[]) {
    const [a, b] = SEGMENTS[zone]
    const filled = Math.min(1, storeys[zone] / SEGMENT_FULL)
    if (filled <= 0) continue
    const x0 = rect.x + a * rect.w
    const full = (b - a) * rect.w * filled
    ctx.save()
    ctx.beginPath()
    ctx.rect(x0, rect.y, Math.max(0, full - FEATHER), rect.h)
    ctx.clip()
    ctx.drawImage(skyline, rect.x, dy, rect.w, dh)
    ctx.restore()

    // Fade the leading edge so the drawing trails off rather than being cut.
    const steps = 5
    for (let i = 0; i < steps; i++) {
      const t = i / steps
      ctx.save()
      ctx.globalAlpha = (1 - t) * (1 - GHOST_ALPHA)
      ctx.beginPath()
      ctx.rect(x0 + full - FEATHER + (FEATHER / steps) * i, rect.y, FEATHER / steps + 0.5, rect.h)
      ctx.clip()
      ctx.drawImage(skyline, rect.x, dy, rect.w, dh)
      ctx.restore()
    }
  }
  ctx.restore()
}
