import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ARENA_LAYOUT, ARENA_TUNING as T, CLASS_HULLS, classTuning, createMesh, hullCapsule, type ArenaLayout, type ArenaObstacle, type Capsule } from '@astera/rules/arena';
import { createColliderView } from '../../src/arena/render/colliders.js';
import { scrapePoint } from '../../src/arena/surface.js';

/** Plan §8.4: a developer switch that draws what the simulation hits, over what is drawn. */
const isMesh = (object: THREE.Object3D): object is THREE.Mesh => object instanceof THREE.Mesh;
const wires = (scene: THREE.Scene): THREE.Mesh[] => {
  const out: THREE.Mesh[] = [];
  scene.traverse(object => { if (isMesh(object) && object.name.startsWith('collider-')) out.push(object); });
  return out;
};

describe('collider wireframe view', () => {
  it('is off until switched on, and then draws every obstacle once in wireframe', () => {
    const scene = new THREE.Scene();
    const view = createColliderView(scene, ARENA_LAYOUT);
    const root = scene.getObjectByName('colliders');
    expect(root?.visible).toBe(false);
    view.visible = true;
    expect(root?.visible).toBe(true);
    let drawn = 0;
    for (const mesh of wires(scene)) {
      if (mesh.name === 'collider-hull') continue;
      expect(mesh.material instanceof THREE.MeshBasicMaterial && mesh.material.wireframe).toBe(true);
      drawn += mesh instanceof THREE.InstancedMesh ? mesh.count : 1;
    }
    expect(drawn).toBe(ARENA_LAYOUT.obstacles.length);
  });

  it('draws each rock at its collider\'s exact position, turn and scale', () => {
    const view = createColliderView(new THREE.Scene(), ARENA_LAYOUT);
    const matrix = new THREE.Matrix4(); const p = new THREE.Vector3(); const q = new THREE.Quaternion(); const s = new THREE.Vector3();
    const ids = view.rocks.flatMap(rock => rock.ids);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(ARENA_LAYOUT.obstacles.filter(o => o.shape === 'mesh').length);
    for (const rock of view.rocks) {
      expect(rock.mesh.count).toBe(rock.ids.length);
      rock.ids.forEach((id, i) => {
        const o = ARENA_LAYOUT.obstacles[id];
        if (o?.shape !== 'mesh') throw new Error('not a mesh rock');
        rock.mesh.getMatrixAt(i, matrix); matrix.decompose(p, q, s);
        expect(p.distanceTo(new THREE.Vector3(o.p.x, o.p.y, o.p.z))).toBeLessThan(1e-3);
        expect(Math.abs(q.dot(new THREE.Quaternion(o.q.x, o.q.y, o.q.z, o.q.w)))).toBeCloseTo(1, 6);
        // Instance matrices are float32: compare the scale relative to itself.
        expect(s.x / o.scale).toBeCloseTo(1, 6);
      });
    }
  });

  it('puts every ship\'s own class hull where the simulation has it, and hides the unused', () => {
    const scene = new THREE.Scene();
    const view = createColliderView(scene, ARENA_LAYOUT);
    view.visible = true;
    const ship = new THREE.Object3D();
    ship.position.set(120, -40, 300);
    ship.quaternion.setFromEuler(new THREE.Euler(0.4, 1.1, -0.3));
    view.ships([{ pose: ship, ship: 'kilavuz' }, { pose: ship, ship: 'akinci' }]);
    // The slot's ship changes class: its capsules become the new class's.
    view.ships([{ pose: ship, ship: 'muhafiz' }]);
    scene.updateMatrixWorld(true);
    expect(view.hulls.map(hull => hull.group.visible)).toEqual([true, false]);
    const first = view.hulls[0]; if (!first) throw new Error('no hull');
    expect(first.capsules).toHaveLength(CLASS_HULLS.muhafiz.length);
    const capsule: Capsule = { ax: 0, ay: 0, az: 0, bx: 0, by: 0, bz: 0, r: 0 };
    const q = { x: ship.quaternion.x, y: ship.quaternion.y, z: ship.quaternion.z, w: ship.quaternion.w };
    first.capsules.forEach(({ mesh, half, radius }, k) => {
      hullCapsule(q, k, classTuning('muhafiz'), capsule);
      const a = new THREE.Vector3(0, -half, 0).applyMatrix4(mesh.matrixWorld);
      const b = new THREE.Vector3(0, half, 0).applyMatrix4(mesh.matrixWorld);
      expect(a.distanceTo(ship.position.clone().add(new THREE.Vector3(capsule.ax, capsule.ay, capsule.az)))).toBeLessThan(1e-6);
      expect(b.distanceTo(ship.position.clone().add(new THREE.Vector3(capsule.bx, capsule.by, capsule.bz)))).toBeLessThan(1e-6);
      expect(radius).toBe(capsule.r);
    });
  });

  it('leaves the scene clean on dispose', () => {
    const scene = new THREE.Scene();
    createColliderView(scene, ARENA_LAYOUT).dispose();
    expect(scene.getObjectByName('colliders')).toBeUndefined();
  });
});

/** A 2 m cube centred on the origin, wound outwards. */
const cube = createMesh([-1, -1, -1, 1, -1, -1, -1, 1, -1, 1, 1, -1, -1, -1, 1, 1, -1, 1, -1, 1, 1, 1, 1, 1],
  [1, 3, 7, 1, 7, 5, 0, 4, 6, 0, 6, 2, 2, 6, 7, 2, 7, 3, 0, 1, 5, 0, 5, 4, 4, 5, 7, 4, 7, 6, 0, 2, 3, 0, 3, 1]);
const layout = (x: number): ArenaLayout => {
  const rock: ArenaObstacle = { id: 0, kind: 'rock', shape: 'mesh', mesh: 0, p: { x, y: 0, z: 0 }, q: { x: 0, y: 0, z: 0, w: 1 },
    scale: 40, radius: cube.radius * 40 };
  return { version: 0, radius: 3000, halfHeight: 3000, entries: [], exits: [], structures: [], fields: [], dust: [], farmSpots: [],
    obstacles: [rock], meshes: [cube], deposits: [], depositKinds: [] };
};

/** Y2: a scrape sparks on the rock face, not in the air a ball's radius from the hull. */
describe('scrape point', () => {
  it('is the nearest point of the real surface beside the hull', () => {
    const out = { x: 0, y: 0, z: 0 };
    expect(scrapePoint(layout(42.2), { x: 0, y: 0, z: 0 }, T, out)).toBe(true);
    expect(out.x).toBeCloseTo(2.2, 9); expect(out.y).toBeCloseTo(0, 9); expect(out.z).toBeCloseTo(0, 9);
  });

  it('finds nothing when no surface is within the hull\'s reach', () => {
    expect(scrapePoint(layout(80), { x: 0, y: 0, z: 0 }, T, { x: 0, y: 0, z: 0 })).toBe(false);
  });

  it('reaches as far as the ship\'s own class hull: the Kılavuz\'s wings, not the Akıncı\'s body', () => {
    // A face 10 m to the side: inside the Kılavuz's 9.9 m wing reach plus 1, past the Akıncı's 8 m.
    const out = { x: 0, y: 0, z: 0 };
    expect(scrapePoint(layout(50), { x: 0, y: 0, z: 0 }, classTuning('kilavuz'), out)).toBe(true);
    expect(out.x).toBeCloseTo(10, 9);
    expect(scrapePoint(layout(50), { x: 0, y: 0, z: 0 }, classTuning('akinci'), out)).toBe(false);
  });
});
