import { Suspense, useMemo, useRef, type ReactNode } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { AdaptiveDpr, Preload, useGLTF } from '@react-three/drei';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { ASTEROID_MODELS, MODEL, MODEL_FACING, SATELLITE_MODEL } from '../ui/assets.js';
import { BrightStars, Nebula, Starfield, softGlow } from '../galaxy/Environment.jsx';
import { orientedCraft, unitModel } from '../galaxy/model.js';
import { place, placeVector, sizeOf, type Framing } from './layout.js';

/**
 * THE FRONT DOOR, AS A PLACE RATHER THAN A FORM. D21.
 *
 * A player deciding whether to spend two weeks in this galaxy is looking at one
 * screen, and that screen has to answer "what is this" before any copy does. So the
 * landing page is the game's own sky: the same nebula, the same stars, the same
 * hulls and instruments that will be in orbit around their planet an hour later.
 *
 * NOTHING HERE IS SHARED WITH THE GAME SURFACE EXCEPT ITS PARTS. `GalaxyCanvas` is
 * driven by real data, has a fog layer, a tap router and a focus system, and every
 * one of those would be a liability on a page whose job is to look good while
 * somebody types a password. This scene is a fixed, seedless composition — no API,
 * no state, no interaction.
 *
 * COMPOSED FOR A PORTRAIT PHONE, AND FRAMED FOR EVERYTHING ELSE. Every object is
 * positioned in normalised screen coordinates (`layout.ts`), so the picture is the
 * picture at any aspect ratio rather than something authored on a wide window and
 * cropped to a dark corner on a phone.
 *
 * THE COPY OWNS THE TOP AND THE BOTTOM. The premise sits in the upper third and the
 * two doors in the lower sixth, so the hero world is placed to break the RIGHT edge
 * at mid-height: opposite the left-aligned text, out of the way of both, and large
 * enough to be a place rather than a dot.
 *
 * IT MUST STAY CHEAP. It renders behind a form, on a phone, for a visitor who has
 * not decided to play yet, and it is the first thing that could make them decide
 * not to. Under thirty draw calls with the backdrop; nothing allocates in the frame
 * loop; `AdaptiveDpr` gives resolution back when the device is struggling; `dpr` is
 * capped at 2 because beyond that a phone burns fill rate on pixels it cannot show.
 */

const FOV = 42;
const CAMERA_Z = 15;

/**
 * The hero world's placement, in one object.
 *
 * Its instruments orbit the same point, and two copies of a position are two
 * positions the moment one of them is nudged — the satellites would quietly detach
 * from the planet they belong to and orbit empty space beside it.
 */
const HERO = { u: 1.18, v: -0.3, depth: 16, fraction: 0.54 } as const;

const HERO_ART = '/assets/images/planets/planet_4.png';
const NEIGHBOUR_ART = '/assets/images/planets/planet_12.png';
const FAR_ART = '/assets/images/planets/planet_9.png';

export function LandingScene() {
  return (
    <Canvas
      className="!absolute inset-0"
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ position: [0, 0, CAMERA_Z], fov: FOV, near: 0.1, far: 900 }}
      // The page above is what the visitor interacts with; this is scenery.
      style={{ pointerEvents: 'none' }}
    >
      <color attach="background" args={['#04060c']} />
      <ambientLight intensity={0.7} />
      {/* Key light from the upper left, which is where the copy is — so the hero
          world is lit on the side facing the words rather than away from them. */}
      <directionalLight position={[-8, 10, 12]} intensity={2.1} color="#dbeaff" />
      {/* Warm bounce from below, so hulls read as objects rather than silhouettes. */}
      <directionalLight position={[6, -6, -4]} intensity={0.7} color="#ffb45e" />

      {/**
       * The backdrop, borrowed from the galaxy — but NOT its `Dust`.
       *
       * That field is 900 untextured points spread over the disc's radius, and it
       * is right there because the camera orbits the disc from outside it. This
       * camera sits INSIDE that radius, and an untextured `PointsMaterial` at close
       * range is not a mote — it is a flat blue square, several of which were
       * floating over the hero world looking like broken sprites.
       *
       * The rocks and the craft supply the near-field parallax that dust would have.
       */}
      <Nebula />
      <Starfield />
      <BrightStars />

      <Suspense fallback={null}>
        <Composition />
        <Preload all />
      </Suspense>

      <EffectComposer>
        <Bloom intensity={0.7} luminanceThreshold={0.3} luminanceSmoothing={0.5} mipmapBlur />
        <Vignette eskil={false} offset={0.22} darkness={0.8} />
      </EffectComposer>
      <AdaptiveDpr pixelated={false} />
    </Canvas>
  );
}

