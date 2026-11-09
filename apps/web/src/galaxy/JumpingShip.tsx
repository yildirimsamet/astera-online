import { useFrame, useLoader } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { VesselHull, VesselLook } from '@astera/rules';
import { ShipFlames } from '../arena/render/flames.js';
import { useRenderQuality } from '../lib/quality.js';
import { ENGINE_FLAME_NOISE_URL } from '../vfx/engineFlames.js';
import { softGlow } from './Environment.js';
import { VESSEL_NOSE_TURN, VESSEL_NOZZLES, vesselModelFile } from './mainSky.js';
import { VESSEL_LENGTH } from './scene.js';
import { VesselBody } from './VesselBody.js';

/** One frame of a ship on its jump: where, facing where, how hard it burns, and how much of it is left. */
export interface JumpingShipState {
  at: THREE.Vector3;
  facing: THREE.Quaternion;
  /** The cruise flame, 0…1. */
  lever: number;
  /** The long Solar flame over it, 0…1. */
  turbo: number;
  /** 0 whole, 1 gone; between, it burns away in one burst of light. */
  vanish: number;
}

/** Wider and longer than a fighter's for its size: a whole colony leaving (owner, 2026-11-09). */
const FLAME_WIDTH = 1.25;
const FLAME_REACH = 1.3;
const NOSE = new THREE.Euler(0, VESSEL_NOSE_TURN, 0);
const NO_DAMAGE = [] as const;

/** Model space (nose +X) into the ship's frame (nose +Z), where the flames are drawn. */
const nozzlesOf = (hull: VesselHull): THREE.Vector3[] =>
  VESSEL_NOZZLES[hull].at.map(([x, y, z]) => new THREE.Vector3(x, y, z).applyEuler(NOSE));

function Flames({ hull, state, seed }: { hull: VesselHull; state: React.RefObject<JumpingShipState>; seed: number }) {
  const noise = useLoader(THREE.TextureLoader, ENGINE_FLAME_NOISE_URL);
  const quality = useRenderQuality();
  const nozzles = useMemo(() => nozzlesOf(hull), [hull]);
  // Six nozzles side by side saturate to a white column where one bell does not: the same light per hull.
  const gain = 0.9 / Math.sqrt(VESSEL_NOZZLES[hull].at.length);
  const flames = useMemo(() => {
    noise.wrapS = noise.wrapT = THREE.RepeatWrapping;
    return new ShipFlames(noise, nozzles, VESSEL_NOZZLES[hull].radius * FLAME_WIDTH, FLAME_REACH,
      quality === 'high' ? 'standard' : 'mobile', seed);
  }, [noise, nozzles, hull, quality, seed]);
  useEffect(() => () => { flames.dispose(); }, [flames]);
  const glows = useRef<(THREE.Sprite | null)[]>([]);
  useFrame(({ clock }) => {
    const { lever, turbo } = state.current;
    flames.update(lever * gain, turbo * gain, clock.elapsedTime);
    flames.mesh.visible = lever > 0.001 || turbo > 0.001;
    // A white-hot throat in each nozzle, brightest at a catch, so the light reads before the flame grows.
    const heat = Math.min(1, lever * 1.4 + turbo * 0.4);
    for (const glow of glows.current) {
      if (!glow) continue;
      glow.material.opacity = heat;
      glow.scale.setScalar(VESSEL_NOZZLES[hull].radius * (3.2 + 2.2 * heat));
    }
  });
  return (
    <>
      <primitive object={flames.mesh} />
      {nozzles.map((nozzle, i) => (
        <sprite key={i} ref={(sprite) => { glows.current[i] = sprite; }} position={nozzle} raycast={() => null}>
          <spriteMaterial map={softGlow()} color="#cfe6ff" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </sprite>
      ))}
    </>
  );
}

/**
 * A COLONY SHIP ON ITS JUMP: its own hull, the studio's volume flames on its own nozzles, and at the end
 * a burst of light it leaves in. `poseAt` fills the state each frame; the pilot's scene and every
 * watcher in either galaxy draw it the same way.
 */
export function JumpingShip({ hull, look, poseAt, seed = 7 }: {
  hull: VesselHull;
  look: VesselLook;
  poseAt: (into: JumpingShipState) => void;
  seed?: number;
}) {
  const group = useRef<THREE.Group>(null);
  const burst = useRef<THREE.Sprite>(null);
  const state = useRef<JumpingShipState>({ at: new THREE.Vector3(), facing: new THREE.Quaternion(), lever: 0, turbo: 0, vanish: 0 });
  useFrame(() => {
    poseAt(state.current);
    const { at, facing, vanish } = state.current;
    const ship = group.current;
    if (ship) {
      ship.position.copy(at);
      ship.quaternion.copy(facing);
      ship.visible = vanish < 1;
      ship.scale.setScalar(VESSEL_LENGTH * (1 - vanish * vanish));
    }
    if (burst.current) {
      const flash = 0.85 * Math.sin(Math.PI * Math.min(1, vanish * 1.15));
      burst.current.visible = vanish > 0 && vanish < 1;
      burst.current.position.copy(at);
      burst.current.material.opacity = flash;
      burst.current.scale.setScalar(VESSEL_LENGTH * (0.5 + 1.1 * vanish));
    }
  });
  return (
    <>
      <group ref={group}>
        <group rotation={[0, VESSEL_NOSE_TURN, 0]}>
          <Suspense fallback={null}><VesselBody file={vesselModelFile(hull, look)} hull={hull} damage={NO_DAMAGE} /></Suspense>
        </group>
        <Suspense fallback={null}><Flames hull={hull} state={state} seed={seed} /></Suspense>
      </group>
      <sprite ref={burst} visible={false} raycast={() => null}>
        <spriteMaterial map={softGlow()} color="#e6f3ff" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </sprite>
    </>
  );
}
