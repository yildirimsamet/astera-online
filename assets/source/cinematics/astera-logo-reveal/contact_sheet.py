"""Tile rendered frames into one labelled sheet for review.

    python3 contact_sheet.py DIR OUT.png [--cols 4] [--frames 1,20,40]
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw

d = Path(sys.argv[1])
out = Path(sys.argv[2])
cols = int(sys.argv[sys.argv.index('--cols') + 1]) if '--cols' in sys.argv else 4
files = sorted(d.glob('f_*.png'))
if '--frames' in sys.argv:
    want = {int(x) for x in sys.argv[sys.argv.index('--frames') + 1].split(',')}
    files = [f for f in files if int(f.stem.split('_')[1]) in want]
ims = [Image.open(f).convert('RGB') for f in files]
w, h = ims[0].size
tw = 480
th = round(h * tw / w)
rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (cols * tw + (cols + 1) * 4, rows * (th + 18) + 4), (40, 40, 40))
draw = ImageDraw.Draw(sheet)
for i, (f, im) in enumerate(zip(files, ims)):
    x = 4 + (i % cols) * (tw + 4)
    y = 4 + (i // cols) * (th + 18)
    sheet.paste(im.resize((tw, th), Image.LANCZOS), (x, y + 14))
    fr = int(f.stem.split('_')[1])
    draw.text((x + 2, y), f'f{fr}  {(fr - 1) / 30:.2f}s', fill=(220, 220, 220))
sheet.save(out)
print(out, len(ims))
