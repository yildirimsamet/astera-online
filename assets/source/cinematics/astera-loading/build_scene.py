"""Blender-native loading film. Run from the recovered file; see README.md."""
import argparse
import hashlib
import math
import random
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[4]
SOURCE = Path(__file__).resolve().parent
OUTPUT = ROOT / "out/astera-loading"
TAU = math.tau
ENDPOINT = 241


def collection(name, scene):
    result = bpy.data.collections.new(name)
    scene.collection.children.link(result)
    return result


def mesh_object(name, vertices, faces, target, materials=(), indices=()):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    target.objects.link(obj)
    for material in materials:
        mesh.materials.append(material)
    for polygon, index in zip(mesh.polygons, indices):
        polygon.material_index = index
    return obj


def material(name, colour, metallic=0.0, roughness=0.4, emission=0.0):
    result = bpy.data.materials.new(name)
    result.use_nodes = True
    shader = result.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*colour, 1)
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Emission Color"].default_value = (*colour, 1)
    shader.inputs["Emission Strength"].default_value = emission
    return result


def set_linear_action(data):
    data = data if isinstance(data, bpy.types.ID) else data.id_data
    if data.animation_data and data.animation_data.action:
        action = data.animation_data.action
        slot = data.animation_data.action_slot
        for layer in action.layers:
            for strip in layer.strips:
                for curve in strip.channelbag(slot).fcurves:
                    for point in curve.keyframe_points:
                        point.interpolation = "LINEAR"
                    cycle = curve.modifiers.new("CYCLES")
                    cycle.mode_before = cycle.mode_after = "REPEAT"


def periodic(data, path, evaluate):
    # Sample the smooth analytic loop into native keys, including the endpoint.
    # Blender evaluates it deterministically without scripts or drivers.
    for frame in range(1, ENDPOINT + 1):
        phase = TAU * (frame - 1) / 240
        setattr(data, path, evaluate(phase))
        data.keyframe_insert(data_path=path, frame=frame)
    set_linear_action(data)


def look_at(obj, point=(0, 0, 0)):
    forward = (Vector(point) - obj.location).normalized()
    right = forward.cross(Vector((0, 1, 0))).normalized()
    up = right.cross(forward).normalized()
    obj.rotation_euler = Matrix((right, up, -forward)).transposed().to_euler()


def make_logo(target):
    path = ROOT / "apps/web/public/assets/images/logos/logo-lockup.png"
    image = bpy.data.images.load(str(path), check_existing=False)
    image.name = "Astera • Original Lockup (packed)"
    image.pack()
    mat = bpy.data.materials.new("Identity • Restrained Original Artwork")
    mat.use_nodes = True
    mat.surface_render_method = "BLENDED"
    tree = mat.node_tree
    tree.nodes.clear()
    output = tree.nodes.new("ShaderNodeOutputMaterial")
    tex = tree.nodes.new("ShaderNodeTexImage")
    tex.name = "Original artwork • no replacement typography"
    tex.image = image
    tex.interpolation = "Linear"
    tex.extension = "CLIP"
    grade = tree.nodes.new("ShaderNodeHueSaturation")
    grade.name = "Quiet silver-blue material treatment"
    grade.inputs["Saturation"].default_value = 0.36
    grade.inputs["Value"].default_value = 0.92
    tree.links.new(tex.outputs["Color"], grade.inputs["Color"])
    emission = tree.nodes.new("ShaderNodeEmission")
    tree.links.new(grade.outputs["Color"], emission.inputs["Color"])
    shimmer = tree.nodes.new("ShaderNodeValue")
    shimmer.name = "Very subtle returning light"
    periodic(shimmer.outputs[0], "default_value", lambda p: 1.215 + 0.015 * math.cos(p))
    tree.links.new(shimmer.outputs[0], emission.inputs["Strength"])
    transparent = tree.nodes.new("ShaderNodeBsdfTransparent")
    mix = tree.nodes.new("ShaderNodeMixShader")
    alpha_grade = tree.nodes.new("ShaderNodeMath")
    alpha_grade.name = "Restrain supplied glow • preserve original artwork"
    alpha_grade.operation = "POWER"
    alpha_grade.inputs[1].default_value = 1.8
    tree.links.new(tex.outputs["Alpha"], alpha_grade.inputs[0])
    tree.links.new(alpha_grade.outputs[0], mix.inputs[0])
    tree.links.new(transparent.outputs[0], mix.inputs[1])
    tree.links.new(emission.outputs[0], mix.inputs[2])
    tree.links.new(mix.outputs[0], output.inputs["Surface"])
    width = 6.6
    height = width * 433 / 768
    logo = mesh_object("Identity • Original Astera Lockup", [(-width/2, -height/2, 0), (width/2, -height/2, 0), (width/2, height/2, 0), (-width/2, height/2, 0)], [(0, 1, 2, 3)], target, [mat])
    uv = logo.data.uv_layers.new(name="Original artwork UV")
    for loop, point in zip(uv.data, ((0, 0), (1, 0), (1, 1), (0, 1))):
        loop.uv = point
    logo["original_source"] = str(path.relative_to(ROOT))
    logo["original_sha256"] = hashlib.sha256(path.read_bytes()).hexdigest()
    logo["treatment"] = "Original packed artwork, restrained material saturation and alpha contrast; no font or shape substitution"
    return logo