/**
 * Everything placed, at whatever aspect the window happens to be.
 *
 * Reading `size` from the render state rather than from `window` means a resize
 * re-runs this — and every position with it — instead of leaving the composition
 * framed for the shape the tab opened at.
 */
function Composition() {
  const size = useThree((state) => state.size);
  const framing = useMemo<Framing>(
    () => ({ fov: FOV, aspect: size.width / Math.max(1, size.height), cameraZ: CAMERA_Z }),
    [size.width, size.height],
  );

  return (
    <Drift>
      {/**
       * The hero world, breaking the lower-right corner.
       *
       * `u` past 1 is deliberate: a planet cropped by the frame is a place you are
       * near, while one floating clear of every edge is a marble on a table.
       *
       * The SIZE is the part that had to be argued down. At 0.78 of the view height
       * it filled the frame, which looked like a game and read like a poster — the
       * premise, which is the one thing this page has to deliver, was sitting on a
       * bright sunlit continent. Half the height and pushed into the corner keeps
       * the upper left dark, and the copy is the brightest thing on the page again.
       */}
      <Planet framing={framing} art={HERO_ART} {...HERO} glow="#5aa0ff" />
      {/* Its instruments, orbiting into the empty middle where they can be seen. */}
      <Instruments framing={framing} />

      <Planet
        framing={framing}
        art={NEIGHBOUR_ART}
        u={-0.72}
        v={0.42}
        depth={34}
        fraction={0.16}
        glow="#7fd0e0"
      />
      <Planet
        framing={framing}
        art={FAR_ART}
        u={0.34}
        v={-0.78}
        depth={62}
        fraction={0.1}
        glow="#8a7fd0"
      />

      <Rocks framing={framing} />
      <Traffic framing={framing} />
    </Drift>
  );
}

/**
 * One slow drift for the whole composition.
 *
 * A still image behind a login form reads as a screenshot. This is below the
 * threshold at which anyone watches it and above the one at which the page feels
 * dead — and because it moves the GROUP, it costs one matrix update rather than one
 * per object.
 */
function Drift({ children }: { children: ReactNode }) {
  const group = useRef<THREE.Group>(null);

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    g.rotation.y = Math.sin(t * 0.04) * 0.05;
    g.position.y = Math.sin(t * 0.08) * 0.3;
  });

  return <group ref={group}>{children}</group>;
}

/**
 * A world, drawn the way the galaxy draws them.
 *
 * Billboarded PNG renders rather than shaded spheres — the sixteen planet assets
 * are finished, lit illustrations, and wrapping one onto a sphere would fight its
 * baked lighting. Same decision as `PlanetField`, for the same reason.
 *
 * The glow behind it is doing real work, not decoration: these renders are dark on
 * their unlit side, and against a near-black sky a dark limb has no edge at all. The
 * halo is what makes the silhouette exist.
 */
function Planet({
  framing,
  art,
  u,
  v,
  depth,
  fraction,
  glow,
}: {
  framing: Framing;
  art: string;
  u: number;
  v: number;
  depth: number;
  /** Diameter as a share of the view's height at this depth. */
  fraction: number;
  glow: string;
}) {
  const texture = useLoader(THREE.TextureLoader, art);
  const halo = useMemo(() => softGlow(), []);
  const position = place(framing, u, v, depth);
  const size = sizeOf(framing, fraction, depth);

  return (
    <group position={position}>
      <sprite scale={[size * 1.75, size * 1.75, 1]}>
        <spriteMaterial
          map={halo}
          color={glow}
          transparent
          opacity={0.4}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
      <sprite scale={[size, size, 1]}>
        <spriteMaterial map={texture} transparent depthWrite={false} />
      </sprite>
    </group>
  );
}

/* ── hardware in orbit ──────────────────────────────────────── */

