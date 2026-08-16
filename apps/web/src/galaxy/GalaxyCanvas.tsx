import { Suspense, useEffect, useMemo, useRef, type ComponentRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { AdaptiveDpr, Html, OrbitControls, Preload } from '@react-three/drei';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import type { Contact, GalaxyPlanet, PendingThread } from '../api/schemas.js';
import { Asteroids, BrightStars, Core, Disc, Dust, Nebula, Starfield } from './Environment.jsx';
import { OwnFleets, Traffic, WatchBeams } from './Fleets.jsx';
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

/**
 * The whole sphere, minus the two poles.
 *
 * You may fly under the galaxy and look up at it. The earlier clamp stopped at
 * 0.46π — just above the disc's own plane — which meant half of every orbit was a
 * wall: you could tilt to look down and then the camera simply refused. Space has
 * no floor and a galaxy has an underside.
 *
 * The poles themselves stay excluded by a hair. Exactly overhead, azimuth becomes
 * undefined and the view snaps a quarter turn for no reason the player can see.
 */
const MIN_POLAR = Math.PI * 0.04;
const MAX_POLAR = Math.PI * 0.96;

/** How far past the rim you may drift before the camera is quietly walked back. */
const LEASH = DISC_RADIUS * 1.15;

/** Seconds spent easing onto a new subject. Long enough to follow, short enough not to wait. */
const EASE = 0.5;

/** Asteroid orbits take 15–40 minutes. Twelve frames a second is imperceptible. */
const AMBIENT_FPS = 12;

export interface GalaxyCanvasProps {
  planets: readonly GalaxyPlanet[];
  /** Your own missions. Inbound attacks carry no path and are not drawn as one. */
  pending: readonly PendingThread[];
  /** Everyone else's, already stripped of anything identifying by the server. */
  contacts: readonly Contact[];
  /** Ids of the planets your telescopes are pointed at. Yours alone to know. */
  watching: readonly string[];
  seed: number | undefined;
  seasonStart: Date | undefined;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Bumped by the HOME button to re-centre on the player's own world. */
  homeSignal: number;
}

export function GalaxyCanvas({
  planets,
  pending,
  contacts,
  watching,
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

  /** The camera's subject: whatever world is open, so orbiting turns around it. */
  const focus = useMemo<[number, number, number] | null>(() => {
    const node = nodes.find((n) => n.id === selectedId);
    return node ? node.position : null;
  }, [nodes, selectedId]);

  const watched = useMemo(() => {
    const wanted = new Set(watching);
    return planets.filter((p) => wanted.has(p.id)).map((p) => toWorld(p.position));
  }, [planets, watching]);

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
        <WatchBeams from={home} targets={watched} />
        <OwnFleets pending={pending} />
        <Traffic contacts={contacts} />
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
      <Rig home={home} homeSignal={homeSignal} focus={focus} />
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
 * Free to roam the whole disc — an earlier version tethered the camera near the
 * player's own planet, which left half the galaxy unreachable and unclickable.
 * Three things make free roaming comfortable rather than merely possible:
 *
 * ORBIT AROUND WHAT YOU TAPPED. The single biggest comfort factor in an orbit
 * camera is whether the pivot is the thing you are looking at. Rotating a distant
 * pivot swings your subject across the screen and out of frame, and the player
 * fights the camera the whole way. Selecting a world eases the pivot onto it.
 *
 * ZOOM WHERE YOU POINT. Pinching or scrolling moves toward the cursor rather than
 * the centre of the screen, so reaching a world in the corner is one gesture
 * instead of zoom-then-pan-then-zoom.
 *
 * A LEASH RATHER THAN A WALL. Panning is unrestricted in the moment; drift far
 * enough past the rim and the pivot is eased back over the next second. You cannot
 * get lost in empty space, and you are never stopped dead mid-gesture.
 */
function Rig({
  home,
  homeSignal,
  focus,
}: {
  home: [number, number, number];
  homeSignal: number;
  /** The selected world, if any — the camera's subject. */
  focus: [number, number, number] | null;
}) {
  const ref = useRef<ComponentRef<typeof OrbitControls>>(null);
  const invalidate = useThree((state) => state.invalidate);
  /** Where the pivot is heading, and how much of the ease is left. */
  const ease = useRef<{ to: THREE.Vector3; left: number } | null>(null);

  const goTo = (x: number, y: number, z: number): void => {
    ease.current = { to: new THREE.Vector3(x, y, z), left: EASE };
    invalidate();
  };

  // HOME re-frames rather than teleports: an instant cut loses every sense of
  // where you were, and re-orienting afterwards costs more than the half second.
  useEffect(() => {
    const controls = ref.current;
    if (!controls) return;
    if (homeSignal === 0) {
      controls.target.set(home[0], home[1], home[2]);
      controls.object.position.set(home[0] + 12, 16, home[2] + 20);
      controls.update();
      return;
    }
    goTo(home[0], home[1], home[2]);
  }, [home, homeSignal]);

  useEffect(() => {
    // `focus` is memoised upstream, so this fires on a change of subject and not
    // on every render of the galaxy.
    if (focus) goTo(focus[0], focus[1], focus[2]);
  }, [focus]);

  useFrame((_, delta) => {
    const controls = ref.current;
    if (!controls) return;

    /**
     * The leash. Checked continuously rather than on release, because a player who
     * has flung the camera into the void wants it back before they let go — and
     * because the correction is a lerp, it reads as the galaxy pulling rather than
     * as an edge they hit.
     */
    if (!ease.current) {
      const t = controls.target;
      const flat = Math.hypot(t.x, t.z);
      if (flat > LEASH || Math.abs(t.y) > LEASH * 0.5) {
        const k = flat > LEASH ? LEASH / flat : 1;
        goTo(t.x * k, THREE.MathUtils.clamp(t.y, -LEASH * 0.5, LEASH * 0.5), t.z * k);
      }
    }

    const move = ease.current;
    if (!move) return;

    // Frame-rate independent easing: the same curve at 30fps and at 120.
    const step = 1 - Math.pow(0.001, delta / Math.max(0.001, move.left + delta));
    const previous = controls.target.clone();
    controls.target.lerp(move.to, Math.min(1, step));
    // The camera follows its pivot, so the framing is preserved and only the
    // subject changes. Moving the pivot alone would swing the view instead.
    controls.object.position.add(controls.target.clone().sub(previous));
    controls.update();
    invalidate();

    move.left -= delta;
    if (move.left <= 0 || controls.target.distanceToSquared(move.to) < 0.0004) {
      controls.target.copy(move.to);
      controls.update();
      ease.current = null;
    }
  });

  return (
    <OrbitControls
      ref={ref}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.5}
      zoomSpeed={0.9}
      panSpeed={0.9}
      zoomToCursor
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
