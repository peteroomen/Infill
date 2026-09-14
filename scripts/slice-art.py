"""
Turns the generated massing-model sheet into the sprites the renderer uses.

    python3 scripts/slice-art.py

Source art lives in art-src/ and is not shipped; the outputs in src/assets/ and
public/ are. Tile bands are detected rather than hard-coded, so a regenerated
sheet does not need new constants.

The important move is separating the MODEL from its LOT. The sheet photographs
each building centred on its own slab with a wide chipboard margin, and used
whole those margins put visible gutters between the cells of a single piece —
a tetromino read as four marooned houses rather than one block. So the buildings
are cut out, the bare lot becomes a repeating ground texture, and the renderer
draws the building larger than its cell and free to overhang.

Shadows are cast in code from the cut-out silhouettes rather than kept from the
photograph, because a photographed shadow stops dead at the edge of its slab.
"""
from PIL import Image, ImageFilter, ImageChops
import numpy as np
import os

TILE = 192
SRC, OUT = 'art-src', 'src/assets'
os.makedirs(OUT, exist_ok=True)
os.makedirs('public', exist_ok=True)

# Chipboard, measured off the bare lot: a low-saturation orange.
CHIP_HUE, CHIP_SAT = 33.8, 0.214


def bands(mask, limit, frac=0.04, min_len=40):
    thresh, out, start = limit * frac, [], None
    for i, v in enumerate(mask):
        if v > thresh and start is None:
            start = i
        elif v <= thresh and start is not None:
            out.append((start, i)); start = None
    if start is not None:
        out.append((start, len(mask)))
    return [r for r in out if r[1] - r[0] > min_len]


def hsv(px):
    mx, mn = px.max(axis=-1), px.min(axis=-1)
    d = mx - mn
    s = np.where(mx > 0, d / np.maximum(mx, 1), 0)
    r, g, b = px[..., 0], px[..., 1], px[..., 2]
    h = np.zeros_like(mx)
    safe = d > 1e-6
    i = safe & (mx == r); h[i] = 60 * (((g - b) / np.maximum(d, 1e-6))[i] % 6)
    i = safe & (mx == g); h[i] = 60 * (((b - r) / np.maximum(d, 1e-6))[i] + 2)
    i = safe & (mx == b); h[i] = 60 * (((r - g) / np.maximum(d, 1e-6))[i] + 4)
    return h, s


im = Image.open(f'{SRC}/tiles-raw.png').convert('RGB')
arr = np.asarray(im).astype(float)
warm = (arr[:, :, 0] - arr[:, :, 2]) > 14
COLS = bands(warm.sum(axis=0), arr.shape[0])
ROWS = bands(warm.sum(axis=1), arr.shape[1])
assert len(COLS) == 4 and len(ROWS) == 4, f'expected a 4x4 sheet, got {len(COLS)}x{len(ROWS)}'


