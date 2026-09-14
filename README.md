# INFILL

**A shape puzzle that builds a city.** One thumb, no gravity, no clock.

A 10×10 lot. A hand of three tetrominoes colour-coded by zone, plus a works slot
holding a road. Drag one onto the board. Fill a row or column and that strip
**completes** — it leaves the board and rises into the skyline, banking
population.

```
npm install
npm run dev      # play at localhost:5173
npm test         # the rules
npm run model    # the balance harness — RUNS=25 for a fuller pass
npm run build    # typecheck + production build
```

---

## The three rules

**You place, you don't drop.** No gravity, no clock. A piece goes exactly where
you put it. Because nothing settles downward, rows and columns both clear.

**You can build on top of yourself.** A placement is legal if every cell it
covers is empty *or* the same zone below density 3. This is a *placement* rule,
not a scoring rule — it changes which moves exist. A piece landing entirely on
existing buildings consumes no new ground, at the cost of future stacking
capacity.

**Clearing is a harvest, not a demolition.** The board is the construction site.
The city is the skyline above it, which only ever grows.

## What a line is worth

Scored only at the moment it clears, against the cells' four neighbours as they
stand right then.

```
cell = max(0, DENSITY_VALUE[own] + Σ pair × min(own_density, neighbour_density))
```

`DENSITY_VALUE` is `[0, 10, 25, 45]` — superlinear, so upzoning is worth the
tempo it costs. The `min()` means you cannot collect a big neighbour's bonus
without matching it. Both halves were forced by measurement; see
[docs/BALANCE.md](docs/BALANCE.md).

| pair | value |
|---|---|
| residential – commercial | +5 |
| commercial – industrial | +5 |
| residential – industrial | **−8** |
| same zone | 0 — it pays in density instead |
| anything – park | +5, at the harvested cell's own density |
| anything – blight | −5 |

Cells of the highest-demand zone count twice. A placement completing several
lines at once pays +25% each, capped at ×2.

## Roads

A road scores nothing and counts as filled, so it is a cheap way to close a row
that produces no population. What it does instead is **make adjacency see through
it**: step outward through consecutive road cells and the first non-road cell is
that direction's neighbour. A house three cells from a shop, with road between,
scores the full bonus.

**Rays do not turn corners.** Every road cell conducts independently along its own
row and column, so an L-bend does not connect its two ends. That is why roads are
drawn as plain tape with dashes only along the axes a ray actually travels — the
art must not draw a rule the game does not have.

The consequence that makes this affordable: a cell always has at most four
neighbours. A longer road changes *which* four, never how many.

## Blight

Demand climbs every placement and a bar that fills drops permanent blight on the
board. Blight **blocks** its row and its column until you bulldoze it — one cell
at an intersection kills two of the twenty lines.

This is the only pressure in the design that accumulates, and it is what ends a
run. The board fills because clearing gets harder, not because a timer ran out.

## Reading the board

Density is on four channels at once: colour darkens, the block grows taller, the
shadow lengthens, and pips count it out. The pips are authoritative; the rest
support them. Zone is carried by **form** as well as hue — a pitched ridge, a
window grid, a chimney — so the board survives colourblindness.

Hold any cell to see its four resolved neighbours and what it would be worth
harvested right now. Clear-time scoring is right; clear-time-only *understanding*
is not.

## Layout

```
src/game/     the rules, pure and cloneable. No DOM.
  rules.ts      placement legality and overlap
  rays.ts       road line-of-sight
  score.ts      the scoring formula
  settle.ts     the settlement contract
  bots.ts       greedy / reacting / thinking
src/render/
  tiles.ts      the tile-drawing seam — swap this for real art
  renderer.ts   board, skyline, rail, inspection
src/App.tsx     drag, rotate, bulldoze
scripts/model.ts  the balance harness
```

`place(state, move)` is pure and returns a new state. The harness, the drag
ghost, the sightline highlight and the tests all depend on that, so it has to
stay that way.

## Documents

- [docs/DESIGN.md](docs/DESIGN.md) — the design and its arguments
- [docs/BALANCE.md](docs/BALANCE.md) — what the harness changed, and why
- [docs/ART-DIRECTION.md](docs/ART-DIRECTION.md) — the massing-model direction

## Status

MVP. Playable end to end: place, rotate, overlap, roads, parks, demand, blight,
bulldozer, skyline, game over. Art is a code-drawn placeholder in the chosen
direction, behind one seam.

Not in: terrain, the stadium / transit stop / power plant, district clears,
utilities, ordinance cards, landscape.
