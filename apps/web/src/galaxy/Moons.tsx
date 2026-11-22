import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { effectiveCracks } from '@astera/rules';
import type { GalaxyMoons } from '../api/schemas.js';
import { serverNow } from '../lib/clock.js';
import { NIGHT_FLOOR } from './planetSurface.js';
import {
  moonFlashProgress,
  moonOrbitPosition,
  moonRadiusFor,
  moonRarityRingColor,
  moonSurfaceColor,
} from './moonOrbit.js';

/*
  VFX BRIEF 1 — Textured Equirectangular 3D Moons (S53 / V17)
  - Physical object: Cratered lunar regolith (Common/Rare/undiscovered) and ancient fractured
    mineral-veined moons (Epic/Legendary), wrapped in seamless 2:1 equirectangular maps on a
    low-poly smooth UV sphere (`SphereGeometry(1, 24, 16)`) with Astera's `NIGHT_FLOOR` emissive
    floor so the dark limb never drops to a flat black silhouette.
  - Draw budget: 2 instanced meshes (regolith + ancient) across all moons in the galaxy.

  VFX BRIEF 2 — Moon Rarity Telemetry Ring (S53 / V17)
  - Physical event: Orbital telemetry ring locking onto a discovered moon's gravitational resonance;
    undiscovered moons render ringless (V17).
  - Asset / pattern: Crisp 48-segment `RingGeometry` hairline (`MeshBasicMaterial`, zero soft glow).

  VFX BRIEF 3 — Public Moon Gate Aperture Flash (F4b / S16 / S32)
  - Physical event: Public gate arrival aperture flash visible to everyone on the galaxy disc
    (departure flash sensor-gated on server). Uses `/assets/vfx/library/gate-ring-scifi.webp`
    segmented Sci-Fi portal frame (`AdditiveBlending`, zero soft radial glow).
*/

const MOON_REGOLITH_TEX = '/assets/textures/moons/moon-regolith-2x1.webp';
const MOON_ANCIENT_TEX = '/assets/textures/moons/moon-ancient-2x1.webp';
const GATE_RING_TEX = '/assets/vfx/library/gate-ring-scifi.webp';

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

function makeLunarMaterial(map: THREE.Texture, cacheKey: string): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    map,
    emissiveMap: map,
    emissive: new THREE.Color().setScalar(NIGHT_FLOOR),
    roughness: 0.94,
    metalness: 0.04,
  });
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n#if defined(USE_COLOR) || defined(USE_INSTANCING_COLOR)\n\ttotalEmissiveRadiance *= vColor.rgb;\n#endif',
    );
  };
  mat.customProgramCacheKey = () => cacheKey;
  return mat;
}

