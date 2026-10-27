import * as THREE from 'three';
import { mulberry32 } from '@astera/rules';
import { ARENA_TUNING as T, closestSurface, obstacleSize, type ArenaLayout, type ArenaWorld, type SurfacePoint } from '@astera/rules/arena';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { FARM_HEX } from '../farmColors.js';

/**
 * FARM YOU CAN SEE (owner 2026-10-20: premium, readable at a glance). Every loose piece
 * of ore and every vein on a mineable rock is a lit crystal in its kind's colour: amber
 * alloy, blue crystal, green deuterium. A solid, blooming shape reads against a bright
 * nebula where an additive dot vanished. Veins shrink as a deposit is mined and are
 * gone while it rests dry. One instanced draw per kind.
 */
const VEINS_PER_ROCK = 6;
const up = new THREE.Vector3(0, 1, 0);

interface Vein { slot: number; position: THREE.Vector3; quaternion: THREE.Quaternion; scale: number }

/** One faceted crystal: a hexagonal prism with a pointed tip, base at the origin, up +Y. */
function prism(radius: number, length: number): THREE.BufferGeometry {
  const body = new THREE.CylinderGeometry(radius, radius * 0.82, length, 6, 1, true).translate(0, length / 2, 0);
  const tip = new THREE.ConeGeometry(radius, radius * 1.9, 6, 1, true).translate(0, length + radius * 0.95, 0);
  return mergeVertices(body, tip);
}

function mergeVertices(...parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const flat = parts.map(part => part.index ? part.toNonIndexed() : part);
  // Cylinders and cones share position, normal and uv, so the merge always succeeds.
  const merged = mergeGeometries(flat, false);
  for (const part of new Set([...parts, ...flat])) part.dispose();
  merged.computeVertexNormals();
  return merged;
}

/**
 * A cluster of four crystals fanned out from one root, bounding radius about 1. Flat
 * facets catch the light; the emissive core blooms. ~100 triangles.
 */
function crystalCluster(): THREE.BufferGeometry {
  const pieces = ([[0, 0, 1.25, 0.22], [0.55, 0.9, 0.85, 0.17], [-0.6, 2.4, 0.75, 0.16], [0.45, 4.1, 0.6, 0.13]] as const)
    .map(([lean, around, length, radius]) => prism(radius, length)
      .rotateZ(lean).rotateY(around));
  return mergeVertices(...pieces).translate(0, -0.45, 0);
}

