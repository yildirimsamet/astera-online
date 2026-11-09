import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useTranslation } from 'react-i18next';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { JUMP_FLIGHT } from '@astera/rules';
import { haptic } from '../lib/haptics.js';
import { playSound } from '../lib/sound.js';
import { SCENE_SECONDS, REVEAL_SECOND, beatAt, endJump, revealJump, takeCues, type BeatId, type Jump } from '../starter/jump.js';
import type { JumpWorld } from '../starter/jumpWorld.js';
import { BrightStars, Core, Dust, Sky } from './Environment.js';
import { JumpingShip, type JumpingShipState } from './JumpingShip.js';
import { jumpCamera, jumpStop, type JumpPath } from './jumpCamera.js';
import { shipStateAt } from './jumpShipState.js';
import { PlanetField } from './PlanetField.js';
import { SCENE_LIGHT } from './planetSurface.js';
import { SpaceLighting } from './SpaceLighting.js';
import { VesselField } from './VesselField.js';

const smooth = (from: number, to: number, value: number): number => {
  const k = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return k * k * (3 - 2 * k);
};
const NOWHERE = { x: 0, y: 0, z: 0 };
const NO_RIVALS = [] as const;
const ignore = (): void => undefined;

const AHEAD = new THREE.Vector3(), ACROSS = new THREE.Vector3(), UP = new THREE.Vector3();
const STREAKS = 260;

