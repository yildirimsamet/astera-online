import { useFrame } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { VESSEL_SYSTEMS, vesselLook, type Vec3, type VesselHull, type VesselProgress, type VesselSystem } from '@astera/rules';
import { softGlow } from './Environment.js';
import { HitboxMaterial } from './hitboxDebug.js';
import { VESSEL_BAYS, VESSEL_NOSE_TURN, damageSpots, starterShipYaw, vesselHitBox, vesselLights, vesselModelFile } from './mainSky.js';
import { VESSEL_LENGTH } from './scene.js';
import { markHit, wasTap } from './tap.js';
import { VesselBody } from './VesselBody.js';

const LENGTH = VESSEL_LENGTH;
/** Three beats of light where the system came back, then quiet (onboarding design §5.3). */
const AWAKEN_S = 3.6;
const BEATS = 3;

/** A bay that has just come back: a flare and a widening ring of its own colour, beating three times. */
function AwakenPulse({ at, colour }: { at: readonly [number, number, number]; colour: string }) {
  const flare = useRef<THREE.Sprite>(null);
  const ring = useRef<THREE.Sprite>(null);
  const start = useRef<number | null>(null);
  const materials = useMemo(() => {
    const make = () => new THREE.SpriteMaterial({ map: softGlow(), color: colour, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
    return { flare: make(), ring: make() };
  }, [colour]);
  useEffect(() => () => { materials.flare.dispose(); materials.ring.dispose(); }, [materials]);
  // The galaxy draws on demand: while the beats run, each frame asks for the next.
  useFrame(({ clock, invalidate }) => {
    start.current ??= clock.elapsedTime;
    const t = clock.elapsedTime - start.current;
    const beat = (t / AWAKEN_S) * BEATS;
    const phase = beat % 1;
    const live = t < AWAKEN_S;
    if (live) invalidate();
    materials.flare.opacity = live ? 0.35 + 0.65 * (1 - phase) : 0;
    materials.ring.opacity = live ? (1 - phase) * 0.85 : 0;
    flare.current?.scale.setScalar(0.16 + 0.2 * (1 - phase));
    ring.current?.scale.setScalar(0.2 + 0.9 * phase);
  });
  return (
    <>
      <sprite ref={ring} position={at} material={materials.ring} raycast={() => null} />
      <sprite ref={flare} position={at} material={materials.flare} raycast={() => null} />
    </>
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
 * mended system burns as a light at its place on that hull. A sprite per bay and no real light, as
 * everything else in this scene.
 */
export function OwnVessel({ at, offset, hull, progress, onSelect, awaken }: {
  at: readonly [number, number, number];
  offset: Vec3;
  hull: VesselHull;
  progress: VesselProgress;
  onSelect: () => void;
  /** A system that just came back; a new key beats again. */
  awaken?: { system: VesselSystem; key: number } | undefined;
}) {
  const lights = useMemo(() => vesselLights(progress), [progress]);
  const damage = useMemo(() => damageSpots(lights), [lights]);
  const look = vesselLook(progress);
  return (
    <group position={[at[0], at[1], at[2]]} rotation={[0, starterShipYaw([at[0], at[1], at[2]], offset), 0]} scale={LENGTH}>
      <group rotation={[0, VESSEL_NOSE_TURN, 0]}>
        <mesh onPointerUp={(event) => { if (!wasTap()) return; markHit(); event.stopPropagation(); onSelect(); }}>
          <boxGeometry args={vesselHitBox(hull)} />
          <HitboxMaterial kind="fleet" />
        </mesh>
        {/* Its own boundary: a new state loading must not take the main galaxy's sky with it. */}
        {/* Owner 2026-11-06: lit from its own texture, a light rim, and its damage burning on it. */}
        <Suspense fallback={null}><VesselBody file={vesselModelFile(hull, look)} hull={hull} damage={damage} /></Suspense>
        {VESSEL_SYSTEMS.map(system => lights[system] > 0 && (
          <sprite key={system} position={VESSEL_BAYS[hull][system]} scale={0.03 + 0.04 * lights[system]} raycast={() => null}>
            <spriteMaterial map={softGlow()} color={BAY_COLOUR[system]} opacity={0.35 + 0.6 * lights[system]} transparent depthWrite={false} toneMapped={false} />
          </sprite>
        ))}
        {awaken && <AwakenPulse key={awaken.key} at={VESSEL_BAYS[hull][awaken.system]} colour={BAY_COLOUR[awaken.system]} />}
      </group>
    </group>
  );
}