interface Orbit {
  model: string;
  /** Orbital radius as a share of the view height at the hero's depth. */
  radius: number;
  height: number;
  period: number;
  phase: number;
  scale: number;
}

/**
 * The satellites, on the hero world.
 *
 * Deliberately the four a player will actually put in orbit — Uplink, Foundry,
 * Derrick, Beacon — rather than a decorative arrangement. Somebody who plays for a
 * week and comes back to this page should recognise their own sky.
 */
const ORBITS: Orbit[] = [
  { model: SATELLITE_MODEL.UPLINK, radius: 0.62, height: 0.06, period: 38, phase: 2.4, scale: 0.85 },
  { model: SATELLITE_MODEL.DERRICK, radius: 0.74, height: -0.14, period: 48, phase: 3.6, scale: 0.8 },
  { model: SATELLITE_MODEL.FOUNDRY, radius: 0.55, height: 0.18, period: 30, phase: 4.6, scale: 0.7 },
  { model: SATELLITE_MODEL.BEACON, radius: 0.86, height: 0.02, period: 58, phase: 1.6, scale: 0.62 },
];

for (const orbit of ORBITS) useGLTF.preload(orbit.model, false);

function Instruments({ framing }: { framing: Framing }) {
  const centre = place(framing, HERO.u, HERO.v, HERO.depth);
  const unit = sizeOf(framing, 1, HERO.depth);

  return (
    <group position={centre}>
      {ORBITS.map((orbit) => (
        <Orbiting key={orbit.model + String(orbit.phase)} orbit={orbit} unit={unit} />
      ))}
    </group>
  );
}

function Orbiting({ orbit, unit }: { orbit: Orbit; unit: number }) {
  const { scene } = useGLTF(orbit.model, false);
  const body = useMemo(() => {
    const model = unitModel(scene);
    if (!model) return null;
    return new THREE.Mesh(model.geometry, model.material);
  }, [scene]);

  const group = useRef<THREE.Group>(null);
  const radius = orbit.radius * unit;

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const angle = orbit.phase + (state.clock.elapsedTime / orbit.period) * Math.PI * 2;
    g.position.set(Math.cos(angle) * radius, orbit.height * unit, Math.sin(angle) * radius * 0.55);
    // Slow tumble, so an instrument reads as a machine holding station rather than
    // a prop sliding around a circle.
    g.rotation.y = angle * 0.6;
    g.rotation.z = Math.sin(angle * 0.5) * 0.25;
  });

  if (!body) return null;
  return (
    <group ref={group} scale={orbit.scale}>
      <primitive object={body} />
    </group>
  );
}

/* ── rocks ──────────────────────────────────────────────────── */

interface Rock {
  model: string;
  u: number;
  v: number;
  depth: number;
  fraction: number;
  spin: number;
}

const ROCKS: Rock[] = [
  { model: ASTEROID_MODELS[0], u: -0.55, v: -0.34, depth: 13, fraction: 0.075, spin: 0.15 },
  { model: ASTEROID_MODELS[1], u: 0.18, v: 0.2, depth: 19, fraction: 0.05, spin: -0.2 },
  { model: ASTEROID_MODELS[2], u: -0.22, v: -0.62, depth: 11, fraction: 0.035, spin: 0.27 },
  { model: ASTEROID_MODELS[0], u: 0.62, v: 0.56, depth: 26, fraction: 0.045, spin: -0.12 },
  { model: ASTEROID_MODELS[1], u: -0.86, v: 0.02, depth: 22, fraction: 0.06, spin: 0.22 },
  { model: ASTEROID_MODELS[2], u: 0.05, v: -0.2, depth: 30, fraction: 0.04, spin: -0.09 },
];

for (const model of ASTEROID_MODELS) useGLTF.preload(model, false);

function Rocks({ framing }: { framing: Framing }) {
  return (
    <>
      {ROCKS.map((rock, i) => (
        <Rocky key={`${rock.model}-${String(i)}`} rock={rock} framing={framing} />
      ))}
    </>
  );
}

