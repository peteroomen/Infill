# Asset generation — the model sheets

Paste each prompt into GPT Image as-is. Sheet A is the one the game needs; B and
C are the payoff art and the icon.

**What makes these usable, and why the constraints are worded the way they are:**

- **Tiles include their own chipboard lot.** No transparency needed — GPT Image
  can't do reliable alpha, and the renderer already draws the lot underneath.
  Each tile is a complete square I can slice straight out.
- **One light direction, one camera, one scale, across every tile.** This is the
  thing that breaks most often and the thing that matters most: nine tiles lit
  from different angles will never look like one board.
- **Shadows stay inside the tile bounds.** A shadow that runs off the edge tiles
  badly against its neighbour.
- **Density must be legible by height and shadow length alone.** Pips are drawn
  in code on top; the art carries colour, form and height.
- **No text anywhere.** It gets garbled and I only have to mask it out.

**If the sheet comes back inconsistent** — and it probably will on the first try —
generate one *row* at a time instead. Three tiles in one image drift far less than
sixteen. The row prompts are at the bottom.

---

## Sheet A — the board tiles (the one I need)

Generate at **1024 × 1024**. Ask for 4 variations.

```
A top-down photograph of an architectural massing model, cropped into a clean
asset sheet of 16 square tiles in a strict 4 wide by 4 tall grid, evenly
spaced with narrow equal gaps, on a plain mid-grey background.

Every tile shows one square lot of pale chipboard, colour #D6C9AC, with a
faint ruled pencil grid. On each lot sits a simple block of painted card or
basswood — a massing study, no windows, no doors, no signage, no people, no
cars. Shot from directly overhead with a very slight offset so the front and
right faces of each block are just visible. A single soft light from the
upper left throws a soft grey shadow down and to the right of every block.
The lighting direction, camera angle, lot size and shadow softness are
IDENTICAL in all sixteen tiles. Every shadow falls entirely inside its own
tile and never crosses into another.

Reading left to right, top to bottom:

Row 1 — a short pale sage green block with a low pitched roof, colour
#A3BE86, one storey tall, short shadow; a medium sage green block with a
pitched roof, colour #7FA05E, twice as tall, longer shadow; a tall dark sage
green block with a pitched roof, colour #57783E, three times as tall, long
shadow; a bare chipboard lot with nothing on it, just the ruled pencil grid.

Row 2 — a short pale blue block with a flat roof, colour #8FBCDF, one storey
tall; a medium blue flat-roofed block, colour #4A8CC0, twice as tall; a tall
dark blue flat-roofed tower, colour #2E6390, three times as tall; a lot of
cracked grey rubble and derelict weedy ground, colour #ADA89E, flat and
clearly abandoned, no building.

Row 3 — a short pale amber block with a small cylindrical chimney, colour
#E8C078, one storey tall; a medium amber block with a chimney, colour
#D5A03F, twice as tall; a tall dark amber industrial block with two
chimneys, colour #A8761F, three times as tall; a small flat public park of
model-railway grass, colour #BFD3A4, with three small lichen trees in dark
green #5C7842 and a pale path, no building.

Row 4 — a strip of plain matte white tape, colour #F4F2ED, running straight
from the top edge to the bottom edge across the chipboard, completely
unmarked; the same white tape running straight from the left edge to the
right edge, unmarked; the two tapes crossing at right angles in the centre
of the lot, forming a plain crossroads, unmarked; a bare chipboard lot,
identical to the one in row 1.

Materials are matte and tactile — visible card grain and cut edges. Muted,
warm, sophisticated. Everything sharp and in focus, no depth of field blur.
No text, no labels, no numbers, no borders drawn around the tiles, no
watermark.
```

**Important:** the tape in row 4 must be completely unmarked — no centre line, no
dashes, no arrows. Roads in this game conduct adjacency along their own row and
column and **rays do not turn corners**, so anything implying flow around a bend
is drawing a rule the game doesn't have. The code adds directional dashes itself,
along the axes a ray actually travels.

---

## Sheet B — the skyline strip

