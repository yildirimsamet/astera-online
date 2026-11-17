import { useTexture } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { VESSEL_SYSTEMS, vesselLook, type Vec3, type VesselHull, type VesselLook, type VesselProgress, type VesselSystem } from '@astera/rules';
import { BayReturnFx, RunningLights, SparkStreaks, WeldFx } from './BayFx.js';
import { HitboxMaterial } from './hitboxDebug.js';
import { HULL_SHIFT_SECONDS, hullSweepAt, nextLook } from './hullShift.js';
import { VESSEL_BAYS, VESSEL_NOSE_TURN, damageSpots, starterShipYaw, vesselHitBox, vesselLights, vesselModelFile, type DamageSpot } from './mainSky.js';
import { VESSEL_LENGTH } from './scene.js';
import { markHit, wasTap } from './tap.js';
import { VesselBody, preloadVessel } from './VesselBody.js';

const LENGTH = VESSEL_LENGTH;
/** The scanner's lines (Synty Military Combat HUD, comms scanlines), lit along the cut. */
const SCANLINES = '/assets/vfx/library/scanlines.webp';
const NOSEWARD = new THREE.Vector3(1, 0, 0);
const TAILWARD = new THREE.Vector3(-1, 0, 0);

/**
 * THE HULL'S NEW LOOK, AS A MOMENT (owner 2026-11-18; `hullShift.ts`). VFX brief: a refit scanner
 * passes from the tail past the nose, a plane of hard scan lines that lays the new plating as it goes
 * and throws sparks where new meets old (`scanlines.webp`, sparks as streaks); behind it the new hull,
 * ahead of it the old, each cut by a plane that moves with it. Two hulls for a second and a half.
 */
function HullShift({ hull, from, to, damage, onDone }: {
  hull: VesselHull;
  from: VesselLook;
  to: VesselLook;
  damage: readonly DamageSpot[];
  onDone: () => void;
}) {
  const frame = useRef<THREE.Group>(null);
  const cut = useRef<THREE.Group>(null);
  const lines = useTexture(SCANLINES);
  const start = useRef<number | null>(null);
  const ended = useRef(false);
  const planes = useMemo(() => ({ fresh: [new THREE.Plane()], worn: [new THREE.Plane()] }), []);
  const [, tall, wide] = vesselHitBox(hull);
  const material = useMemo(() => new THREE.MeshBasicMaterial({ map: lines, color: '#8fe8ff', transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }), [lines]);
  useEffect(() => () => { material.dispose(); }, [material]);
  useFrame(({ clock, invalidate }) => {
    const group = frame.current;
    if (!group) return;
    start.current ??= clock.elapsedTime;
    const t = clock.elapsedTime - start.current;
    const x = hullSweepAt(t, HULL_SHIFT_SECONDS);
    group.updateWorldMatrix(true, false);
    // The new hull where the sheet has passed (x' < x), the old one ahead of it.
    planes.fresh[0]?.set(TAILWARD, x).applyMatrix4(group.matrixWorld);
    planes.worn[0]?.set(NOSEWARD, -x).applyMatrix4(group.matrixWorld);
    if (cut.current) cut.current.position.x = x;
    if (t < HULL_SHIFT_SECONDS) { invalidate(); return; }
    if (!ended.current) { ended.current = true; onDone(); }
  });
  return (
    <group ref={frame}>
      <VesselBody file={vesselModelFile(hull, from)} hull={hull} damage={[]} clip={planes.worn} />
      <VesselBody file={vesselModelFile(hull, to)} hull={hull} damage={damage} clip={planes.fresh} />
      <group ref={cut}>
        <mesh rotation={[0, Math.PI / 2, 0]} material={material} raycast={() => null}>
          <planeGeometry args={[wide * 1.1, tall * 1.3]} />
        </mesh>
        {/* The cut throws sparks where the new plate meets the old. */}
        <SparkStreaks at={[0, tall * 0.25, 0]} count={10} stream seed={2} />
        <SparkStreaks at={[0, 0, wide * 0.3]} count={8} stream seed={3} />
        <SparkStreaks at={[0, 0, -wide * 0.3]} count={8} stream seed={4} />
      </group>
    </group>
  );
}

