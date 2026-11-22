import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import type { MoonRarity } from '@astera/rules';
import type { GalaxyMoons } from '../api/schemas.js';
import { serverNow } from '../lib/clock.js';
import { moonOrbitPosition, moonRadiusFor } from './moonOrbit.js';

/*
  VFX BRIEF — Private Moon Gate Aperture & Directional Fleet Warp
  - Physical event: The commander opens a paired spatial gate on their moon, their squadron spools
    drives and launches straight along the vector toward the destination moon, stretching into
    hyper-light streaks as each vessel punches through the astral aperture and emerges at the
    receiving gate. Strictly client-local to the jumping commander (invisible to other players).
  - Assets:
    · `/assets/vfx/library/gate-ring-scifi.webp` — segmented Sci-Fi portal frame
    · `/assets/vfx/library/spiral-4x4.webp` — 16-frame swirling astral portal vortex
    · `/assets/vfx/library/electric-line-4x4.webp` — 16-frame rim discharge arcs
    · `/assets/vfx/library/sck-exhaust-jet.webp` — engine jets & directional hyper-warp light streaks
    · `/assets/vfx/library/flare-star.webp` — crisp star flash at warp snap
    · `/assets/vfx/library/white-shock-4x4.webp` — 16-frame spatial aperture shockwave
  - Zero radial gradient / soft glow sprites; 60fps only while active, zero cost when idle.
*/

const GATE_RING_TEX = '/assets/vfx/library/gate-ring-scifi.webp';
const SPIRAL_TEX = '/assets/vfx/library/spiral-4x4.webp';
const ARC_TEX = '/assets/vfx/library/electric-line-4x4.webp';
const JET_TEX = '/assets/vfx/library/sck-exhaust-jet.webp';
const FLARE_TEX = '/assets/vfx/library/flare-star.webp';
const SHOCK_TEX = '/assets/vfx/library/white-shock-4x4.webp';

export const MOON_WARP_DURATION_MS = 6_200;

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

const RARITY_ACCENT: Record<MoonRarity, string> = {
  COMMON: '#bae6fd',
  RARE: '#38bdf8',
  EPIC: '#c084fc',
  LEGENDARY: '#fbbf24',
};

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
  ring: THREE.Texture;
  spiral: THREE.Texture;
  arc: THREE.Texture;
  jet: THREE.Texture;
  flare: THREE.Texture;
  shock: THREE.Texture;
}

interface PortalRigProps {
  readonly event: MoonGateWarpEvent;
  readonly moons: GalaxyMoons | undefined;
  readonly nodeById: ReadonlyMap<string, MoonHostRef>;
  readonly maps: SharedMaps;
}

const MAX_SQUAD = 6;
const FORMATION_OFFSETS: readonly (readonly [number, number, number])[] = [
  [0, 0, 0],
  [-0.55, 0.14, -0.35],
  [0.55, -0.1, -0.35],
  [-0.95, -0.18, -0.7],
  [0.95, 0.18, -0.7],
  [0, 0.32, -0.85],
];

