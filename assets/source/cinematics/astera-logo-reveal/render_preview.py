"""Preview renders of astera_logo_reveal.blend.

    blender -b astera_logo_reveal.blend --python render_preview.py -- OUTDIR [--pct 50] [--samples 16]
                                                                      [--frames 1,20,40 | --all]

--all renders the full range as PNGs; stills otherwise. Nothing is saved back to the .blend.
"""
import sys
import time
from pathlib import Path

import bpy

argv = sys.argv[sys.argv.index('--') + 1:]
out = Path(argv[0])
out.mkdir(parents=True, exist_ok=True)


def opt(name, default):
    return type(default)(argv[argv.index(name) + 1]) if name in argv else default


scn = bpy.context.scene
scn.render.resolution_percentage = opt('--pct', 50)
scn.eevee.taa_render_samples = opt('--samples', 16)
scn.render.image_settings.file_format = 'PNG'
scn.render.image_settings.color_mode = 'RGB'

if '--all' in argv:
    scn.render.filepath = str(out / 'f_')
    t = time.time()
    bpy.ops.render.render(animation=True)
    print(f'RENDERED {scn.frame_end - scn.frame_start + 1} frames in {time.time() - t:.1f}s')
else:
    frames = [int(f) for f in opt('--frames', '1,20,40,60,80,100,114').split(',')]
    for f in frames:
        t = time.time()
        scn.frame_set(f)
        scn.render.filepath = str(out / f'f_{f:04d}.png')
        bpy.ops.render.render(write_still=True)
        print(f'frame {f}: {time.time() - t:.1f}s')