def make_ring(target):
    titanium = material("Orbit • Brushed Titanium", (0.25, 0.285, 0.33), 0.86, 0.29)
    dark = material("Orbit • Recessed Graphite", (0.065, 0.079, 0.095), 0.78, 0.43)
    edge = material("Orbit • Satin Edge", (0.43, 0.46, 0.50), 0.90, 0.24)
    accent = material("Orbit • Inset Navigation Light", (0.13, 0.225, 0.31), 0.35, 0.35, 1.7)
    for mat in (titanium, dark, edge):
        tree = mat.node_tree
        shader = tree.nodes.get("Principled BSDF")
        position = tree.nodes.new("ShaderNodeNewGeometry")
        separate = tree.nodes.new("ShaderNodeSeparateXYZ")
        tree.links.new(position.outputs["Position"], separate.inputs[0])
        grade = tree.nodes.new("ShaderNodeMapRange")
        grade.inputs["From Min"].default_value = -4.5
        grade.inputs["From Max"].default_value = 3.0
        grade.inputs["To Min"].default_value = .43
        grade.inputs["To Max"].default_value = 1.0
        tree.links.new(separate.outputs["Z"], grade.inputs["Value"])
        tint = tree.nodes.new("ShaderNodeMixRGB")
        tint.blend_type = "MULTIPLY"
        tint.inputs[0].default_value = 1
        tint.inputs[1].default_value = shader.inputs["Base Color"].default_value
        tree.links.new(grade.outputs[0], tint.inputs[2])
        tree.links.new(tint.outputs[0], shader.inputs["Base Color"])
    tilt = bpy.data.objects.new("Orbit • Inclined Orbital Plane", None)
    target.objects.link(tilt)
    tilt.location = (0, 0.05, -0.8)
    tilt.rotation_euler = (math.radians(51), math.radians(-8), math.radians(-14))
    rotor = bpy.data.objects.new("Orbit • Continuous Rotor", None)
    target.objects.link(rotor)
    rotor.parent = tilt
    rotor.rotation_euler.z = 0
    rotor.keyframe_insert(data_path="rotation_euler", index=2, frame=1)
    rotor.rotation_euler.z = TAU / 32
    rotor.keyframe_insert(data_path="rotation_euler", index=2, frame=ENDPOINT)
    set_linear_action(rotor)
    action = rotor.animation_data.action
    for layer in action.layers:
        for strip in layer.strips:
            for curve in strip.channelbag(rotor.animation_data.action_slot).fcurves:
                for modifier in curve.modifiers:
                    modifier.mode_before = modifier.mode_after = "REPEAT_OFFSET"
    rotor["loop_symmetry"] = 32
    rotor["full_revolution_seconds"] = 256
    vertices, faces, indices = [], [], []

    def profile_ring(radius, profile, index, start=0.0, extent=TAU, samples=512, closed=True):
        base = len(vertices)
        count = samples if closed else samples + 1
        for i in range(count):
            theta = start + extent * i / samples
            for dr, z in profile:
                vertices.append(((radius+dr)*math.cos(theta), (radius+dr)*math.sin(theta), z))
        n = len(profile)
        for i in range(samples):
            next_i = (i+1) % count
            for j in range(n):
                faces.append((base+i*n+j, base+next_i*n+j, base+next_i*n+(j+1)%n, base+i*n+(j+1)%n))
                indices.append(index)
        if not closed:
            faces.extend((tuple(base+j for j in reversed(range(n))), tuple(base+(count-1)*n+j for j in range(n))))
            indices.extend((index, index))

    # Chamfered radial beams, not a luminous curve or a decorative torus.
    profile = [(-0.054, -0.040), (0.054, -0.040), (0.067, -0.027), (0.067, 0.027), (0.054, 0.040), (-0.054, 0.040), (-0.067, 0.027), (-0.067, -0.027)]
    profile_ring(4.73, profile, 0)
    profile_ring(4.57, [(dr*.46, z*.75) for dr, z in profile], 2)
    for segment in range(32):
        angle = segment * TAU/32
        profile_ring(4.65, [(-.066, -.025), (.066, -.025), (.066, .025), (-.066, .025)], 1, angle-.008, .016, 1, False)
        profile_ring(4.729, [(-.018, .041), (.018, .041), (.018, .047), (-.018, .047)], 3, angle+.045, .026, 4, False)
        profile_ring(4.73, [(-.058, .041), (.058, .041), (.058, .051), (-.058, .051)], 2, angle-.012, .024, 3, False)
    ring = mesh_object("Orbit • Machined Titanium Assembly", vertices, faces, target, (titanium, dark, edge, accent), indices)
    ring.parent = rotor
    for polygon in ring.data.polygons:
        polygon.use_smooth = len(polygon.vertices) == 4
    ring["geometry"] = "32 identical sectors; two chamfered metal rails, inset couplings and tiny navigation accents"
    return ring