/** Single private warp sequence: Origin Gate unfold -> directional squadron warp -> conduit pulse -> Destination Gate arrival. */
function WarpSequence({ event, moons, nodeById, maps }: PortalRigProps) {
  const invalidate = useThree((s) => s.invalidate);
  const shipCount = Math.max(2, Math.min(MAX_SQUAD, Math.ceil(Math.sqrt(Math.max(1, event.shipCount)))));
  const accentHex = RARITY_ACCENT[event.rarity];

  // Cloned flipbook textures so each portal sequence animates its own UVs cleanly.
  const localTex = useMemo(() => {
    const depSpiral = maps.spiral.clone();
    depSpiral.repeat.set(0.25, 0.25);
    depSpiral.needsUpdate = true;

    const arrSpiral = maps.spiral.clone();
    arrSpiral.repeat.set(0.25, 0.25);
    arrSpiral.needsUpdate = true;

    const depArc = maps.arc.clone();
    depArc.repeat.set(0.25, 0.25);
    depArc.needsUpdate = true;

    const arrArc = maps.arc.clone();
    arrArc.repeat.set(0.25, 0.25);
    arrArc.needsUpdate = true;

    const depShock = maps.shock.clone();
    depShock.repeat.set(0.25, 0.25);
    depShock.needsUpdate = true;

    const arrShock = maps.shock.clone();
    arrShock.repeat.set(0.25, 0.25);
    arrShock.needsUpdate = true;

    return { depSpiral, arrSpiral, depArc, arrArc, depShock, arrShock };
  }, [maps]);

  // Procedural dart-like chevron ship geometry (crisp spacecraft silhouette, 1 shared geometry, zero GLB load stall).
  const craftGeo = useMemo(() => {
    const geo = new THREE.ConeGeometry(0.18, 0.72, 4);
    geo.rotateX(Math.PI / 2);
    geo.scale(1.15, 0.42, 1);
    return geo;
  }, []);

  const conduitGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    return geo;
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
      depRingOuter: mk(maps.ring, accentHex),
      depRingInner: mk(maps.ring, '#e0f2fe'),
      depSpiral: mk(localTex.depSpiral, '#7dd3fc'),
      depArc: mk(localTex.depArc, '#e0f2fe'),
      depShock: mk(localTex.depShock, '#bae6fd'),
      arrRingOuter: mk(maps.ring, accentHex),
      arrRingInner: mk(maps.ring, '#e0f2fe'),
      arrSpiral: mk(localTex.arrSpiral, '#7dd3fc'),
      arrArc: mk(localTex.arrArc, '#e0f2fe'),
      arrShock: mk(localTex.arrShock, '#bae6fd'),
      hull: new THREE.MeshBasicMaterial({ color: '#e2f1ff', transparent: true, opacity: 1, toneMapped: false }),
      jet: mk(maps.jet, '#7dd3fc'),
      streak: mk(maps.jet, '#f0f9ff'),
      flare: new THREE.SpriteMaterial({
        map: maps.flare,
        color: '#ffffff',
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
      arrFlare: new THREE.SpriteMaterial({
        map: maps.flare,
        color: '#ffffff',
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
      conduit: new THREE.LineBasicMaterial({
        color: accentHex,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
      conduitCore: new THREE.LineBasicMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    };
  }, [maps, localTex, accentHex]);

  const conduitLine = useMemo(() => {
    const line = new THREE.Line(conduitGeo, materials.conduit);
    line.visible = false;
    line.frustumCulled = false;
    return line;
  }, [conduitGeo, materials.conduit]);

  useEffect(() => () => {
    craftGeo.dispose();
    conduitGeo.dispose();
    Object.values(localTex).forEach((t) => { t.dispose(); });
    Object.values(materials).forEach((m) => { m.dispose(); });
  }, [craftGeo, conduitGeo, localTex, materials]);

  // Refs for transforms updated per frame (zero React rerenders in loop).
  const depGateRef = useRef<THREE.Group>(null);
  const depOuterRef = useRef<THREE.Mesh>(null);
  const depInnerRef = useRef<THREE.Mesh>(null);
  const depSpiralRef = useRef<THREE.Mesh>(null);
  const depArcRef = useRef<THREE.Mesh>(null);
  const depShockRef = useRef<THREE.Mesh>(null);
  const depFlareRef = useRef<THREE.Sprite>(null);

  const arrGateRef = useRef<THREE.Group>(null);
  const arrOuterRef = useRef<THREE.Mesh>(null);
  const arrInnerRef = useRef<THREE.Mesh>(null);
  const arrSpiralRef = useRef<THREE.Mesh>(null);
  const arrArcRef = useRef<THREE.Mesh>(null);
  const arrShockRef = useRef<THREE.Mesh>(null);
  const arrFlareRef = useRef<THREE.Sprite>(null);

  const depShipRefs = useRef<(THREE.Group | null)[]>([]);
  const depStreakRefs = useRef<(THREE.Group | null)[]>([]);
  const arrShipRefs = useRef<(THREE.Group | null)[]>([]);
  const arrStreakRefs = useRef<(THREE.Group | null)[]>([]);

  // Per-frame scratch vectors (never allocated in useFrame).
  const scratch = useMemo(() => ({
    originParent: { x: 0, y: 0, z: 0 },
    destParent: { x: 0, y: 0, z: 0 },
    originMoon: { x: 0, y: 0, z: 0 },
    destMoon: { x: 0, y: 0, z: 0 },
    fromV: new THREE.Vector3(),
    toV: new THREE.Vector3(),
    dir: new THREE.Vector3(),
    side: new THREE.Vector3(),
    up: new THREE.Vector3(),
    facing: new THREE.Quaternion(),
    backFacing: new THREE.Quaternion(),
    gateDepPos: new THREE.Vector3(),
    gateArrPos: new THREE.Vector3(),
    tmp: new THREE.Vector3(),
    head: new THREE.Vector3(),
    tail: new THREE.Vector3(),
  }), []);

  useFrame(() => {
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

    const fromSeed = fromMoon?.visualSeed ?? 1;
    const toSeed = toMoon?.visualSeed ?? 2;
    const fromR = moonRadiusFor(fromNode.radius, moons?.rarity[event.fromPlanetId] ?? event.rarity);
    const toR = moonRadiusFor(toNode.radius, moons?.rarity[event.toPlanetId]);

    scratch.originParent.x = fromNode.position[0];
    scratch.originParent.y = fromNode.position[1];
    scratch.originParent.z = fromNode.position[2];
    moonOrbitPosition(scratch.originParent, fromNode.radius, fromSeed, timeSec, scratch.originMoon);

    scratch.destParent.x = toNode.position[0];
    scratch.destParent.y = toNode.position[1];
    scratch.destParent.z = toNode.position[2];
    moonOrbitPosition(scratch.destParent, toNode.radius, toSeed, timeSec, scratch.destMoon);

    scratch.fromV.set(scratch.originMoon.x, scratch.originMoon.y, scratch.originMoon.z);
    scratch.toV.set(scratch.destMoon.x, scratch.destMoon.y, scratch.destMoon.z);
    scratch.dir.subVectors(scratch.toV, scratch.fromV);
    const totalDist = scratch.dir.length();
    if (totalDist < 0.001) return;
    scratch.dir.divideScalar(totalDist);

    // Build orthonormal basis pointing from origin moon -> destination moon.
    const refUp = Math.abs(scratch.dir.y) > 0.92 ? ALT_UP : UP_AXIS;
    scratch.side.crossVectors(scratch.dir, refUp).normalize();
    scratch.up.crossVectors(scratch.side, scratch.dir).normalize();
    scratch.facing.setFromUnitVectors(Z_AXIS, scratch.dir);
    scratch.backFacing.setFromUnitVectors(Z_AXIS, scratch.tmp.copy(scratch.dir).negate());

    // Visual scale tuned so both close-up moon inspection AND mid/wide disc views clearly read the gate & warp!
    const depUnit = Math.max(fromR * 3.4, fromNode.radius * 0.95);
    const arrUnit = Math.max(toR * 3.4, toNode.radius * 0.95);
    scratch.gateDepPos.copy(scratch.fromV).addScaledVector(scratch.dir, depUnit * 1.45);
    scratch.gateArrPos.copy(scratch.toV).addScaledVector(scratch.dir, -arrUnit * 1.45);

    // ─── 1. DEPARTURE GATE (0.0s -> 3.6s) ─────────────────────────────────────
    const depOpen = smooth(0.0, 0.55, t) * (1 - smooth(2.65, 3.55, t));
    if (depGateRef.current) {
      depGateRef.current.visible = depOpen > 0.005;
      depGateRef.current.position.copy(scratch.gateDepPos);
      depGateRef.current.quaternion.copy(scratch.facing);
      const aperture = depUnit * (0.25 + 1.55 * depOpen);
      depGateRef.current.scale.setScalar(aperture);
    }
    materials.depRingOuter.opacity = depOpen * 0.95;
    materials.depRingInner.opacity = depOpen * 0.85;
    materials.depSpiral.opacity = depOpen * 0.92;
    materials.depArc.opacity = depOpen > 0.2 ? depOpen * (0.55 + 0.45 * Math.abs(Math.sin(t * 23))) : 0;
    if (depOuterRef.current) depOuterRef.current.rotation.z = t * 1.1;
    if (depInnerRef.current) depInnerRef.current.rotation.z = -t * 1.85;
    if (depSpiralRef.current) depSpiralRef.current.rotation.z = t * 2.6;
    if (depArcRef.current) depArcRef.current.rotation.z = Math.floor(t * 14) * 1.17;
    setGridFrame(localTex.depSpiral, (t * 18) % 16, 4, 4);
    setGridFrame(localTex.depArc, (t * 24) % 16, 4, 4);

    // Departure shock & star flare peak when lead ships punch through the gate (~1.15s)
    const depPunch = t >= 1.05 ? clamp01((t - 1.05) / 0.95) : -1;
    if (depShockRef.current) {
      depShockRef.current.visible = depPunch >= 0 && depPunch < 1;
      const shockScale = 0.7 + depPunch * 2.1;
      depShockRef.current.scale.setScalar(shockScale);
      materials.depShock.opacity = depPunch >= 0 ? (1 - depPunch) * 0.9 : 0;
      if (depPunch >= 0) setGridFrame(localTex.depShock, depPunch * 15, 4, 4);
    }
    let depFlashPeak = 0;

    // ─── 2. DIRECTIONAL DEPARTING SQUADRON (0.35s -> 2.8s) ───────────────────
    let maxJet = 0;
    let maxStreak = 0;
    for (let i = 0; i < shipCount; i++) {
      const shipGrp = depShipRefs.current[i];
      const streakGrp = depStreakRefs.current[i];
      const [ox, oy, oz] = FORMATION_OFFSETS[i] ?? [0, 0, 0];
      const stagger = i * 0.14;
      const launchAt = 0.35 + stagger;
      const snapAt = 1.18 + stagger; // exact instant ship hits the gate and warps

      if (shipGrp) {
        const alive = t >= launchAt && t < snapAt + 0.14;
        shipGrp.visible = alive;
        if (alive) {
          const lt = t - launchAt;
          const span = snapAt - launchAt;
          const pre = clamp01(lt / span);
          // Smooth spool -> aggressive acceleration straight toward the open gate along `dir`
          const along = t < snapAt
            ? depUnit * (oz * 0.75 + 0.15 + (1.3 * pre * pre * pre))
            : depUnit * (oz * 0.75 + 1.45 + 18 * (t - snapAt));
          const spread = 1 - 0.55 * smooth(0.5, 1.0, pre);
          shipGrp.position
            .copy(scratch.fromV)
            .addScaledVector(scratch.dir, along)
            .addScaledVector(scratch.side, ox * depUnit * 0.65 * spread)
            .addScaledVector(scratch.up, oy * depUnit * 0.65 * spread);
          shipGrp.quaternion.copy(scratch.facing);

          // Warp stretch right before & across the gate snap (FleetWarp language)
          const stretch = 1 + 20 * clamp01((t - (snapAt - 0.14)) / 0.22) ** 2;
          const slim = 1 / Math.sqrt(stretch);
          const s = depUnit * 0.42;
          shipGrp.scale.set(s * slim, s * slim, s * stretch);
          maxJet = Math.max(maxJet, 0.45 + 0.55 * pre);
        }
      }

      if (streakGrp) {
        const sinceSnap = t - (snapAt - 0.04);
        const streakAlpha = sinceSnap >= 0 && sinceSnap < 0.75 ? (1 - sinceSnap / 0.75) ** 1.5 : 0;
        streakGrp.visible = streakAlpha > 0.01;
        if (streakAlpha > 0.01) {
          streakGrp.position
            .copy(scratch.gateDepPos)
            .addScaledVector(scratch.side, ox * depUnit * 0.28)
            .addScaledVector(scratch.up, oy * depUnit * 0.28);
          streakGrp.quaternion.copy(scratch.facing);
          const streakLen = Math.min(totalDist * 0.42, depUnit * (6 + 18 * clamp01(sinceSnap / 0.22)));
          streakGrp.scale.set(depUnit * 0.32, depUnit * 0.32, streakLen);
          maxStreak = Math.max(maxStreak, streakAlpha);
        }
      }

      if (t >= snapAt && t < snapAt + 0.38) {
        depFlashPeak = Math.max(depFlashPeak, (1 - (t - snapAt) / 0.38) ** 2);
      }
    }

    materials.jet.opacity = Math.max(maxJet, 0.35);
    materials.streak.opacity = Math.max(maxStreak, 0.15);
    if (depFlareRef.current) {
      depFlareRef.current.visible = depFlashPeak > 0.01;
      depFlareRef.current.position.copy(scratch.gateDepPos);
      depFlareRef.current.scale.setScalar(depUnit * (0.9 + 1.5 * depFlashPeak));
      materials.flare.opacity = depFlashPeak * 0.85;
    }

    // ─── 3. HYPERSPACE CONDUIT PACKET (1.1s -> 3.4s, origin -> destination) ──
    const transit = (t - 1.1) / 1.9;
    const showConduit = transit > 0 && transit < 1.18;
    conduitLine.visible = showConduit;
    if (showConduit) {
      const headFrac = clamp01(transit);
      const tailFrac = clamp01(transit - 0.28);
      scratch.head.lerpVectors(scratch.gateDepPos, scratch.gateArrPos, headFrac);
      scratch.tail.lerpVectors(scratch.gateDepPos, scratch.gateArrPos, tailFrac);
      const posAttr = conduitGeo.getAttribute('position') as THREE.BufferAttribute;
      posAttr.setXYZ(0, scratch.tail.x, scratch.tail.y, scratch.tail.z);
      posAttr.setXYZ(1, scratch.head.x, scratch.head.y, scratch.head.z);
      posAttr.needsUpdate = true;
      const fade = smooth(0, 0.12, transit) * (1 - smooth(0.92, 1.18, transit));
      materials.conduit.opacity = fade * 0.92;
    }

    // ─── 4. DESTINATION ARRIVAL GATE & EMERGING SQUADRON (2.5s -> 6.0s) ──────
    const arrOpen = smooth(2.45, 2.95, t) * (1 - smooth(4.95, 5.95, t));
    if (arrGateRef.current) {
      arrGateRef.current.visible = arrOpen > 0.005;
      arrGateRef.current.position.copy(scratch.gateArrPos);
      arrGateRef.current.quaternion.copy(scratch.backFacing);
      const aperture = arrUnit * (0.25 + 1.55 * arrOpen);
      arrGateRef.current.scale.setScalar(aperture);
    }
    materials.arrRingOuter.opacity = arrOpen * 0.95;
    materials.arrRingInner.opacity = arrOpen * 0.85;
    materials.arrSpiral.opacity = arrOpen * 0.92;
    materials.arrArc.opacity = arrOpen > 0.2 ? arrOpen * (0.55 + 0.45 * Math.abs(Math.sin(t * 25 + 1.3))) : 0;
    if (arrOuterRef.current) arrOuterRef.current.rotation.z = -t * 1.15;
    if (arrInnerRef.current) arrInnerRef.current.rotation.z = t * 1.9;
    if (arrSpiralRef.current) arrSpiralRef.current.rotation.z = -t * 2.6;
    if (arrArcRef.current) arrArcRef.current.rotation.z = Math.floor(t * 14 + 3) * 1.31;
    setGridFrame(localTex.arrSpiral, 15 - ((t * 18) % 16), 4, 4);
    setGridFrame(localTex.arrArc, (t * 24 + 5) % 16, 4, 4);

    const arrPunch = t >= 2.9 ? clamp01((t - 2.9) / 0.95) : -1;
    if (arrShockRef.current) {
      arrShockRef.current.visible = arrPunch >= 0 && arrPunch < 1;
      arrShockRef.current.scale.setScalar(0.7 + arrPunch * 2.1);
      materials.arrShock.opacity = arrPunch >= 0 ? (1 - arrPunch) * 0.9 : 0;
      if (arrPunch >= 0) setGridFrame(localTex.arrShock, arrPunch * 15, 4, 4);
    }

    let arrFlashPeak = 0;
    for (let i = 0; i < shipCount; i++) {
      const shipGrp = arrShipRefs.current[i];
      const streakGrp = arrStreakRefs.current[i];
      const [ox, oy, oz] = FORMATION_OFFSETS[i] ?? [0, 0, 0];
      const emergeAt = 2.92 + i * 0.14;
      const doneAt = emergeAt + 1.55;

      if (shipGrp) {
        const alive = t >= emergeAt && t < doneAt;
        shipGrp.visible = alive;
        if (alive) {
          const et = t - emergeAt;
          const settle = 1 - Math.exp(-et * 3.1);
          // Burst out of the receiving gate toward the destination moon and brake into orbit
          const along = -arrUnit * (1.45 - 1.35 * settle) + oz * arrUnit * 0.3;
          shipGrp.position
            .copy(scratch.toV)
            .addScaledVector(scratch.dir, along)
            .addScaledVector(scratch.side, ox * arrUnit * 0.55 * (0.35 + 0.65 * settle))
            .addScaledVector(scratch.up, oy * arrUnit * 0.55 * (0.35 + 0.65 * settle));
          shipGrp.quaternion.copy(scratch.facing);

          const stretch = 1 + 18 * Math.max(0, 1 - et / 0.24) ** 2;
          const slim = 1 / Math.sqrt(stretch);
          const fadeOut = 1 - smooth(1.15, 1.55, et);
          const s = arrUnit * 0.42 * (0.4 + 0.6 * fadeOut);
          shipGrp.scale.set(s * slim, s * slim, s * stretch);
        }
      }

      if (streakGrp) {
        const et = t - (emergeAt - 0.22);
        const a = et >= 0 && et < 0.55 ? (et < 0.22 ? et / 0.22 : 1 - (et - 0.22) / 0.33) : 0;
        streakGrp.visible = a > 0.01;
        if (a > 0.01) {
          streakGrp.position
            .copy(scratch.gateArrPos)
            .addScaledVector(scratch.side, ox * arrUnit * 0.25)
            .addScaledVector(scratch.up, oy * arrUnit * 0.25);
          streakGrp.quaternion.copy(scratch.backFacing);
          streakGrp.scale.set(arrUnit * 0.32, arrUnit * 0.32, Math.min(totalDist * 0.38, arrUnit * 14));
        }
      }

      if (t >= emergeAt && t < emergeAt + 0.38) {
        arrFlashPeak = Math.max(arrFlashPeak, (1 - (t - emergeAt) / 0.38) ** 2);
      }
    }

    if (arrFlareRef.current) {
      arrFlareRef.current.visible = arrFlashPeak > 0.01;
      arrFlareRef.current.position.copy(scratch.gateArrPos);
      arrFlareRef.current.scale.setScalar(arrUnit * (0.9 + 1.5 * arrFlashPeak));
      materials.arrFlare.opacity = arrFlashPeak * 0.85;
    }

    invalidate();
  });

  const squadIndices = useMemo(() => Array.from({ length: shipCount }, (_, i) => i), [shipCount]);

  return (
    <group name={`moon-gate-warp-${event.id}`}>
      {/* Departure Astral Gate at Origin Moon */}
      <group ref={depGateRef} visible={false}>
        <mesh ref={depOuterRef} renderOrder={4} material={materials.depRingOuter}>
          <planeGeometry args={[1.35, 1.35]} />
        </mesh>
        <mesh ref={depInnerRef} renderOrder={4} material={materials.depRingInner}>
          <planeGeometry args={[0.92, 0.92]} />
        </mesh>
        <mesh ref={depSpiralRef} renderOrder={5} material={materials.depSpiral}>
          <planeGeometry args={[1.18, 1.18]} />
        </mesh>
        <mesh ref={depArcRef} renderOrder={6} material={materials.depArc}>
          <planeGeometry args={[1.42, 1.42]} />
        </mesh>
        <mesh ref={depShockRef} visible={false} renderOrder={6} material={materials.depShock}>
          <planeGeometry args={[1.25, 1.25]} />
        </mesh>
      </group>
      <sprite ref={depFlareRef} visible={false} renderOrder={8} material={materials.flare} />

      {/* Departing squadron + directional warp streaks */}
      {squadIndices.map((idx) => (
        <group key={`dep-${idx}`}>
          <group
            ref={(el) => { depShipRefs.current[idx] = el; }}
            visible={false}
          >
            <mesh geometry={craftGeo} material={materials.hull} renderOrder={6} />
            {/* Crossed engine exhaust jet cards behind stern */}
            <group position={[0, 0, -0.42]} rotation={[0, Math.PI / 2, 0]} scale={[1.05, 0.36, 1]}>
              <mesh position={[0.5, 0, 0]} material={materials.jet} renderOrder={6}>
                <planeGeometry args={[1, 1]} />
              </mesh>
              <mesh rotation={[Math.PI / 2, 0, 0]} position={[0.5, 0, 0]} material={materials.jet} renderOrder={6}>
                <planeGeometry args={[1, 1]} />
              </mesh>
            </group>
          </group>
          {/* Directional hyper-warp light streak shooting forward along `dir` */}
          <group
            ref={(el) => { depStreakRefs.current[idx] = el; }}
            visible={false}
          >
            <group rotation={[0, -Math.PI / 2, 0]}>
              <mesh position={[0.5, 0, 0]} material={materials.streak} renderOrder={7}>
                <planeGeometry args={[1, 1]} />
              </mesh>
              <mesh rotation={[Math.PI / 2, 0, 0]} position={[0.5, 0, 0]} material={materials.streak} renderOrder={7}>
                <planeGeometry args={[1, 1]} />
              </mesh>
            </group>
          </group>
        </group>
      ))}

      {/* Hyperspace conduit streak connecting Origin Moon -> Destination Moon */}
      <primitive object={conduitLine} raycast={() => null} />

      {/* Arrival Astral Gate at Destination Moon */}
      <group ref={arrGateRef} visible={false}>
        <mesh ref={arrOuterRef} renderOrder={4} material={materials.arrRingOuter}>
          <planeGeometry args={[1.35, 1.35]} />
        </mesh>
        <mesh ref={arrInnerRef} renderOrder={4} material={materials.arrRingInner}>
          <planeGeometry args={[0.92, 0.92]} />
        </mesh>
        <mesh ref={arrSpiralRef} renderOrder={5} material={materials.arrSpiral}>
          <planeGeometry args={[1.18, 1.18]} />
        </mesh>
        <mesh ref={arrArcRef} renderOrder={6} material={materials.arrArc}>
          <planeGeometry args={[1.42, 1.42]} />
        </mesh>
        <mesh ref={arrShockRef} visible={false} renderOrder={6} material={materials.arrShock}>
          <planeGeometry args={[1.25, 1.25]} />
        </mesh>
      </group>
      <sprite ref={arrFlareRef} visible={false} renderOrder={8} material={materials.arrFlare} />

      {/* Emerging squadron + arrival warp streaks */}
      {squadIndices.map((idx) => (
        <group key={`arr-${idx}`}>
          <group
            ref={(el) => { arrShipRefs.current[idx] = el; }}
            visible={false}
          >
            <mesh geometry={craftGeo} material={materials.hull} renderOrder={6} />
            <group position={[0, 0, -0.42]} rotation={[0, Math.PI / 2, 0]} scale={[0.9, 0.32, 1]}>
              <mesh position={[0.5, 0, 0]} material={materials.jet} renderOrder={6}>
                <planeGeometry args={[1, 1]} />
              </mesh>
              <mesh rotation={[Math.PI / 2, 0, 0]} position={[0.5, 0, 0]} material={materials.jet} renderOrder={6}>
                <planeGeometry args={[1, 1]} />
              </mesh>
            </group>
          </group>
          <group
            ref={(el) => { arrStreakRefs.current[idx] = el; }}
            visible={false}
          >
            <group rotation={[0, -Math.PI / 2, 0]}>
              <mesh position={[0.5, 0, 0]} material={materials.streak} renderOrder={7}>
                <planeGeometry args={[1, 1]} />
              </mesh>
              <mesh rotation={[Math.PI / 2, 0, 0]} position={[0.5, 0, 0]} material={materials.streak} renderOrder={7}>
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
  const [ring, spiral, arc, jet, flare, shock] = useTexture([
    GATE_RING_TEX,
    SPIRAL_TEX,
    ARC_TEX,
    JET_TEX,
    FLARE_TEX,
    SHOCK_TEX,
  ]);

  const maps = useMemo<SharedMaps>(() => {
    for (const tex of [ring!, spiral!, arc!, jet!, flare!, shock!]) {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.generateMipmaps = false;
      tex.minFilter = THREE.LinearFilter;
      tex.needsUpdate = true;
    }
    return { ring: ring!, spiral: spiral!, arc: arc!, jet: jet!, flare: flare!, shock: shock! };
  }, [ring, spiral, arc, jet, flare, shock]);

  const nodeById = useMemo(() => {
    const map = new Map<string, MoonHostRef>();
    for (const node of nodes) map.set(node.id, node);
    return map;
  }, [nodes]);

  if (events.length === 0) return null;

  return (
    <group name="moon-gate-warp-layer">
      {events.map((ev) => (
        <WarpSequence
          key={ev.id}
          event={ev}
          moons={moons}
          nodeById={nodeById}
          maps={maps}
        />
      ))}
    </group>
  );
}
