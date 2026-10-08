"""ASTERA ONLINE — logo reveal, built from nothing so it can be rebuilt at will.

    blender -b --factory-startup --python build_scene.py -- [--out astera_logo_reveal.blend]

Orbital ring -> letter A -> ASTERA ONLINE, 3.8 s at 30 fps (frames 1..114).

Everything lives in a fresh file: the script never opens or edits an existing .blend.
The wordmark comes from glyphs.json, which trace_logo.py lifts from the shipped brand art
(blindspace/.../logos/logo-big.png). Swap that JSON for vector-master outlines and the
whole animation follows.
"""
import json
import math
import random
import sys
from pathlib import Path

import bpy
from mathutils import Euler, Matrix, Quaternion, Vector

HERE = Path(__file__).resolve().parent
ARGV = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = Path(ARGV[ARGV.index('--out') + 1]) if '--out' in ARGV else HERE / 'astera_logo_reveal.blend'
GLYPHS = json.loads((HERE / 'glyphs.json').read_text())

FPS = 30
F_END = 114


def fr(sec):
    """Seconds on the brief's timeline -> frame number (0.00 s is frame 1)."""
    return 1.0 + sec * FPS


# ── timeline (frames) ─────────────────────────────────────────────────────────
T_CORE_IN = fr(0.05)
T_RING_IN = fr(0.45)        # ring starts drawing itself around the core
T_RING_DRAWN = fr(0.95)
T_SPIN_LOCK = fr(1.38)      # ring has decelerated, seam at the bottom, facing camera
T_FACE_START = fr(1.08)
T_FOLD_START = fr(1.25)     # ring opens at the seam and folds into the A
T_FOLD_END = fr(1.70)
T_PULSE = fr(1.75)          # A complete: the one flash in the piece
T_SETTLE = fr(2.03)         # the A has slid back into its slot in the word
T_SWEEP = (fr(1.93), fr(2.42))  # a reveal front runs from the A to the end of the word
T_ONLINE = fr(2.22)
T_ORBIT_IN = fr(2.40)       # the orbit returns, now around the whole lockup
T_ORBIT_DRAWN = fr(3.05)
T_HOLD = fr(3.20)

# The ring and the A are born in front of the word (closer to camera, so the transformation
# reads large), then the finished A slides back into its place in the lockup.
Y_NEAR = -9.5

# ── palette ───────────────────────────────────────────────────────────────────
COOL = (0.62, 0.84, 1.0, 1.0)
COOL_WHITE = (0.84, 0.92, 1.0, 1.0)
CORE_COL = (0.86, 0.93, 1.0, 1.0)


def clamp01(x):
    return max(0.0, min(1.0, x))


def smooth(x):
    x = clamp01(x)
    return x * x * (3 - 2 * x)


def ease_in_out(x):
    x = clamp01(x)
    return 4 * x ** 3 if x < 0.5 else 1 - (-2 * x + 2) ** 3 / 2


def ease_out(x):
    return 1 - (1 - clamp01(x)) ** 3


# ── animation helpers ─────────────────────────────────────────────────────────

def fcurves(id_data):
    ad = id_data.animation_data
    if not ad or not ad.action:
        return []
    from bpy_extras import anim_utils
    bag = anim_utils.action_get_channelbag_for_slot(ad.action, ad.action_slot)
    return list(bag.fcurves) if bag else []


def key(target, path, frame, value, interp='BEZIER', easing='AUTO', index=-1):
    """Insert one keyframe and give it an interpolation for the segment that follows."""
    if isinstance(value, bool):
        interp = 'CONSTANT'
    if path.startswith('["'):
        target[path[2:-2]] = value
    elif index >= 0:
        getattr(target, path)[index] = value
    else:
        setattr(target, path, value)
    target.keyframe_insert(path, frame=frame, index=index)
    full = target.path_from_id(path)
    for fc in fcurves(target.id_data):
        if fc.data_path == full and (index < 0 or fc.array_index == index):
            for kp in fc.keyframe_points:
                if abs(kp.co.x - frame) < 1e-4:
                    kp.interpolation = interp
                    kp.easing = easing
                    kp.handle_left_type = kp.handle_right_type = 'AUTO_CLAMPED'


def keys(target, path, pairs, index=-1, interp='BEZIER', easing='AUTO'):
    for p in pairs:
        f, v = p[0], p[1]
        key(target, path, f, v,
            interp=p[2] if len(p) > 2 else interp,
            easing=p[3] if len(p) > 3 else easing, index=index)


def prop(obj, name, value=0.0):
    obj[name] = value
    return obj


# ── scene scaffolding ─────────────────────────────────────────────────────────

def reset_file():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scn = bpy.context.scene
    scn.name = 'ASTERA_Reveal'
    return scn


def collection(name, parent=None):
    col = bpy.data.collections.new(name)
    (parent or bpy.context.scene.collection).children.link(col)
    return col


def link(obj, col):
    col.objects.link(obj)
    return obj