def make_space(target):
    sky = bpy.data.materials.new("Space • Faint Interstellar Dust")
    sky.use_nodes = True
    tree = sky.node_tree
    tree.nodes.clear()
    uv = tree.nodes.new("ShaderNodeTexCoord")
    noise = tree.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 4.0
    noise.inputs["Detail"].default_value = 5.5
    noise.inputs["Roughness"].default_value = 0.70
    tree.links.new(uv.outputs["UV"], noise.inputs["Vector"])
    ramp = tree.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.30
    ramp.color_ramp.elements[0].color = (0.0003, 0.0005, 0.0011, 1)
    ramp.color_ramp.elements[1].position = 0.83
    ramp.color_ramp.elements[1].color = (0.009, 0.012, 0.019, 1)
    tree.links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    emission = tree.nodes.new("ShaderNodeEmission")
    tree.links.new(ramp.outputs["Color"], emission.inputs["Color"])
    emission.inputs["Strength"].default_value = 0.6
    output = tree.nodes.new("ShaderNodeOutputMaterial")
    tree.links.new(emission.outputs[0], output.inputs["Surface"])
    dust = mesh_object("Space • Distant Dust Sheet", [(-30, -18, -20), (30, -18, -20), (30, 18, -20), (-30, 18, -20)], [(0, 1, 2, 3)], target, [sky])
    coords = dust.data.uv_layers.new()
    for loop, coord in zip(coords.data, ((0, 0), (1, 0), (1, 1), (0, 1))):
        loop.uv = coord
    periodic(dust, "location", lambda p: (0.025*math.cos(p), 0.010*math.sin(p), 0))
    stars = [material("Space • Distant Starlight", (.35, .40, .49), emission=0.9), material("Space • Near Starlight", (.52, .59, .68), emission=1.6), material("Space • Warm Distant Suns", (.42, .38, .31), emission=1.1)]
    rng = random.Random(73041)
    vertices, faces, indices = [], [], []
    for i in range(220):
        x, y, z = rng.uniform(-15.0, 15.0), rng.uniform(-8.5, 8.5), rng.uniform(-16, -7)
        radius = rng.uniform(.007, .017) if i % 17 else rng.uniform(.018, .028)
        base = len(vertices)
        vertices.extend((x+radius*math.cos(j*TAU/6), y+radius*math.sin(j*TAU/6), z) for j in range(6))
        faces.append(tuple(base+j for j in range(6)))
        indices.append(1 if i % 17 == 0 else (2 if i % 11 == 0 else 0))
    field = mesh_object("Space • Sparse Distant Stars", vertices, faces, target, stars, indices)
    periodic(field, "rotation_euler", lambda p: (0.0006*math.sin(p), 0.0005*math.cos(p), 0.001*math.sin(p)))


def make_camera_lights(target, scene):
    camera_data = bpy.data.cameras.new("Camera • Loading Portrait 55mm")
    camera = bpy.data.objects.new("Camera • Stable Cinematic Perspective", camera_data)
    target.objects.link(camera)
    camera.data.lens = 55
    camera.data.clip_start, camera.data.clip_end = .1, 200
    scene.camera = camera
    for frame in range(1, ENDPOINT+1):
        phase = TAU*(frame-1)/240
        camera.location = (.006*math.sin(phase), .004*math.sin(phase), 25.0 + .035*math.cos(phase))
        look_at(camera)
        camera.keyframe_insert(data_path="location", frame=frame)
        camera.keyframe_insert(data_path="rotation_euler", frame=frame)
    set_linear_action(camera)
    for name, loc, colour, power, size in [
        ("Light • Cold Front Softbox", (-3, -4, 8), (.76, .84, 1.0), 1550, 5),
        ("Light • Quiet Graphite Fill", (5, 0, 7), (.48, .58, .75), 420, 6),
        ("Light • Warm Edge Reflection", (6, -3, 4), (1.0, .78, .55), 640, 3.5),
        ("Light • Faint Rear Separation", (-2, 6, 1), (.60, .71, .86), 180, 4),
    ]:
        data = bpy.data.lights.new(name, "AREA")
        data.color, data.energy, data.shape, data.size = colour, power, "DISK", size
        light = bpy.data.objects.new(name, data)
        target.objects.link(light)
        light.location = loc
        look_at(light)
        if "Warm Edge" in name:
            for frame in range(1, ENDPOINT+1):
                phase = TAU*(frame-1)/240
                light.location = (loc[0]+.65*math.sin(phase), loc[1]+.4*math.cos(phase), loc[2])
                look_at(light)
                light.keyframe_insert(data_path="location", frame=frame)
                light.keyframe_insert(data_path="rotation_euler", frame=frame)
            set_linear_action(light)
            periodic(data, "energy", lambda p: power*(1+.065*math.sin(p)))


