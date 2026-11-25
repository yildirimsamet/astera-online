import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ARENA_TUNING as T, closestSurface, createSandboxWorld, obstacleSize, type SurfacePoint } from '@astera/rules/arena';
import { createOre } from '../../src/arena/render/ore.js';

/**
 * Owner 2026-10-20: farm must read at a glance. Loose ore is a crystal in its kind's
 * colour; a mineable rock wears veins that shrink as it is mined and vanish while dry.
 */
const setup = () => {
  const world = createSandboxWorld();
  for (const drop of world.cargoDrops) drop.active = false;
  const scene = new THREE.Scene();
  const ore = createOre(scene, world.layout, world.cargoDrops.length);
  const meshes = scene.children.filter((c): c is THREE.InstancedMesh => c instanceof THREE.InstancedMesh);
  const veined = world.layout.deposits.map((index, slot) => ({ slot, o: world.layout.obstacles[index] }))
    .filter(({ o }) => o?.kind === 'rock');
  return { world, ore, meshes, veined };
};
const scaleOf = (mesh: THREE.InstancedMesh, i: number) => {
  const m = new THREE.Matrix4(); mesh.getMatrixAt(i, m);
  return new THREE.Vector3().setFromMatrixScale(m).x;
};

describe('arena ore', () => {
  it('draws one instanced crystal batch per kind and six veins on every veined rock', () => {
    const { world, ore, meshes, veined } = setup();
    // Alloy, crystal, deuterium and the storm's Asteryum (plan 2026-11-24 §3.2).
    expect(meshes).toHaveLength(4);
    expect(veined.length).toBeGreaterThan(0);
    ore.update(world, 0);
    expect(meshes.reduce((n, m) => n + m.count, 0)).toBe(veined.length * 6);
  });

  it('roots every vein on its rock\'s real surface and grows it outwards (Y2: mesh rock)', () => {
    const { world, ore, meshes, veined } = setup();
    ore.update(world, 0);
    const seen = [0, 0, 0];
    const matrix = new THREE.Matrix4(); const root = new THREE.Vector3(); const turn = new THREE.Quaternion(); const scale = new THREE.Vector3();
    const near: SurfacePoint = { x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, d: 0, inside: false };
    for (const { slot, o } of veined) {
      if (o?.shape !== 'mesh') throw new Error('veined rock is not a mesh rock');
      const kind = world.layout.depositKinds[slot] ?? 0;
      const mesh = meshes[kind]; if (!mesh) throw new Error('no batch');
      const size = obstacleSize(world.layout, o);
      for (let i = 0; i < 6; i++) {
        mesh.getMatrixAt(seen[kind] ?? 0, matrix); seen[kind] = (seen[kind] ?? 0) + 1;
        matrix.decompose(root, turn, scale);
        expect(closestSurface(world.layout, o.id, root, Infinity, near)).toBe(true);
        expect(near.d).toBeLessThanOrEqual(size * 0.2);
        const out = root.clone().sub(new THREE.Vector3(o.p.x, o.p.y, o.p.z)).normalize();
        expect(new THREE.Vector3(0, 1, 0).applyQuaternion(turn).dot(out)).toBeGreaterThan(0);
      }
    }
  });

  it('hides a dry rock\'s veins and shrinks a mined one\'s', () => {
    const { world, ore, meshes, veined } = setup();
    const first = veined[0]; if (!first) throw new Error('no veined rock');
    const kind = world.layout.depositKinds[first.slot] ?? 0;
    const mesh = meshes[kind]; if (!mesh) throw new Error('no batch');
    ore.update(world, 0);
    const full = mesh.count;
    const ownFirst = veined.filter(v => (world.layout.depositKinds[v.slot] ?? 0) === kind).indexOf(first) * 6;
    const fullScale = scaleOf(mesh, ownFirst);
    world.minerals[first.slot] = T.crystalReserve / 2;
    ore.update(world, 0);
    expect(scaleOf(mesh, ownFirst)).toBeLessThan(fullScale);
    world.dry[first.slot] = true;
    ore.update(world, 0);
    expect(mesh.count).toBe(full - 6);
  });

  it('draws live drops in their own kind and skips empty or inactive ones', () => {
    const { world, ore, meshes } = setup();
    ore.update(world, 0);
    const before = meshes.map(m => m.count);
    const [a, b, c] = world.cargoDrops;
    if (!a || !b || !c) throw new Error('no drops');
    Object.assign(a, { active: true, amount: 3, kind: 2 });
    Object.assign(b, { active: true, amount: 0, kind: 1 });
    Object.assign(c, { active: false, amount: 5, kind: 0 });
    ore.update(world, 1);
    expect(meshes.map(m => m.count)).toEqual([before[0], before[1], (before[2] ?? 0) + 1, before[3]]);
  });

  /*
    VFX brief — the storm's Asteryum (owner 2026-11-25: "asset'ini birazcık daha büyüt ve birazcık daha parlak yap,
    ama ok ile falan işaret etmeyelim"). In the world: a violet gem of one or two units floats free in the zone's
    middle, turning like every loose piece. Asset: the same ore crystal, Asteryum's lavender; no marker, no halo.
    Why: the storm says only "the middle"; the stone itself must be big and bright enough to catch the eye there.
  */
  it('draws a piece of Asteryum a little larger and brighter than a lone field piece, however few units it holds', () => {
    const { world, ore, meshes } = setup();
    const [alloy, asterium] = world.cargoDrops;
    if (!alloy || !asterium) throw new Error('no drops');
    Object.assign(alloy, { active: true, amount: 12, kind: 0 });
    Object.assign(asterium, { active: true, amount: 1, kind: 3 });
    ore.update(world, 0);
    const alloyMesh = meshes[0]; const asteriumMesh = meshes[3];
    if (!alloyMesh || !asteriumMesh) throw new Error('no batches');
    const veinsOf = (kind: number): number => world.layout.deposits.filter((index, slot) =>
      world.layout.obstacles[index]?.kind === 'rock' && (world.layout.depositKinds[slot] ?? 0) === kind).length * 6;
    expect(scaleOf(asteriumMesh, veinsOf(3))).toBeGreaterThan(scaleOf(alloyMesh, veinsOf(0)));
    const glow = (mesh: THREE.InstancedMesh): number => mesh.material instanceof THREE.MeshStandardMaterial ? mesh.material.emissiveIntensity : 0;
    for (const time of [0, 0.7, 1.4, 2.1]) {
      ore.update(world, time);
      expect(glow(asteriumMesh)).toBeGreaterThan(glow(alloyMesh));
    }
  });

  it('leaves the scene clean on dispose', () => {
    const { ore, meshes } = setup();
    const scene = meshes[0]?.parent;
    ore.dispose();
    expect(scene?.children.some(c => c instanceof THREE.InstancedMesh)).toBe(false);
  });
});
