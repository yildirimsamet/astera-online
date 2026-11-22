import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import type { MoonRarity } from '@astera/rules';
import type { GalaxyMoons } from '../api/schemas.js';
import { serverNow } from '../lib/clock.js';
import type { AstralGateInstance, AstralGateOptions } from '../vfx/astralGate.js';
import { moonOrbitPosition, moonRadiusFor } from './moonOrbit.js';

/*
  VFX BRIEF — Private Purple Astral Gate & Directional Moon Fleet Warp
  - Physical event: The commander opens a paired purple Gate of Astral Tracery (`astralGate.js`,
    #c1b8ff) clearly ahead of their moon along the exact jump vector. Their squadron forms up in
    front of the moon in clear space, glides visibly toward the open violet star-membrane portal,
    and punches through one-by-one — stretching into crisp violet-cyan hyper-light spears aimed
    straight at the destination moon, where the paired Astral Gate opens and receives them.
  - Privacy: Strictly client-local to the jumping commander (never broadcast to other players).
  - Assets:
    · `src/vfx/astralGate.js` (lazy-imported MIT Gate of Astral Tracery, #c1b8ff)
    · `/assets/vfx/library/sck-exhaust-jet.webp` — thruster plumes & directional warp light streaks
    · `/assets/vfx/library/flare-star.webp` — crisp warp snap star flare
    · `/assets/vfx/library/white-shock-4x4.webp` — 16-frame aperture ripple at warp punch-through
  - Zero radial gradient / soft glow sprites; 60fps only while active.
*/

const JET_TEX = '/assets/vfx/library/sck-exhaust-jet.webp';
const FLARE_TEX = '/assets/vfx/library/flare-star.webp';
const SHOCK_TEX = '/assets/vfx/library/white-shock-4x4.webp';

export const MOON_WARP_DURATION_MS = 7_600;

export interface MoonGateWarpEvent {
  readonly id: string;
  readonly fromPlanetId: string;
  readonly toPlanetId: string;
  readonly startedAtMs: number;
  readonly shipCount: number;
  readonly rarity: MoonRarity;
}

export interface MoonHostRef {
  readonly id: string;
  readonly position: readonly [number, number, number];
  readonly radius: number;
}

const Z_AXIS = new THREE.Vector3(0, 0, 1);
const UP_AXIS = new THREE.Vector3(0, 1, 0);
const ALT_UP = new THREE.Vector3(1, 0, 0);

/** Measured center Y of `utility-gate-frame` / `utility-star-membrane` in `astralGate.js` at size=1. */
const ASTRAL_GATE_CENTER_Y = 1.45;
const ASTRAL_GATE_PURPLE = '#c1b8ff';

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
const smooth = (a: number, b: number, t: number): number => {
  const k = clamp01((t - a) / (b - a));
  return k * k * (3 - 2 * k);
};

function setGridFrame(tex: THREE.Texture, frame: number, cols: number, rows: number): void {
  const f = Math.max(0, Math.min(cols * rows - 1, Math.floor(frame)));
  tex.offset.set((f % cols) / cols, 1 - (Math.floor(f / cols) + 1) / rows);
}

interface SharedMaps {
  jet: THREE.Texture;
  flare: THREE.Texture;
  shock: THREE.Texture;
}

type CreateAstralGateFn = (options?: AstralGateOptions) => AstralGateInstance;
let cachedGateLoader: Promise<CreateAstralGateFn> | null = null;
function loadAstralGate(): Promise<CreateAstralGateFn> {
  cachedGateLoader ??= import('../vfx/astralGate.js').then((mod) => mod.default);
  return cachedGateLoader;
}

const MAX_SQUAD = 6;
/** Clean V-wedge formation spread in clear space ahead of the moon so every ship reads individually. */
const FORMATION_OFFSETS: readonly (readonly [number, number, number])[] = [
  [0, 0.04, 0],
  [-0.62, 0.12, -0.34],
  [0.62, -0.08, -0.34],
  [-1.12, -0.14, -0.68],
  [1.12, 0.16, -0.68],
  [0, 0.34, -0.82],
];

