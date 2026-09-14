import type { Cell, Zone } from '../game/types'
import tilesUrl from '../assets/tiles.webp'
import skylineUrl from '../assets/skyline.webp'
import type { RoadAxes } from './tiles'

/**
 * The photographed massing model, and the painted elevation.
 *
 * This is the other half of the tile seam: `tiles.ts` draws the same cell states
 * with code, and is still the fallback — before the sheet has loaded, and in high
 * contrast, where wider colour steps beat photographic fidelity.
 */

const TILE = 192

/** Column and row of each cell state in the 4x4 sheet. */
const SPRITE = {
  R1: [0, 0], R2: [1, 0], R3: [2, 0], empty: [3, 0],
  C1: [0, 1], C2: [1, 1], C3: [2, 1], blight: [3, 1],
  I1: [0, 2], I2: [1, 2], I3: [2, 2], park: [3, 2],
  roadNS: [0, 3], roadEW: [1, 3], roadCross: [2, 3],
} as const

/** The elevation runs green, then blue, then amber. Measured, not guessed. */
const SEGMENTS: Record<Zone, [number, number]> = {
  R: [0.0, 0.23],
  C: [0.23, 0.63],
  I: [0.63, 1.0],
}
/** Storeys of one zone that fill its stretch of the panorama. */
const SEGMENT_FULL = 90
export const SKYLINE_PAPER = '#F6E8D1'

const tiles = new Image()
const skyline = new Image()
let loaded = 0
const onLoad = () => {
  loaded++
  listeners.forEach((f) => f())
}
const listeners = new Set<() => void>()
tiles.onload = onLoad
skyline.onload = onLoad
tiles.src = tilesUrl
skyline.src = skylineUrl

export function artReady(): boolean {
  return loaded >= 2
}

export function onArtReady(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function spriteFor(cell: Cell, axes: RoadAxes): readonly [number, number] {
  switch (cell.kind) {
    case 'empty':
      return SPRITE.empty
    case 'blight':
      return SPRITE.blight
    case 'park':
      return SPRITE.park
    case 'road':
      // Connectivity decides the picture; the sightline overlay teaches the rule.
      if (axes.h && axes.v) return SPRITE.roadCross
      return axes.v ? SPRITE.roadNS : SPRITE.roadEW
    default: {
      const d = Math.min(Math.max(cell.density, 1), 3)
      const key = `${cell.zone ?? 'R'}${d}` as keyof typeof SPRITE
      return SPRITE[key] ?? SPRITE.empty
    }
  }
}

export function drawArtCell(
  ctx: CanvasRenderingContext2D,
  cell: Cell,
  x: number,
  y: number,
  s: number,
  axes: RoadAxes,
): void {
  const [c, r] = spriteFor(cell, axes)
  // A half-pixel outset closes the seams that appear between neighbouring
  // tiles once the board is scaled to a non-integer cell size.
  ctx.drawImage(tiles, c * TILE, r * TILE, TILE, TILE, x - 0.5, y - 0.5, s + 1, s + 1)
}

/** A piece rendered in a rail card, as model blocks on card. */
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
  const isRoad = kind === 'road'
  for (const [ox, oy] of cells) {
    let sprite: readonly [number, number]
    if (kind === 'park') sprite = SPRITE.park
    else if (isRoad) {
      // Show each road cell connected to the ones the shape actually touches.
      const h2 = cells.some(([x, y]) => y === oy && Math.abs(x - ox) === 1)
      const v2 = cells.some(([x, y]) => x === ox && Math.abs(y - oy) === 1)
      sprite = h2 && v2 ? SPRITE.roadCross : v2 ? SPRITE.roadNS : SPRITE.roadEW
    } else {
      sprite = SPRITE[`${zone ?? 'R'}2` as keyof typeof SPRITE]
    }
    // Zoom past the bare chipboard margin: at rail size the model itself is
    // only a few pixels across if the whole lot is drawn.
    const inset = isRoad ? 0 : TILE * 0.17
    ctx.drawImage(
      tiles,
      sprite[0] * TILE + inset,
      sprite[1] * TILE + inset,
      TILE - inset * 2,
      TILE - inset * 2,
      x0 + ox * unit - 0.5,
      y0 + oy * unit - 0.5,
      unit + 1,
      unit + 1,
    )
  }
}

/** Density pips, over the art. The authoritative read, so they need contrast. */
export function drawArtPips(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, density: number): void {
  if (density < 1) return
  const rad = Math.max(1.2, s * 0.045)
  const gap = rad * 2.7
  const px = x + s * 0.14
  const py = y + s * 0.87
  ctx.save()
  ctx.strokeStyle = 'rgba(40,36,28,0.5)'
  ctx.lineWidth = Math.max(1, rad * 0.5)
  ctx.fillStyle = 'rgba(255,255,255,0.95)'
  for (let i = 0; i < density; i++) {
    ctx.beginPath()
    ctx.arc(px + i * gap, py, rad, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fill()
  }
  ctx.restore()
}

/**
 * The elevation fills in as you harvest — each zone revealing its own stretch of
 * the drawing, so the panorama stays an honest record of what you actually built
 * rather than a progress bar wearing a picture.
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
  for (const zone of ['R', 'C', 'I'] as Zone[]) {
    const [a, b] = SEGMENTS[zone]
    const filled = Math.min(1, storeys[zone] / SEGMENT_FULL)
    if (filled <= 0) continue
    const x0 = rect.x + a * rect.w
    const width = (b - a) * rect.w * filled
    ctx.save()
    ctx.beginPath()
    ctx.rect(x0, rect.y, width, rect.h)
    ctx.clip()
    ctx.drawImage(skyline, rect.x, dy, rect.w, dh)
    ctx.restore()
  }
  ctx.restore()
}
