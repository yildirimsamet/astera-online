"""Original flame authoring. Run through Blender MCP with ASTERA_ROOT set in globals.

Creates a new scene; preserves the user's existing scenes. The .blend contains
animated native volumes. GLBs are lightweight static fallback shells; the game
uses engineFlames.ts for the animated camera-ray volume, not glTF shader nodes.
"""
import bpy
import json
import math
from pathlib import Path
import numpy as np

root = Path(ASTERA_ROOT) if 'ASTERA_ROOT' in globals() else Path(__file__).resolve().parents[1]
source = root / 'assets/source/engine-flames'
output = root / 'apps/web/public/assets/vfx/engine-flames'
output.mkdir(parents=True, exist_ok=True)
recipes = json.loads((source / 'recipes.json').read_text())
scene_name = 'Astera | Engine Flame Studio'
scene = bpy.data.scenes.get(scene_name) or bpy.data.scenes.new(scene_name)
for obj in list(scene.objects):
    bpy.data.objects.remove(obj, do_unlink=True)
bpy.context.window.scene = scene
scene.render.engine = 'BLENDER_EEVEE'
scene.eevee.volumetric_tile_size = '4'
scene.eevee.volumetric_samples = 96
scene.eevee.use_volume_custom_range = True
scene.eevee.volumetric_start = 8
scene.eevee.volumetric_end = 18
scene.render.resolution_x = 1600
scene.render.resolution_y = 1100
scene.render.resolution_percentage = 100
scene.render.fps = 24
scene.frame_end = 144
scene.world = bpy.data.worlds.new('Astera Flame Studio World')
scene.world.use_nodes = True
next(n for n in scene.world.node_tree.nodes if n.type == 'BACKGROUND').inputs['Color'].default_value = (.002, .004, .009, 1)
scene.view_settings.view_transform = 'AgX'

# Periodic multi-band noise, not a copied photograph or a third-party asset.
rng = np.random.default_rng(40211021)
size = 128
frequencies = np.fft.fftfreq(size)
xx, yy = np.meshgrid(frequencies, frequencies)
channels = []
for scale in (0.035, 0.085, 0.18):
    spectrum = np.fft.fft2(rng.normal(size=(size, size)))
    field = np.fft.ifft2(spectrum * np.exp(-(xx * xx + yy * yy) / (scale * scale))).real
    channels.append(np.clip(.5 + field / (field.std() * 5), 0, 1))
noise = np.dstack((*channels, np.ones((size, size)))).astype(np.float32)
image = bpy.data.images.new('Astera | Advected flow noise', width=size, height=size, alpha=True)
image.colorspace_settings.name = 'Non-Color'
image.pixels.foreach_set(noise.ravel())
image.filepath_raw = str(output / 'flow-noise.png')
image.file_format = 'PNG'
image.save()
image.pack()