class NodeBuilder:
    """Terse node graph construction: n('Math', operation='ADD', inputs={0: x, 1: 0.5})."""

    def __init__(self, tree):
        self.tree = tree
        self.x = 0

    def n(self, kind, inputs=None, **attrs):
        node = self.tree.nodes.new(kind if '.' in kind or kind.startswith(('ShaderNode', 'CompositorNode', 'Node'))
                                   else 'ShaderNode' + kind)
        node.location = (self.x, 0)
        self.x += 180
        for k, v in attrs.items():
            setattr(node, k, v)
        for k, v in (inputs or {}).items():
            self.set(node.inputs[k], v)
        return node

    def set(self, sock, v):
        if hasattr(v, 'is_output') or (isinstance(v, tuple) and len(v) == 2 and hasattr(v[0], 'outputs')):
            out = v if hasattr(v, 'is_output') else v[0].outputs[v[1]]
            self.tree.links.new(out, sock)
        elif hasattr(v, 'outputs'):
            self.tree.links.new(v.outputs[0], sock)
        else:
            sock.default_value = v

    def math(self, op, a, b=None, clamp=False):
        node = self.n('Math', operation=op, use_clamp=clamp)
        self.set(node.inputs[0], a)
        if b is not None:
            self.set(node.inputs[1], b)
        return node

    def objattr(self, name):
        return self.n('Attribute', attribute_type='OBJECT', attribute_name=name).outputs['Fac']

    def maprange(self, v, a, b, c, d, smooth_=False, clamp=True):
        node = self.n('MapRange', interpolation_type='SMOOTHSTEP' if smooth_ else 'LINEAR', clamp=clamp)
        self.set(node.inputs['Value'], v)
        node.inputs['From Min'].default_value = a
        node.inputs['From Max'].default_value = b
        node.inputs['To Min'].default_value = c
        node.inputs['To Max'].default_value = d
        return node


def new_material(name, method='DITHERED'):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.node_tree.nodes.clear()
    mat.surface_render_method = method
    if hasattr(mat, 'use_transparent_shadow'):
        mat.use_transparent_shadow = True
    if method == 'BLENDED':
        mat.use_transparency_overlap = False          # fade as a solid, no inner faces
    return mat, NodeBuilder(mat.node_tree)


# ── materials ─────────────────────────────────────────────────────────────────

def mat_letter(name, stops, rough, glow_gain):
    """Brushed silver for the wordmark, after the shipped art: bright top falling to a
    darker base. `stops` = [(position, grey), ...] along the letter's height."""
    mat, b = new_material(name, method='BLENDED')
    tc = b.n('TexCoord')
    sep = b.n('SeparateXYZ', inputs={0: tc.outputs['Generated']})
    ramp = b.n('ValToRGB')
    b.set(ramp.inputs[0], sep.outputs['Y'])
    els = ramp.color_ramp.elements
    while len(els) < len(stops):
        els.new(0.5)
    for el, (pos, g) in zip(els, stops):
        el.position = pos
        el.color = (g * 0.97, g * 0.985, g, 1.0)
    # fine horizontal brushing: noise stretched along X, in roughness and a touch of colour
    mapping = b.n('Mapping', inputs={'Scale': (0.6, 90.0, 1.0)})
    b.set(mapping.inputs['Vector'], tc.outputs['Object'])
    noise = b.n('TexNoise', inputs={'Vector': mapping, 'Scale': 3.0, 'Detail': 2.0})
    r = b.maprange(noise.outputs['Fac'], 0.3, 0.7, rough - 0.05, rough + 0.05)
    brush = b.maprange(noise.outputs['Fac'], 0.3, 0.7, 0.94, 1.04)
    tint = b.n('Mix', data_type='RGBA', blend_type='MULTIPLY', inputs={0: 1.0, 6: ramp.outputs['Color']})
    b.set(tint.inputs[7], b.n('CombineColor', inputs={0: brush, 1: brush, 2: brush}))
    reveal = b.objattr('reveal')
    glow = b.objattr('glow')
    em = b.math('MULTIPLY', glow, glow_gain)
    bsdf = b.n('BsdfPrincipled', inputs={
        'Base Color': tint.outputs[2], 'Metallic': 1.0, 'Roughness': r,
        'Alpha': reveal, 'Emission Color': COOL_WHITE, 'Emission Strength': em,
    })
    out = b.n('OutputMaterial')
    b.set(out.inputs['Surface'], bsdf)
    return mat


def mat_orbit_band():
    """Dark machined metal band with a restrained emissive edge and a travelling glint.

    Per-object controls (custom properties):
      draw     0..1  how much of the band exists, measured along U from the seam
      energy         overall emission level
      headamp        brightness of the glint riding the drawing front
      outline  0..1  light the band's end caps too (used once it is the letter A)
      fade     0..1  overall opacity
      depth_c, depth_r, back  front/back falloff: ring centre Y, its Y half-range, and the
                     brightness of the far side
    """
    mat, b = new_material('M_Orbit_Band')
    uv = b.n('UVMap')
    sep = b.n('SeparateXYZ', inputs={0: uv})
    u, v = sep.outputs['X'], sep.outputs['Y']
    draw, energy, headamp = b.objattr('draw'), b.objattr('energy'), b.objattr('headamp')
    outline, fade = b.objattr('outline'), b.objattr('fade')
    depth_c, depth_r, back = b.objattr('depth_c'), b.objattr('depth_r'), b.objattr('back')

    # visible where u < draw, with a soft leading edge
    lead = b.math('SUBTRACT', draw, u)
    vis = b.maprange(lead, -0.004, 0.004, 0.0, 1.0, smooth_=True)
    # glint: exponential tail behind the drawing front
    tail = b.math('MAXIMUM', lead, 0.0)
    head = b.math('EXPONENT', b.math('MULTIPLY', tail, -16.0))
    head = b.math('MULTIPLY', b.math('MULTIPLY', head, vis), headamp)

    edge_o = b.maprange(v, 0.62, 1.0, 0.0, 1.0, smooth_=True)
    edge_i = b.math('MULTIPLY', b.maprange(v, 0.28, 0.0, 0.0, 1.0, smooth_=True), 0.45)
    ends = b.math('ADD', b.maprange(u, 0.012, 0.0, 0.0, 1.0, smooth_=True),
                  b.maprange(u, 0.988, 1.0, 0.0, 1.0, smooth_=True))
    edge = b.math('ADD', b.math('ADD', edge_o, edge_i), b.math('MULTIPLY', ends, outline))

    geo = b.n('NewGeometry')
    wy = b.n('SeparateXYZ', inputs={0: geo.outputs['Position']}).outputs['Y']
    ny = b.math('DIVIDE', b.math('SUBTRACT', wy, depth_c), depth_r)
    depth = b.n('MapRange', clamp=True)
    b.set(depth.inputs['Value'], ny)
    depth.inputs['From Min'].default_value = -1.0
    depth.inputs['From Max'].default_value = 1.0
    depth.inputs['To Min'].default_value = 1.0
    b.set(depth.inputs['To Max'], back)

    glow = b.math('ADD', b.math('MULTIPLY', edge, 1.0), b.math('MULTIPLY', head, b.math('ADD', b.math('MULTIPLY', edge, 5.0), 1.6)))
    strength = b.math('MULTIPLY', b.math('MULTIPLY', glow, energy), depth)
    alpha = b.math('MULTIPLY', vis, fade)
    bsdf = b.n('BsdfPrincipled', inputs={
        'Base Color': (0.055, 0.06, 0.07, 1.0), 'Metallic': 1.0, 'Roughness': 0.26,
        'Alpha': alpha, 'Emission Color': COOL, 'Emission Strength': strength,
    })
    out = b.n('OutputMaterial')
    b.set(out.inputs['Surface'], bsdf)
    return mat