const BAY_COLOUR: Record<VesselSystem, string> = {
  REFINERY: '#ffb46a',
  SURVEY: '#9fd8ff',
  DEFENCE: '#8fe8ff',
  CARGO: '#ffd9a0',
  DRIVE: '#7fb6ff',
};

/**
 * THE PLAYER'S OWN SHIP, THE ONLY ONE DRAWN AS IT TRULY IS: its hull follows the repairs, and each
 * mended system carries a running light at its place on that hull (`BayFx`). No real light, as
 * everything else in this scene.
 */
export function OwnVessel({ at, offset, hull, progress, onSelect, awaken, working = [], look: shownLook }: {
  at: readonly [number, number, number];
  offset: Vec3;
  hull: VesselHull;
  progress: VesselProgress;
  onSelect: () => void;
  /** A system that just came back; a new key beats again. */
  awaken?: { system: VesselSystem; key: number } | undefined;
  /** Systems with a short repair under way: their bays weld. */
  working?: readonly VesselSystem[];
  /** The look to show, held back until its moment (the director's hull shot); the repairs' own look otherwise. */
  look?: VesselLook | undefined;
}) {
  const lights = useMemo(() => vesselLights(progress), [progress]);
  const damage = useMemo(() => damageSpots(lights), [lights]);
  // A mended bay carries a running light, each off the others' beat.
  const running = useMemo(() => VESSEL_SYSTEMS.flatMap((system, i) => (lights[system] > 0 ? [{ at: VESSEL_BAYS[hull][system], colour: BAY_COLOUR[system], offset: i * 0.19 }] : [])), [lights, hull]);
  const look = shownLook ?? vesselLook(progress);
  // A change of look runs along the hull as a moment; it never swaps under the player's eyes.
  const [drawn, setDrawn] = useState(look);
  const [shift, setShift] = useState<{ from: VesselLook; to: VesselLook } | null>(null);
  if (look !== drawn) { setShift({ from: drawn, to: look }); setDrawn(look); }
  useEffect(() => {
    const next = nextLook(look);
    if (next) preloadVessel(vesselModelFile(hull, next));
  }, [hull, look]);
  return (
    <group position={[at[0], at[1], at[2]]} rotation={[0, starterShipYaw([at[0], at[1], at[2]], offset), 0]} scale={LENGTH}>
      <group rotation={[0, VESSEL_NOSE_TURN, 0]}>
        <mesh onPointerUp={(event) => { if (!wasTap()) return; markHit(); event.stopPropagation(); onSelect(); }}>
          <boxGeometry args={vesselHitBox(hull)} />
          <HitboxMaterial kind="fleet" />
        </mesh>
        {/* Its own boundary: a new state loading must not take the main galaxy's sky with it. */}
        {/* Owner 2026-11-06: lit from its own texture, a light rim, and its damage burning on it. */}
        {shift
          ? (
            <Suspense fallback={<VesselBody file={vesselModelFile(hull, shift.from)} hull={hull} damage={damage} />}>
              <HullShift key={`${shift.from}>${shift.to}`} hull={hull} from={shift.from} to={shift.to} damage={damage} onDone={() => { setShift(null); }} />
            </Suspense>
          )
          : <Suspense fallback={null}><VesselBody file={vesselModelFile(hull, look)} hull={hull} damage={damage} /></Suspense>}
        <RunningLights lights={running} />
        <Suspense fallback={null}>
          {awaken && <BayReturnFx key={awaken.key} system={awaken.system} at={VESSEL_BAYS[hull][awaken.system]} colour={BAY_COLOUR[awaken.system]} />}
          {working.map(system => <WeldFx key={system} at={VESSEL_BAYS[hull][system]} />)}
        </Suspense>
      </group>
    </group>
  );
}
