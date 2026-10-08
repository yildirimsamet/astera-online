"""Run with Blender: blender -b astera-loading.blend --python test_scene.py."""
import hashlib
import math
import unittest
from pathlib import Path

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector, kdtree


class LoadingSceneTests(unittest.TestCase):
    def setUp(self):
        self.scene = bpy.data.scenes.get("Astera • Orbital Loading")
        self.assertIsNotNone(self.scene, "The dedicated loading scene has not been created")

    def test_delivery_settings_and_existing_scene(self):
        s = self.scene
        self.assertEqual(s.render.engine, "BLENDER_EEVEE")
        self.assertEqual((s.frame_start, s.frame_end, s.render.fps), (1, 240, 30))
        self.assertEqual((s.render.resolution_x, s.render.resolution_y), (1920, 1080))
        self.assertEqual(s.camera.data.type, "PERSP")
        self.assertIn("Sphere", bpy.data.scenes["Scene"].objects)
        self.assertIsNone(bpy.data.scenes["Scene"].camera)
        self.assertNotIn("Sphere", s.objects)
        self.assertLess(sum(len(o.data.vertices) for o in s.objects if o.type == "MESH"), 65000)
        self.assertFalse(any(o.type == "FONT" for o in s.objects))

    def test_original_logo_is_packed_and_undistorted(self):
        logo = self.scene.objects["Identity • Original Astera Lockup"]
        image = bpy.data.images["Astera • Original Lockup (packed)"]
        self.assertIsNotNone(image.packed_file)
        self.assertEqual(tuple(image.size), (768, 433))
        self.assertAlmostEqual(logo.dimensions.x / logo.dimensions.y, 768 / 433, places=5)
        repo = Path(__file__).resolve().parents[4]
        original = repo / "apps/web/public/assets/images/logos/logo-lockup.png"
        self.assertEqual(hashlib.sha256(image.packed_file.data).hexdigest(), hashlib.sha256(original.read_bytes()).hexdigest())
        self.assertFalse(logo.hide_render)
        self.assertIsNone(logo.animation_data)
        self.assertEqual(len(logo.data.uv_layers), 1)
        self.assertEqual(logo.data.materials[0].surface_render_method, "BLENDED", "Static logo alpha must be clean, without temporal dither noise")

    def test_periodic_camera_lights_and_shader_values(self):
        s = self.scene
        rotor = s.objects["Orbit • Continuous Rotor"]
        snapshots = []
        for frame in (1, 241):
            s.frame_set(frame)
            snapshots.append({
                "objects": {o.name: tuple(v for row in o.matrix_world for v in row) for o in s.objects if o != rotor and o.parent != rotor},
                "lights": {o.name: o.data.energy for o in s.objects if o.type == "LIGHT"},
                "values": {f"{m.name}/{n.name}": n.outputs[0].default_value for m in bpy.data.materials if m.use_nodes for n in m.node_tree.nodes if n.type == "VALUE"},
            })
        for section in ("objects", "lights", "values"):
            for name, start in snapshots[0][section].items():
                end = snapshots[1][section][name]
                if isinstance(start, tuple):
                    self.assertLess(max(abs(a-b) for a, b in zip(start, end)), 2e-5, name)
                else:
                    self.assertAlmostEqual(start, end, places=5, msg=name)

    def test_camera_keeps_the_wordmark_upright_and_centered_throughout(self):
        s = self.scene
        for frame in range(1, 242):
            s.frame_set(frame)
            center = world_to_camera_view(s, s.camera, Vector((0, 0, 0)))
            left = world_to_camera_view(s, s.camera, Vector((-3, 0, 0)))
            right = world_to_camera_view(s, s.camera, Vector((3, 0, 0)))
            top = world_to_camera_view(s, s.camera, Vector((0, 1, 0)))
            self.assertLess(abs(center.x-.5), .0001)
            self.assertLess(abs(center.y-.5), .0001)
            self.assertLess(left.x, right.x, f"Wordmark is flipped at frame {frame}")
            self.assertGreater(top.y, center.y, f"Wordmark is inverted at frame {frame}")
            self.assertLess(abs(left.y-right.y), .0002, f"Camera roll at frame {frame}")

    def test_rotating_ring_is_slow_continuous_and_geometrically_seamless(self):
        s = self.scene
        rotor = s.objects["Orbit • Continuous Rotor"]
        ring = s.objects["Orbit • Machined Titanium Assembly"]
        s.frame_set(1)
        start_angle = rotor.rotation_euler.z
        points = [ring.matrix_world @ v.co for v in ring.data.vertices]
        tree = kdtree.KDTree(len(points))
        for i, point in enumerate(points):
            tree.insert(point, i)
        tree.balance()
        s.frame_set(241)
        turn = rotor.rotation_euler.z - start_angle
        self.assertAlmostEqual(turn, math.tau / 32, places=6)
        for vertex in ring.data.vertices:
            _, _, distance = tree.find(ring.matrix_world @ vertex.co)
            self.assertLess(distance, 2e-5)
        steps = []
        for frame in (1, 2, 120, 121, 240, 241):
            s.frame_set(frame)
            steps.append(rotor.rotation_euler.z)
        for a, b in ((0, 1), (2, 3), (4, 5)):
            self.assertAlmostEqual(steps[b] - steps[a], turn / 240, places=6)

    def test_ring_does_not_obscure_lettering(self):
        s = self.scene
        ring = s.objects["Orbit • Machined Titanium Assembly"]
        logo = s.objects["Identity • Original Astera Lockup"]
        # These pixel bounds enclose ASTERA and ONLINE in the original artwork.
        # Test the entire ring, including its rear arc, against the lettering.
        for frame in (1, 31, 61, 91, 121, 151, 181, 211, 240, 241):
            s.frame_set(frame)
            w, h = logo.dimensions.x, logo.dimensions.y
            for corners in (((8, 153), (752, 250)), ((171, 268), (570, 330))):
                bounds = [world_to_camera_view(s, s.camera, logo.matrix_world @ Vector(((x/768-.5)*w, (.5-y/433)*h, 0))) for x, y in corners]
                left, right = sorted(p.x for p in bounds)
                bottom, top = sorted(p.y for p in bounds)
                for vertex in ring.data.vertices:
                    p = world_to_camera_view(s, s.camera, ring.matrix_world @ vertex.co)
                    self.assertFalse(left < p.x < right and bottom < p.y < top, f"Ring crosses lettering at frame {frame}")
                self.assertTrue(0.05 < left < right < 0.95)


if __name__ == "__main__":
    result = unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(LoadingSceneTests))
    if not result.wasSuccessful():
        raise SystemExit(1)
