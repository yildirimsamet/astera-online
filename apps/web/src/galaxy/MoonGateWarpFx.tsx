import { Component, Suspense, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import type { MoonRarity } from '@astera/rules';
import type { GalaxyMoons } from '../api/schemas.js';
import { serverNow } from '../lib/clock.js';
import { haptic } from '../lib/haptics.js';
import { playSound } from '../lib/sound.js';
import { HULL_MODEL } from '../ui/assets.js';
import createAstralGate, { type AstralGateInstance } from '../vfx/astralGate.js';
import { moonClearStagingDirection, moonOrbitPosition, moonRadiusFor } from './moonOrbit.js';

/*
  VFX BRIEF — Private Purple Astral Gate & Directional Moon Fleet Warp (Paket D)
  - Physical event: The commander opens a paired purple Gate of Astral Tracery (`astralGate.ts`,
    #c1b8ff) cleanly outside the moon & Dyson shell exclusion sphere along the jump vector.
    Real Astera GLB starcraft form up in V-wedge ahead of the moon, glide visibly into the open
    violet star-membrane portal, and punch through one-by-one — stretching into crisp violet-cyan
    hyper-light spears along a volumetric hyperspace conduit to the destination moon, where the
    camera pans over as the paired Astral Gate opens and receives the squadron.
  - Privacy: Strictly client-local to the jumping commander (never broadcast to other players).
  - Assets:
    · `src/vfx/astralGate.ts` (lean synchronous Gate of Astral Tracery, ~6 KB)
    · `HULL_MODEL.DART` (real GLB starcraft silhouette, fallback to sculpted delta hull)
    · `/assets/vfx/library/sck-exhaust-jet.webp` — thruster plumes, warp spears & volumetric conduit
    · `/assets/vfx/library/flare-star.webp` — crisp warp snap star flare
    · `/assets/vfx/library/white-shock-4x4.webp` — 16-frame aperture ripple at warp punch-through
  - Zero radial gradient / soft glow sprites; 60fps only while active.
*/

const JET_TEX = '/assets/vfx/library/sck-exhaust-jet.webp';
const FLARE_TEX = '/assets/vfx/library/flare-star.webp';
const SHOCK_TEX = '/assets/vfx/library/white-shock-4x4.webp';

useTexture.preload(JET_TEX);
useTexture.preload(FLARE_TEX);
useTexture.preload(SHOCK_TEX);

export const MOON_WARP_DURATION_MS = 8_600;

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

/** Measured center Y of `utility-gate-frame` / `utility-star-membrane` in `astralGate.ts` at size=1. */
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

const MAX_SQUAD = 6;
/** Clean V-wedge formation spread in clear space ahead of the moon so every ship reads individually. */
const FORMATION_OFFSETS: readonly (readonly [number, number, number])[] = [
  [0, 0.04, 0],
  [-0.64, 0.12, -0.34],
  [0.64, -0.08, -0.34],
  [-1.16, -0.14, -0.68],
  [1.16, 0.16, -0.68],
  [0, 0.36, -0.84],
];

class ModelGuard extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } { return { failed: true }; }
  override render(): ReactNode { return this.state.failed ? this.props.fallback : this.props.children; }
}

/** Real Astera GLB starcraft normalized to 1 unit down +Z with bright warp silhouette lighting. */
function GlbCraftModel() {
  const { scene } = useGLTF(HULL_MODEL.DART, false);
  const clone = useMemo(() => {
    const root = scene.clone(true);
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const maxDim = Math.max(0.001, size.x, size.y, size.z);
    const s = 1.15 / maxDim;
    root.scale.setScalar(s);
    root.position.set(-center.x * s, -center.y * s, -center.z * s);
    root.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.renderOrder = 7;
        const orig = obj.material as THREE.Material | THREE.Material[];
        const brighten = (m: THREE.Material): THREE.Material => {
          const c = m.clone();
          if ('emissive' in c && c.emissive instanceof THREE.Color) {
            c.emissive.set('#6366f1');
            if ('emissiveIntensity' in c) (c as THREE.MeshStandardMaterial).emissiveIntensity = 0.55;
          }
          return c;
        };
        obj.material = Array.isArray(orig) ? orig.map(brighten) : brighten(orig);
      }
    });
    return root;
  }, [scene]);

  useEffect(() => () => {
    clone.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        const mat = obj.material as THREE.Material | THREE.Material[];
        if (Array.isArray(mat)) mat.forEach((m) => { m.dispose(); });
        else mat.dispose();
      }
    });
  }, [clone]);

  return <primitive object={clone} />;
}