def mat_additive(name, ring=False):
    """Additive glow card. Radial falloff from the UV centre; `glow` scales it."""
    mat, b = new_material(name, method='BLENDED')
    uv = b.n('UVMap')
    centred = b.n('VectorMath', operation='SUBTRACT', inputs={0: uv, 1: (0.5, 0.5, 0.0)})
    d = b.math('MULTIPLY', b.n('VectorMath', operation='LENGTH', inputs={0: centred}).outputs['Value'], 2.0)
    if ring:
        x = b.math('DIVIDE', b.math('SUBTRACT', d, 0.82), 0.05)
        fall = b.math('EXPONENT', b.math('MULTIPLY', b.math('MULTIPLY', x, x), -1.0))
    else:
        lin = b.math('SUBTRACT', 1.0, d, clamp=True)
        fall = b.math('POWER', lin, 3.2)
    strength = b.math('MULTIPLY', fall, b.objattr('glow'))
    em = b.n('Emission', inputs={'Color': CORE_COL, 'Strength': strength})
    tr = b.n('BsdfTransparent')
    add = b.n('AddShader', inputs={0: em, 1: tr})
    out = b.n('OutputMaterial')
    b.set(out.inputs['Surface'], add)
    return mat


def mat_emit(name, color, strength_attr, gain, attr_type='OBJECT'):
    mat, b = new_material(name)
    a = b.n('Attribute', attribute_type=attr_type, attribute_name=strength_attr).outputs['Fac']
    em = b.n('Emission', inputs={'Color': color, 'Strength': b.math('MULTIPLY', a, gain)})
    out = b.n('OutputMaterial')
    b.set(out.inputs['Surface'], em)
    return mat


# ── geometry ──────────────────────────────────────────────────────────────────