def raw(r, c):
    y0, y1 = ROWS[r]; x0, x1 = COLS[c]
    side = min(x1 - x0, y1 - y0)
    cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
    return im.crop((cx - side // 2, cy - side // 2, cx + side // 2, cy + side // 2))


def tone(t):
    """Median of four corner patches — a mean gets dragged off by whichever
    corner a tall block or its shadow happens to reach into."""
    a = np.asarray(t).astype(float)
    k = max(4, int(t.width * 0.22))
    corners = [a[:k, :k], a[:k, -k:], a[-k:, :k], a[-k:, -k:]]
    return np.median(np.array([c.reshape(-1, 3).mean(axis=0) for c in corners]), axis=0)


# ---- lots: bare ground, and the cell states that are texture to their edges ---
LOTS = {'empty': (0, 3), 'blight': (1, 3), 'park': (2, 3),
        'roadNS': (3, 0), 'roadEW': (3, 1), 'roadCross': (3, 2)}
lot_imgs = {k: raw(r, c).resize((TILE, TILE), Image.LANCZOS) for k, (r, c) in LOTS.items()}

# Level every lot to the bare one so the board reads as a single surface.
target = tone(lot_imgs['empty'])
for k, t in lot_imgs.items():
    if k in ('blight', 'park'):
        continue  # texture to the edges; no chipboard to match
    a = np.asarray(t).astype(float) + (target - tone(t))
    lot_imgs[k] = Image.fromarray(np.clip(a, 0, 255).astype('uint8'))

lots = Image.new('RGB', (TILE * 3, TILE * 2))
LOT_ORDER = ['empty', 'blight', 'park', 'roadNS', 'roadEW', 'roadCross']
for i, k in enumerate(LOT_ORDER):
    lots.paste(lot_imgs[k], ((i % 3) * TILE, (i // 3) * TILE))
lots.save(f'{OUT}/lots.webp', quality=90, method=6)

# ---- models: the buildings, cut off their slabs -----------------------------
MODELS = ['R1', 'R2', 'R3', 'C1', 'C2', 'C3', 'I1', 'I2', 'I3']
MODEL_AT = {'R': 0, 'C': 1, 'I': 2}


def cut(r, c):
    t = raw(r, c).resize((TILE, TILE), Image.LANCZOS)
    a = np.asarray(t).astype(float)
    h, s = hsv(a)
    hd = np.abs(((h - CHIP_HUE + 180) % 360) - 180)
    # Hue is unstable on near-grey pixels, so it only counts with some colour
    # behind it. Saturation catches the ambers, whose hue sits on the
    # chipboard's own. The hue gate is well clear of both: bare board measures
    # about 1 degree off, the palest building about 27.
    mask = ((hd > 14) & (s > 0.12)) | (s > CHIP_SAT + 0.15)
    al = Image.fromarray((mask * 255).astype('uint8'), 'L')
    # Opening kills speckle; closing fills pinholes in a flat painted face.
    al = (al.filter(ImageFilter.MinFilter(3))
            .filter(ImageFilter.MaxFilter(5))
            .filter(ImageFilter.MinFilter(3))
            .filter(ImageFilter.GaussianBlur(0.6)))
    return Image.merge('RGBA', (*t.split(), al))


models = Image.new('RGBA', (TILE * 3, TILE * 3), (0, 0, 0, 0))
shadows = Image.new('RGBA', (TILE * 3, TILE * 3), (0, 0, 0, 0))
for i, name in enumerate(MODELS):
    zone, d = name[0], int(name[1])
    sprite = cut(MODEL_AT[zone], d - 1)
    models.paste(sprite, ((i % 3) * TILE, (i // 3) * TILE))

    # A cast shadow: the silhouette, offset down-right from a light in the upper
    # left, softened, and lengthening with height.
    al = sprite.split()[3]
    off = int(TILE * (0.035 + 0.028 * d))
    sh = Image.new('L', (TILE, TILE), 0)
    sh.paste(al, (off, int(off * 1.35)))
    sh = sh.filter(ImageFilter.GaussianBlur(TILE * 0.022))
    sh = ImageChops.multiply(sh, Image.new('L', (TILE, TILE), 150))
    black = Image.new('RGBA', (TILE, TILE), (44, 38, 26, 0))
    black.putalpha(sh)
    shadows.paste(black, ((i % 3) * TILE, (i // 3) * TILE))

models.save(f'{OUT}/models.webp', quality=92, method=6, exact=True)
shadows.save(f'{OUT}/shadows.webp', quality=88, method=6, exact=True)


def prepare_skyline():
    sky = Image.open(f'{SRC}/skyline-raw.png').convert('RGB')
    a = np.asarray(sky).astype(int)
    paper = a[10:40, 10:40].reshape(-1, 3).mean(axis=0)
    ink = (np.abs(a - paper).sum(axis=2) > 40).sum(axis=1)
    rows_ = np.where(ink > sky.width * 0.02)[0]
    top, bottom = int(rows_[0]), int(rows_[-1])
    pad = int((bottom - top) * 0.06)
    sky = sky.crop((0, max(0, top - pad), sky.width, min(sky.height, bottom + pad)))
    sky = sky.resize((1200, int(1200 * sky.height / sky.width)), Image.LANCZOS)
    # Cut the paper away so the elevation sits on the page rather than in a
    # cream box of its own — the strip has to read as part of the UI.
    a2 = np.asarray(sky).astype(float)
    paper2 = a2[5:25, 5:25].reshape(-1, 3).mean(axis=0)
    alpha = np.clip((np.abs(a2 - paper2).sum(axis=2) - 10) / 26, 0, 1)
    al = Image.fromarray((alpha * 255).astype('uint8'), 'L').filter(ImageFilter.GaussianBlur(0.4))
    sky = Image.merge('RGBA', (*sky.split(), al))
    sky.save(f'{OUT}/skyline.webp', quality=88, method=6, exact=True)
    print(f'{OUT}/skyline.webp  {sky.size}  aspect {sky.width/sky.height:.2f}')


def prepare_icon():
    ic = Image.open(f'{SRC}/icon-raw.png').convert('RGB')
    side = min(ic.size)
    cx, cy = ic.width // 2, ic.height // 2
    ic = ic.crop((cx - side // 2, cy - side // 2, cx + side // 2, cy + side // 2))
    for size, name in ((512, 'public/icon-512.png'), (180, 'public/apple-touch-icon.png'), (64, 'public/favicon.png')):
        ic.resize((size, size), Image.LANCZOS).save(name, optimize=True)


prepare_skyline()
prepare_icon()
for f in ('lots', 'models', 'shadows'):
    print(f'{OUT}/{f}.webp  {os.path.getsize(f"{OUT}/{f}.webp")//1024} kB')