/** Build a sleek swept-wing spacecraft mesh (body + delta wing + glowing canopy) in 1 lightweight geometry group. */
function CraftMesh({
  fuselageGeo,
  wingGeo,
  hullMat,
  accentMat,
  jetMat,
  jetScale = 1,
}: {
  readonly fuselageGeo: THREE.BufferGeometry;
  readonly wingGeo: THREE.BufferGeometry;
  readonly hullMat: THREE.Material;
  readonly accentMat: THREE.Material;
  readonly jetMat: THREE.Material;
  readonly jetScale?: number;
}) {
  return (
    <>
      <mesh geometry={fuselageGeo} material={hullMat} renderOrder={7} />
      <mesh geometry={wingGeo} position={[0, -0.02, -0.12]} material={accentMat} renderOrder={7} />
      {/* Crossed thruster plume cards behind the stern */}
      <group position={[0, 0, -0.5]} rotation={[0, Math.PI / 2, 0]} scale={[1.35 * jetScale, 0.44 * jetScale, 1]}>
        <mesh position={[0.5, 0, 0]} material={jetMat} renderOrder={7}>
          <planeGeometry args={[1, 1]} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0.5, 0, 0]} material={jetMat} renderOrder={7}>
          <planeGeometry args={[1, 1]} />
        </mesh>
      </group>
    </>
  );
}

