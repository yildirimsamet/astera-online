import { useFrame, useLoader } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { VesselHull, VesselLook } from '@astera/rules';
import { ShipFlames } from '../arena/render/flames.js';
import { useRenderQuality } from '../lib/quality.js';
import { useDisposable } from '../lib/useDisposable.js';
import { ENGINE_FLAME_NOISE_URL } from '../vfx/engineFlames.js';
import { VESSEL_NOSE_TURN, VESSEL_NOZZLES, vesselModelFile } from './mainSky.js';
import { warpStreak } from './warpStreak.js';
import { VESSEL_LENGTH } from './scene.js';
import { VesselBody } from './VesselBody.js';

/** A unit plane along +Z from 0 (the tail) to 1 (ahead); two of them crossed read from any side. */
const STREAK_GEOMETRY = new THREE.PlaneGeometry(1, 1).rotateY(-Math.PI / 2).translate(0, 0, 0.5);
const TAIL = new THREE.Vector3();
const STREAK_VERT = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const STREAK_FRAG = /* glsl */`
  uniform float uFade; varying vec2 vUv;
  void main() {
    // A hard white core across the line, a thin blue edge; brightest at the ship, thinning ahead.
    float across = abs(vUv.y - 0.5) * 2.0;
    float core = step(across, 0.22);
    float edge = (1.0 - smoothstep(0.22, 1.0, across)) * 0.45;
    float ahead = 1.0 - vUv.x * 0.8;
    vec3 colour = mix(vec3(0.55, 0.78, 1.0), vec3(1.0), core);
    gl_FragColor = vec4(colour * (core + edge) * ahead * uFade, 1.0);
  }`;

/** One frame of a ship on its jump: where, facing where, how hard it burns, and how much of it is left. */
export interface JumpingShipState {
  at: THREE.Vector3;
  facing: THREE.Quaternion;
  /** The cruise flame, 0…1. */
  lever: number;
  /** The long Solar flame over it, 0…1. */
  turbo: number;
  /** 0 whole, 1 gone; between, it stretches into a line of light along its heading. */
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
  const flames = useDisposable(() => {
    noise.wrapS = noise.wrapT = THREE.RepeatWrapping;
    return new ShipFlames(noise, nozzles, VESSEL_NOZZLES[hull].radius * FLAME_WIDTH, FLAME_REACH,
      quality === 'high' ? 'standard' : 'mobile', seed);
  }, [noise, nozzles, hull, quality, seed]);
  useFrame(({ clock }) => {
    const { lever, turbo } = state.current;
    if (!flames) return;
    flames.update(lever * gain, turbo * gain, clock.elapsedTime);
    flames.mesh.visible = lever > 0.001 || turbo > 0.001;
  });
  return (
    <>
      {flames && <primitive object={flames.mesh} />}
    </>
  );
}

/**
 * A COLONY SHIP ON ITS JUMP: its own hull, the studio's volume flames on its own nozzles, and at the end
 * the hull pulled forward into a line of light that snaps out. `poseAt` fills the state each frame; the pilot's scene and every
 * watcher in either galaxy draw it the same way.
 */
export function JumpingShip({ hull, look, poseAt, seed = 7 }: {
  hull: VesselHull;
  look: VesselLook;
  poseAt: (into: JumpingShipState) => void;
  seed?: number;
}) {
  const group = useRef<THREE.Group>(null);
  const streak = useRef<THREE.Group>(null);
  const streakMaterial = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: STREAK_VERT, fragmentShader: STREAK_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, forceSinglePass: true, toneMapped: false, uniforms: { uFade: { value: 0 } },
  }), []);
  useEffect(() => () => { streakMaterial.dispose(); }, [streakMaterial]);
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
    const line = streak.current;
    if (line) {
      const { length, width, fade } = warpStreak(vanish);
      line.visible = vanish > 0 && vanish < 1;
      // From the shrinking hull's tail forward along its heading (+Z in this frame), in hull lengths.
      line.position.copy(at).add(TAIL.set(0, 0, -0.5 * VESSEL_LENGTH * (1 - vanish * vanish)).applyQuaternion(facing));
      line.quaternion.copy(facing);
      line.scale.set(VESSEL_LENGTH * width, VESSEL_LENGTH * width, VESSEL_LENGTH * length);
      const uniform = streakMaterial.uniforms.uFade;
      if (uniform) uniform.value = fade;
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
      {/* The jump: the hull pulled forward into a line of light that snaps out (`warpStreak`). */}
      <group ref={streak} visible={false}>
        <mesh geometry={STREAK_GEOMETRY} material={streakMaterial} raycast={() => null} />
        <mesh geometry={STREAK_GEOMETRY} material={streakMaterial} rotation={[0, 0, Math.PI / 2]} raycast={() => null} />
      </group>
    </>
  );
}