function Rocky({ rock, framing }: { rock: Rock; framing: Framing }) {
  const { scene } = useGLTF(rock.model, false);
  const unit = useMemo(() => unitModel(scene), [scene]);
  const mesh = useRef<THREE.Mesh>(null);
  const position = place(framing, rock.u, rock.v, rock.depth);
  const scale = sizeOf(framing, rock.fraction, rock.depth);

  useFrame((state) => {
    const m = mesh.current;
    if (!m) return;
    const t = state.clock.elapsedTime;
    m.rotation.x = t * rock.spin * 0.6;
    m.rotation.y = t * rock.spin;
    // A shallow bob, so the field is not a diorama of pinned objects.
    m.position.y = position[1] + Math.sin(t * 0.3 + rock.u * 4) * scale * 0.3;
  });

  if (!unit) return null;
  return (
    <mesh
      ref={mesh}
      geometry={unit.geometry}
      material={unit.material}
      position={position}
      scale={scale}
    />
  );
}

/* ── craft in transit ───────────────────────────────────────── */

interface Lane {
  model: string;
  /** Screen-space start and end: [u, v, depth]. */
  from: [number, number, number];
  to: [number, number, number];
  /** Seconds for one crossing. */
  duration: number;
  /** Where in the crossing it is at t=0, so they never leave together. */
  offset: number;
  fraction: number;
}

/**
 * Six craft, crossing the middle band where nothing else is.
 *
 * Lanes run edge to edge with |u| > 1 at both ends, so every craft enters and
 * leaves the frame rather than appearing and vanishing in open space.
 */
const LANES: Lane[] = [
  { model: MODEL.wasp, from: [-1.4, -0.5, 12], to: [1.4, 0.1, 20], duration: 17, offset: 0, fraction: 0.05 },
  { model: MODEL.wasp, from: [-1.4, -0.62, 12], to: [1.4, -0.02, 20], duration: 17, offset: 0.04, fraction: 0.045 },
  { model: MODEL.lance, from: [1.4, 0.62, 15], to: [-1.4, -0.3, 11], duration: 24, offset: 0.35, fraction: 0.07 },
  { model: MODEL.hauler, from: [-1.4, 0.5, 26], to: [1.4, -0.4, 14], duration: 33, offset: 0.62, fraction: 0.085 },
  { model: MODEL.probe, from: [0.4, -1.3, 10], to: [-0.7, 1.3, 24], duration: 21, offset: 0.2, fraction: 0.03 },
  { model: MODEL.bulwark, from: [1.4, -0.72, 21], to: [-1.4, 0.24, 17], duration: 38, offset: 0.5, fraction: 0.1 },
];

for (const lane of LANES) useGLTF.preload(lane.model, false);

function Traffic({ framing }: { framing: Framing }) {
  return (
    <>
      {LANES.map((lane, i) => (
        <Craft key={`${lane.model}-${String(i)}`} lane={lane} framing={framing} />
      ))}
    </>
  );
}

function Craft({ lane, framing }: { lane: Lane; framing: Framing }) {
  const { scene } = useGLTF(lane.model, false);

  /**
   * Turned onto +Z at build time, not at render time.
   *
   * Four of the five hulls were authored nose-down−X. `lookAt` aims +Z, so without
   * this every craft on this page would fly backwards — which is the sort of thing
   * nobody notices in review and everybody notices on a landing page.
   */
  const craft = useMemo(
    () => orientedCraft(scene, MODEL_FACING[lane.model] ?? '+z'),
    [scene, lane.model],
  );

  const group = useRef<THREE.Group>(null);
  const from = useMemo(() => placeVector(framing, ...lane.from), [framing, lane.from]);
  const to = useMemo(() => placeVector(framing, ...lane.to), [framing, lane.to]);
  // Sized at the midpoint's depth, so a craft crossing toward the camera does not
  // also visibly change build.
  const scale = sizeOf(framing, lane.fraction, (lane.from[2] + lane.to[2]) / 2);

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    // Wraps rather than reverses: a craft that flew backwards along its own lane
    // would be the one thing on this page that cannot happen in the game.
    const t = (((state.clock.elapsedTime / lane.duration + lane.offset) % 1) + 1) % 1;
    g.position.lerpVectors(from, to, t);
    g.lookAt(to);
  });

  return (
    <group ref={group} scale={scale}>
      <primitive object={craft} />
    </group>
  );
}