export function createOre(scene: THREE.Scene, layout: ArenaLayout, drops: number) {
  const geometry = crystalCluster();
  // Veined rock only: the crystal formations are crystals already.
  const veins: Vein[][] = FARM_HEX.map(() => []);
  const surface: SurfacePoint = { x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, d: 0, inside: false };
  layout.deposits.forEach((index, slot) => {
    const o = layout.obstacles[index];
    if (o?.kind !== 'rock') return;
    const kind = layout.depositKinds[slot] ?? 0;
    const size = obstacleSize(layout, o);
    const random = mulberry32(7919 + o.id * 31);
    // Two or three clusters, so a rock looks seamed rather than sprinkled.
    const seams = Array.from({ length: 2 + Math.floor(random() * 2) }, () =>
      new THREE.Vector3(random() * 2 - 1, random() * 1.6 - 0.3, random() * 2 - 1).normalize());
    for (let i = 0; i < VEINS_PER_ROCK; i++) {
      const seam = seams[i % seams.length] ?? up;
      const d = seam.clone().add(new THREE.Vector3(random() - 0.5, random() - 0.5, random() - 0.5).multiplyScalar(0.55)).normalize();
      const twist = new THREE.Quaternion().setFromAxisAngle(up, random() * Math.PI * 2);
      const scale = size * (0.32 + random() * 0.18);
      // Rooted on the real surface the pilot sees (Y2), sunk a little, grown along its normal.
      const outside = { x: o.p.x + d.x * o.radius * 1.1, y: o.p.y + d.y * o.radius * 1.1, z: o.p.z + d.z * o.radius * 1.1 };
      if (!closestSurface(layout, o.id, outside, Infinity, surface)) continue;
      const normal = new THREE.Vector3(surface.nx, surface.ny, surface.nz);
      veins[kind]?.push({ slot, position: new THREE.Vector3(surface.x, surface.y, surface.z).addScaledVector(normal, -size * 0.18),
        quaternion: new THREE.Quaternion().setFromUnitVectors(up, normal).multiply(twist), scale });
    }
  });

  const meshes = FARM_HEX.map((hex, kind) => {
    const color = new THREE.Color(hex);
    // Deep and saturated: a pale bright colour is what AgX bleaches to paper.
    const deep = color.clone().offsetHSL(0, 0.25, -0.18);
    // A gem, not a sticker: a metal tints its reflections, so the nebula's white sheen
    // comes back in the kind's colour; light gathers at the grazing edges.
    const material = new THREE.MeshStandardMaterial({ color: deep, emissive: deep, emissiveIntensity: 1,
      roughness: 0.16, metalness: 0.85, flatShading: true, envMapIntensity: 1.3 });
    material.onBeforeCompile = shader => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float oreRim = 1.0 - abs(dot(normal, normalize(vViewPosition)));
        totalEmissiveRadiance *= 0.3 + 3.2 * oreRim * oreRim;`);
    };
    const mesh = new THREE.InstancedMesh(geometry, material, drops + (veins[kind]?.length ?? 0));
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // Instances span the whole arena; the base geometry's bounds say nothing about them.
    mesh.frustumCulled = false; mesh.count = 0;
    scene.add(mesh);
    return mesh;
  });

  const pose = new THREE.Object3D();
  const spin = new THREE.Quaternion(); const tilt = new THREE.Quaternion(); const axis = new THREE.Vector3();
  const counts = [0, 0, 0];

  return {
    update(world: ArenaWorld, time: number): void {
      counts.fill(0);
      veins.forEach((list, kind) => {
        const mesh = meshes[kind]; if (!mesh) return;
        for (const vein of list) {
          if (world.dry[vein.slot]) continue;
          // Mined veins shrink: how much is left reads on the rock itself.
          const reserve = Math.max(0, Math.min(1, (world.minerals[vein.slot] ?? T.crystalReserve) / T.crystalReserve));
          pose.position.copy(vein.position); pose.quaternion.copy(vein.quaternion);
          pose.scale.setScalar(vein.scale * (0.35 + 0.65 * reserve)); pose.updateMatrix();
          mesh.setMatrixAt(counts[kind] ?? 0, pose.matrix); counts[kind] = (counts[kind] ?? 0) + 1;
        }
      });
      world.cargoDrops.forEach((drop, i) => {
        if (!drop.active || drop.amount <= 0) return;
        const mesh = meshes[drop.kind]; if (!mesh) return;
        // A bigger piece is a bigger crystal; each turns slowly and bobs on its own phase.
        const size = 2.4 + Math.min(drop.amount, T.dropChunk) * 0.5;
        axis.set(Math.sin(i * 2.1), 1.6, Math.cos(i * 1.3)).normalize();
        tilt.setFromAxisAngle(axis.set(Math.cos(i), 0, Math.sin(i)), 0.5 + (i % 5) * 0.12);
        spin.setFromAxisAngle(up, time * 0.7 + i * 1.7);
        pose.quaternion.copy(tilt).multiply(spin);
        pose.position.set(drop.p.x, drop.p.y + Math.sin(time * 1.6 + i * 1.7) * 1.2, drop.p.z);
        pose.scale.setScalar(size); pose.updateMatrix();
        mesh.setMatrixAt(counts[drop.kind] ?? 0, pose.matrix); counts[drop.kind] = (counts[drop.kind] ?? 0) + 1;
      });
      meshes.forEach((mesh, kind) => {
        mesh.count = counts[kind] ?? 0;
        mesh.instanceMatrix.needsUpdate = true;
        const material = mesh.material;
        if (material instanceof THREE.MeshStandardMaterial) material.emissiveIntensity = 0.9 + 0.2 * Math.sin(time * 2.2 + kind * 2);
      });
    },
    dispose(): void {
      for (const mesh of meshes) { scene.remove(mesh); if (mesh.material instanceof THREE.Material) mesh.material.dispose(); mesh.dispose(); }
      geometry.dispose();
    },
  };
}
