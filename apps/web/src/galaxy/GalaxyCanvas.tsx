import { Suspense, useEffect, useMemo, useRef, type ComponentRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { AdaptiveDpr, Html, OrbitControls, Preload } from '@react-three/drei';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import type { GalaxyPlanet } from '../api/schemas.js';
import { Asteroids, BrightStars, Core, Disc, Dust, Nebula, Starfield } from './Environment.jsx';
import { PlanetField } from './PlanetField.jsx';
import { DISC_RADIUS, asteroidsOf, planetNodes, toWorld, type PlanetNode } from './scene.js';
import { installTapGuard, wasTap } from './tap.js';

/**
 * THE GAME SURFACE.
 *
 * Not a screen the player visits — the thing every other screen is drawn on top
 * of. `decisions.md` D1 puts it plainly: the information game "makes the 3D galaxy
 * an interface rather than a target list".
 *
 * PERFORMANCE SHAPE, which is what keeps this from being a slideshow on a phone:
 *
 *   · The galaxy is instanced — one draw call per distinct planet render rather
 *     than four meshes per planet.
 *   · Rendering is ON DEMAND. A loop running sixty times a second is the biggest
 *     battery drain a page can have, and this scene is usually still. The camera
 *     invalidates itself while it moves; a slow ticker invalidates for the
 *     asteroids and the dust. When nothing is happening, nothing renders.
 *   · `AdaptiveDpr` drops resolution while the camera moves and restores it when
 *     it settles, which is where a mid-range phone actually wins its frames.
 */

/** Never edge-on, never straight down — the disc should always read as a disc. */
const MIN_POLAR = Math.PI * 0.1;
const MAX_POLAR = Math.PI * 0.46;

/** Asteroid orbits take 15–40 minutes. Twelve frames a second is imperceptible. */
const AMBIENT_FPS = 12;

export interface GalaxyCanvasProps {
  planets: readonly GalaxyPlanet[];
  seed: number | undefined;
  seasonStart: Date | undefined;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Bumped by the HOME button to re-centre on the player's own world. */
  homeSignal: number;
}

export function GalaxyCanvas({
  planets,
  seed,
  seasonStart,
  selectedId,
  onSelect,
  homeSignal,
}: GalaxyCanvasProps) {
  const nodes = useMemo(() => planetNodes(planets), [planets]);
  const home = useMemo<[number, number, number]>(() => {
    const self = planets.find((p) => p.isSelf);
    return self ? toWorld(self.position) : [0, 0, 0];
  }, [planets]);

  const asteroids = useMemo(() => (seed === undefined ? [] : asteroidsOf(seed)), [seed]);

  useEffect(() => installTapGuard(), []);

  return (
    <Canvas
      frameloop="demand"
      camera={{ position: [home[0] + 12, 16, home[2] + 20], fov: 45, near: 0.1, far: 600 }}
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onPointerMissed={() => {
        // Same rule as selecting: releasing after a pan is not a click on space.
        if (wasTap()) onSelect(null);
      }}
      style={{ position: 'absolute', inset: 0, touchAction: 'none' }}
    >
      <color attach="background" args={['#04060c']} />
      {/*
        Atmospheric perspective. Distant worlds fade into the nebula instead of
        staying crisp, which is most of what makes a scene read as deep rather than
        as objects on a black sheet. Far enough out that nothing interactive hides.
      */}
      <fog attach="fog" args={['#070c18', 55, 210]} />

      {/* One key light, from the same upper-left the planet renders assume, so the
          asteroids are shaded consistently with everything else. */}
      <ambientLight intensity={0.35} />
      <directionalLight position={[-8, 12, 9]} intensity={2.2} />

      <Nebula />
      <Core />
      <Starfield />
      <BrightStars />
      <Dust />
      <Disc />

      {seasonStart && asteroids.length > 0 && (
        <Asteroids asteroids={asteroids} seasonStart={seasonStart} />
      )}

      <Suspense fallback={null}>
        <PlanetField nodes={nodes} selectedId={selectedId} onSelect={onSelect} />
        <Labels nodes={nodes} selectedId={selectedId} />
        <Preload all />
      </Suspense>

      {/*
        Bloom is the difference between "lights" and "light". It is the one
        post-process worth its cost here: everything bright in this scene is
        additive already, so a small mipmap kernel does all the work.
      */}
      <EffectComposer enableNormalPass={false}>
        <Bloom intensity={0.55} luminanceThreshold={0.62} luminanceSmoothing={0.35} mipmapBlur />
        <Vignette eskil={false} offset={0.24} darkness={0.7} />
      </EffectComposer>

      <AdaptiveDpr pixelated={false} />
      <DevBridge />
      <Rig home={home} homeSignal={homeSignal} />
      <AmbientTicker />
    </Canvas>
  );
}

/**
 * Names, only where they earn the pixels.
 *
 * Semantic zoom: labelling every world at every distance is how a galaxy map
 * becomes unreadable. Your own planet, an open window and the current selection
 * are the only three things a player looks for by name.
 */
function Labels({ nodes, selectedId }: { nodes: readonly PlanetNode[]; selectedId: string | null }) {
  const marked = nodes.filter(
    (node) => node.id === selectedId || node.stance === 'self' || node.stance === 'window',
  );

  return (
    <>
      {marked.map((node) => (
        <Html
          key={node.id}
          position={[node.position[0], node.position[1] + node.radius * 1.85, node.position[2]]}
          center
          distanceFactor={9}
          zIndexRange={[10, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <span
            className={`whitespace-nowrap font-display text-[12px] uppercase tracking-[0.16em] ${
              node.stance === 'window' ? 'text-opportunity' : 'text-bone'
            }`}
            style={{ textShadow: '0 0 10px rgba(0,0,0,0.95)' }}
          >
            {node.name}
          </span>
        </Html>
      ))}
    </>
  );
}

/**
 * Camera behaviour.
 *
 * Free to roam the whole disc. The earlier version tethered the camera near the
 * player's own planet, which left half the galaxy unreachable and unclickable —
 * the opposite of a place you can explore. Panning is unrestricted, only the tilt
 * is clamped, and HOME always brings you back, so "lost" is never a state you can
 * get stuck in.
 */
function Rig({ home, homeSignal }: { home: [number, number, number]; homeSignal: number }) {
  const ref = useRef<ComponentRef<typeof OrbitControls>>(null);

  useEffect(() => {
    const controls = ref.current;
    if (!controls) return;
    controls.target.set(home[0], home[1], home[2]);
    controls.object.position.set(home[0] + 12, 16, home[2] + 20);
    controls.update();
  }, [home, homeSignal]);

  return (
    <OrbitControls
      ref={ref}
      makeDefault
      enableDamping
      dampingFactor={0.075}
      rotateSpeed={0.5}
      zoomSpeed={0.9}
      panSpeed={0.9}
      minPolarAngle={MIN_POLAR}
      maxPolarAngle={MAX_POLAR}
      minDistance={1.2}
      // Far enough to see the whole disc at once, and no further — past this the
      // galaxy is a smudge and the player has lost their bearings.
      maxDistance={DISC_RADIUS * 3}
      screenSpacePanning
      mouseButtons={{
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      }}
      touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}
    />
  );
}

/**
 * A handle on the scene, in development only.
 *
 * R3F stopped exposing its store on the canvas element, and a 3D scene cannot be
 * debugged from the outside — "the planets are missing" has a dozen possible
 * causes and only the live scene graph distinguishes them. Stripped from
 * production builds by the `DEV` guard.
 */
interface DebugWindow {
  __galaxy?: unknown;
}

function DevBridge() {
  const state = useThree();
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as DebugWindow).__galaxy = state;
  }, [state]);
  return null;
}

/**
 * Requests frames for the things that move on their own.
 *
 * With `frameloop="demand"` nothing renders unless something asks. The camera asks
 * while it is moving; this asks slowly and constantly, so the asteroids and the
 * dust keep drifting without paying for sixty frames a second of a still scene.
 */
function AmbientTicker() {
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    const id = setInterval(() => {
      invalidate();
    }, 1000 / AMBIENT_FPS);
    return () => {
      clearInterval(id);
    };
  }, [invalidate]);

  return null;
}
