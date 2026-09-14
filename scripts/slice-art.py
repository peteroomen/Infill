"""
Slices the generated massing-model sheet into the sprite sheet the renderer uses,
and prepares the skyline and icon.

    python3 scripts/slice-art.py

Source art lives in art-src/ and is not shipped; the outputs in src/assets/ and
public/ are. Tile bands are detected rather than hard-coded, because a
regenerated sheet will not land on exactly the same pixels.
"""
from PIL import Image
import numpy as np
import os

TILE = 192                      # per-tile output size
SRC = 'art-src'
OUT = 'src/assets'
os.makedirs(OUT, exist_ok=True)
os.makedirs('public', exist_ok=True)


def bands(mask, limit, thresh_frac=0.04, min_len=40):
    """Contiguous runs where enough pixels look like chipboard."""
    thresh = limit * thresh_frac
    out, start = [], None
    for i, v in enumerate(mask):
        if v > thresh and start is None:
            start = i
        elif v <= thresh and start is not None:
            out.append((start, i))
            start = None
    if start is not None:
        out.append((start, len(mask)))
    return [r for r in out if r[1] - r[0] > min_len]


def slice_tiles():
    im = Image.open(f'{SRC}/tiles-raw.png').convert('RGB')
    a = np.asarray(im).astype(int)
    h, w, _ = a.shape
    # Chipboard is warm; the backdrop is neutral grey.
    warm = (a[:, :, 0] - a[:, :, 2]) > 14
    cols = bands(warm.sum(axis=0), h)
    rows = bands(warm.sum(axis=1), w)
    assert len(cols) == 4 and len(rows) == 4, f'expected a 4x4 sheet, found {len(cols)}x{len(rows)}'

    # Crop first, then level the chipboard across tiles. Each photographed slab
    # is lit very slightly differently, and butted together on a board those
    # differences read as a patchwork of squares rather than one surface.
    crops = []
    for r, (y0, y1) in enumerate(rows):
        for c, (x0, x1) in enumerate(cols):
            side = min(x1 - x0, y1 - y0)
            cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
            tile = im.crop((cx - side // 2, cy - side // 2, cx + side // 2, cy + side // 2))
            crops.append(tile.resize((TILE, TILE), Image.LANCZOS))

    def board_tone(t):
        """Median of the four corner patches.

        A tall block or its shadow reaches into one or two corners, so a mean
        over the whole edge gets dragged off by whichever tile happens to have
        the biggest model. The median of four samples ignores the outliers."""
        a = np.asarray(t).astype(float)
        k = int(TILE * 0.22)
        corners = [a[:k, :k], a[:k, -k:], a[-k:, :k], a[-k:, -k:]]
        return np.median(np.array([c.reshape(-1, 3).mean(axis=0) for c in corners]), axis=0)

    # park (index 11) and blight (index 7) are texture to their edges — excluded
    # from the reference, and left uncorrected.
    textured = {7, 11}
    tones = [board_tone(t) for i, t in enumerate(crops) if i not in textured]
    target = np.mean(tones, axis=0)

    sheet = Image.new('RGB', (TILE * 4, TILE * 4))
    for i, tile in enumerate(crops):
        if i not in textured:
            delta = target - board_tone(tile)
            a = np.asarray(tile).astype(float) + delta
            tile = Image.fromarray(np.clip(a, 0, 255).astype('uint8'))
        sheet.paste(tile, ((i % 4) * TILE, (i // 4) * TILE))
    sheet.save(f'{OUT}/tiles.webp', quality=88, method=6)
    print(f'{OUT}/tiles.webp  {sheet.size}  {os.path.getsize(f"{OUT}/tiles.webp")//1024} kB')


def prepare_skyline():
    im = Image.open(f'{SRC}/skyline-raw.png').convert('RGB')
    # Trim the empty paper below the ground line so the strip is mostly building.
    a = np.asarray(im).astype(int)
    paper = a[10:40, 10:40].reshape(-1, 3).mean(axis=0)
    ink = (np.abs(a - paper).sum(axis=2) > 40).sum(axis=1)
    rowsWithInk = np.where(ink > im.width * 0.02)[0]
    top, bottom = int(rowsWithInk[0]), int(rowsWithInk[-1])
    pad = int((bottom - top) * 0.06)
    im = im.crop((0, max(0, top - pad), im.width, min(im.height, bottom + pad)))
    # Sized to the strip it is drawn in: full board width at up to 3x density.
    im = im.resize((1200, int(1200 * im.height / im.width)), Image.LANCZOS)
    im.save(f'{OUT}/skyline.webp', quality=86, method=6)
    print(f'{OUT}/skyline.webp  {im.size}  aspect {im.width/im.height:.2f}  {os.path.getsize(f"{OUT}/skyline.webp")//1024} kB')


def prepare_icon():
    im = Image.open(f'{SRC}/icon-raw.png').convert('RGB')
    side = min(im.size)
    cx, cy = im.width // 2, im.height // 2
    im = im.crop((cx - side // 2, cy - side // 2, cx + side // 2, cy + side // 2))
    for size, name in ((512, 'public/icon-512.png'), (180, 'public/apple-touch-icon.png'), (64, 'public/favicon.png')):
        im.resize((size, size), Image.LANCZOS).save(name, optimize=True)
    print('public/icon-512.png, apple-touch-icon.png, favicon.png')


slice_tiles()
prepare_skyline()
prepare_icon()
