import { useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { crackLimit, effectiveCracks } from '@astera/rules';
import type { GalaxyMoons } from '../api/schemas.js';
import { serverNow } from '../lib/clock.js';
import { NIGHT_FLOOR } from './planetSurface.js';
import {
  moonListChanges,
  type MoonListState,
  moonOrbitPosition,
  moonRadiusFor,
  moonRarityRimColor,
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

  VFX BRIEF 2 — Rarity on the limb (V17, owner 2026-11-24)
  - In the world: a discovered moon's limb catches a thin light of its rarity's colour; an unknown one has none.
  - Asset: the lunar material itself (one fresnel term in its emissive), no extra draw.
  - Why: the old ring read as a planetary ring; the moon's own edge carries the rarity instead.

  The public gate flash moved to `MoonGateFlashes` (the Astral Gate itself, not a ring sprite).

  VFX BRIEF 4 — Birth from wreckage (review V1, §9.3)
  - In the world: the battle's wreck cloud spirals in around the planet and packs into a new moon.
  - Asset: the moon's own `moon-regolith-2x1.webp` on lit, tumbling boulders (one instanced draw).
  - Why: the moon is literally made of the fight's wreckage; no ring, no halo.

  VFX BRIEF 5 — Shatter (review V2, §9.3)
  - In the world: inside the Death Star's fireball (`NukeBlast`, already aimed at the moon) the moon
    breaks into regolith boulders flung outward, glowing hot at first and cooling to grey.
  - Asset: the same regolith texture on the same boulder draw; the fire is `NukeBlast`'s library art.
  - Why: the dock and every ship on it are now rubble — the loss reads as rock, not as a light.
*/

const MOON_REGOLITH_TEX = '/assets/textures/moons/moon-regolith-2x1.webp';
const MOON_ANCIENT_TEX = '/assets/textures/moons/moon-ancient-2x1.webp';

useTexture.preload(MOON_REGOLITH_TEX);
useTexture.preload(MOON_ANCIENT_TEX);

const MAX_INSTANCES = 4_096;
const SHATTER_SHARDS = 22;
const BIRTH_SHARDS = 18;
const _hot = new THREE.Color(0xffa25e);
const _cool = new THREE.Color(0xb9b2a6);
const BIRTH_DURATION_MS = 4_500;
const SHATTER_DURATION_MS = 3_600;

const _parent = { x: 0, y: 0, z: 0 };
const _pos = { x: 0, y: 0, z: 0 };
const _dummy = new THREE.Object3D();
const _color = new THREE.Color();
const _crackColor = new THREE.Color();
const _rimColor = new THREE.Color();
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
        '#include <common>\nattribute float aCrack;\nattribute vec3 aRim;\nvarying float vCrack;\nvarying vec3 vRim;\nvarying vec3 vLocalPos;',
      )
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvCrack = aCrack;\nvRim = aRim;\nvLocalPos = position;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying float vCrack;\nvarying vec3 vRim;\nvarying vec3 vLocalPos;',
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
  }
  // V17 (rim, 2026-11-24): a known rarity reads as a thin limb of its colour; an unknown one has none.
  float limb = smoothstep(0.55, 1.0, 1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0));
  totalEmissiveRadiance += vRim * limb * 0.85;`,
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
  const shardRef = useRef<THREE.InstancedMesh>(null);

  const regIdsRef = useRef<string[]>([]);
  const ancIdsRef = useRef<string[]>([]);
  const ringIdsRef = useRef<string[]>([]);
  const moonPosPoolRef = useRef<Map<string, CachedMoonPos>>(new Map());
  const listStateRef = useRef<MoonListState>({ hydrated: false, known: new Set() });
  const knownMoonsRef = useRef<Map<string, { x: number; y: number; z: number; r: number; seed: number }>>(new Map());
  const birthsRef = useRef<BirthEvent[]>([]);
  const shattersRef = useRef<ShatterEvent[]>([]);

  const [regolithTex, ancientTex] = useTexture([
    MOON_REGOLITH_TEX,
    MOON_ANCIENT_TEX,
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
    const regRims = new Float32Array(MAX_INSTANCES * 3);
    const regRimAttr = new THREE.InstancedBufferAttribute(regRims, 3);
    regSphere.setAttribute('aRim', regRimAttr);

    const ancSphere = new THREE.SphereGeometry(1, 24, 16);
    const ancCracks = new Float32Array(MAX_INSTANCES);
    const ancCrackAttr = new THREE.InstancedBufferAttribute(ancCracks, 1);
    ancSphere.setAttribute('aCrack', ancCrackAttr);
    const ancRims = new Float32Array(MAX_INSTANCES * 3);
    const ancRimAttr = new THREE.InstancedBufferAttribute(ancRims, 3);
    ancSphere.setAttribute('aRim', ancRimAttr);

    return {
      regSphere,
      regCracks,
      regCrackAttr,
      regRims,
      regRimAttr,
      ancSphere,
      ancCracks,
      ancCrackAttr,
      ancRims,
      ancRimAttr,
      ring: new THREE.RingGeometry(1.30, 1.42, 48),
      shard: new THREE.IcosahedronGeometry(0.18, 0),
    };
  }, []);

  const materials = useMemo(() => {
    const reg = regolithTex!;
    const anc = ancientTex!;
    for (const tex of [reg, anc]) {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.needsUpdate = true;
    }

    return {
      regolith: makeLunarMaterial(reg, 'lunar-regolith-v2'),
      ancient: makeLunarMaterial(anc, 'lunar-ancient-v2'),
      // Owner 2026-11-24: no drawn rarity ring (it read as a planetary ring). It stays as the tap target
      // that makes a small moon easy to touch, and writes no colour or depth.
      ring: new THREE.MeshBasicMaterial({
        side: THREE.DoubleSide,
        colorWrite: false,
        depthWrite: false,
      }),
      // Lit regolith boulders: the same rock the moon is drawn in (V1/V2), never a flat coloured sticker.
      shard: new THREE.MeshStandardMaterial({
        map: reg,
        roughness: 1,
        metalness: 0,
        emissive: new THREE.Color().setScalar(NIGHT_FLOOR),
        flatShading: true,
      }),
    };
  }, [regolithTex, ancientTex]);

  useEffect(() => () => {
    geometries.regSphere.dispose();
    geometries.ancSphere.dispose();
    geometries.ring.dispose();
    geometries.shard.dispose();
    materials.regolith.dispose();
    materials.ancient.dispose();
    materials.ring.dispose();
    materials.shard.dispose();
  }, [geometries, materials]);

  // Track moon births & shatters whenever `moons.list` updates (the first list is the galaxy as it stands).
  useEffect(() => {
    const list = moons?.list;
    if (!list) return;
    const nowMs = serverNow();
    const change = moonListChanges(listStateRef.current, list.map((m) => m.planetId));
    listStateRef.current = change;
    for (const planetId of change.births) birthsRef.current.push({ planetId, startedAtMs: nowMs });
    for (const planetId of change.gone) {
      const prev = knownMoonsRef.current.get(planetId);
      if (!prev) continue;
      shattersRef.current.push({ x: prev.x, y: prev.y, z: prev.z, r: prev.r, seed: prev.seed, startedAtMs: nowMs });
      knownMoonsRef.current.delete(planetId);
    }
  }, [moons?.list]);

  useFrame(() => {
    const regMesh = regolithRef.current;
    const ancMesh = ancientRef.current;
    const ringMesh = ringRef.current;
    const shardMesh = shardRef.current;
    if (!regMesh || !ancMesh || !ringMesh || !shardMesh) return;

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
    const ringIds = ringIdsRef.current;
    regIds.length = 0;
    ancIds.length = 0;
    ringIds.length = 0;

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
      // V17: only a discovered rarity lights the limb.
      const rimHex = moonRarityRimColor(rarity);
      if (rimHex === null) _rimColor.setRGB(0, 0, 0);
      else _rimColor.setHex(rimHex);

      if (isAncient) {
        if (ancCount < MAX_INSTANCES) {
          ancMesh.setMatrixAt(ancCount, _dummy.matrix);
          ancMesh.setColorAt(ancCount, _color);
          geometries.ancCracks[ancCount] = crackNorm;
          _rimColor.toArray(geometries.ancRims, ancCount * 3);
          ancIds.push(item.planetId);
          ancCount++;
        }
      } else {
        if (regCount < MAX_INSTANCES) {
          regMesh.setMatrixAt(regCount, _dummy.matrix);
          regMesh.setColorAt(regCount, _color);
          geometries.regCracks[regCount] = crackNorm;
          _rimColor.toArray(geometries.regRims, regCount * 3);
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

      // The undrawn tap ring: a small moon is as easy to touch as its old ring was.
      if (ringCount < MAX_INSTANCES) {
        _dummy.position.set(_pos.x, _pos.y, _pos.z);
        _dummy.rotation.copy(_ringTilt);
        _dummy.scale.setScalar(r);
        _dummy.updateMatrix();
        ringMesh.setMatrixAt(ringCount, _dummy.matrix);
        ringIds.push(item.planetId);
        ringCount++;
      }
    }

    regMesh.count = regCount;
    regMesh.instanceMatrix.needsUpdate = true;
    regMesh.boundingSphere = null;
    if (regMesh.instanceColor) regMesh.instanceColor.needsUpdate = true;
    geometries.regCrackAttr.needsUpdate = true;
    geometries.regRimAttr.needsUpdate = true;

    ancMesh.count = ancCount;
    ancMesh.instanceMatrix.needsUpdate = true;
    ancMesh.boundingSphere = null;
    if (ancMesh.instanceColor) ancMesh.instanceColor.needsUpdate = true;
    geometries.ancCrackAttr.needsUpdate = true;
    geometries.ancRimAttr.needsUpdate = true;

    ringMesh.count = ringCount;
    ringMesh.instanceMatrix.needsUpdate = true;
    ringMesh.boundingSphere = null;
    if (ringMesh.instanceColor) ringMesh.instanceColor.needsUpdate = true;

    // Moon Birth Accretion Swirl (§9.3)
    let shardCount = 0;
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
      // Wreckage spirals in and packs: far and loose at first, gone into the moon's surface at the end.
      const ease = 1 - (1 - p) ** 3;
      for (let s = 0; s < BIRTH_SHARDS; s++) {
        if (shardCount >= MAX_INSTANCES) break;
        const a1 = ((s * 137.5) % 360) * (Math.PI / 180) + (1 - ease) * Math.PI * 1.6;
        const a2 = ((((s * 53) % 120) - 60) * (Math.PI / 180)) * (1 - ease);
        const dist = target.r * (1 + (4.6 + (s % 4) * 0.5) * (1 - ease));
        _dummy.position.set(
          target.x + Math.cos(a1) * Math.cos(a2) * dist,
          target.y + Math.sin(a2) * dist,
          target.z + Math.sin(a1) * Math.cos(a2) * dist,
        );
        _dummy.rotation.set(timeSec * (0.9 + s * 0.17), timeSec * (1.3 + s * 0.11), s);
        const size = target.r * (0.32 + (s % 3) * 0.12) * (1 - ease * 0.85);
        _dummy.scale.set(size * (1 + (s % 2) * 0.35), size, size * (1 + (s % 3) * 0.2));
        _dummy.updateMatrix();
        shardMesh.setMatrixAt(shardCount, _dummy.matrix);
        shardMesh.setColorAt(shardCount, _cool);
        shardCount++;
      }
    }

    // Moon Shatter Debris Shards (§9.3)
    const shatters = shattersRef.current;
    for (let i = shatters.length - 1; i >= 0; i--) {
      const sh = shatters[i]!;
      const p = (nowMs - sh.startedAtMs) / SHATTER_DURATION_MS;
      if (p < 0 || p > 1) {
        shatters.splice(i, 1);
        continue;
      }
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
        const size = sh.r * (0.45 + (s % 3) * 0.18) * fade;
        _dummy.scale.set(size * (1 + (s % 2) * 0.4), size, size * (1 + (s % 3) * 0.25));
        _dummy.updateMatrix();
        shardMesh.setMatrixAt(shardCount, _dummy.matrix);
        // Fresh fracture faces glow, then cool to the moon's own grey.
        _color.copy(_hot).lerp(_cool, Math.min(1, p * 2.2));
        shardMesh.setColorAt(shardCount, _color);
        shardCount++;
      }
    }


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
        onClick={handleClick(ringIdsRef.current)}
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
