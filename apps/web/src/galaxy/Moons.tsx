import { useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { crackLimit, effectiveCracks } from '@astera/rules';
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
  VFX BRIEF 1 — Textured Equirectangular 3D Moons + Glowing Fissure Cracks (S53 / V17)
  - Physical object: Cratered lunar regolith (Common/Rare/undiscovered) and ancient fractured
    mineral-veined moons (Epic/Legendary), wrapped in seamless 2:1 equirectangular maps on a
    low-poly smooth UV sphere (`SphereGeometry(1, 24, 16)`) with Astera's `NIGHT_FLOOR` emissive
    floor and a procedural GPU fissure seam driven by per-instance `aCrack` severity (`0..1`).
  - Draw budget: 2 instanced meshes (regolith + ancient) across all moons in the galaxy; clickable
    to focus their parent world; zero per-frame heap allocations.

  VFX BRIEF 2 — Moon Rarity Telemetry Ring (S53 / V17)
  - Physical event: Orbital telemetry ring locking onto a discovered moon's gravitational resonance;
    undiscovered moons render ringless (V17).

  VFX BRIEF 3 — Public Moon Gate Aperture Flash, Birth Accretion & Shatter Shards (§9.3)
  - Public gate arrivals flash crisp cyan (`#38bdf8`); sensor-gated departures flash violet
    (`#c084fc`) using `/assets/vfx/library/gate-ring-scifi.webp` (`AdditiveBlending`).
  - Newly born moons emit a 4.5s golden-cyan accretion ring; shattered moons burst into radial
    regolith rock shards. Zero radial glow sprites.
*/

const MOON_REGOLITH_TEX = '/assets/textures/moons/moon-regolith-2x1.webp';
const MOON_ANCIENT_TEX = '/assets/textures/moons/moon-ancient-2x1.webp';
const GATE_RING_TEX = '/assets/vfx/library/gate-ring-scifi.webp';

useTexture.preload(MOON_REGOLITH_TEX);
useTexture.preload(MOON_ANCIENT_TEX);
useTexture.preload(GATE_RING_TEX);

const MAX_INSTANCES = 4_096;
const SHATTER_SHARDS = 14;
const BIRTH_DURATION_MS = 4_500;
const SHATTER_DURATION_MS = 3_600;

const _parent = { x: 0, y: 0, z: 0 };
const _pos = { x: 0, y: 0, z: 0 };
const _dummy = new THREE.Object3D();
const _color = new THREE.Color();
const _crackColor = new THREE.Color();
const _ringTilt = new THREE.Euler(Math.PI / 2, 0, 0);

interface MoonHostNode {
  readonly id: string;
  readonly position: readonly [number, number, number];
  readonly radius: number;
}

interface CachedMoonPos {
  x: number;
  y: number;
  z: number;
  r: number;
}

interface BirthEvent {
  planetId: string;
  startedAtMs: number;
}

interface ShatterEvent {
  x: number;
  y: number;
  z: number;
  r: number;
  seed: number;
  startedAtMs: number;
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
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute float aCrack;\nvarying float vCrack;\nvarying vec3 vLocalPos;',
      )
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvCrack = aCrack;\nvLocalPos = position;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying float vCrack;\nvarying vec3 vLocalPos;',
      )
      .replace(
        '#include <emissivemap_fragment>',
        /* glsl */ `#include <emissivemap_fragment>
#if defined(USE_COLOR) || defined(USE_INSTANCING_COLOR)
  totalEmissiveRadiance *= vColor.rgb;
#endif
  if (vCrack > 0.01) {
    vec3 p = normalize(vLocalPos) * 5.2;
    float f1 = abs(sin(p.x * 2.1 + sin(p.y * 2.7 + p.z * 1.9)));
    float f2 = abs(sin(p.y * 2.4 - cos(p.z * 2.3 + p.x * 1.7)));
    float ridge = min(f1, f2);
    float width = 0.045 + vCrack * 0.14;
    float vein = 1.0 - smoothstep(0.0, width, ridge);
    float core = 1.0 - smoothstep(0.0, width * 0.45, ridge);
    vec3 magma = mix(vec3(0.95, 0.28, 0.04), vec3(1.0, 0.78, 0.35), core);
    totalEmissiveRadiance += magma * vein * (0.65 + vCrack * 1.45);
  }`,
      );
  };
  mat.customProgramCacheKey = () => cacheKey;
  return mat;
}