def material(name, colour, metallic=0):
    result = bpy.data.materials.new(name)
    result.use_nodes = True
    principled = next(n for n in result.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    principled.inputs['Base Color'].default_value = (*colour, 1)
    principled.inputs['Metallic'].default_value = metallic
    principled.inputs['Roughness'].default_value = .3
    return result


metal = material('Studio | graphite titanium', (.065, .08, .1), .85)
rim = material('Studio | brushed nozzle lip', (.25, .29, .32), .85)


def native_volume(name, recipe, peak):
    result = bpy.data.materials.new(name)
    result.use_nodes = True
    tree = result.node_tree
    tree.nodes.clear()

    def node(kind):
        return tree.nodes.new(kind)

    def link(value, socket):
        if isinstance(value, (int, float)):
            socket.default_value = value
        else:
            tree.links.new(value, socket)

    def op(operation, a, b=0):
        n = node('ShaderNodeMath')
        n.operation = operation
        link(a, n.inputs[0])
        link(b, n.inputs[1])
        return n.outputs[0]

    coords = node('ShaderNodeTexCoord')
    separate = node('ShaderNodeSeparateXYZ')
    tree.links.new(coords.outputs['Generated'], separate.inputs[0])
    t = op('SUBTRACT', 1, separate.outputs['Z'])
    x = op('SUBTRACT', op('MULTIPLY', separate.outputs['X'], 2), 1)
    y = op('SUBTRACT', op('MULTIPLY', separate.outputs['Y'], 2), 1)
    radius = op('DIVIDE', op('MULTIPLY', op('ADD', .18, op('MULTIPLY', recipe['expansion'], op('POWER', t, recipe['rise']))),
                op('POWER', op('MAXIMUM', .0001, op('SUBTRACT', 1, t)), recipe['taper'])), peak)
    cylinder_radius = op('SQRT', op('ADD', op('MULTIPLY', x, x), op('MULTIPLY', y, y)))
    radial = op('DIVIDE', cylinder_radius, op('MAXIMUM', radius, .001))
    mapping = node('ShaderNodeMapping')
    tree.links.new(coords.outputs['Generated'], mapping.inputs['Vector'])
    mapping.inputs['Scale'].default_value = (2.5, 2.5, 4)
    driver = mapping.inputs['Location'].driver_add('default_value', 2).driver
    driver.expression = 'frame / 24 * ' + str(recipe['speed'] * 4)
    turbulence = node('ShaderNodeTexNoise')
    tree.links.new(mapping.outputs['Vector'], turbulence.inputs['Vector'])
    turbulence.inputs['Scale'].default_value = 2.2
    turbulence.inputs['Detail'].default_value = 2
    turbulence.inputs['Roughness'].default_value = .65
    broken = op('ADD', radial, op('MULTIPLY', op('SUBTRACT', turbulence.outputs['Fac'], .5), recipe['turbulence'] * 1.2))
    edge = op('MAXIMUM', 0, op('SUBTRACT', 1, broken))
    decay = op('POWER', op('MAXIMUM', 0, op('SUBTRACT', 1, t)), 1.3)
    body = op('MULTIPLY', op('MULTIPLY', op('POWER', edge, 1.1), decay),
              op('MAXIMUM', .04, op('SUBTRACT', op('MULTIPLY', turbulence.outputs['Fac'], 6), 2.2)))
    core = op('MULTIPLY', op('EXPONENT', op('MULTIPLY', op('MULTIPLY', radial, radial), -15)),
              op('EXPONENT', op('MULTIPLY', t, -3.4)))
    cells = op('POWER', op('MAXIMUM', 0, op('COSINE', op('MULTIPLY', op('SUBTRACT', op('MULTIPLY', t, recipe['cells']), .15), math.tau))), 8)
    compression = op('MULTIPLY', op('MULTIPLY', cells, core), recipe['shock'] * 2)
    density = op('ADD', op('MULTIPLY', body, .4 if name.startswith('vacuum') else 2), op('ADD', op('MULTIPLY', core, 3), compression))
    density = op('MULTIPLY', density, op('MAXIMUM', 0, op('SUBTRACT', 1, op('POWER', cylinder_radius, 8))))
    ramp = node('ShaderNodeValToRGB')
    ramp.color_ramp.elements.remove(ramp.color_ramp.elements[1])
    for index, (at, colour) in enumerate([(0, recipe['hot']), (.25, recipe['body']), (1, recipe['tail'])]):
        element = ramp.color_ramp.elements[0] if index == 0 else ramp.color_ramp.elements.new(at)
        element.position = at
        element.color = (*colour, 1)
    tree.links.new(t, ramp.inputs[0])
    hot_mix = node('ShaderNodeMixRGB')
    tree.links.new(op('MINIMUM', 1, op('MULTIPLY', core, 1.8)), hot_mix.inputs[0])
    tree.links.new(ramp.outputs[0], hot_mix.inputs[1])
    hot_mix.inputs[2].default_value = (*recipe['hot'], 1)
    ring = op('SUBTRACT', radial, .78)
    sheath = op('MULTIPLY', op('EXPONENT', op('MULTIPLY', op('MULTIPLY', ring, ring), -144)),
                op('MULTIPLY', op('POWER', op('MAXIMUM', 0, op('SUBTRACT', 1, t)), .6), recipe['sheathGain'] * 1.2))
    sheath = op('MULTIPLY', sheath, op('MAXIMUM', 0, op('SUBTRACT', 1, op('POWER', cylinder_radius, 8))))
    cool_mix = node('ShaderNodeMixRGB')
    tree.links.new(op('DIVIDE', sheath, op('ADD', .0001, op('ADD', density, sheath))), cool_mix.inputs[0])
    tree.links.new(hot_mix.outputs[0], cool_mix.inputs[1])
    cool_mix.inputs[2].default_value = (*recipe['sheath'], 1)
    volume = node('ShaderNodeVolumePrincipled')
    volume.inputs['Density'].default_value = 0
    tree.links.new(cool_mix.outputs[0], volume.inputs['Emission Color'])
    fade = node('ShaderNodeMapRange')
    fade.interpolation_type = 'SMOOTHSTEP'
    tree.links.new(t, fade.inputs['Value'])
    fade.inputs['From Min'].default_value = .5
    fade.inputs['From Max'].default_value = 1
    fade.inputs['To Min'].default_value = 1
    fade.inputs['To Max'].default_value = 0
    tail = op('MULTIPLY', fade.outputs['Result'], fade.outputs['Result'])
    tree.links.new(op('MULTIPLY', op('MULTIPLY', op('ADD', density, sheath), tail), 3), volume.inputs['Emission Strength'])
    out = node('ShaderNodeOutputMaterial')
    tree.links.new(volume.outputs[0], out.inputs['Volume'])
    return result


fallbacks = bpy.data.collections.new('GLB static fallbacks | runtime uses the volume shader')
scene.collection.children.link(fallbacks)
for index, (identity, recipe) in enumerate(recipes.items()):
    y = (1.5 - index) * 2.25
    reach = 3 if identity != 'vacuum' else 2.7
    nozzle_radius = .2
    peak = max((.18 + recipe['expansion'] * (i / 100) ** recipe['rise']) * (1 - i / 100) ** recipe['taper'] for i in range(101))
    max_radius = nozzle_radius * peak / .18
    bpy.ops.mesh.primitive_cube_add(size=2, location=(0, y, -reach / 2))
    plume = bpy.context.object
    plume.name = identity + ' | animated volume'
    plume.scale = (max_radius, max_radius, reach / 2)
    plume.data.materials.append(native_volume(identity, recipe, peak))
    plume['variant'] = identity
    plume['axis'] = '-Z'
    plume['nozzle_radius'] = nozzle_radius
    plume['runtime'] = 'EngineFlameBatch: one instanced draw, 12 proxy triangles per engine'
    # A presentation nozzle; excluded from all exported flame-only files.
    bpy.ops.mesh.primitive_cone_add(vertices=32, radius1=.245, radius2=.13, depth=.65, location=(0, y, .325))
    nozzle = bpy.context.object
    nozzle.name = identity + ' | presentation nozzle'
    nozzle.data.materials.append(metal)
    bevel = nozzle.modifiers.new('Machined edge', 'BEVEL')
    bevel.width = .025
    bevel.segments = 2
    bpy.ops.mesh.primitive_torus_add(major_radius=.23, minor_radius=.026, major_segments=32, minor_segments=8, location=(0, y, 0))
    bpy.context.object.data.materials.append(rim)

    # Portable glTF fallback with a packed RGBA emission texture. This is static;
    # the native .blend and game material contain the animated volume treatment.
    width, height = 64, 128
    uu, tt = np.meshgrid(np.arange(width) / width, np.arange(height) / (height - 1))
    grain = .5 + .3 * np.sin(uu * math.tau * 9 + tt * 35) * np.sin(uu * math.tau * 13 - tt * 21)
    cells = np.maximum(0, np.cos((tt * recipe['cells'] - .15) * math.tau)) ** 8
    hot = np.clip(np.exp(-tt * 7) + cells * recipe['shock'] * np.exp(-tt * 2), 0, 1)
    colour = np.array(recipe['body'])[None, None, :] * (1 - tt[:, :, None]) + np.array(recipe['tail'])[None, None, :] * tt[:, :, None]
    colour = colour * (1 - hot[:, :, None]) + np.array(recipe['hot'])[None, None, :] * hot[:, :, None]
    alpha = (1 - tt) ** .9 * np.clip(grain + .35, 0, 1) * np.minimum(1, tt * 40)
    fade = np.clip((tt - .5) * 2, 0, 1)
    alpha *= (1 - fade * fade * (3 - 2 * fade)) ** 2
    pixels = np.concatenate((colour, alpha[:, :, None]), axis=2).astype(np.float32)
    cool_colour = np.broadcast_to(np.array(recipe['sheath']), colour.shape).copy()
    cool_alpha = alpha * min(.55, recipe['sheathGain'] * .48 + .05)
    cool_pixels = np.concatenate((cool_colour, cool_alpha[:, :, None]), axis=2).astype(np.float32)
    pixels = np.concatenate((pixels, cool_pixels), axis=0)
    baked = bpy.data.images.new(identity + ' | static emissive fallback', width=width, height=height * 2, alpha=True)
    baked.pixels.foreach_set(pixels.ravel())
    baked.pack()
    shell_mat = bpy.data.materials.new(identity + ' | static glTF fallback')
    shell_mat.use_nodes = True
    shell_mat.surface_render_method = 'DITHERED'
    principled = next(n for n in shell_mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    tex = shell_mat.node_tree.nodes.new('ShaderNodeTexImage')
    tex.image = baked
    shell_mat.node_tree.links.new(tex.outputs['Color'], principled.inputs['Base Color'])
    shell_mat.node_tree.links.new(tex.outputs['Color'], principled.inputs['Emission Color'])
    shell_mat.node_tree.links.new(tex.outputs['Alpha'], principled.inputs['Alpha'])
    principled.inputs['Emission Strength'].default_value = 1
    vertices, faces, uv_coords = [], [], []
    sides, rings = 10, 12
    for shell in (1, .64):
        offset = len(vertices)
        for ring in range(rings + 1):
            t = ring / rings
            radius = nozzle_radius * (.18 + recipe['expansion'] * t ** recipe['rise']) * max(.00001, 1 - t) ** recipe['taper'] / .18 * shell
            for side in range(sides + 1):
                angle = side / sides * math.tau
                vertices.append((math.cos(angle) * radius, math.sin(angle) * radius, -t * reach))
                uv_coords.append((side / sides, t * .5 + (.5 if shell == 1 else 0)))
                if ring < rings and side < sides:
                    a = offset + ring * (sides + 1) + side
                    b = a + sides + 1
                    faces.extend(((a, a + 1, b), (a + 1, b + 1, b)))
    mesh = bpy.data.meshes.new(identity + ' fallback mesh')
    mesh.from_pydata(vertices, [], faces)
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    uv = mesh.uv_layers.new(name='Flow UV')
    for loop in mesh.loops:
        uv.data[loop.index].uv = uv_coords[loop.vertex_index]
    mesh.materials.append(shell_mat)
    obj = bpy.data.objects.new(identity + ' | static fallback', mesh)
    fallbacks.objects.link(obj)
    obj['original_asset'] = 'Astera Online, authored 2026-10-21'
    obj['usage'] = 'Static fallback. Animated material: apps/web/src/vfx/engineFlames.ts'
    obj['variant'] = identity
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.export_scene.gltf(filepath=str(output / (identity + '.glb')), export_format='GLB', use_selection=True,
                              export_animations=False, export_extras=True, export_yup=False)
    obj.hide_render = True
    obj.hide_set(True)

# Orthographic look-development camera, exhausts flowing left to right.
bpy.ops.object.camera_add(location=(13, 0, -1.2))
camera = bpy.context.object
camera.name = 'Studio Camera'
from mathutils import Vector
camera.rotation_euler = (Vector((0, 0, -1.2)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 12
scene.camera = camera
bpy.ops.object.light_add(type='AREA', location=(5, 0, 3))
bpy.context.object.data.energy = 1400
bpy.context.object.data.shape = 'DISK'
bpy.context.object.data.size = 8
bpy.context.object.rotation_euler = (Vector((0, 0, 0)) - bpy.context.object.location).to_track_quat('-Z', 'Y').to_euler()
scene.frame_set(32)
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type == 'VIEW_3D':
            area.spaces.active.region_3d.view_perspective = 'CAMERA'
bpy.ops.wm.save_as_mainfile(filepath=str(source / 'astera-engine-flames.blend'))
print(json.dumps({'blend': str(source / 'astera-engine-flames.blend'), 'assets': [p.name for p in output.iterdir()], 'scene': scene.name}))