export function Moons({
  moons,
  nodes,
}: {
  readonly moons?: GalaxyMoons | undefined;
  readonly nodes: readonly MoonHostNode[];
}) {
  const regolithRef = useRef<THREE.InstancedMesh>(null);
  const ancientRef = useRef<THREE.InstancedMesh>(null);
  const ringRef = useRef<THREE.InstancedMesh>(null);
  const flashRef = useRef<THREE.InstancedMesh>(null);

  const [regolithTex, ancientTex, gateRingTex] = useTexture([
    MOON_REGOLITH_TEX,
    MOON_ANCIENT_TEX,
    GATE_RING_TEX,
  ]);

  const nodeById = useMemo(() => {
    const map = new Map<string, MoonHostNode>();
    for (const node of nodes) map.set(node.id, node);
    return map;
  }, [nodes]);

  // Smooth round sphere silhouette (24x16) while keeping total poly count low and 100% instanced.
  const geometries = useMemo(() => ({
    sphere: new THREE.SphereGeometry(1, 24, 16),
    ring: new THREE.RingGeometry(1.30, 1.42, 48),
    flash: new THREE.PlaneGeometry(3.8, 3.8),
  }), []);

  const materials = useMemo(() => {
    const reg = regolithTex!;
    const anc = ancientTex!;
    const gate = gateRingTex!;
    for (const tex of [reg, anc]) {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.needsUpdate = true;
    }
    gate.colorSpace = THREE.SRGBColorSpace;
    gate.generateMipmaps = false;
    gate.minFilter = THREE.LinearFilter;
    gate.needsUpdate = true;

    return {
      regolith: makeLunarMaterial(reg, 'lunar-regolith'),
      ancient: makeLunarMaterial(anc, 'lunar-ancient'),
      ring: new THREE.MeshBasicMaterial({
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.88,
        depthWrite: false,
      }),
      flash: new THREE.MeshBasicMaterial({
        map: gate,
        color: 0x7dd3fc,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.92,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    };
  }, [regolithTex, ancientTex, gateRingTex]);

  useEffect(() => () => {
    geometries.sphere.dispose();
    geometries.ring.dispose();
    geometries.flash.dispose();
    materials.regolith.dispose();
    materials.ancient.dispose();
    materials.ring.dispose();
    materials.flash.dispose();
  }, [geometries, materials]);

  useFrame(({ camera }) => {
    const regMesh = regolithRef.current;
    const ancMesh = ancientRef.current;
    const ringMesh = ringRef.current;
    const flashMesh = flashRef.current;
    if (!regMesh || !ancMesh || !ringMesh || !flashMesh) return;

    const list = moons?.list ?? [];
    if (list.length === 0) {
      regMesh.count = 0;
      ancMesh.count = 0;
      ringMesh.count = 0;
      flashMesh.count = 0;
      return;
    }

    const nowMs = serverNow();
    const timeSec = nowMs / 1_000;
    const rarityMap = moons?.rarity ?? {};

    let regCount = 0;
    let ancCount = 0;
    let ringCount = 0;
    const moonByPlanet = new Map<string, { x: number; y: number; z: number; r: number }>();

    for (const item of list) {
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
      _dummy.rotation.set(0.12 * Math.sin(item.visualSeed), timeSec * 0.18 + item.visualSeed, 0);
      _dummy.scale.setScalar(r);
      _dummy.updateMatrix();

      // Lighter surface tint so the equirectangular albedo stays crisp; Epic/Legendary use the ancient fractured map.
      const isAncient = rarity === 'EPIC' || rarity === 'LEGENDARY';
      const baseTint = isAncient
        ? (rarity === 'LEGENDARY' ? 0xfef3c7 : 0xede9fe)
        : (rarity === 'RARE' ? 0xdbeafe : 0xf1f5f9);
      const crackTint = cracks > 0 ? moonSurfaceColor(item.visualSeed, cracks) : baseTint;
      _color.setHex(baseTint).lerp(new THREE.Color(crackTint), cracks > 0 ? 0.55 : 0);

      if (isAncient) {
        if (ancCount < MAX_INSTANCES) {
          ancMesh.setMatrixAt(ancCount, _dummy.matrix);
          ancMesh.setColorAt(ancCount, _color);
          ancCount++;
        }
      } else {
        if (regCount < MAX_INSTANCES) {
          regMesh.setMatrixAt(regCount, _dummy.matrix);
          regMesh.setColorAt(regCount, _color);
          regCount++;
        }
      }

      moonByPlanet.set(item.planetId, { x: _pos.x, y: _pos.y, z: _pos.z, r });

      // V17: rarity ring only for discovered moons (present in moons.rarity map)
      const ringColor = moonRarityRingColor(rarity);
      if (ringColor !== null && ringCount < MAX_INSTANCES) {
        _dummy.position.set(_pos.x, _pos.y, _pos.z);
        _dummy.rotation.copy(_ringTilt);
        _dummy.scale.setScalar(r);
        _dummy.updateMatrix();
        ringMesh.setMatrixAt(ringCount, _dummy.matrix);
        _color.setHex(ringColor);
        ringMesh.setColorAt(ringCount, _color);
        ringCount++;
      }
    }

    regMesh.count = regCount;
    regMesh.instanceMatrix.needsUpdate = true;
    if (regMesh.instanceColor) regMesh.instanceColor.needsUpdate = true;

    ancMesh.count = ancCount;
    ancMesh.instanceMatrix.needsUpdate = true;
    if (ancMesh.instanceColor) ancMesh.instanceColor.needsUpdate = true;

    ringMesh.count = ringCount;
    ringMesh.instanceMatrix.needsUpdate = true;
    if (ringMesh.instanceColor) ringMesh.instanceColor.needsUpdate = true;

    // Public gate arrival & sensor-gated departure aperture flashes using the segmented Sci-Fi portal ring texture
    let flashCount = 0;
    const flashes = [
      ...(moons?.flashes.arrivals ?? []),
      ...(moons?.flashes.departures ?? []),
    ];
    for (const fl of flashes) {
      if (flashCount >= MAX_INSTANCES) break;
      const p = moonFlashProgress(fl.at.getTime(), nowMs);
      if (p === null) continue;
      const target = moonByPlanet.get(fl.planetId);
      if (!target) continue;

      const scale = target.r * (0.95 + p * 1.45);
      _dummy.position.set(target.x, target.y, target.z);
      _dummy.quaternion.copy(camera.quaternion);
      _dummy.rotateZ(timeSec * 1.8 + p * 3.14);
      _dummy.scale.setScalar(scale);
      _dummy.updateMatrix();
      flashMesh.setMatrixAt(flashCount, _dummy.matrix);
      _color.setHex(0x7dd3fc).multiplyScalar(1 - p);
      flashMesh.setColorAt(flashCount, _color);
      flashCount++;
    }

    flashMesh.count = flashCount;
    flashMesh.instanceMatrix.needsUpdate = true;
    if (flashMesh.instanceColor) flashMesh.instanceColor.needsUpdate = true;
  });

  return (
    <group name="moons">
      <instancedMesh
        ref={regolithRef}
        args={[geometries.sphere, materials.regolith, MAX_INSTANCES]}
        count={0}
        frustumCulled={false}
        raycast={() => undefined}
      />
      <instancedMesh
        ref={ancientRef}
        args={[geometries.sphere, materials.ancient, MAX_INSTANCES]}
        count={0}
        frustumCulled={false}
        raycast={() => undefined}
      />
      <instancedMesh
        ref={ringRef}
        args={[geometries.ring, materials.ring, MAX_INSTANCES]}
        count={0}
        frustumCulled={false}
        raycast={() => undefined}
      />
      <instancedMesh
        ref={flashRef}
        args={[geometries.flash, materials.flash, MAX_INSTANCES]}
        count={0}
        frustumCulled={false}
        raycast={() => undefined}
        renderOrder={4}
      />
    </group>
  );
}