export function Moons({
  moons,
  nodes,
  onSelectPlanet,
}: {
  readonly moons?: GalaxyMoons | undefined;
  readonly nodes: readonly MoonHostNode[];
  readonly onSelectPlanet?: ((planetId: string) => void) | undefined;
}) {
  const regolithRef = useRef<THREE.InstancedMesh>(null);
  const ancientRef = useRef<THREE.InstancedMesh>(null);
  const ringRef = useRef<THREE.InstancedMesh>(null);
  const flashRef = useRef<THREE.InstancedMesh>(null);
  const shardRef = useRef<THREE.InstancedMesh>(null);

  const regIdsRef = useRef<string[]>([]);
  const ancIdsRef = useRef<string[]>([]);
  const moonPosPoolRef = useRef<Map<string, CachedMoonPos>>(new Map());
  const seenHydratedRef = useRef(false);
  const knownMoonsRef = useRef<Map<string, { x: number; y: number; z: number; r: number; seed: number }>>(new Map());
  const birthsRef = useRef<BirthEvent[]>([]);
  const shattersRef = useRef<ShatterEvent[]>([]);

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

  // Separate sphere geometries for regolith & ancient so each has its own `aCrack` instanced attribute.
  const geometries = useMemo(() => {
    const regSphere = new THREE.SphereGeometry(1, 24, 16);
    const regCracks = new Float32Array(MAX_INSTANCES);
    const regCrackAttr = new THREE.InstancedBufferAttribute(regCracks, 1);
    regSphere.setAttribute('aCrack', regCrackAttr);

    const ancSphere = new THREE.SphereGeometry(1, 24, 16);
    const ancCracks = new Float32Array(MAX_INSTANCES);
    const ancCrackAttr = new THREE.InstancedBufferAttribute(ancCracks, 1);
    ancSphere.setAttribute('aCrack', ancCrackAttr);

    return {
      regSphere,
      regCracks,
      regCrackAttr,
      ancSphere,
      ancCracks,
      ancCrackAttr,
      ring: new THREE.RingGeometry(1.30, 1.42, 48),
      flash: new THREE.PlaneGeometry(3.8, 3.8),
      shard: new THREE.DodecahedronGeometry(0.18, 0),
    };
  }, []);

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
      regolith: makeLunarMaterial(reg, 'lunar-regolith-v2'),
      ancient: makeLunarMaterial(anc, 'lunar-ancient-v2'),
      ring: new THREE.MeshBasicMaterial({
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.88,
        depthWrite: false,
      }),
      flash: new THREE.MeshBasicMaterial({
        map: gate,
        color: 0xffffff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.92,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
      shard: new THREE.MeshBasicMaterial({
        color: 0xfb923c,
        transparent: true,
        opacity: 0.9,
        toneMapped: false,
      }),
    };
  }, [regolithTex, ancientTex, gateRingTex]);

  useEffect(() => () => {
    geometries.regSphere.dispose();
    geometries.ancSphere.dispose();
    geometries.ring.dispose();
    geometries.flash.dispose();
    geometries.shard.dispose();
    materials.regolith.dispose();
    materials.ancient.dispose();
    materials.ring.dispose();
    materials.flash.dispose();
    materials.shard.dispose();
  }, [geometries, materials]);

  // Track moon births & shatters whenever `moons.list` updates (after initial hydration)
  useEffect(() => {
    const list = moons?.list;
    if (!list) return;
    const nowMs = serverNow();
    const currentSet = new Set<string>();
    for (const m of list) currentSet.add(m.planetId);

    if (!seenHydratedRef.current) {
      if (list.length > 0) seenHydratedRef.current = true;
      return;
    }

    // New moon born -> accretion swirl
    for (const m of list) {
      if (!knownMoonsRef.current.has(m.planetId)) {
        birthsRef.current.push({ planetId: m.planetId, startedAtMs: nowMs });
      }
    }
    // Existing moon vanished -> shatter shards burst
    for (const [planetId, prev] of knownMoonsRef.current.entries()) {
      if (!currentSet.has(planetId)) {
        shattersRef.current.push({
          x: prev.x,
          y: prev.y,
          z: prev.z,
          r: prev.r,
          seed: prev.seed,
          startedAtMs: nowMs,
        });
        knownMoonsRef.current.delete(planetId);
      }
    }
  }, [moons?.list]);

  useFrame(({ camera }) => {
    const regMesh = regolithRef.current;
    const ancMesh = ancientRef.current;
    const ringMesh = ringRef.current;
    const flashMesh = flashRef.current;
    const shardMesh = shardRef.current;
    if (!regMesh || !ancMesh || !ringMesh || !flashMesh || !shardMesh) return;

    const list = moons?.list ?? [];
    const nowMs = serverNow();
    const timeSec = nowMs / 1_000;
    const rarityMap = moons?.rarity ?? {};

    let regCount = 0;
    let ancCount = 0;
    let ringCount = 0;
    const pool = moonPosPoolRef.current;
    const regIds = regIdsRef.current;
    const ancIds = ancIdsRef.current;
    regIds.length = 0;
    ancIds.length = 0;

    for (const item of list) {
      const node = nodeById.get(item.planetId);
      if (!node) continue;

      const rarity = rarityMap[item.planetId];
      const cracks = effectiveCracks(
        { cracks: item.cracks, lastHitAtMs: item.lastHitAt?.getTime() ?? null },
        nowMs,
      );
      const crackCap = crackLimit(rarity ?? 'COMMON');
      const crackNorm = cracks > 0 ? Math.min(1, cracks / Math.max(1, crackCap)) : 0;

      const r = moonRadiusFor(node.radius, rarity);
      _parent.x = node.position[0];
      _parent.y = node.position[1];
      _parent.z = node.position[2];
      moonOrbitPosition(_parent, node.radius, item.visualSeed, timeSec, _pos);

      _dummy.position.set(_pos.x, _pos.y, _pos.z);
      _dummy.rotation.set(0.12 * Math.sin(item.visualSeed), timeSec * 0.18 + item.visualSeed, 0);
      _dummy.scale.setScalar(r);
      _dummy.updateMatrix();

      const isAncient = rarity === 'EPIC' || rarity === 'LEGENDARY';
      const baseTint = isAncient
        ? (rarity === 'LEGENDARY' ? 0xfef3c7 : 0xede9fe)
        : (rarity === 'RARE' ? 0xdbeafe : 0xf1f5f9);
      _color.setHex(baseTint);
      if (cracks > 0) {
        _crackColor.setHex(moonSurfaceColor(item.visualSeed, cracks));
        _color.lerp(_crackColor, 0.42);
      }

      if (isAncient) {
        if (ancCount < MAX_INSTANCES) {
          ancMesh.setMatrixAt(ancCount, _dummy.matrix);
          ancMesh.setColorAt(ancCount, _color);
          geometries.ancCracks[ancCount] = crackNorm;
          ancIds.push(item.planetId);
          ancCount++;
        }
      } else {
        if (regCount < MAX_INSTANCES) {
          regMesh.setMatrixAt(regCount, _dummy.matrix);
          regMesh.setColorAt(regCount, _color);
          geometries.regCracks[regCount] = crackNorm;
          regIds.push(item.planetId);
          regCount++;
        }
      }

      // Reuse pooled entry — zero per-frame object allocation
      let cached = pool.get(item.planetId);
      if (!cached) {
        cached = { x: _pos.x, y: _pos.y, z: _pos.z, r };
        pool.set(item.planetId, cached);
      } else {
        cached.x = _pos.x;
        cached.y = _pos.y;
        cached.z = _pos.z;
        cached.r = r;
      }

      let known = knownMoonsRef.current.get(item.planetId);
      if (!known) {
        known = { x: _pos.x, y: _pos.y, z: _pos.z, r, seed: item.visualSeed };
        knownMoonsRef.current.set(item.planetId, known);
      } else {
        known.x = _pos.x;
        known.y = _pos.y;
        known.z = _pos.z;
        known.r = r;
      }

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
    geometries.regCrackAttr.needsUpdate = true;

    ancMesh.count = ancCount;
    ancMesh.instanceMatrix.needsUpdate = true;
    if (ancMesh.instanceColor) ancMesh.instanceColor.needsUpdate = true;
    geometries.ancCrackAttr.needsUpdate = true;

    ringMesh.count = ringCount;
    ringMesh.instanceMatrix.needsUpdate = true;
    if (ringMesh.instanceColor) ringMesh.instanceColor.needsUpdate = true;

    // Public gate flashes (cyan arrivals, violet sensor-gated departures) + Birth accretion rings
    let flashCount = 0;
    const emitFlash = (
      x: number,
      y: number,
      z: number,
      r: number,
      p: number,
      hex: number,
      spinDir: number,
      scaleMult: number,
    ) => {
      if (flashCount >= MAX_INSTANCES) return;
      const easeOut = 1 - (1 - p) * (1 - p);
      const env = Math.sin(p * Math.PI);
      const scale = r * (0.9 + easeOut * scaleMult);
      _dummy.position.set(x, y, z);
      _dummy.quaternion.copy(camera.quaternion);
      _dummy.rotateZ(spinDir * (timeSec * 1.9 + p * 3.14));
      _dummy.scale.setScalar(scale);
      _dummy.updateMatrix();
      flashMesh.setMatrixAt(flashCount, _dummy.matrix);
      _color.setHex(hex).multiplyScalar(Math.max(0.02, env));
      flashMesh.setColorAt(flashCount, _color);
      flashCount++;
    };

    const arrivals = moons?.flashes.arrivals;
    if (arrivals) {
      for (const fl of arrivals) {
        const p = moonFlashProgress(fl.at.getTime(), nowMs);
        if (p === null) continue;
        const target = pool.get(fl.planetId);
        if (!target) continue;
        emitFlash(target.x, target.y, target.z, target.r, p, 0x38bdf8, 1, 1.55);
      }
    }
    const departures = moons?.flashes.departures;
    if (departures) {
      for (const fl of departures) {
        const p = moonFlashProgress(fl.at.getTime(), nowMs);
        if (p === null) continue;
        const target = pool.get(fl.planetId);
        if (!target) continue;
        emitFlash(target.x, target.y, target.z, target.r, p, 0xc084fc, -1, 1.45);
      }
    }

    // Moon Birth Accretion Swirl (§9.3)
    const births = birthsRef.current;
    for (let i = births.length - 1; i >= 0; i--) {
      const b = births[i]!;
      const p = (nowMs - b.startedAtMs) / BIRTH_DURATION_MS;
      if (p < 0 || p > 1) {
        births.splice(i, 1);
        continue;
      }
      const target = pool.get(b.planetId);
      if (!target) continue;
      // Inward condensing golden-cyan accretion halo
      emitFlash(target.x, target.y, target.z, target.r, 1 - p, 0xfbbf24, 1.5, 2.6);
      emitFlash(target.x, target.y, target.z, target.r, p, 0x38bdf8, -1.2, 1.8);
    }

    // Moon Shatter Debris Shards (§9.3)
    let shardCount = 0;
    const shatters = shattersRef.current;
    for (let i = shatters.length - 1; i >= 0; i--) {
      const sh = shatters[i]!;
      const p = (nowMs - sh.startedAtMs) / SHATTER_DURATION_MS;
      if (p < 0 || p > 1) {
        shatters.splice(i, 1);
        continue;
      }
      // Expanding orange shock ring on shatter
      emitFlash(sh.x, sh.y, sh.z, sh.r, p, 0xf97316, 1.8, 3.4);
      const fade = 1 - p * p;
      const spread = sh.r * (0.6 + p * 5.2);
      for (let s = 0; s < SHATTER_SHARDS; s++) {
        if (shardCount >= MAX_INSTANCES) break;
        const a1 = ((sh.seed * 13 + s * 137.5) % 360) * (Math.PI / 180);
        const a2 = (((sh.seed * 7 + s * 53) % 160) - 80) * (Math.PI / 180);
        const spd = 0.65 + ((s * 31) % 10) * 0.08;
        const dist = spread * spd;
        _dummy.position.set(
          sh.x + Math.cos(a1) * Math.cos(a2) * dist,
          sh.y + Math.sin(a2) * dist,
          sh.z + Math.sin(a1) * Math.cos(a2) * dist,
        );
        _dummy.rotation.set(timeSec * (1.8 + s * 0.3), timeSec * (2.2 + s * 0.2), s);
        _dummy.scale.setScalar(sh.r * (0.45 + (s % 3) * 0.18) * fade);
        _dummy.updateMatrix();
        shardMesh.setMatrixAt(shardCount, _dummy.matrix);
        _color.setHex(s % 2 === 0 ? 0xfb923c : 0x94a3b8).multiplyScalar(0.4 + 0.6 * fade);
        shardMesh.setColorAt(shardCount, _color);
        shardCount++;
      }
    }

    flashMesh.count = flashCount;
    flashMesh.instanceMatrix.needsUpdate = true;
    if (flashMesh.instanceColor) flashMesh.instanceColor.needsUpdate = true;

    shardMesh.count = shardCount;
    shardMesh.instanceMatrix.needsUpdate = true;
    if (shardMesh.instanceColor) shardMesh.instanceColor.needsUpdate = true;
  });

  const handleClick = (ids: readonly string[]) => (e: ThreeEvent<MouseEvent>) => {
    if (!onSelectPlanet || e.instanceId === undefined) return;
    const planetId = ids[e.instanceId];
    if (!planetId) return;
    e.stopPropagation();
    onSelectPlanet(planetId);
  };

  return (
    <group name="moons">
      <instancedMesh
        ref={regolithRef}
        args={[geometries.regSphere, materials.regolith, MAX_INSTANCES]}
        count={0}
        frustumCulled={false}
        onClick={handleClick(regIdsRef.current)}
      />
      <instancedMesh
        ref={ancientRef}
        args={[geometries.ancSphere, materials.ancient, MAX_INSTANCES]}
        count={0}
        frustumCulled={false}
        onClick={handleClick(ancIdsRef.current)}
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
      <instancedMesh
        ref={shardRef}
        args={[geometries.shard, materials.shard, MAX_INSTANCES]}
        count={0}
        frustumCulled={false}
        raycast={() => undefined}
        renderOrder={5}
      />
    </group>
  );
}
