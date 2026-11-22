import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { effectiveCracks } from '@astera/rules';
import type { GalaxyMoons } from '../api/schemas.js';
import { serverNow } from '../lib/clock.js';
import {
  moonFlashProgress,
  moonOrbitPosition,
  moonRadiusFor,
  moonRarityRingColor,
  moonSurfaceColor,
} from './moonOrbit.js';

/*
  VFX BRIEF 1 — Moon Rarity Telemetry Ring (S53 / V17)
  - Physical event: Orbital telemetry ring locking onto a discovered moon's gravitational resonance; undiscovered moons render ringless (V17).
  - Asset / pattern: Crisp geometric `RingGeometry` hairline (`MeshBasicMaterial`, zero soft circular glow).
  - Why it tells the event: Gives single-glance rarity recognition (grey/blue/purple/gold) in 1 instanced draw call.

  VFX BRIEF 2 — Moon Gate Aperture Flash (F4b / S16 / S32)
  - Physical event: Spatial jump aperture snaps shut over a moon after a 10s gate transit (public on arrival, sensor-gated on departure).
  - Asset / pattern: Sharp 6-sided segmented geometric warp-ring (`RingGeometry(1.55, 1.82, 6)`), matching `JumpStreaks` / `astral-gate` language, zero soft radial glow.
  - Why it tells the event: Instantly marks active gate activity across the galaxy disc without obscuring the moon.
*/

const MAX_INSTANCES = 4_096;
const _parent = { x: 0, y: 0, z: 0 };
const _pos = { x: 0, y: 0, z: 0 };
const _dummy = new THREE.Object3D();
const _color = new THREE.Color();
const _ringTilt = new THREE.Euler(Math.PI / 2, 0, 0);

interface MoonHostNode {
  readonly id: string;
  readonly position: readonly [number, number, number];
  readonly radius: number;
}

export function Moons({
  moons,
  nodes,
}: {
  readonly moons?: GalaxyMoons | undefined;
  readonly nodes: readonly MoonHostNode[];
}) {
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const ringRef = useRef<THREE.InstancedMesh>(null);
  const flashRef = useRef<THREE.InstancedMesh>(null);

  const nodeById = useMemo(() => {
    const map = new Map<string, MoonHostNode>();
    for (const node of nodes) map.set(node.id, node);
    return map;
  }, [nodes]);

  const geometries = useMemo(() => ({
    sphere: new THREE.SphereGeometry(1, 16, 12),
    ring: new THREE.RingGeometry(1.32, 1.44, 32),
    flash: new THREE.RingGeometry(1.58, 1.85, 6),
  }), []);

  const materials = useMemo(() => ({
    sphere: new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0.08 }),
    ring: new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true, opacity: 0.85, depthWrite: false }),
    flash: new THREE.MeshBasicMaterial({ color: 0x7dd3fc, side: THREE.DoubleSide, transparent: true, opacity: 0.9, depthWrite: false }),
  }), []);

  useEffect(() => () => {
    geometries.sphere.dispose();
    geometries.ring.dispose();
    geometries.flash.dispose();
    materials.sphere.dispose();
    materials.ring.dispose();
    materials.flash.dispose();
  }, [geometries, materials]);

  useFrame(() => {
    const bodyMesh = bodyRef.current;
    const ringMesh = ringRef.current;
    const flashMesh = flashRef.current;
    if (!bodyMesh || !ringMesh || !flashMesh) return;

    const list = moons?.list ?? [];
    if (list.length === 0) {
      bodyMesh.count = 0;
      ringMesh.count = 0;
      flashMesh.count = 0;
      return;
    }

    const nowMs = serverNow();
    const timeSec = nowMs / 1_000;
    const rarityMap = moons?.rarity ?? {};

    let bodyCount = 0;
    let ringCount = 0;
    const moonByPlanet = new Map<string, { x: number; y: number; z: number; r: number }>();

    for (const item of list) {
      if (bodyCount >= MAX_INSTANCES) break;
      const node = nodeById.get(item.planetId);
      if (!node) continue;

      const rarity = rarityMap[item.planetId];
      const cracks = effectiveCracks(
        { cracks: item.cracks, lastHitAtMs: item.lastHitAt?.getTime() ?? null },
        nowMs,
      );
      const r = moonRadiusFor(node.radius, rarity);
      _parent.x = node.position[0];
      _parent.y = node.position[1];
      _parent.z = node.position[2];
      moonOrbitPosition(_parent, node.radius, item.visualSeed, timeSec, _pos);

      _dummy.position.set(_pos.x, _pos.y, _pos.z);
      _dummy.rotation.set(0, timeSec * 0.25 + item.visualSeed, 0);
      _dummy.scale.setScalar(r);
      _dummy.updateMatrix();
      bodyMesh.setMatrixAt(bodyCount, _dummy.matrix);
      _color.setHex(moonSurfaceColor(item.visualSeed, cracks));
      bodyMesh.setColorAt(bodyCount, _color);
      bodyCount += 1;

      moonByPlanet.set(item.planetId, { x: _pos.x, y: _pos.y, z: _pos.z, r });

      const ringHex = moonRarityRingColor(rarity);
      if (ringHex !== null && ringCount < MAX_INSTANCES) {
        _dummy.position.set(_pos.x, _pos.y, _pos.z);
        _dummy.rotation.copy(_ringTilt);
        _dummy.scale.setScalar(r);
        _dummy.updateMatrix();
        ringMesh.setMatrixAt(ringCount, _dummy.matrix);
        _color.setHex(ringHex);
        ringMesh.setColorAt(ringCount, _color);
        ringCount += 1;
      }
    }

    bodyMesh.count = bodyCount;
    bodyMesh.instanceMatrix.needsUpdate = true;
    if (bodyMesh.instanceColor) bodyMesh.instanceColor.needsUpdate = true;

    ringMesh.count = ringCount;
    ringMesh.instanceMatrix.needsUpdate = true;
    if (ringMesh.instanceColor) ringMesh.instanceColor.needsUpdate = true;

    let flashCount = 0;
    const arrivals = moons?.flashes.arrivals ?? [];
    const departures = moons?.flashes.departures ?? [];
    const allFlashes = [...arrivals, ...departures];
    for (const fl of allFlashes) {
      if (flashCount >= MAX_INSTANCES) break;
      const progress = moonFlashProgress(fl.at.getTime(), nowMs);
      if (progress === null) continue;
      const pos = moonByPlanet.get(fl.planetId);
      if (!pos) continue;

      const scale = pos.r * (1.2 + (1 - progress) * 0.9);
      _dummy.position.set(pos.x, pos.y, pos.z);
      _dummy.rotation.set(Math.PI / 2, progress * Math.PI * 2, 0);
      _dummy.scale.setScalar(scale);
      _dummy.updateMatrix();
      flashMesh.setMatrixAt(flashCount, _dummy.matrix);
      flashCount += 1;
    }

    flashMesh.count = flashCount;
    flashMesh.instanceMatrix.needsUpdate = true;
  });

  if (!moons || moons.list.length === 0) return null;

  return (
    <group name="moons-layer">
      <instancedMesh ref={bodyRef} args={[geometries.sphere, materials.sphere, MAX_INSTANCES]} frustumCulled={false} />
      <instancedMesh ref={ringRef} args={[geometries.ring, materials.ring, MAX_INSTANCES]} frustumCulled={false} />
      <instancedMesh ref={flashRef} args={[geometries.flash, materials.flash, MAX_INSTANCES]} frustumCulled={false} />
    </group>
  );
}