function WarpSequence({
  event,
  moons,
  nodeById,
  maps,
  createGate,
}: {
  readonly event: MoonGateWarpEvent;
  readonly moons: GalaxyMoons | undefined;
  readonly nodeById: ReadonlyMap<string, MoonHostRef>;
  readonly maps: SharedMaps;
  readonly createGate: CreateAstralGateFn;
}) {
  const invalidate = useThree((s) => s.invalidate);
  const shipCount = Math.max(3, Math.min(MAX_SQUAD, Math.ceil(Math.sqrt(Math.max(1, event.shipCount)))));

  // Instantiate two real purple Gate of Astral Tracery portals (departure + arrival).
  const portals = useMemo(() => {
    const dep: AstralGateInstance = createGate({
      size: 1,
      speed: 1.15,
      detail: 1,
      color: ASTRAL_GATE_PURPLE,
      density: 0.7,
    });
    const arr: AstralGateInstance = createGate({
      size: 1,
      speed: 1.15,
      detail: 1,
      color: ASTRAL_GATE_PURPLE,
      density: 0.7,
    });
    // Center the upright arch at local origin so ships fly directly through the star membrane.
    dep.group.position.set(0, -ASTRAL_GATE_CENTER_Y, 0);
    arr.group.position.set(0, -ASTRAL_GATE_CENTER_Y, 0);
    return { dep, arr };
  }, [createGate]);

  const localTex = useMemo(() => {
    const depShock = maps.shock.clone();
    depShock.repeat.set(0.25, 0.25);
    depShock.needsUpdate = true;

    const arrShock = maps.shock.clone();
    arrShock.repeat.set(0.25, 0.25);
    arrShock.needsUpdate = true;
    return { depShock, arrShock };
  }, [maps.shock]);

  const geometries = useMemo(() => {
    // Sleek pointed fuselage oriented along +Z
    const fuselage = new THREE.ConeGeometry(0.2, 0.95, 5);
    fuselage.rotateX(Math.PI / 2);
    fuselage.scale(1.0, 0.45, 1.0);

    // Swept delta wing oriented flat along XZ
    const wing = new THREE.ConeGeometry(0.52, 0.56, 3);
    wing.rotateX(Math.PI / 2);
    wing.scale(1.15, 0.08, 0.9);

    const conduit = new THREE.BufferGeometry();
    conduit.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    return { fuselage, wing, conduit };
  }, []);

  const materials = useMemo(() => {
    const mk = (map: THREE.Texture, color: string) =>
      new THREE.MeshBasicMaterial({
        map,
        color,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
    return {
      hull: new THREE.MeshBasicMaterial({ color: '#eef6ff', transparent: true, opacity: 1, toneMapped: false }),
      accent: new THREE.MeshBasicMaterial({ color: '#a5b4fc', transparent: true, opacity: 0.95, toneMapped: false }),
      jet: mk(maps.jet, '#a78bfa'),
      streak: mk(maps.jet, '#e9d5ff'),
      depShock: mk(localTex.depShock, '#c4b5fd'),
      arrShock: mk(localTex.arrShock, '#c4b5fd'),
      depFlare: new THREE.SpriteMaterial({
        map: maps.flare,
        color: '#f5f3ff',
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
      arrFlare: new THREE.SpriteMaterial({
        map: maps.flare,
        color: '#f5f3ff',
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
      conduit: new THREE.LineBasicMaterial({
        color: '#c4b5fd',
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    };
  }, [maps, localTex]);

  const conduitLine = useMemo(() => {
    const line = new THREE.Line(geometries.conduit, materials.conduit);
    line.visible = false;
    line.frustumCulled = false;
    return line;
  }, [geometries.conduit, materials.conduit]);

  useEffect(() => () => {
    portals.dep.dispose();
    portals.arr.dispose();
    geometries.fuselage.dispose();
    geometries.wing.dispose();
    geometries.conduit.dispose();
    localTex.depShock.dispose();
    localTex.arrShock.dispose();
    Object.values(materials).forEach((m) => { m.dispose(); });
  }, [portals, geometries, localTex, materials]);

  const depGateHostRef = useRef<THREE.Group>(null);
  const depShockRef = useRef<THREE.Mesh>(null);
  const depFlareRef = useRef<THREE.Sprite>(null);

  const arrGateHostRef = useRef<THREE.Group>(null);
  const arrShockRef = useRef<THREE.Mesh>(null);
  const arrFlareRef = useRef<THREE.Sprite>(null);

  const depShipRefs = useRef<(THREE.Group | null)[]>([]);
  const depStreakRefs = useRef<(THREE.Group | null)[]>([]);
  const arrShipRefs = useRef<(THREE.Group | null)[]>([]);
  const arrStreakRefs = useRef<(THREE.Group | null)[]>([]);

  const depStopped = useRef(false);
  const arrStarted = useRef(false);
  const arrStopped = useRef(false);

  const scratch = useMemo(() => ({
    originParent: { x: 0, y: 0, z: 0 },
    destParent: { x: 0, y: 0, z: 0 },
    originMoon: { x: 0, y: 0, z: 0 },
    destMoon: { x: 0, y: 0, z: 0 },
    fromV: new THREE.Vector3(),
    toV: new THREE.Vector3(),
    dir: new THREE.Vector3(),
    negDir: new THREE.Vector3(),
    side: new THREE.Vector3(),
    up: new THREE.Vector3(),
    basis: new THREE.Matrix4(),
    gateDepQuat: new THREE.Quaternion(),
    gateArrQuat: new THREE.Quaternion(),
    shipFacing: new THREE.Quaternion(),
    backFacing: new THREE.Quaternion(),
    gateDepPos: new THREE.Vector3(),
    gateArrPos: new THREE.Vector3(),
    laneStart: new THREE.Vector3(),
    laneEnd: new THREE.Vector3(),
    head: new THREE.Vector3(),
    tail: new THREE.Vector3(),
    tmp: new THREE.Vector3(),
  }), []);

  useFrame((_, rawDelta) => {
    const dt = Math.min(0.05, Math.max(0.001, rawDelta));
    const nowMs = serverNow();
    const t = (nowMs - event.startedAtMs) / 1_000;
    if (t < 0 || t > MOON_WARP_DURATION_MS / 1_000) return;

    const fromNode = nodeById.get(event.fromPlanetId);
    const toNode = nodeById.get(event.toPlanetId);
    if (!fromNode || !toNode) return;

    const timeSec = nowMs / 1_000;
    const list = moons?.list ?? [];
    const fromMoon = list.find((m) => m.planetId === event.fromPlanetId);
    const toMoon = list.find((m) => m.planetId === event.toPlanetId);

    const fromR = moonRadiusFor(fromNode.radius, moons?.rarity[event.fromPlanetId] ?? event.rarity);
    const toR = moonRadiusFor(toNode.radius, moons?.rarity[event.toPlanetId]);

    scratch.originParent.x = fromNode.position[0];
    scratch.originParent.y = fromNode.position[1];
    scratch.originParent.z = fromNode.position[2];
    moonOrbitPosition(scratch.originParent, fromNode.radius, fromMoon?.visualSeed ?? 1, timeSec, scratch.originMoon);

    scratch.destParent.x = toNode.position[0];
    scratch.destParent.y = toNode.position[1];
    scratch.destParent.z = toNode.position[2];
    moonOrbitPosition(scratch.destParent, toNode.radius, toMoon?.visualSeed ?? 2, timeSec, scratch.destMoon);

    scratch.fromV.set(scratch.originMoon.x, scratch.originMoon.y, scratch.originMoon.z);
    scratch.toV.set(scratch.destMoon.x, scratch.destMoon.y, scratch.destMoon.z);
    scratch.dir.subVectors(scratch.toV, scratch.fromV);
    const totalDist = scratch.dir.length();
    if (totalDist < 0.001) return;
    scratch.dir.divideScalar(totalDist);
    scratch.negDir.copy(scratch.dir).negate();

    // Orthonormal basis: X = portal normal (`dir`), Y = upright (`up`), Z = arch width (`side`).
    const refUp = Math.abs(scratch.dir.y) > 0.92 ? ALT_UP : UP_AXIS;
    scratch.side.crossVectors(scratch.dir, refUp).normalize();
    scratch.up.crossVectors(scratch.side, scratch.dir).normalize();

    // Astral Gate faces +X with upright +Y -> map X->dir, Y->up, Z->side!
    scratch.basis.makeBasis(scratch.dir, scratch.up, scratch.side);
    scratch.gateDepQuat.setFromRotationMatrix(scratch.basis);
    // Arrival gate faces -dir (receiving) with upright +Y -> map X->-dir, Y->up, Z->-side!
    scratch.tmp.copy(scratch.side).negate();
    scratch.basis.makeBasis(scratch.negDir, scratch.up, scratch.tmp);
    scratch.gateArrQuat.setFromRotationMatrix(scratch.basis);

    scratch.shipFacing.setFromUnitVectors(Z_AXIS, scratch.dir);
    scratch.backFacing.setFromUnitVectors(Z_AXIS, scratch.negDir);

    // Clear-space staging lane well IN FRONT of the moon so ships & portal never collide with the moon!
    const depUnit = Math.max(fromR * 2.2, fromNode.radius * 0.65);
    const arrUnit = Math.max(toR * 2.2, toNode.radius * 0.65);
    const depStartOffset = Math.max(fromR * 1.9, depUnit * 0.95);
    const depGateOffset = Math.max(fromR * 5.1, depUnit * 2.55);
    const arrGateOffset = Math.max(toR * 5.1, arrUnit * 2.55);
    const arrStopOffset = Math.max(toR * 1.9, arrUnit * 0.95);

    scratch.laneStart.copy(scratch.fromV).addScaledVector(scratch.dir, depStartOffset);
    scratch.gateDepPos.copy(scratch.fromV).addScaledVector(scratch.dir, depGateOffset);
    scratch.gateArrPos.copy(scratch.toV).addScaledVector(scratch.dir, -arrGateOffset);
    scratch.laneEnd.copy(scratch.toV).addScaledVector(scratch.dir, -arrStopOffset);

    // ─── 1. PURPLE ASTRAL GATE AT ORIGIN MOON (0.0s -> 4.3s) ──────────────────
    if (t >= 3.3 && !depStopped.current) {
      depStopped.current = true;
      portals.dep.stop();
    }
    if (!portals.dep.finished) {
      portals.dep.update(dt);
    }
    if (depGateHostRef.current) {
      depGateHostRef.current.visible = !portals.dep.finished;
      depGateHostRef.current.position.copy(scratch.gateDepPos);
      depGateHostRef.current.quaternion.copy(scratch.gateDepQuat);
      depGateHostRef.current.scale.setScalar(depUnit * 0.68);
    }

    // Aperture shockwave when lead vessel hits the star membrane (~1.55s)
    const depPunch = t >= 1.5 ? clamp01((t - 1.5) / 0.85) : -1;
    if (depShockRef.current) {
      depShockRef.current.visible = depPunch >= 0 && depPunch < 1;
      if (depPunch >= 0 && depPunch < 1) {
        depShockRef.current.position.copy(scratch.gateDepPos);
        depShockRef.current.quaternion.copy(scratch.shipFacing);
        depShockRef.current.scale.setScalar(depUnit * (0.9 + depPunch * 2.1));
        setGridFrame(localTex.depShock, depPunch * 15, 4, 4);
        materials.depShock.opacity = (1 - depPunch) * 0.82;
      }
    }

    // ─── 2. VISIBLE SQUADRON LAUNCHING AHEAD OF MOON -> THROUGH PURPLE GATE ──
    let depFlashPeak = 0;
    let maxJet = 0;
    let maxStreak = 0;
    const laneLen = depGateOffset - depStartOffset;

    for (let i = 0; i < shipCount; i++) {
      const shipGrp = depShipRefs.current[i];
      const streakGrp = depStreakRefs.current[i];
      const [ox, oy, oz] = FORMATION_OFFSETS[i] ?? [0, 0, 0];
      const stagger = i * 0.17;
      const appearAt = 0.42 + stagger * 0.65;
      const snapAt = 1.56 + stagger; // exact moment this ship pierces the purple star membrane

      if (shipGrp) {
        const alive = t >= appearAt && t < snapAt + 0.14;
        shipGrp.visible = alive;
        if (alive) {
          const lt = t - appearAt;
          const cruiseSpan = Math.max(0.2, snapAt - appearAt);
          const u = clamp01(lt / cruiseSpan);
          // Smooth cruise-in from ahead of the moon, then hard warp acceleration into the gate
          const ease = u * 0.32 + u * u * u * 0.68;
          const along = t < snapAt
            ? depStartOffset + oz * depUnit * 0.42 + laneLen * ease
            : depGateOffset + depUnit * 19 * (t - snapAt);
          // Formation converges cleanly toward the portal throat right before entry
          const converge = 1 - 0.58 * smooth(0.58, 1.0, u);
          const fadeIn = smooth(0, 0.2, lt);
          shipGrp.position
            .copy(scratch.fromV)
            .addScaledVector(scratch.dir, along)
            .addScaledVector(scratch.side, ox * depUnit * 0.58 * converge)
            .addScaledVector(scratch.up, oy * depUnit * 0.58 * converge);
          shipGrp.quaternion.copy(scratch.shipFacing);

          const stretch = 1 + 19 * clamp01((t - (snapAt - 0.15)) / 0.22) ** 2;
          const slim = 1 / Math.sqrt(stretch);
          const s = depUnit * 0.48 * (0.45 + 0.55 * fadeIn);
          shipGrp.scale.set(s * slim, s * slim, s * stretch);
          maxJet = Math.max(maxJet, 0.55 + 0.45 * u);
        }
      }

      if (streakGrp) {
        const sinceSnap = t - (snapAt - 0.03);
        const a = sinceSnap >= 0 && sinceSnap < 0.8 ? (1 - sinceSnap / 0.8) ** 1.45 : 0;
        streakGrp.visible = a > 0.01;
        if (a > 0.01) {
          streakGrp.position
            .copy(scratch.gateDepPos)
            .addScaledVector(scratch.side, ox * depUnit * 0.22)
            .addScaledVector(scratch.up, oy * depUnit * 0.22);
          streakGrp.quaternion.copy(scratch.shipFacing);
          const streakLen = Math.min(totalDist * 0.42, depUnit * (5 + 16 * clamp01(sinceSnap / 0.2)));
          streakGrp.scale.set(depUnit * 0.28, depUnit * 0.28, streakLen);
          maxStreak = Math.max(maxStreak, a);
        }
      }

      if (t >= snapAt && t < snapAt + 0.34) {
        depFlashPeak = Math.max(depFlashPeak, (1 - (t - snapAt) / 0.34) ** 2);
      }
    }

    materials.jet.opacity = Math.max(maxJet, 0.45);
    materials.streak.opacity = Math.max(maxStreak, 0.2);
    if (depFlareRef.current) {
      depFlareRef.current.visible = depFlashPeak > 0.01;
      depFlareRef.current.position.copy(scratch.gateDepPos);
      depFlareRef.current.scale.setScalar(depUnit * (0.85 + 1.35 * depFlashPeak));
      materials.depFlare.opacity = depFlashPeak * 0.78;
    }

    // ─── 3. HYPERSPACE CONDUIT PULSE (1.5s -> 4.1s) ───────────────────────────
    const transit = (t - 1.5) / 2.1;
    const showConduit = transit > 0 && transit < 1.18;
    conduitLine.visible = showConduit;
    if (showConduit) {
      scratch.head.lerpVectors(scratch.gateDepPos, scratch.gateArrPos, clamp01(transit));
      scratch.tail.lerpVectors(scratch.gateDepPos, scratch.gateArrPos, clamp01(transit - 0.3));
      const posAttr = geometries.conduit.getAttribute('position') as THREE.BufferAttribute;
      posAttr.setXYZ(0, scratch.tail.x, scratch.tail.y, scratch.tail.z);
      posAttr.setXYZ(1, scratch.head.x, scratch.head.y, scratch.head.z);
      posAttr.needsUpdate = true;
      materials.conduit.opacity = smooth(0, 0.12, transit) * (1 - smooth(0.92, 1.18, transit)) * 0.88;
    }

    // ─── 4. PURPLE ASTRAL GATE AT DESTINATION MOON (2.8s -> 7.4s) ─────────────
    if (t >= 2.8) {
      arrStarted.current = true;
      if (t >= 5.7 && !arrStopped.current) {
        arrStopped.current = true;
        portals.arr.stop();
      }
      if (!portals.arr.finished) {
        portals.arr.update(dt);
      }
    }
    if (arrGateHostRef.current) {
      arrGateHostRef.current.visible = arrStarted.current && !portals.arr.finished;
      arrGateHostRef.current.position.copy(scratch.gateArrPos);
      arrGateHostRef.current.quaternion.copy(scratch.gateArrQuat);
      arrGateHostRef.current.scale.setScalar(arrUnit * 0.68);
    }

    const arrPunch = t >= 3.5 ? clamp01((t - 3.5) / 0.85) : -1;
    if (arrShockRef.current) {
      arrShockRef.current.visible = arrPunch >= 0 && arrPunch < 1;
      if (arrPunch >= 0 && arrPunch < 1) {
        arrShockRef.current.position.copy(scratch.gateArrPos);
        arrShockRef.current.quaternion.copy(scratch.backFacing);
        arrShockRef.current.scale.setScalar(arrUnit * (0.9 + arrPunch * 2.1));
        setGridFrame(localTex.arrShock, arrPunch * 15, 4, 4);
        materials.arrShock.opacity = (1 - arrPunch) * 0.82;
      }
    }

    let arrFlashPeak = 0;
    const arrSpan = arrGateOffset - arrStopOffset;
    for (let i = 0; i < shipCount; i++) {
      const shipGrp = arrShipRefs.current[i];
      const streakGrp = arrStreakRefs.current[i];
      const [ox, oy, oz] = FORMATION_OFFSETS[i] ?? [0, 0, 0];
      const emergeAt = 3.55 + i * 0.17;
      const doneAt = emergeAt + 1.85;

      if (shipGrp) {
        const alive = t >= emergeAt && t < doneAt;
        shipGrp.visible = alive;
        if (alive) {
          const et = t - emergeAt;
          const settle = 1 - Math.exp(-et * 2.6);
          const along = -arrGateOffset + arrSpan * settle + oz * arrUnit * 0.35;
          shipGrp.position
            .copy(scratch.toV)
            .addScaledVector(scratch.dir, along)
            .addScaledVector(scratch.side, ox * arrUnit * 0.55 * (0.35 + 0.65 * settle))
            .addScaledVector(scratch.up, oy * arrUnit * 0.55 * (0.35 + 0.65 * settle));
          shipGrp.quaternion.copy(scratch.shipFacing);

          const stretch = 1 + 17 * Math.max(0, 1 - et / 0.25) ** 2;
          const slim = 1 / Math.sqrt(stretch);
          const fadeOut = 1 - smooth(1.35, 1.85, et);
          const s = arrUnit * 0.48 * (0.35 + 0.65 * fadeOut);
          shipGrp.scale.set(s * slim, s * slim, s * stretch);
        }
      }

      if (streakGrp) {
        const et = t - (emergeAt - 0.2);
        const a = et >= 0 && et < 0.55 ? (et < 0.2 ? et / 0.2 : 1 - (et - 0.2) / 0.35) : 0;
        streakGrp.visible = a > 0.01;
        if (a > 0.01) {
          streakGrp.position
            .copy(scratch.gateArrPos)
            .addScaledVector(scratch.side, ox * arrUnit * 0.22)
            .addScaledVector(scratch.up, oy * arrUnit * 0.22);
          streakGrp.quaternion.copy(scratch.backFacing);
          streakGrp.scale.set(arrUnit * 0.28, arrUnit * 0.28, Math.min(totalDist * 0.36, arrUnit * 13));
        }
      }

      if (t >= emergeAt && t < emergeAt + 0.34) {
        arrFlashPeak = Math.max(arrFlashPeak, (1 - (t - emergeAt) / 0.34) ** 2);
      }
    }

    if (arrFlareRef.current) {
      arrFlareRef.current.visible = arrFlashPeak > 0.01;
      arrFlareRef.current.position.copy(scratch.gateArrPos);
      arrFlareRef.current.scale.setScalar(arrUnit * (0.85 + 1.35 * arrFlashPeak));
      materials.arrFlare.opacity = arrFlashPeak * 0.78;
    }

    invalidate();
  });

  const squadIndices = useMemo(() => Array.from({ length: shipCount }, (_, i) => i), [shipCount]);

  return (
    <group name={`moon-gate-warp-${event.id}`}>
      {/* Real Purple Gate of Astral Tracery at Origin Moon */}
      <group ref={depGateHostRef} visible={false}>
        <primitive object={portals.dep.group} />
      </group>
      <mesh ref={depShockRef} visible={false} renderOrder={7} material={materials.depShock}>
        <planeGeometry args={[1, 1]} />
      </mesh>
      <sprite ref={depFlareRef} visible={false} renderOrder={9} material={materials.depFlare} />

      {/* Departing squadron + directional warp streaks ahead of Origin Moon */}
      {squadIndices.map((idx) => (
        <group key={`dep-${idx}`}>
          <group ref={(el) => { depShipRefs.current[idx] = el; }} visible={false}>
            <CraftMesh
              fuselageGeo={geometries.fuselage}
              wingGeo={geometries.wing}
              hullMat={materials.hull}
              accentMat={materials.accent}
              jetMat={materials.jet}
            />
          </group>
          <group ref={(el) => { depStreakRefs.current[idx] = el; }} visible={false}>
            <group rotation={[0, -Math.PI / 2, 0]}>
              <mesh position={[0.5, 0, 0]} material={materials.streak} renderOrder={8}>
                <planeGeometry args={[1, 1]} />
              </mesh>
              <mesh rotation={[Math.PI / 2, 0, 0]} position={[0.5, 0, 0]} material={materials.streak} renderOrder={8}>
                <planeGeometry args={[1, 1]} />
              </mesh>
            </group>
          </group>
        </group>
      ))}

      {/* Hyperspace conduit connecting Origin Gate -> Destination Gate */}
      <primitive object={conduitLine} raycast={() => null} />

      {/* Real Purple Gate of Astral Tracery at Destination Moon */}
      <group ref={arrGateHostRef} visible={false}>
        <primitive object={portals.arr.group} />
      </group>
      <mesh ref={arrShockRef} visible={false} renderOrder={7} material={materials.arrShock}>
        <planeGeometry args={[1, 1]} />
      </mesh>
      <sprite ref={arrFlareRef} visible={false} renderOrder={9} material={materials.arrFlare} />

      {/* Emerging squadron + arrival warp streaks ahead of Destination Moon */}
      {squadIndices.map((idx) => (
        <group key={`arr-${idx}`}>
          <group ref={(el) => { arrShipRefs.current[idx] = el; }} visible={false}>
            <CraftMesh
              fuselageGeo={geometries.fuselage}
              wingGeo={geometries.wing}
              hullMat={materials.hull}
              accentMat={materials.accent}
              jetMat={materials.jet}
              jetScale={0.85}
            />
          </group>
          <group ref={(el) => { arrStreakRefs.current[idx] = el; }} visible={false}>
            <group rotation={[0, -Math.PI / 2, 0]}>
              <mesh position={[0.5, 0, 0]} material={materials.streak} renderOrder={8}>
                <planeGeometry args={[1, 1]} />
              </mesh>
              <mesh rotation={[Math.PI / 2, 0, 0]} position={[0.5, 0, 0]} material={materials.streak} renderOrder={8}>
                <planeGeometry args={[1, 1]} />
              </mesh>
            </group>
          </group>
        </group>
      ))}
    </group>
  );
}

export function MoonGateWarpFx({
  events,
  moons,
  nodes,
}: {
  readonly events: readonly MoonGateWarpEvent[];
  readonly moons?: GalaxyMoons | undefined;
  readonly nodes: readonly MoonHostRef[];
}) {
  const [createGate, setCreateGate] = useState<CreateAstralGateFn | null>(null);

  useEffect(() => {
    if (events.length === 0 || createGate !== null) return;
    let alive = true;
    void loadAstralGate().then((fn) => {
      if (alive) setCreateGate(() => fn);
    });
    return () => { alive = false; };
  }, [events.length, createGate]);

  const [jet, flare, shock] = useTexture([JET_TEX, FLARE_TEX, SHOCK_TEX]);

  const maps = useMemo<SharedMaps>(() => {
    for (const tex of [jet!, flare!, shock!]) {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.generateMipmaps = false;
      tex.minFilter = THREE.LinearFilter;
      tex.needsUpdate = true;
    }
    return { jet: jet!, flare: flare!, shock: shock! };
  }, [jet, flare, shock]);

  const nodeById = useMemo(() => {
    const map = new Map<string, MoonHostRef>();
    for (const node of nodes) map.set(node.id, node);
    return map;
  }, [nodes]);

  if (events.length === 0 || createGate === null) return null;

  return (
    <group name="moon-gate-warp-layer">
      {events.map((ev) => (
        <WarpSequence
          key={ev.id}
          event={ev}
          moons={moons}
          nodeById={nodeById}
          maps={maps}
          createGate={createGate}
        />
      ))}
    </group>
  );
}