/** Fallback sleek swept-wing spacecraft mesh (body + delta wing) if GLB is still streaming. */
function FallbackCraftHull({
  fuselageGeo,
  wingGeo,
  hullMat,
  accentMat,
}: {
  readonly fuselageGeo: THREE.BufferGeometry;
  readonly wingGeo: THREE.BufferGeometry;
  readonly hullMat: THREE.Material;
  readonly accentMat: THREE.Material;
}) {
  return (
    <>
      <mesh geometry={fuselageGeo} material={hullMat} renderOrder={7} />
      <mesh geometry={wingGeo} position={[0, -0.02, -0.12]} material={accentMat} renderOrder={7} />
    </>
  );
}

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
  const fallback = (
    <FallbackCraftHull
      fuselageGeo={fuselageGeo}
      wingGeo={wingGeo}
      hullMat={hullMat}
      accentMat={accentMat}
    />
  );
  return (
    <>
      <ModelGuard fallback={fallback}>
        <Suspense fallback={fallback}>
          <GlbCraftModel />
        </Suspense>
      </ModelGuard>
      {/* Crossed thruster plume cards behind the stern */}
      <group position={[0, 0, -0.52]} rotation={[0, Math.PI / 2, 0]} scale={[1.45 * jetScale, 0.48 * jetScale, 1]}>
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
  onArriveCamera,
}: {
  readonly event: MoonGateWarpEvent;
  readonly moons: GalaxyMoons | undefined;
  readonly nodeById: ReadonlyMap<string, MoonHostRef>;
  readonly maps: SharedMaps;
  readonly onArriveCamera?: ((toPlanetId: string) => void) | undefined;
}) {
  const invalidate = useThree((s) => s.invalidate);
  const shipCount = Math.max(3, Math.min(MAX_SQUAD, Math.ceil(Math.sqrt(Math.max(1, event.shipCount)))));

  // Instantiate two real purple Gate of Astral Tracery portals synchronously (zero lazy-load delay!).
  const portals = useMemo(() => {
    const dep: AstralGateInstance = createAstralGate({
      size: 1,
      speed: 1.15,
      detail: 1,
      color: ASTRAL_GATE_PURPLE,
      density: 0.7,
    });
    const arr: AstralGateInstance = createAstralGate({
      size: 1,
      speed: 1.15,
      detail: 1,
      color: ASTRAL_GATE_PURPLE,
      density: 0.7,
    });
    // Center the upright arch at local origin so ships fly directly through the star membrane.
    dep.group.position.set(0, -ASTRAL_GATE_CENTER_Y, 0);
    arr.group.position.set(0, -ASTRAL_GATE_CENTER_Y, 0);
    // If mounted mid-sequence, fast-forward departure gate to current clock
    const elapsedSec = Math.max(0, (serverNow() - event.startedAtMs) / 1_000);
    if (elapsedSec > 0.05) dep.update(Math.min(elapsedSec, 3.2));
    return { dep, arr };
  }, [event.startedAtMs]);

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
    const fuselage = new THREE.ConeGeometry(0.2, 0.95, 5);
    fuselage.rotateX(Math.PI / 2);
    fuselage.scale(1.0, 0.45, 1.0);

    const wing = new THREE.ConeGeometry(0.52, 0.56, 3);
    wing.rotateX(Math.PI / 2);
    wing.scale(1.15, 0.08, 0.9);

    return { fuselage, wing };
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
      conduit: mk(maps.jet, '#c4b5fd'),
      conduitCore: mk(maps.jet, '#f5f3ff'),
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
    };
  }, [maps, localTex]);

  useEffect(() => () => {
    portals.dep.dispose();
    portals.arr.dispose();
    geometries.fuselage.dispose();
    geometries.wing.dispose();
    localTex.depShock.dispose();
    localTex.arrShock.dispose();
    Object.values(materials).forEach((m) => { m.dispose(); });
  }, [portals, geometries, localTex, materials]);

  const depGateHostRef = useRef<THREE.Group>(null);
  const depShockRef = useRef<THREE.Mesh>(null);
  const depFlareRef = useRef<THREE.Sprite>(null);

  const conduitRef = useRef<THREE.Group>(null);

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
  const cameraPanned = useRef(false);
  const soundPlayed = useRef({ open: false, warp: false, arrive: false });

  const scratch = useMemo(() => ({
    originParent: { x: 0, y: 0, z: 0 },
    destParent: { x: 0, y: 0, z: 0 },
    originMoon: { x: 0, y: 0, z: 0 },
    destMoon: { x: 0, y: 0, z: 0 },
    depDirOut: { x: 0, y: 0, z: 0 },
    arrDirOut: { x: 0, y: 0, z: 0 },
    fromV: new THREE.Vector3(),
    toV: new THREE.Vector3(),
    depDir: new THREE.Vector3(),
    arrInDir: new THREE.Vector3(),
    arrOutDir: new THREE.Vector3(),
    conduitDir: new THREE.Vector3(),
    side: new THREE.Vector3(),
    up: new THREE.Vector3(),
    arrSide: new THREE.Vector3(),
    arrUp: new THREE.Vector3(),
    basis: new THREE.Matrix4(),
    gateDepQuat: new THREE.Quaternion(),
    gateArrQuat: new THREE.Quaternion(),
    depShipFacing: new THREE.Quaternion(),
    arrShipFacing: new THREE.Quaternion(),
    arrBackFacing: new THREE.Quaternion(),
    conduitQuat: new THREE.Quaternion(),
    gateDepPos: new THREE.Vector3(),
    gateArrPos: new THREE.Vector3(),
    head: new THREE.Vector3(),
    tail: new THREE.Vector3(),
    mid: new THREE.Vector3(),
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

    // Synced audio & haptic beats
    if (!soundPlayed.current.open && t >= 0.04) {
      soundPlayed.current.open = true;
      playSound('unseal', { gain: 0.72, key: `moon-gate-open:${event.id}` });
      haptic('commit');
    }
    if (!soundPlayed.current.warp && t >= 1.48) {
      soundPlayed.current.warp = true;
      playSound('warp', { gain: 0.85, key: `moon-gate-warp:${event.id}` });
      haptic('warp');
    }
    if (!cameraPanned.current && t >= 3.15) {
      cameraPanned.current = true;
      onArriveCamera?.(event.toPlanetId);
    }
    if (!soundPlayed.current.arrive && t >= 3.75) {
      soundPlayed.current.arrive = true;
      playSound('impact', { gain: 0.65, key: `moon-gate-arrive:${event.id}` });
      haptic('thunk');
    }

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
    const totalDist = scratch.fromV.distanceTo(scratch.toV);
    if (totalDist < 0.001) return;

    // Planet + Dyson shell safe departure & arrival staging vectors!
    moonClearStagingDirection(
      scratch.originParent,
      fromNode.radius,
      scratch.originMoon,
      scratch.destMoon,
      scratch.depDirOut,
    );
    moonClearStagingDirection(
      scratch.destParent,
      toNode.radius,
      scratch.destMoon,
      scratch.originMoon,
      scratch.arrDirOut,
    );

    scratch.depDir.set(scratch.depDirOut.x, scratch.depDirOut.y, scratch.depDirOut.z);
    scratch.arrOutDir.set(scratch.arrDirOut.x, scratch.arrDirOut.y, scratch.arrDirOut.z);
    scratch.arrInDir.copy(scratch.arrOutDir).negate();

    // Departure gate orthonormal basis: X = depDir, Y = up, Z = side
    const depRefUp = Math.abs(scratch.depDir.y) > 0.92 ? ALT_UP : UP_AXIS;
    scratch.side.crossVectors(scratch.depDir, depRefUp).normalize();
    scratch.up.crossVectors(scratch.side, scratch.depDir).normalize();
    scratch.basis.makeBasis(scratch.depDir, scratch.up, scratch.side);
    scratch.gateDepQuat.setFromRotationMatrix(scratch.basis);

    // Arrival gate faces outward toward incoming beam (arrOutDir) with upright Y
    const arrRefUp = Math.abs(scratch.arrOutDir.y) > 0.92 ? ALT_UP : UP_AXIS;
    scratch.arrSide.crossVectors(scratch.arrOutDir, arrRefUp).normalize();
    scratch.arrUp.crossVectors(scratch.arrSide, scratch.arrOutDir).normalize();
    scratch.basis.makeBasis(scratch.arrOutDir, scratch.arrUp, scratch.arrSide);
    scratch.gateArrQuat.setFromRotationMatrix(scratch.basis);

    scratch.depShipFacing.setFromUnitVectors(Z_AXIS, scratch.depDir);
    scratch.arrShipFacing.setFromUnitVectors(Z_AXIS, scratch.arrInDir);
    scratch.arrBackFacing.setFromUnitVectors(Z_AXIS, scratch.arrOutDir);

    // Clear-space staging lane well IN FRONT of the moon (never overlapping moon or parent Dyson shell)
    const depUnit = Math.max(fromR * 2.25, fromNode.radius * 0.68);
    const arrUnit = Math.max(toR * 2.25, toNode.radius * 0.68);
    const depStartOffset = Math.max(fromR * 2.0, depUnit * 0.95);
    const depGateOffset = Math.max(fromR * 5.2, depUnit * 2.55);
    const arrGateOffset = Math.max(toR * 5.2, arrUnit * 2.55);
    const arrStopOffset = Math.max(toR * 2.0, arrUnit * 0.95);

    scratch.gateDepPos.copy(scratch.fromV).addScaledVector(scratch.depDir, depGateOffset);
    scratch.gateArrPos.copy(scratch.toV).addScaledVector(scratch.arrOutDir, arrGateOffset);

    // ─── 1. PURPLE ASTRAL GATE AT ORIGIN MOON (0.0s -> 4.3s) ──────────────────
    if (t >= 3.4 && !depStopped.current) {
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
      depGateHostRef.current.scale.setScalar(depUnit * 0.72);
    }

    const depPunch = t >= 1.52 ? clamp01((t - 1.52) / 0.85) : -1;
    if (depShockRef.current) {
      depShockRef.current.visible = depPunch >= 0 && depPunch < 1;
      if (depPunch >= 0 && depPunch < 1) {
        depShockRef.current.position.copy(scratch.gateDepPos);
        depShockRef.current.quaternion.copy(scratch.depShipFacing);
        depShockRef.current.scale.setScalar(depUnit * (0.95 + depPunch * 2.2));
        setGridFrame(localTex.depShock, depPunch * 15, 4, 4);
        materials.depShock.opacity = (1 - depPunch) * 0.85;
      }
    }

    // ─── 2. VISIBLE GLB SQUADRON LAUNCHING AHEAD OF MOON -> THROUGH PURPLE GATE ──
    let depFlashPeak = 0;
    let maxJet = 0;
    let maxStreak = 0;
    const laneLen = depGateOffset - depStartOffset;

    for (let i = 0; i < shipCount; i++) {
      const shipGrp = depShipRefs.current[i];
      const streakGrp = depStreakRefs.current[i];
      const [ox, oy, oz] = FORMATION_OFFSETS[i] ?? [0, 0, 0];
      const stagger = i * 0.17;
      const appearAt = 0.4 + stagger * 0.65;
      const snapAt = 1.56 + stagger;

      if (shipGrp) {
        const alive = t >= appearAt && t < snapAt + 0.14;
        shipGrp.visible = alive;
        if (alive) {
          const lt = t - appearAt;
          const cruiseSpan = Math.max(0.2, snapAt - appearAt);
          const u = clamp01(lt / cruiseSpan);
          const ease = u * 0.3 + u * u * u * 0.7;
          const along = t < snapAt
            ? depStartOffset + oz * depUnit * 0.42 + laneLen * ease
            : depGateOffset + depUnit * 20 * (t - snapAt);
          const converge = 1 - 0.6 * smooth(0.55, 1.0, u);
          const fadeIn = smooth(0, 0.2, lt);
          shipGrp.position
            .copy(scratch.fromV)
            .addScaledVector(scratch.depDir, along)
            .addScaledVector(scratch.side, ox * depUnit * 0.58 * converge)
            .addScaledVector(scratch.up, oy * depUnit * 0.58 * converge);
          shipGrp.quaternion.copy(scratch.depShipFacing);

          const stretch = 1 + 19 * clamp01((t - (snapAt - 0.15)) / 0.22) ** 2;
          const slim = 1 / Math.sqrt(stretch);
          const s = depUnit * 0.52 * (0.45 + 0.55 * fadeIn);
          shipGrp.scale.set(s * slim, s * slim, s * stretch);
          maxJet = Math.max(maxJet, 0.58 + 0.42 * u);
        }
      }

      if (streakGrp) {
        const sinceSnap = t - (snapAt - 0.03);
        const a = sinceSnap >= 0 && sinceSnap < 0.85 ? (1 - sinceSnap / 0.85) ** 1.45 : 0;
        streakGrp.visible = a > 0.01;
        if (a > 0.01) {
          streakGrp.position
            .copy(scratch.gateDepPos)
            .addScaledVector(scratch.side, ox * depUnit * 0.22)
            .addScaledVector(scratch.up, oy * depUnit * 0.22);
          streakGrp.quaternion.copy(scratch.depShipFacing);
          const streakLen = Math.min(totalDist * 0.42, depUnit * (5 + 17 * clamp01(sinceSnap / 0.2)));
          streakGrp.scale.set(depUnit * 0.3, depUnit * 0.3, streakLen);
          maxStreak = Math.max(maxStreak, a);
        }
      }

      if (t >= snapAt && t < snapAt + 0.34) {
        depFlashPeak = Math.max(depFlashPeak, (1 - (t - snapAt) / 0.34) ** 2);
      }
    }

    materials.jet.opacity = Math.max(maxJet, 0.48);
    materials.streak.opacity = Math.max(maxStreak, 0.22);
    if (depFlareRef.current) {
      depFlareRef.current.visible = depFlashPeak > 0.01;
      depFlareRef.current.position.copy(scratch.gateDepPos);
      depFlareRef.current.scale.setScalar(depUnit * (0.9 + 1.4 * depFlashPeak));
      materials.depFlare.opacity = depFlashPeak * 0.82;
    }

    // ─── 3. VOLUMETRIC HYPERSPACE CONDUIT RIBBON (1.5s -> 4.4s) ───────────────
    const transit = (t - 1.5) / 2.25;
    const showConduit = transit > 0 && transit < 1.22;
    if (conduitRef.current) {
      conduitRef.current.visible = showConduit;
      if (showConduit) {
        scratch.head.lerpVectors(scratch.gateDepPos, scratch.gateArrPos, clamp01(transit));
        scratch.tail.lerpVectors(scratch.gateDepPos, scratch.gateArrPos, clamp01(transit - 0.36));
        scratch.conduitDir.subVectors(scratch.head, scratch.tail);
        const segLen = scratch.conduitDir.length();
        if (segLen > 0.01) {
          scratch.conduitDir.divideScalar(segLen);
          scratch.mid.addVectors(scratch.tail, scratch.head).multiplyScalar(0.5);
          scratch.conduitQuat.setFromUnitVectors(Z_AXIS, scratch.conduitDir);
          conduitRef.current.position.copy(scratch.mid);
          conduitRef.current.quaternion.copy(scratch.conduitQuat);
          const width = Math.max(depUnit, arrUnit) * 0.42;
          conduitRef.current.scale.set(width, width, segLen);
          const alpha = smooth(0, 0.14, transit) * (1 - smooth(0.92, 1.22, transit));
          materials.conduit.opacity = alpha * 0.78;
          materials.conduitCore.opacity = alpha * 0.92;
        } else {
          conduitRef.current.visible = false;
        }
      }
    }

    // ─── 4. PURPLE ASTRAL GATE AT DESTINATION MOON (3.1s -> 8.4s) ─────────────
    if (t >= 3.1) {
      arrStarted.current = true;
      if (t >= 6.4 && !arrStopped.current) {
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
      arrGateHostRef.current.scale.setScalar(arrUnit * 0.72);
    }

    const arrPunch = t >= 3.75 ? clamp01((t - 3.75) / 0.85) : -1;
    if (arrShockRef.current) {
      arrShockRef.current.visible = arrPunch >= 0 && arrPunch < 1;
      if (arrPunch >= 0 && arrPunch < 1) {
        arrShockRef.current.position.copy(scratch.gateArrPos);
        arrShockRef.current.quaternion.copy(scratch.arrBackFacing);
        arrShockRef.current.scale.setScalar(arrUnit * (0.95 + arrPunch * 2.2));
        setGridFrame(localTex.arrShock, arrPunch * 15, 4, 4);
        materials.arrShock.opacity = (1 - arrPunch) * 0.85;
      }
    }

    let arrFlashPeak = 0;
    const arrSpan = arrGateOffset - arrStopOffset;
    for (let i = 0; i < shipCount; i++) {
      const shipGrp = arrShipRefs.current[i];
      const streakGrp = arrStreakRefs.current[i];
      const [ox, oy, oz] = FORMATION_OFFSETS[i] ?? [0, 0, 0];
      const emergeAt = 3.8 + i * 0.17;
      const doneAt = emergeAt + 2.05;

      if (shipGrp) {
        const alive = t >= emergeAt && t < doneAt;
        shipGrp.visible = alive;
        if (alive) {
          const et = t - emergeAt;
          const settle = 1 - Math.exp(-et * 2.5);
          const distFromMoon = arrGateOffset - arrSpan * settle - oz * arrUnit * 0.35;
          shipGrp.position
            .copy(scratch.toV)
            .addScaledVector(scratch.arrOutDir, distFromMoon)
            .addScaledVector(scratch.arrSide, ox * arrUnit * 0.55 * (0.35 + 0.65 * settle))
            .addScaledVector(scratch.arrUp, oy * arrUnit * 0.55 * (0.35 + 0.65 * settle));
          shipGrp.quaternion.copy(scratch.arrShipFacing);

          const stretch = 1 + 17 * Math.max(0, 1 - et / 0.25) ** 2;
          const slim = 1 / Math.sqrt(stretch);
          const fadeOut = 1 - smooth(1.5, 2.05, et);
          const s = arrUnit * 0.52 * (0.35 + 0.65 * fadeOut);
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
            .addScaledVector(scratch.arrSide, ox * arrUnit * 0.22)
            .addScaledVector(scratch.arrUp, oy * arrUnit * 0.22);
          streakGrp.quaternion.copy(scratch.arrBackFacing);
          streakGrp.scale.set(arrUnit * 0.3, arrUnit * 0.3, Math.min(totalDist * 0.36, arrUnit * 13));
        }
      }

      if (t >= emergeAt && t < emergeAt + 0.34) {
        arrFlashPeak = Math.max(arrFlashPeak, (1 - (t - emergeAt) / 0.34) ** 2);
      }
    }

    if (arrFlareRef.current) {
      arrFlareRef.current.visible = arrFlashPeak > 0.01;
      arrFlareRef.current.position.copy(scratch.gateArrPos);
      arrFlareRef.current.scale.setScalar(arrUnit * (0.9 + 1.4 * arrFlashPeak));
      materials.arrFlare.opacity = arrFlashPeak * 0.82;
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

      {/* Volumetric crossed hyperspace conduit beam connecting Origin Gate -> Destination Gate */}
      <group ref={conduitRef} visible={false}>
        <group rotation={[0, Math.PI / 2, 0]}>
          <mesh material={materials.conduit} renderOrder={6}>
            <planeGeometry args={[1, 1]} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} material={materials.conduit} renderOrder={6}>
            <planeGeometry args={[1, 1]} />
          </mesh>
          <mesh scale={[1, 0.35, 1]} material={materials.conduitCore} renderOrder={7}>
            <planeGeometry args={[1, 1]} />
          </mesh>
        </group>
      </group>

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
  onArriveCamera,
}: {
  readonly events: readonly MoonGateWarpEvent[];
  readonly moons?: GalaxyMoons | undefined;
  readonly nodes: readonly MoonHostRef[];
  readonly onArriveCamera?: ((toPlanetId: string) => void) | undefined;
}) {
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
          onArriveCamera={onArriveCamera}
        />
      ))}
    </group>
  );
}
