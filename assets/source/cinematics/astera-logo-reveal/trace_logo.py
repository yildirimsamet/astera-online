"""Trace the ASTERA ONLINE wordmark out of the real brand art into vector outlines.

Source: blindspace/apps/web/public/assets/images/logos/logo-big.png (981x800, the painted
lockup the game ships). The letters are not redrawn: their silhouettes are lifted from
that file, the orange flight streak that runs behind them is cut away, and the result is
written as polygons in Blender units (1 BU = 100 source px, origin at the lockup centre,
+Z up).

If a vector master of the logo ever turns up (SVG/AI), replace glyphs.json with outlines
from that file and build_scene.py will pick them up unchanged.

Run with any Python that has numpy, pillow and scikit-image:
    python trace_logo.py [path/to/logo-big.png]
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from skimage import measure, morphology, filters

SRC = Path(sys.argv[1] if len(sys.argv) > 1 else
           '/home/yildirim/Desktop/Coding/MyProjects/blindspace/apps/web/public/assets/images/logos/logo-big.png')
OUT = Path(__file__).with_name('glyphs.json')

PX_PER_BU = 100.0
ASTERA_ROWS = (351, 450)
ONLINE_ROWS = (456, 538)
COLS = (55, 885)
LUM_T = 40.0

img = np.asarray(Image.open(SRC).convert('RGB')).astype(float)
R, G, B = img[..., 0], img[..., 1], img[..., 2]
lum = 0.2126 * R + 0.7152 * G + 0.0722 * B

band = np.zeros(lum.shape, bool)
band[ASTERA_ROWS[0]:ASTERA_ROWS[1], COLS[0]:COLS[1]] = True
band[ONLINE_ROWS[0]:ONLINE_ROWS[1], COLS[0]:COLS[1]] = True
# Letters are cool silver (R-B about -10); the streak glow behind them is warm.
warm = (R - B) > 12
mask = (lum > LUM_T) & band & ~warm

# The streak: fit a line through its orange pixels, then drop every thin piece of the
# mask that lies along it. Letters are thick, the streak is 2-4 px, so an opening
# separates the two and the line test keeps letter corners from being thrown away.
orange = (R - B > 50) & (R > 70)
ys, xs = np.nonzero(orange)
k, c = np.polyfit(xs, ys, 1)
yy, xx = np.mgrid[0:lum.shape[0], 0:lum.shape[1]]
dist = np.abs(k * xx - yy + c) / np.hypot(k, 1)

opened = morphology.opening(mask, morphology.disk(2))
residue = measure.label(mask & ~opened, connectivity=2)
for p in measure.regionprops(residue):
    rr, cc = p.coords[:, 0], p.coords[:, 1]
    if dist[rr, cc].mean() < 7:
        mask[rr, cc] = False
# Anything else thin that touches a letter (the planet's blue rim grazes the S) goes the
# same way: keep the opened shape plus a 2 px collar so sharp corners survive.
opened = morphology.opening(mask, morphology.disk(2))
mask &= morphology.dilation(opened, morphology.disk(2))
mask = morphology.remove_small_objects(mask, max_size=120)
mask = morphology.remove_small_holes(mask, max_size=40)

labels = measure.label(mask, connectivity=2)
regions = [p for p in measure.regionprops(labels) if p.area > 300]
top = sorted([p for p in regions if p.bbox[0] < ASTERA_ROWS[1] - 20], key=lambda p: p.bbox[1])
bot = sorted([p for p in regions if p.bbox[0] >= ASTERA_ROWS[1] - 20], key=lambda p: p.bbox[1])
assert len(top) == 6 and len(bot) == 6, (len(top), len(bot))

all_rows = np.concatenate([p.coords[:, 0] for p in regions])
all_cols = np.concatenate([p.coords[:, 1] for p in regions])
cx = (all_cols.min() + all_cols.max() + 1) / 2.0
cy = (all_rows.min() + all_rows.max() + 1) / 2.0


def to_bu(pts):
    # skimage contours are (row, col); +0.5 puts them on pixel centres
    return [[round((c + 0.5 - cx) / PX_PER_BU, 5), round((cy - (r + 0.5)) / PX_PER_BU, 5)] for r, c in pts]


UP = 4          # contour on a 4x bicubic upsample: the art is only ~800 px wide and the
PAD = 4         # reveal shows it at ~1100 px, so pixel-level wobble would show


def polygon_area(P):
    y, x = P[:, 0], P[:, 1]
    return 0.5 * abs(np.dot(x, np.roll(y, 1)) - np.dot(y, np.roll(x, 1)))


def snap_axes(P, min_len, ang_deg=4.0):
    """The face is geometric: edges within a few degrees of horizontal/vertical are meant
    to be exactly so. Diagonals and short curve segments are left alone."""
    P = P.copy()
    n = len(P)
    for i in range(n):
        a, b = P[i], P[(i + 1) % n]
        d = b - a
        if np.hypot(*d) < min_len:
            continue
        ang = np.degrees(np.arctan2(abs(d[0]), abs(d[1])))      # 0 = horizontal
        if ang < ang_deg:
            P[i, 0] = P[(i + 1) % n, 0] = (a[0] + b[0]) / 2
        elif ang > 90 - ang_deg:
            P[i, 1] = P[(i + 1) % n, 1] = (a[1] + b[1]) / 2
    return P


def outlines(region, tol):
    r0, c0, r1, c1 = region.bbox
    r0, c0, r1, c1 = r0 - PAD, c0 - PAD, r1 + PAD, c1 + PAD
    own = morphology.dilation(labels[r0:r1, c0:c1] == region.label, morphology.disk(1))
    sub = np.where(own & ~warm[r0:r1, c0:c1], lum[r0:r1, c0:c1], 0.0).astype(np.float32)
    h, w = sub.shape
    up = np.asarray(Image.fromarray(sub, mode='F').resize((w * UP, h * UP), Image.BICUBIC))
    field = filters.gaussian(up, sigma=1.4)
    polys = []
    for cnt in measure.find_contours(field, LUM_T + 5):
        if len(cnt) < 12:
            continue
        cnt = measure.approximate_polygon(cnt, tolerance=tol * UP)[:-1]
        if len(cnt) < 3:
            continue
        if polygon_area(cnt) < 25 * UP * UP:
            continue
        cnt = snap_axes(cnt, min_len=3 * UP)
        cnt = (cnt + 0.5) / UP - 0.5 + np.array([r0, c0])      # back to source pixel indices
        polys.append(to_bu(cnt))
    return polys


glyphs = []
for name, row, regs in (('ASTERA', 'top', top), ('ONLINE', 'bottom', bot)):
    for i, (ch, p) in enumerate(zip(name, regs)):
        glyphs.append({
            'id': f'{name}_{i}_{ch}',
            'char': ch,
            'row': row,
            'index': i,
            'polys': outlines(p, tol=0.45),
        })

# The first A, reduced to its corners: this is the shape the orbital ring folds into.
a_poly = np.array(outlines(top[0], tol=1.6)[0])
order = np.argsort(a_poly[:, 1])
feet = a_poly[order[:4]]
feet = feet[np.argsort(feet[:, 0])]
lo, li, ri, ro = (tuple(p) for p in feet)
idx = {tuple(p): i for i, p in enumerate(a_poly)}
n = len(a_poly)


def walk(start, end, avoid):
    for step in (1, -1):
        out, i = [], idx[start]
        while True:
            out.append(a_poly[i].tolist())
            if tuple(a_poly[i]) == end:
                break
            i = (i + step) % n
            if tuple(a_poly[i]) == avoid:
                out = None
                break
        if out:
            return out
    raise RuntimeError('could not walk A outline')


outer = walk(lo, ro, li)
inner = walk(li, ri, lo)

data = {
    'source': str(SRC),
    'px_per_bu': PX_PER_BU,
    'streak_line_px': [k, c],
    'glyphs': glyphs,
    'a_morph': {'outer': outer, 'inner': inner, 'polygon': a_poly.tolist()},
}
OUT.write_text(json.dumps(data, indent=1))

Image.fromarray((mask * 255).astype(np.uint8)).crop((COLS[0], ASTERA_ROWS[0] - 10, COLS[1], ONLINE_ROWS[1] + 10)) \
    .save(OUT.with_name('trace_mask.png'))
print('glyphs', [(g['id'], len(g['polys']), [len(p) for p in g['polys']]) for g in glyphs])
print('A outer', np.round(outer, 3).tolist())
print('A inner', np.round(inner, 3).tolist())
xs_all = [pt[0] for g in glyphs for poly in g['polys'] for pt in poly]
zs_all = [pt[1] for g in glyphs for poly in g['polys'] for pt in poly]
print('extent x', min(xs_all), max(xs_all), 'z', min(zs_all), max(zs_all))
