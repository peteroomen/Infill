import { H, W } from '../game/constants'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface Layout {
  w: number
  h: number
  pad: number
  header: Rect
  skyline: Rect
  board: Rect
  cell: number
  rail: Rect
  slots: Rect[]
  works: Rect
  tool: Rect
}

const PAD = 16
const HEADER_H = 104
const SKYLINE_H = 138
const RAIL_H = 126
const MENU_W = 40
const GAP = 12

/**
 * Controls sit in the lower third; the board cannot — at ~35 px a cell it is
 * ~350 px tall and the lower third of an 844 px screen is ~281. Board in the
 * middle, readout above it, skyline on top.
 */
export function layout(w: number, h: number): Layout {
  const pad = PAD
  const innerW = w - pad * 2
  const headerY = pad
  const skylineY = headerY + HEADER_H + GAP
  const spaceTop = skylineY + SKYLINE_H + GAP
  const railH = RAIL_H
  const railY = h - pad - railH
  const spaceBottom = railY - GAP
  const availH = spaceBottom - spaceTop

  const cell = Math.max(18, Math.floor(Math.min(innerW / W, availH / H)))
  const boardW = cell * W
  const boardH = cell * H
  const boardX = pad + (innerW - boardW) / 2
  // Centre the board in whatever is left: the cell size is capped by width, so
  // on a tall screen the slack belongs around the board, not under it.
  const boardY = spaceTop + Math.max(0, (availH - boardH) / 2)

  const weights = [1, 1, 1, 0.92, 0.92]
  const gaps = GAP * 0.6 * (weights.length - 1)
  const unit = (innerW - gaps) / weights.reduce((a, b) => a + b, 0)
  const cards: Rect[] = []
  let cx = pad
  for (const weight of weights) {
    const cw = unit * weight
    cards.push({ x: cx, y: railY + 22, w: cw, h: railH - 26 })
    cx += cw + GAP * 0.6
  }

  return {
    w,
    h,
    pad,
    // The right edge is short of the gutter: the pause button is an HTML
    // control sitting over the canvas there, and the demand values must not
    // run underneath it.
    header: { x: pad, y: headerY, w: innerW - MENU_W, h: HEADER_H },
    skyline: { x: pad, y: skylineY, w: innerW, h: SKYLINE_H },
    board: { x: boardX, y: boardY, w: boardW, h: boardH },
    cell,
    rail: { x: pad, y: railY, w: innerW, h: railH },
    slots: cards.slice(0, 3),
    works: cards[3],
    tool: cards[4],
  }
}

export function hit(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h
}