The harvest: buildings that have left the board. This is the one place with room
for detail, so it's where the "real city" feeling has to live.

Generate at **1536 × 1024 landscape**.

```
A wide painted elevation of a city skyline seen straight on from ground
level, in the manner of an architect's watercolour presentation drawing. A
continuous row of buildings across the full width, standing on a single
ground line with nothing below it. Low pitched-roof houses on the left in
sage green, rising through mid-rise blocks and flat-roofed offices in slate
blue to tall towers in the centre, then falling away to industrial sheds and
chimneys in warm ochre amber on the right. Flat washes of colour grouped by
building type, fine ink linework over the washes, visible brush texture and
slight paper grain. A plain pale warm sky, no clouds, no sun. Muted, warm,
hand-made. Nothing photographic, no perspective, no people, no cars, no
text, no labels, no watermark.
```

## Sheet C — the app icon

Generate at **1024 × 1024**.

```
A single square app icon. A top-down photograph of four square lots of an
architectural massing model on pale chipboard, arranged in a two-by-two
square, filling the frame. Three lots hold simple painted blocks of
different heights — one sage green with a pitched roof, one slate blue and
flat-roofed and taller, one warm ochre amber with a small chimney — and the
fourth lot is bare chipboard. Lit from the upper left with soft grey shadows
falling down and to the right. Matte painted card, visible grain, warm and
tactile. Centred, generous margin, nothing cropped. No text, no letters, no
logo, no watermark.
```

---

## If the sheet drifts — one row at a time

Same preamble each time, swapping the last paragraph. This trades four images for
much tighter consistency.

```
A top-down photograph of an architectural massing model, cropped into a
clean asset sheet of 4 square tiles in a single horizontal row, evenly
spaced with narrow equal gaps, on a plain mid-grey background. Every tile
shows one square lot of pale chipboard, colour #D6C9AC, with a faint ruled
pencil grid. Shot from directly overhead with a very slight offset so the
front and right faces are just visible. A single soft light from the upper
left throws a soft grey shadow down and to the right. Lighting, camera, lot
size and shadow softness are IDENTICAL across all four tiles, and every
shadow stays inside its own tile. Matte painted card and basswood, visible
grain. No text, no labels, no borders, no watermark.

The four tiles, left to right: <<ROW>>
```

Substituting for `<<ROW>>`:

- **Residential** — `a short pale sage green block with a low pitched roof, colour #A3BE86, one storey tall; a medium sage green pitched-roof block, colour #7FA05E, twice as tall; a tall dark sage green pitched-roof block, colour #57783E, three times as tall; a bare chipboard lot with nothing on it.`
- **Commercial** — `a short pale blue flat-roofed block, colour #8FBCDF, one storey tall; a medium blue flat-roofed block, colour #4A8CC0, twice as tall; a tall dark blue flat-roofed tower, colour #2E6390, three times as tall; a lot of cracked grey rubble and derelict weedy ground, colour #ADA89E, no building.`
- **Industrial** — `a short pale amber block with a small cylindrical chimney, colour #E8C078, one storey tall; a medium amber block with a chimney, colour #D5A03F, twice as tall; a tall dark amber block with two chimneys, colour #A8761F, three times as tall; a small flat park of model-railway grass, colour #BFD3A4, with three lichen trees, no building.`
- **Roads** — `a strip of plain matte white tape running straight from top edge to bottom edge, completely unmarked; the same tape running left to right, unmarked; the two crossing at right angles in the centre, unmarked; a bare chipboard lot with nothing on it.`

---

## What to send back

The PNGs, and one line saying which is which if the ordering drifted. Nothing
else — I'll slice them, and they drop in behind `src/render/tiles.ts` without
touching anything else.

The tile order I need, as filenames if you want to be precise:

```
r1 r2 r3    c1 c2 c3    i1 i2 i3
empty  blight  park
road-ns  road-ew  road-cross
skyline  icon
```

If a tile comes back wrong, it's a one-tile regeneration — the row prompts above
take a single substitution.