def organize_nodes(scene):
    positions = {
        "TEX_COORD": (-1050, 160), "TEX_IMAGE": (-800, 240),
        "TEX_NOISE": (-800, 160), "NEW_GEOMETRY": (-900, 160),
        "SEPARATE_XYZ": (-650, 160), "MAP_RANGE": (-450, 160),
        "VALTORGB": (-550, 160), "HUE_SAT": (-440, 240),
        "MIX_RGB": (-200, 240), "VALUE": (-400, -100),
        "MATH": (-380, -350), "BSDF_TRANSPARENT": (-150, -50),
        "EMISSION": (-150, 260), "BSDF_PRINCIPLED": (120, 240),
        "MIX_SHADER": (120, 240), "OUTPUT_MATERIAL": (450, 240),
    }
    materials = {m for o in scene.objects if o.type == "MESH" for m in o.data.materials}
    for mat in materials:
        for node in mat.node_tree.nodes:
            node.location = positions.get(node.type, (0, 0))
            node.width = 260 if node.type in ("TEX_IMAGE", "VALTORGB") else 180


def build():
    scene = bpy.data.scenes.new("Astera • Orbital Loading")
    bpy.context.window.scene = scene
    make_logo(collection("01 • Astera Identity", scene))
    make_ring(collection("02 • Orbital Structure", scene))
    make_space(collection("03 • Deep Space", scene))
    make_camera_lights(collection("04 • Camera and Cinematic Lights", scene), scene)
    scene.render.engine = "BLENDER_EEVEE"
    scene.eevee.taa_render_samples = 64
    scene.eevee.use_raytracing = False
    scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = 1920, 1080, 100
    scene.render.fps = 30
    scene.frame_start, scene.frame_end = 1, 240
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.film_transparent = False
    scene.render.use_file_extension = True
    scene.render.filepath = str(OUTPUT / "frames/loading-")
    world = bpy.data.worlds.new("Space • Near-black Void")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (.003, .005, .010, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = .12
    scene.world = world
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = 0
    scene["delivery"] = "8 second loop • 240 frames • 30 fps • Eevee • original packed Astera logo"
    scene["loop_contract"] = "Frame 241 matches frame 1; exclude 241 from exports. Rotor is geometrically equivalent after one of 32 sectors."
    scene["original_scene"] = "Scene is preserved from /tmp/quit.blend; it is not used in the loading render."
    organize_nodes(scene)
    for label, frame in (("LOOP START", 1), ("Quiet light passage", 61), ("Half-cycle", 121), ("Closing approach", 211), ("LOOP BOUNDARY • do not export", 241)):
        scene.timeline_markers.new(label, frame=frame)
    text = bpy.data.texts.new("READ ME • Astera Loading Film")
    text.write((SOURCE / "production-notes.md").read_text())
    scene.frame_set(1)
    # Open into a camera composition with a useful material viewport.
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == "VIEW_3D":
                area.spaces.active.region_3d.view_perspective = "CAMERA"
                area.spaces.active.shading.type = "MATERIAL"
                area.spaces.active.shading.use_scene_world = True
                area.spaces.active.shading.use_scene_lights = True
                area.spaces.active.overlay.show_overlays = False
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / "astera-loading.blend"))
    return scene


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--preview", action="store_true")
    parser.add_argument("--render", action="store_true")
    args = parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    OUTPUT.mkdir(parents=True, exist_ok=True)
    scene = build()
    if args.preview:
        scene.render.resolution_percentage = 67
        scene.eevee.taa_render_samples = 32
        for frame in (1, 61, 121, 181, 240, 241):
            scene.frame_set(frame)
            scene.render.filepath = str(OUTPUT / f"preview-v3-{frame:03}.png")
            bpy.ops.render.render(write_still=True)
    if args.render:
        (OUTPUT / "frames").mkdir(exist_ok=True)
        bpy.ops.render.render(animation=True)


if __name__ == "__main__":
    main()
