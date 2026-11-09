import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useTranslation } from 'react-i18next';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { JUMP_FLIGHT } from '@astera/rules';
import { haptic } from '../lib/haptics.js';
import { playSound } from '../lib/sound.js';
import { JUMP_LAYER, beatAt, endJump, mayReveal, stillFade, stillScale, revealJump, revealSecond, sceneSeconds, takeCues, useJumpStill, type BeatId, type Jump } from '../starter/jump.js';
import type { JumpWorld } from '../starter/jumpWorld.js';
import { BrightStars, Core, Dust, Sky } from './Environment.js';
import { JumpingShip } from './JumpingShip.js';
import { jumpCamera, jumpStop, type JumpPath } from './jumpCamera.js';
import { shipStateAt } from './jumpShipState.js';
import { Streaks } from './JumpStreaks.js';
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
  const picture = useRef<HTMLImageElement>(null);
  const [beat, setBeat] = useState<BeatId>(beatAt(jump.start).id);
  const still = useJumpStill();
  const inGame = jump.inGame === true;
  const hasStill = still !== null;
  useEffect(() => {
    const reveal = revealSecond(jump), end = sceneSeconds(jump);
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
      if (mayReveal(jump, s, hasStill)) revealJump();
      if (inGame) {
        // The still holds until the main view under it has drawn, then gives way.
        const fade = s >= reveal ? stillFade(s, reveal, jump.drawnAt ?? null) : { opacity: 1, done: false };
        if (root.current) root.current.style.opacity = String(fade.opacity);
        if (picture.current) picture.current.style.transform = `scale(${stillScale(s, reveal, fade.opacity)})`;
        if (fade.done || s >= end) { endJump(); return; }
      } else {
        if (root.current) root.current.style.opacity = String(1 - smooth(end - 1.4, end, s));
        if (s >= end) { endJump(); return; }
      }
      frame = requestAnimationFrame(run);
    };
    frame = requestAnimationFrame(run);
    return () => { cancelAnimationFrame(frame); };
  }, [jump, inGame, hasStill]);
  // Above the loading cover (z 1000): the planet loads under the scene's last beats (playtest 2026-11-09).
  // In the game the galaxy view flies the ship under this layer (z 1001); it adds the words, takes the
  // touches, and holds the flight's last frame while the session moves.
  return (
    <div ref={root} data-testid="migration-sequence" data-in-game={inGame || undefined} style={{ zIndex: JUMP_LAYER + 1 }}
      className={`fixed inset-0 overflow-hidden font-v2-ui ${inGame && !(jump.stage === 'reveal' && !still) ? '' : 'bg-[#02040a]'}`}>
      {/* While the main game prepares, the camera seems to keep closing on the world, as the game then does. */}
      {inGame && jump.stage === 'reveal' && still && <img ref={picture} src={still} alt="" className="absolute inset-0 size-full object-cover" />}
      {!inGame && jump.world && (
        <Canvas dpr={[1, 1.5]} gl={{ antialias: true, powerPreference: 'high-performance' }} camera={{ fov: 45, near: 0.05, far: 4000, position: [0, 0, 1] }}>
          <Stage jump={jump} world={jump.world} clock={clock} />
        </Canvas>
      )}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_60%,rgba(0,0,0,.5))]" />
      {!inGame && <div ref={veil} aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[#02040a]" />}
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
