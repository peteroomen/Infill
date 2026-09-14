/**
 * Palette sampled from the massing-model reference: warm neutral page, chipboard
 * board, matte painted blocks, white tape roads.
 *
 * Density reads on three channels at once — colour darkens, the block grows
 * taller, and the shadow lengthens — plus pips, which are the authoritative read.
 * Colour and shadow support them; neither carries information on its own.
 */

export const PAGE = '#F0EDE6'
export const PAGE_DEEP = '#E6E2D8'
export const INK = '#3A3A34'
export const INK_DIM = '#8A8578'
export const INK_FAINT = '#B4AE9F'

export const BOARD_EDGE = '#BCA882'
export const BOARD_BASE = '#D6C9AC'
export const BOARD_GRID = '#C0B091'
export const BOARD_FRAME = '#C4B393'

/** [face, side, top-highlight] per density. */
export interface Shade {
  top: string
  side: string
  dark: string
}

export const ZONE_SHADES: Record<string, Shade[]> = {
  R: [
    { top: '#A3BE86', side: '#8CA771', dark: '#7A9462' },
    { top: '#7FA05E', side: '#6B8A4E', dark: '#5C7842' },
    { top: '#57783E', side: '#486534', dark: '#3C562B' },
  ],
  C: [
    { top: '#8FBCDF', side: '#77A5C9', dark: '#6793B7' },
    { top: '#4A8CC0', side: '#3D77A6', dark: '#336691' },
    { top: '#2E6390', side: '#26527A', dark: '#1F4566' },
  ],
  I: [
    { top: '#E8C078', side: '#D3A85F', dark: '#BE9550' },
    { top: '#D5A03F', side: '#BC8B32', dark: '#A3782A' },
    { top: '#A8761F', side: '#8F6319', dark: '#785214' },
  ],
}

export const BLIGHT: Shade = { top: '#ADA89E', side: '#948F86', dark: '#7E7A72' }
export const PARK_SHADE: Shade = { top: '#BFD3A4', side: '#A3B98A', dark: '#8DA376' }
export const PARK_TREE = '#5C7842'
export const PARK_TREE_DARK = '#40572E'

export const ROAD_TAPE = '#F4F2ED'
export const ROAD_TAPE_EDGE = '#DAD5C9'
export const ROAD_DASH = '#BFB9AC'

export const GHOST_OK = '#5FD98A'
export const GHOST_OK_GLOW = 'rgba(95, 217, 138, 0.55)'
export const GHOST_BAD = '#D9705F'
export const GHOST_FOOTPRINT = 'rgba(255,255,255,0.85)'

export const SIGHTLINE = 'rgba(74, 140, 192, 0.55)'

export const CARD = '#F7F5F0'
export const CARD_EDGE = '#E1DCD1'

export const SHADOW = 'rgba(74, 66, 48, 0.20)'

export const ZONE_LABEL: Record<string, string> = { R: 'RESIDENTIAL', C: 'COMMERCIAL', I: 'INDUSTRIAL' }
export const ZONE_ACCENT: Record<string, string> = { R: '#5C7842', C: '#2E6390', I: '#C8912F' }

export const FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, system-ui, sans-serif`

export function shadeFor(kind: string, zone: string | null, density: number): Shade {
  if (kind === 'blight') return BLIGHT
  if (kind === 'park') return PARK_SHADE
  const ramp = ZONE_SHADES[zone ?? 'R']
  return ramp[Math.min(Math.max(density, 1), 3) - 1]
}