def band_mesh(name, columns):
    """Open strip: columns = [(inner_xyz, outer_xyz), ...]; UV u along, v across."""
    verts, faces = [], []
    for inner, outer in columns:
        verts += [tuple(inner), tuple(outer)]
    n = len(columns)
    for i in range(n - 1):
        faces.append((2 * i, 2 * i + 2, 2 * i + 3, 2 * i + 1))
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    uvl = me.uv_layers.new(name='UVMap')
    for poly in me.polygons:
        for li in poly.loop_indices:
            vi = me.loops[li].vertex_index
            uvl.data[li].uv = ((vi // 2) / (n - 1), float(vi % 2))
    me.update()
    return me


def ring_columns(radius, half_width, segs, theta0, sign=1.0):
    cols = []
    for i in range(segs + 1):
        th = theta0 + sign * 2 * math.pi * i / segs
        c, s = math.cos(th), math.sin(th)
        cols.append((((radius - half_width) * c, (radius - half_width) * s, 0.0),
                     ((radius + half_width) * c, (radius + half_width) * s, 0.0)))
    return cols


def resample(chain, ts):
    pts = [Vector((p[0], p[1])) for p in chain]
    seg = [(pts[i + 1] - pts[i]).length for i in range(len(pts) - 1)]
    total = sum(seg)
    out = []
    for t in ts:
        d = t * total
        for i, L in enumerate(seg):
            if d <= L or i == len(seg) - 1:
                k = 0 if L == 0 else min(1.0, d / L)
                out.append(pts[i].lerp(pts[i + 1], k))
                break
            d -= L
    return out


def billboard(name, size, mat, col, camera):
    me = bpy.data.meshes.new(name)
    h = size / 2
    me.from_pydata([(-h, -h, 0), (h, -h, 0), (h, h, 0), (-h, h, 0)], [], [(0, 1, 2, 3)])
    uvl = me.uv_layers.new(name='UVMap')
    for li, uv in zip(range(4), [(0, 0), (1, 0), (1, 1), (0, 1)]):
        uvl.data[li].uv = uv
    me.materials.append(mat)
    ob = link(bpy.data.objects.new(name, me), col)
    con = ob.constraints.new('TRACK_TO')
    con.target = camera
    con.track_axis = 'TRACK_Z'
    con.up_axis = 'UP_Y'
    ob.visible_shadow = False
    return ob


# ── build ─────────────────────────────────────────────────────────────────────

def build():
    scn = reset_file()
    scn.frame_start, scn.frame_end = 1, F_END
    scn.render.fps = FPS
    scn.render.resolution_x, scn.render.resolution_y = 1920, 1080
    scn.render.resolution_percentage = 100
    scn.render.engine = 'BLENDER_EEVEE'
    scn.eevee.taa_render_samples = 64
    scn.render.use_motion_blur = True
    scn.render.motion_blur_shutter = 0.5
    scn.view_settings.view_transform = 'AgX'
    try:
        scn.view_settings.look = 'AgX - Medium High Contrast'
    except TypeError:
        pass
    scn.view_settings.exposure = 0.0

    cols = {n: collection(n) for n in ('LOGO', 'ORBIT', 'ENERGY', 'FX', 'LIGHTS', 'CAMERA', 'ENVIRONMENT')}

    # ── camera ────────────────────────────────────────────────────────────────
    a_poly = GLYPHS['a_morph']['polygon']
    ax = [p[0] for p in a_poly]
    az = [p[1] for p in a_poly]
    A_C = Vector(((min(ax) + max(ax)) / 2, Y_NEAR, (min(az) + max(az)) / 2))
    CORE = Vector((A_C.x, Y_NEAR, A_C.z - 0.06))
    CAM_END = Vector((0.0, -18.8, -0.2))

    cam_data = bpy.data.cameras.new('CAM_Main')
    cam_data.lens = 50
    cam_data.sensor_width = 36
    cam_data.clip_start, cam_data.clip_end = 0.1, 400
    cam = link(bpy.data.objects.new('CAM_Main', cam_data), cols['CAMERA'])
    scn.camera = cam
    cam.rotation_euler = (math.radians(90), 0, 0)
    # x/z: locked on the core until the word starts to build, then a gentle truck to centre
    keys(cam, 'location', [(1, CORE.x), (T_PULSE - 3, CORE.x), (fr(2.62), CAM_END.x), (F_END, CAM_END.x)], index=0)
    keys(cam, 'location', [(1, CORE.z), (T_PULSE - 3, CORE.z), (fr(2.62), CAM_END.z), (F_END, CAM_END.z)], index=2)
    # y: one continuous push-in, slowing but never stopping
    keys(cam, 'location', [(1, -27.5), (fr(1.15), -23.6), (fr(1.75), -21.8), (fr(2.45), -20.0),
                           (fr(3.20), -19.2), (F_END, CAM_END.y)], index=1)
    keys(cam, 'rotation_euler', [(1, math.radians(0.5)), (F_END, 0.0)], index=1)

    # ── world: near-black space with few stars; a soft studio env only for reflections ──
    world = bpy.data.worlds.new('ENV_World')
    scn.world = world
    world.use_nodes = True
    wt = world.node_tree
    wt.nodes.clear()
    b = NodeBuilder(wt)
    tc = b.n('TexCoord')
    dirv = tc.outputs['Generated']

    def stars(scale, keep, radius, gain):
        vor = b.n('TexVoronoi', inputs={'Vector': dirv, 'Scale': scale, 'Randomness': 1.0})
        rgb = b.n('SeparateColor', inputs={0: vor.outputs['Color']})
        sel = b.maprange(rgb.outputs['Red'], keep, keep + 0.002, 0.0, 1.0)
        dot = b.maprange(vor.outputs['Distance'], radius, 0.0, 0.0, 1.0, smooth_=True)
        bright = b.math('POWER', rgb.outputs['Green'], 2.5)
        return b.math('MULTIPLY', b.math('MULTIPLY', sel, dot), b.math('MULTIPLY', bright, gain))

    s = b.math('ADD', stars(55.0, 0.975, 0.035, 2.4), stars(160.0, 0.93, 0.05, 0.9))
    neb = b.n('TexNoise', inputs={'Vector': dirv, 'Scale': 1.4, 'Detail': 4.0, 'Roughness': 0.55})
    nebm = b.maprange(neb.outputs['Fac'], 0.48, 0.78, 0.0, 1.0, smooth_=True)
    # ShaderNodeMix repeats its socket names per data type: colour A/B are 6/7, result is 2
    nebc = b.n('Mix', data_type='RGBA', inputs={0: nebm, 6: (0.0006, 0.0008, 0.0014, 1), 7: (0.003, 0.005, 0.011, 1)})
    sc = b.n('CombineColor', inputs={0: b.math('MULTIPLY', s, 0.9), 1: b.math('MULTIPLY', s, 0.95), 2: s})
    starc = b.n('Mix', data_type='RGBA', blend_type='ADD', inputs={0: 1.0, 6: nebc.outputs[2], 7: sc})
    bg_cam = b.n('Background', inputs={'Color': starc.outputs[2], 'Strength': 1.0})

    # reflection-only environment: a long soft box behind and above the camera
    box_dir = Vector((0.0, -1.0, 0.42)).normalized()
    ndir = b.n('VectorMath', operation='NORMALIZE', inputs={0: dirv})
    dp = b.n('VectorMath', operation='DOT_PRODUCT', inputs={0: ndir, 1: tuple(box_dir)}).outputs['Value']
    box = b.maprange(dp, 0.55, 0.97, 0.0, 1.0, smooth_=True)
    up = b.n('SeparateXYZ', inputs={0: ndir}).outputs['Z']
    sky = b.maprange(up, -0.4, 0.8, 0.012, 0.05, smooth_=True)
    refl = b.math('ADD', b.math('MULTIPLY', box, 0.65), sky)
    bg_ref = b.n('Background', inputs={'Color': (0.8, 0.88, 1.0, 1.0), 'Strength': refl})
    lp = b.n('LightPath')
    mix = b.n('MixShader', inputs={0: lp.outputs['Is Camera Ray'], 1: bg_ref, 2: bg_cam})
    wout = b.n('OutputWorld')
    b.set(wout.inputs['Surface'], mix)

    # ── materials ─────────────────────────────────────────────────────────────
    M_ASTERA = mat_letter('M_Logo_Astera', [(0.0, 0.26), (0.5, 0.55), (0.86, 0.95), (1.0, 1.0)], rough=0.27, glow_gain=1.3)
    M_ONLINE = mat_letter('M_Logo_Online', [(0.0, 0.22), (0.5, 0.42), (0.88, 0.74), (1.0, 0.78)], rough=0.33, glow_gain=0.6)
    M_BAND = mat_orbit_band()
    M_HALO = mat_additive('M_Energy_Halo')
    M_CORE = mat_emit('M_Energy_Core', CORE_COL, 'power', 60.0)
    M_DUST = mat_emit('M_Env_Dust', (0.7, 0.82, 1.0, 1.0), 'bright', 0.9, attr_type='GEOMETRY')

    # ── logo: the real wordmark outlines, extruded with a fine bevel ─────────
    root = link(bpy.data.objects.new('LOGO_Root', None), cols['LOGO'])
    root.empty_display_type = 'PLAIN_AXES'
    letters = {}
    for g in GLYPHS['glyphs']:
        xs = [p[0] for poly in g['polys'] for p in poly]
        zs = [p[1] for poly in g['polys'] for p in poly]
        cx, cz = (min(xs) + max(xs)) / 2, (min(zs) + max(zs)) / 2
        cu = bpy.data.curves.new('CU_' + g['id'], 'CURVE')
        cu.dimensions = '2D'
        cu.fill_mode = 'BOTH'
        cu.extrude = 0.045
        cu.bevel_mode = 'ROUND'
        cu.bevel_depth = 0.008
        cu.bevel_resolution = 3
        for poly in g['polys']:
            sp = cu.splines.new('POLY')
            sp.points.add(len(poly) - 1)
            for pt, (x, z) in zip(sp.points, poly):
                pt.co = (x - cx, z - cz, 0.0, 1.0)
            sp.use_cyclic_u = True
        # explicit texture space = the glyph's own box, so Generated Y runs 0 (base) -> 1 (top);
        # the automatic one for curves is far larger and flattens the gradient to nothing
        cu.use_auto_texspace = False
        cu.texspace_location = (0.0, 0.0, 0.0)
        cu.texspace_size = ((max(xs) - min(xs)) / 2, (max(zs) - min(zs)) / 2, cu.extrude + cu.bevel_depth)
        cu.materials.append(M_ASTERA if g['row'] == 'top' else M_ONLINE)
        ob = link(bpy.data.objects.new('LOGO_' + g['id'], cu), cols['LOGO'])
        ob.parent = root
        ob.location = (cx, 0.0, cz)
        ob.rotation_euler = (math.radians(90), 0, 0)
        prop(ob, 'reveal', 0.0)
        prop(ob, 'glow', 0.0)
        letters[g['id']] = ob

    # keep the silhouette where the trace put it: the bevel grows the outline, so pull
    # it back in by the same amount (sign depends on winding, so measure it once)
    probe = letters['ONLINE_3_I']
    dg = bpy.context.evaluated_depsgraph_get()
    widths = {}
    for sgn in (-1, 1):
        probe.data.offset = sgn * probe.data.bevel_depth
        dg.update()
        widths[sgn] = probe.evaluated_get(dg).dimensions.x
    shrink = min(widths, key=widths.get)
    for ob in letters.values():
        ob.data.offset = shrink * ob.data.bevel_depth

    # ── the orbital ring that becomes the A ─────────────────────────────────
    N = 160
    ts = [i / N for i in range(N + 1)]
    outer = resample(GLYPHS['a_morph']['outer'], ts)
    inner = resample(GLYPHS['a_morph']['inner'], ts)
    A_cols = [(Vector((pi.x, Y_NEAR, pi.y)), Vector((po.x, Y_NEAR, po.y))) for pi, po in zip(inner, outer)]

    q_face = Quaternion()                                  # ring plane == logo plane
    q_obl = (Euler((0.0, math.radians(-17.0), 0.0)).to_quaternion()
             @ Euler((math.radians(67.0), 0.0, 0.0)).to_quaternion())

    def ring_state(frame):
        """Band columns (inner, outer) for one frame of the ring -> A transformation."""
        # spin decelerates to zero exactly when the seam reaches the bottom
        spin = 2 * math.pi * 1.05 * (1 - ease_out((frame - T_RING_IN) / (T_SPIN_LOCK - T_RING_IN)))
        grow = ease_out((frame - T_RING_IN) / (T_FACE_START - T_RING_IN))
        k_face = ease_in_out((frame - T_FACE_START) / (T_SPIN_LOCK - T_FACE_START))
        radius = (1.18 + 0.32 * grow) * (1 - k_face) + 0.62 * k_face
        half_w = 0.034 + 0.01 * k_face
        q = q_obl.slerp(q_face, k_face)
        precess = Euler((math.radians(-4.0 * (1 - k_face) * clamp01((frame - T_RING_IN) / 30)), 0, 0)).to_quaternion()
        q = precess @ q
        ax_a = q @ Vector((1, 0, 0))
        ax_b = q @ Vector((0, 0, 1))
        p = clamp01((frame - T_FOLD_START) / (T_FOLD_END - T_FOLD_START))
        out = []
        for t, (a_in, a_out) in zip(ts, A_cols):
            th = -math.pi / 2 - 2 * math.pi * t + spin
            dirv = ax_a * math.cos(th) + ax_b * math.sin(th)
            r_in = CORE + dirv * (radius - half_w)
            r_out = CORE + dirv * (radius + half_w)
            delay = 0.38 * abs(2 * t - 1)
            s = ease_in_out((p - delay) / (1 - 0.38))
            out.append((r_in.lerp(a_in, s), r_out.lerp(a_out, s)))
        return out

    me = band_mesh('ORBIT_RingToA', A_cols)               # basis = the finished A
    me.materials.append(M_BAND)
    morph = link(bpy.data.objects.new('ORBIT_RingToA', me), cols['ORBIT'])
    sol = morph.modifiers.new('Thickness', 'SOLIDIFY')
    sol.thickness = 0.03
    sol.offset = 0.0
    sol.use_even_offset = True
    morph.shape_key_add(name='Basis', from_mix=False)
    f0, f1 = int(math.floor(T_RING_IN)), int(math.ceil(T_FOLD_END)) + 1
    for F in range(f0, f1 + 1):
        kb = morph.shape_key_add(name=f'F{F:03d}', from_mix=False)
        flat = [c for pair in ring_state(F) for c in pair]
        for vtx, co in zip(kb.data, flat):
            vtx.co = co
        if F == f0:
            keys(kb, 'value', [(1, 1.0), (F, 1.0), (F + 1, 0.0)], interp='LINEAR')
        elif F == f1:
            keys(kb, 'value', [(F - 1, 0.0), (F, 1.0), (F + 1, 0.0)], interp='LINEAR')
        else:
            keys(kb, 'value', [(F - 1, 0.0), (F, 1.0), (F + 1, 0.0)], interp='LINEAR')
    prop(morph, 'depth_c', Y_NEAR)
    prop(morph, 'depth_r', 1.5)
    prop(morph, 'back', 0.35)
    keys(morph, '["draw"]', [(1, 0.0), (T_RING_IN, 0.0), (T_RING_DRAWN, 1.02, 'SINE', 'EASE_IN_OUT')])
    keys(morph, '["energy"]', [(1, 0.0), (T_RING_IN, 1.2), (T_SPIN_LOCK, 1.0), (T_FOLD_END - 2, 1.6), (T_PULSE, 2.6),
                               (T_PULSE + 5, 0.0)])
    keys(morph, '["headamp"]', [(1, 1.0), (T_SPIN_LOCK - 2, 1.0), (T_FOLD_START + 6, 0.0)])
    keys(morph, '["outline"]', [(1, 0.0), (T_FOLD_START + 4, 0.0), (T_FOLD_END, 1.0)])
    keys(morph, '["fade"]', [(1, 1.0), (T_PULSE + 0.5, 1.0), (T_PULSE + 4, 0.0)])
    keys(morph, 'location', [(1, 0.0), (T_PULSE + 1, 0.0), (T_SETTLE, -Y_NEAR)], index=1)
    keys(morph, 'hide_render', [(1, False), (T_PULSE + 5, True)])

    # ── energy core, halo, completion pulse ─────────────────────────────────
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=0.04, location=CORE)
    core = bpy.context.active_object
    core.name = 'ENERGY_Core'
    for c in core.users_collection:
        c.objects.unlink(core)
    cols['ENERGY'].objects.link(core)
    core.data.materials.append(M_CORE)
    core.visible_shadow = False
    keys(core, '["power"]', [(1, 0.0), (T_CORE_IN, 0.0), (T_RING_IN, 0.45), (T_FOLD_START, 0.7), (T_PULSE - 1, 0.9),
                             (T_PULSE, 2.0), (T_PULSE + 6, 0.0)])
    keys(core, 'scale', [(1, 0.3), (T_RING_IN, 1.0), (T_PULSE, 1.25), (T_PULSE + 7, 0.0)], index=0)
    for i in (1, 2):
        keys(core, 'scale', [(1, 0.3), (T_RING_IN, 1.0), (T_PULSE, 1.25), (T_PULSE + 7, 0.0)], index=i)

    halo = billboard('ENERGY_Halo', 1.3, M_HALO, cols['ENERGY'], cam)
    halo.location = CORE
    keys(halo, '["glow"]', [(1, 0.0), (T_CORE_IN, 0.0), (T_RING_IN, 0.14), (T_FOLD_START, 0.2), (T_PULSE, 0.7),
                            (T_PULSE + 8, 0.0)])

    core_light = bpy.data.lights.new('L_Core', 'POINT')
    core_light.color = CORE_COL[:3]
    core_light.shadow_soft_size = 0.05
    lc = link(bpy.data.objects.new('L_Core', core_light), cols['LIGHTS'])
    lc.location = CORE + Vector((0, -0.15, 0))
    keys(core_light, 'energy', [(1, 0.0), (T_RING_IN, 25.0), (T_FOLD_START, 45.0), (T_PULSE, 90.0), (T_PULSE + 8, 0.0)])

    # ── the A arrives, then STERA, then ONLINE ──────────────────────────────
    a1 = letters['ASTERA_0_A']
    keys(a1, '["reveal"]', [(1, 0.0), (T_PULSE - 2, 0.0), (T_PULSE + 3, 1.0)])
    keys(a1, '["glow"]', [(1, 0.0), (T_PULSE - 2, 0.0), (T_PULSE, 0.45), (T_PULSE + 10, 0.0)])
    # born in front of the word, then slides back into its slot
    keys(a1, 'location', [(1, Y_NEAR), (T_PULSE + 1, Y_NEAR), (T_SETTLE, 0.0)], index=1)
    keys(a1, 'hide_render', [(1, True), (T_PULSE - 3, False)])

    # letters light in turn as a reveal front travels from the A to the end of the word
    sx0 = max(ax)
    sx1 = max(p[0] for g in GLYPHS['glyphs'] if g['row'] == 'top' for poly in g['polys'] for p in poly) + 0.3

    def sweep_time(x):
        return T_SWEEP[0] + (x - sx0) / (sx1 - sx0) * (T_SWEEP[1] - T_SWEEP[0])

    order = ['ASTERA_1_S', 'ASTERA_2_T', 'ASTERA_3_E', 'ASTERA_4_R', 'ASTERA_5_A']
    for lid in order:
        ob = letters[lid]
        g = next(g for g in GLYPHS['glyphs'] if g['id'] == lid)
        t0 = sweep_time(min(p[0] for poly in g['polys'] for p in poly)) - 1.0
        keys(ob, '["reveal"]', [(1, 0.0), (t0, 0.0), (t0 + 6, 1.0, 'CUBIC', 'EASE_OUT')])
        keys(ob, '["glow"]', [(1, 0.0), (t0, 0.0), (t0 + 2, 0.3), (t0 + 11, 0.0)])
        keys(ob, 'hide_render', [(1, True), (t0 - 1, False)])
        keys(ob, 'location', [(t0, ob.location.y + 0.45), (t0 + 9, ob.location.y, 'CUBIC', 'EASE_OUT')], index=1)
        for axis in range(3):
            keys(ob, 'scale', [(t0, 0.965), (t0 + 9, 1.0, 'CUBIC', 'EASE_OUT')], index=axis)

    for i in range(6):
        ob = letters[f'ONLINE_{i}_' + 'ONLINE'[i]]
        t0 = T_ONLINE + i * 1.3
        keys(ob, '["reveal"]', [(1, 0.0), (t0, 0.0), (t0 + 9, 1.0, 'SINE', 'EASE_OUT')])
        keys(ob, '["glow"]', [(1, 0.0), (t0, 0.0), (t0 + 3, 0.35), (t0 + 12, 0.0)])
        keys(ob, 'hide_render', [(1, True), (t0 - 1, False)])
        keys(ob, 'location', [(t0, ob.location.z - 0.05), (t0 + 11, ob.location.z, 'CUBIC', 'EASE_OUT')], index=2)

    # ── final orbit: the same band, now circling the whole lockup ───────────
    R_FINAL, TILT = 5.6, math.radians(14.0)            # placed so the front arc never crosses a letter
    fin_me = band_mesh('ORBIT_Final', ring_columns(R_FINAL, 0.036, 360, math.pi, 1.0))
    fin_me.materials.append(M_BAND)
    fin = link(bpy.data.objects.new('ORBIT_Final', fin_me), cols['ORBIT'])
    sol = fin.modifiers.new('Thickness', 'SOLIDIFY')
    sol.thickness = 0.02
    sol.offset = 0.0
    fin.location = (0.0, 2.0, 0.15)
    fin.rotation_mode = 'ZXY'                             # Z first: spin about the ring's own axis
    fin.rotation_euler = (TILT, math.radians(-4.0), 0.0)
    prop(fin, 'depth_c', fin.location.y)
    prop(fin, 'depth_r', R_FINAL * math.cos(TILT))
    prop(fin, 'back', 0.08)
    prop(fin, 'outline', 0.0)
    prop(fin, 'fade', 1.0)
    keys(fin, '["draw"]', [(1, 0.0), (T_ORBIT_IN, 0.0), (T_ORBIT_DRAWN, 1.02, 'SINE', 'EASE_IN_OUT')])
    keys(fin, '["energy"]', [(1, 0.0), (T_ORBIT_IN, 0.0), (T_ORBIT_IN + 7, 0.75), (T_ORBIT_DRAWN, 0.55), (F_END, 0.5)])
    keys(fin, '["headamp"]', [(1, 1.0), (T_ORBIT_DRAWN, 0.9), (F_END, 0.25)])
    # after it closes, the glint keeps travelling, slowing, behind the word
    keys(fin, 'rotation_euler', [(T_ORBIT_DRAWN - 3, 0.0), (F_END, math.radians(-38.0), 'SINE', 'EASE_OUT')], index=2)

    # ── lights ────────────────────────────────────────────────────────────────
    def area(name, size, size_y, energy, loc, target, color=(0.9, 0.95, 1.0)):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.shape = 'RECTANGLE'
        ld.size, ld.size_y = size, size_y
        ld.energy = energy
        ld.color = color
        ob = link(bpy.data.objects.new(name, ld), cols['LIGHTS'])
        ob.location = loc
        con = ob.constraints.new('TRACK_TO')
        con.target = target
        con.track_axis = 'TRACK_NEGATIVE_Z'
        con.up_axis = 'UP_Y'
        return ob

    aim = link(bpy.data.objects.new('LIGHTS_Aim', None), cols['LIGHTS'])
    aim.location = (0, 0, 0.1)
    key_l = area('L_Key', 9.0, 2.5, 1650.0, (0.0, -30.0, 8.0), aim)
    top_l = area('L_Top', 10.0, 1.2, 480.0, (0.0, -3.0, 9.0), aim, (0.86, 0.93, 1.0))
    rim_l = area('L_Rim_Left', 3.0, 3.0, 420.0, (-8.0, 5.0, 4.5), aim, (0.7, 0.84, 1.0))
    rim_r = area('L_Rim_Right', 3.0, 3.0, 420.0, (8.0, 5.0, 4.5), aim, (0.7, 0.84, 1.0))
    sweep = area('L_Sweep', 0.8, 9.0, 0.0, (-16.0, -13.0, 2.0), aim, (0.86, 0.93, 1.0))
    keys(sweep, 'location', [(T_PULSE - 3, -15.0), (fr(2.95), 15.0, 'SINE', 'EASE_IN_OUT')], index=0)
    keys(sweep.data, 'energy', [(1, 0.0), (T_PULSE - 3, 0.0), (T_SWEEP[0] + 4, 550.0), (fr(2.75), 550.0), (fr(2.95), 0.0)])
    for l in (key_l, top_l, rim_l, rim_r):
        e = l.data.energy
        keys(l.data, 'energy', [(1, 0.0), (T_FOLD_START, 0.0), (T_PULSE, e), (T_HOLD, e), (F_END, e * 1.12)])

    # ── a few drifting motes for depth ──────────────────────────────────────
    rng = random.Random(7)
    dust_me = bpy.data.meshes.new('ENV_Dust')
    verts, faces, bright = [], [], []
    ico = [(0, 0, 1), (0.894, 0, 0.447), (0.276, 0.851, 0.447), (-0.724, 0.526, 0.447), (-0.724, -0.526, 0.447),
           (0.276, -0.851, 0.447), (0.724, 0.526, -0.447), (-0.276, 0.851, -0.447), (-0.894, 0, -0.447),
           (-0.276, -0.851, -0.447), (0.724, -0.526, -0.447), (0, 0, -1)]
    ico_f = [(0, 1, 2), (0, 2, 3), (0, 3, 4), (0, 4, 5), (0, 5, 1), (1, 6, 2), (2, 7, 3), (3, 8, 4), (4, 9, 5),
             (5, 10, 1), (6, 7, 2), (7, 8, 3), (8, 9, 4), (9, 10, 5), (10, 6, 1), (11, 7, 6), (11, 8, 7),
             (11, 9, 8), (11, 10, 9), (11, 6, 10)]
    for _ in range(40):
        c = Vector((rng.uniform(-15, 15), rng.uniform(6, 32), rng.uniform(-8, 8)))
        if abs(c.x) < 7 and abs(c.z) < 2.2 and c.y < 4:
            continue                                      # keep motes off the lettering and the ring
        r = rng.uniform(0.006, 0.016) * (1 + max(c.y, 0) / 12)
        bv = rng.uniform(0.15, 1.0) ** 2
        base = len(verts)
        verts += [tuple(c + Vector(v) * r) for v in ico]
        faces += [tuple(base + i for i in f) for f in ico_f]
        bright += [bv] * 12
    dust_me.from_pydata(verts, [], faces)
    attr = dust_me.attributes.new('bright', 'FLOAT', 'POINT')
    attr.data.foreach_set('value', bright)
    dust_me.materials.append(M_DUST)
    dust = link(bpy.data.objects.new('ENV_Dust', dust_me), cols['ENVIRONMENT'])
    dust.visible_shadow = False
    keys(dust, 'location', [(1, (0.0)), (F_END, -0.6, 'LINEAR')], index=0)

    # ── compositor: restrained bloom ─────────────────────────────────────────
    ng = bpy.data.node_groups.new('COMP_Astera', 'CompositorNodeTree')
    ng.interface.new_socket('Image', in_out='OUTPUT', socket_type='NodeSocketColor')
    cb = NodeBuilder(ng)
    rl = cb.n('CompositorNodeRLayers')
    glare = cb.n('CompositorNodeGlare')
    ng.links.new(rl.outputs['Image'], glare.inputs['Image'])
    glare.inputs['Type'].default_value = 'Bloom'
    glare.inputs['Quality'].default_value = 'High'
    glare.inputs['Threshold'].default_value = 0.85
    glare.inputs['Smoothness'].default_value = 0.25
    glare.inputs['Strength'].default_value = 0.32
    glare.inputs['Size'].default_value = 0.72
    go = cb.n('NodeGroupOutput')
    ng.links.new(glare.outputs['Image'], go.inputs[0])
    scn.compositing_node_group = ng
    scn.render.use_compositing = True

    # ── notes for whoever opens the file ─────────────────────────────────────
    txt = bpy.data.texts.new('README_ASTERA')
    txt.write(
        'ASTERA ONLINE logo reveal (built by build_scene.py — rebuild rather than hand-edit).\n\n'
        'Wordmark: outlines traced from the shipped brand art\n'
        f'  {GLYPHS["source"]}\n'
        'by trace_logo.py -> glyphs.json. If a vector master (SVG/AI) exists, regenerate\n'
        'glyphs.json from it and rerun build_scene.py: nothing else needs to change.\n\n'
        'Collections: LOGO (letters, per-object props reveal/glow), ORBIT (ring->A morph is\n'
        'baked as per-frame shape keys; final orbit), ENERGY (core, halo), FX, LIGHTS, CAMERA,\n'
        'ENVIRONMENT (world: stars for camera rays, soft box for reflections only).\n')

    scn.frame_set(1)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT))
    print('SAVED', OUT)


build()