/** Stars streaking past along the way while the ship is fast: one draw call, and it sells the speed. */
function Streaks({ path, clock }: { path: JumpPath; clock: React.RefObject<number> }) {
  const stop = useMemo(() => jumpStop(path), [path]);
  const seeds = useMemo(() => Array.from({ length: STREAKS }, (_, i) => {
    const a = Math.sin(i * 12.9898) * 43758.5453, b = Math.sin(i * 78.233) * 12543.123, c = Math.sin(i * 39.425) * 24634.6345;
    return [(a - Math.floor(a) - 0.5) * 14, (b - Math.floor(b) - 0.5) * 22, c - Math.floor(c)] as const;
  }), []);
  const geometry = useMemo(() => {
    const made = new THREE.BufferGeometry();
    made.setAttribute('position', new THREE.BufferAttribute(new Float32Array(STREAKS * 6), 3));
    return made;
  }, []);
  const material = useMemo(() => new THREE.LineBasicMaterial({ color: '#a8ccff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }), []);
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);
  const state = useRef<JumpingShipState>({ at: new THREE.Vector3(), facing: new THREE.Quaternion(), lever: 0, turbo: 0, vanish: 0 });
  useFrame(() => {
    const s = clock.current;
    const power = smooth(JUMP_FLIGHT.depart + 2.5, JUMP_FLIGHT.depart + 5, s) * (1 - smooth(JUMP_FLIGHT.arrive - 5, JUMP_FLIGHT.arrive - 2.5, s));
    material.opacity = power * 0.55;
    if (power <= 0) return;
    const at = shipStateAt(path.from, stop, s, state.current).at;
    AHEAD.set(stop[0] - path.from[0], stop[1] - path.from[1], stop[2] - path.from[2]).normalize();
    ACROSS.set(AHEAD.z, 0, -AHEAD.x).normalize();
    UP.crossVectors(ACROSS, AHEAD);
    const attribute = geometry.getAttribute('position');
    if (!(attribute instanceof THREE.BufferAttribute)) return;
    const array = attribute.array;
    const span = path.ship * 40;
    for (let i = 0; i < STREAKS; i++) {
      const [x, y, offset] = seeds[i]!;
      const along = span / 2 - ((offset * span + s * path.ship * 60) % span);
      const length = path.ship * (0.4 + power * 3);
      for (let end = 0; end < 2; end++) {
        const k = along - end * length;
        array[i * 6 + end * 3] = at.x + ACROSS.x * x * path.ship + UP.x * y * path.ship + AHEAD.x * k;
        array[i * 6 + end * 3 + 1] = at.y + ACROSS.y * x * path.ship + UP.y * y * path.ship + AHEAD.y * k;
        array[i * 6 + end * 3 + 2] = at.z + ACROSS.z * x * path.ship + UP.z * y * path.ship + AHEAD.z * k;
      }
    }
    attribute.needsUpdate = true;
  });
  return <lineSegments geometry={geometry} material={material} frustumCulled={false} />;
}

const LOOK = new THREE.Vector3();

/** The camera on the jump's clock, with a small kick on each catch of the drive. */
function Camera({ path, clock }: { path: JumpPath; clock: React.RefObject<number> }) {
  const camera = useThree(state => state.camera);
  useFrame(() => {
    const s = clock.current;
    const pose = jumpCamera(path, s);
    camera.position.set(...pose.position);
    // The drive shakes the frame as it catches and settles once it holds.
    const kick = s < JUMP_FLIGHT.lit + 0.6 ? path.ship * 0.012 * Math.max(0, Math.sin(s * 47)) * smooth(JUMP_FLIGHT.ignite, JUMP_FLIGHT.ignite + 0.2, s) : 0;
    camera.position.y += kick;
    LOOK.set(...pose.target);
    camera.up.set(...pose.up);
    camera.lookAt(LOOK);
    if (camera instanceof THREE.PerspectiveCamera && camera.fov !== pose.fov) {
      camera.fov = pose.fov;
      camera.updateProjectionMatrix();
    }
  });
  return null;
}

function Stage({ jump, world, clock }: { jump: Jump; world: JumpWorld; clock: React.RefObject<number> }) {
  const path = useMemo<JumpPath>(() => ({ from: world.from, planet: world.planet, radius: world.radius, ship: world.ship }), [world]);
  const stop = useMemo(() => jumpStop(path), [path]);
  return (
    <>
      {/* The main game's own light and sky, so its first frame is this one's last. */}
      <ambientLight intensity={SCENE_LIGHT.ambient} />
      <directionalLight position={[-8, 12, 9]} intensity={SCENE_LIGHT.key} />
      <directionalLight position={[10, -3, -12]} intensity={0.48} color="#91b5de" />
      <SpaceLighting />
      <Sky />
      <Core />
      <BrightStars />
      <Dust />
      <Camera path={path} clock={clock} />
      <Suspense fallback={null}>
        <PlanetField nodes={world.worlds} selectedId={null} rivals={NO_RIVALS} onSelect={ignore} marks={false} />
        <VesselField ships={world.ships} offset={NOWHERE} onSelect={ignore} />
      </Suspense>
      <Streaks path={path} clock={clock} />
      <JumpingShip hull={jump.hull} look={jump.look} poseAt={(into) => { shipStateAt(path.from, stop, clock.current, into); }} />
    </>
  );
}

/**
 * THE MOMENT THE WHOLE GALAXY WAS FOR. Owner, 2026-11-09: a real flight, not a staged one. The ship
 * lights at its own berth among its neighbours, crosses to the main galaxy, stops at the foot of the
 * world the server gave it, and is gone; the camera settles where the main game opens on that world.
 * The result is already on the server: the session moves to the planet underneath at the reveal, and
 * the scene fades off over it.
 */
export function MigrationSequence({ jump }: { jump: Jump }) {
  const { t } = useTranslation();
  const clock = useRef(jump.start);
  const root = useRef<HTMLDivElement>(null);
  const veil = useRef<HTMLDivElement>(null);
  const [beat, setBeat] = useState<BeatId>(beatAt(jump.start).id);
  useEffect(() => {
    let frame = 0;
    const run = (at: number): void => {
      const s = (at - jump.origin) / 1000;
      clock.current = s;
      setBeat(beatAt(s).id);
      for (const cue of takeCues(s)) {
        playSound(cue.sound, cue.seconds === undefined ? {} : { seconds: cue.seconds });
        haptic(cue.haptic);
      }
      if (veil.current) veil.current.style.opacity = String(1 - smooth(jump.start, jump.start + 0.8, s));
      // Off over the main game, which has opened on the same world from the same place.
      if (root.current) root.current.style.opacity = String(1 - smooth(SCENE_SECONDS - 1.4, SCENE_SECONDS, s));
      if (s >= REVEAL_SECOND) revealJump();
      if (s >= SCENE_SECONDS) { endJump(); return; }
      frame = requestAnimationFrame(run);
    };
    frame = requestAnimationFrame(run);
    return () => { cancelAnimationFrame(frame); };
  }, [jump.origin, jump.start]);
  // Above the loading cover (z 1000): the planet loads under the scene's last beats (playtest 2026-11-09).
  return (
    <div ref={root} data-testid="migration-sequence" className="fixed inset-0 z-[1001] overflow-hidden bg-[#02040a] font-v2-ui">
      {jump.world && (
        <Canvas dpr={[1, 1.5]} gl={{ antialias: true, powerPreference: 'high-performance' }} camera={{ fov: 45, near: 0.05, far: 4000, position: [0, 0, 1] }}>
          <Stage jump={jump} world={jump.world} clock={clock} />
        </Canvas>
      )}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_60%,rgba(0,0,0,.5))]" />
      <div ref={veil} aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[#02040a]" />
      <style>{'@keyframes jump-caption{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}'}</style>
      <p key={beat} role="status" style={{ animation: 'jump-caption .9s ease-out' }} className="pointer-events-none absolute inset-x-6 bottom-[14%] text-center text-title font-medium tracking-wide text-white [text-shadow:0_2px_12px_#000]">
        {t(`starter.jump.scene.${beat}`, { name: jump.shardName })}
      </p>
      {jump.replay && (
        <button type="button" onClick={endJump} className="absolute right-3 top-[calc(env(safe-area-inset-top)+12px)] min-h-9 rounded-control border border-white/30 bg-black/40 px-3 text-caption text-white">
          {t('starter.jump.skip')}
        </button>
      )}
    </div>
  );
}
