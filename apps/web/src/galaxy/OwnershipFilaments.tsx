import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useReducedMotionPreference } from './motion.js';
import type { PlanetNode, Vec3Tuple } from './scene.js';

/**
 * OWNERSHIP AS TOPOLOGY. D122.
 *
 * The caller's worlds are always joined. Selecting a foreign controlled world
 * temporarily joins that commander's worlds too; a neutral selection adds
 * nothing. The controller id is already public on every world, so this draws no
 * fact the galaxy payload did not already state.
 *
 * IT IS A STAR FROM THE CAPITAL, NOT A COMPLETE GRAPH. Owner call, and the first
 * version got it wrong: joining every pair of four worlds is six strings, and six
 * strings between four points is a MESH — it reads as a network of routes, which
 * is the one thing this must not be (a launched fleet flies a straight line and
 * these are not it). A capital with a thread out to each colony is three strings
 * for the same four worlds, and it says the true thing: a colony belongs to a
 * capital. Nothing here implies anything can travel along one.
 */
export interface OwnershipPair {
  key: string;
  from: PlanetNode;
  to: PlanetNode;
  kind: 'own' | 'selected';
}

/**
 * One thread from the capital to each of its colonies.
 *
 * A commander always has exactly one capital — it can be devastated but never
 * captured — so the hub is never ambiguous. Returning nothing when there is no
 * capital in the set is the honest fallback rather than picking an arbitrary hub:
 * a star drawn around the wrong centre would state a relationship that is not
 * there.
 */
const starFromCapital = (
  nodes: readonly PlanetNode[],
  kind: OwnershipPair['kind'],
): OwnershipPair[] => {
  const capital = nodes.find((node) => node.isCapital);
  if (!capital) return [];
  return nodes
    .filter((node) => node.id !== capital.id)
    .map((node) => ({
      key: `${kind}:${capital.id}:${node.id}`,
      from: capital,
      to: node,
      kind,
    }));
};

/**
 * THE STAR OF WHOEVER IS FOCUSED, AND NOTHING WHEN NOBODY IS. Owner call.
 *
 * The first version drew the caller's own worlds permanently and added a foreign
 * commander's on selection. On a disc of three hundred worlds that is a fixture
 * rather than an answer: it is on screen while the player is doing something else
 * entirely, so it stops being information and becomes furniture.
 *
 * Focus is the primitive this map is built on (D118: every world is focused before
 * it is opened), so the threads answer the question focus asks — "whose is this,
 * and what else is theirs" — and they answer it about the world under the
 * player's finger, whether that world is theirs or somebody else's. Focus nothing
 * and the disc is clean.
 *
 * A NEUTRAL FOCUS ADDS NOTHING, because there is no commander to belong to. That
 * falls out of `controllerPlayerId` being null rather than needing a case.
 */
export function ownershipPairs(
  nodes: readonly PlanetNode[],
  selectedId: string | null,
): OwnershipPair[] {
  if (selectedId === null) return [];
  const selected = nodes.find((node) => node.id === selectedId);
  if (!selected || selected.kind === 'NEUTRAL' || !selected.controllerPlayerId) return [];

  const theirs = nodes.filter(
    (node) => node.controllerPlayerId === selected.controllerPlayerId,
  );
  return starFromCapital(theirs, selected.isOwned ? 'own' : 'selected');
}

/**
 * A VEIL OF THREADS, NOT A ROAD. Owner call, from the first shipped version.
 *
 * It read as a motorway: one solid bright line between two worlds. The cause was
 * scale, not colour. The strands were separated by a FIXED 0.055 world units while
 * a near-colony leg is 8.7 world units long and a far one 74 — so the separation
 * was 0.6% of the leg, comfortably sub-pixel at every camera distance this map is
 * flown at. Three one-pixel lines landed on the same pixels, and `AdditiveBlending`
 * summed their alphas into one opaque stroke.
 *
 * SO EVERY OFFSET IS A SHARE OF THE LEG. `VIEW.scale` is 50 game units to the
 * world unit and the disc is 50 world units across, so a rule written in world
 * units means one thing on a neighbour and another on a world across the map —
 * the same failure the invariants table records about durations written in
 * minutes. Written as a share, a string weaves the same way at both ends of the
 * disc.
 */
const STRANDS = 5;
/** The curve needs resolution to weave; a straight-ish line would not. */
const SEGMENTS = 40;

/**
 * How far apart the outermost threads sit, as a share of the leg, and the world
 * units that share is clamped between.
 *
 * The floor keeps two adjacent worlds from collapsing back into one stroke; the
 * ceiling stops a cross-disc pair fanning into a ribbon. HALVED once already on
 * the owner's note — the first pass over-corrected the motorway and the threads
 * read as separate cables rather than as one bundle. About eight screen pixels
 * across the whole fan on a near leg, which is a bundle you can see through.
 */
const SPREAD_SHARE = 0.014;
const SPREAD_MIN = 0.10;
const SPREAD_MAX = 0.5;

/** How many times a thread crosses its neighbours over one leg. */
const WEAVE_TURNS = 2.5;

/**
 * FAINT ENOUGH THAT CROSSING THREADS STILL READ AS THREADS.
 *
 * Additive, so wherever strings overlap — and they overlap most where several
 * legs converge on a capital — the alphas SUM. At the old 0.18 that convergence
 * was a bright knot; the number has to be chosen for the overlap rather than for
 * a single thread in open space. Five strands at 0.055 sum to 0.28 in the worst
 * case, which is still a veil.
 *
 * The selected foreign topology is fainter again: it is a transient answer to
 * "whose are these", and it must never compete with the player's own worlds.
 */
const ALPHA_OWN = 0.055;
const ALPHA_SELECTED = 0.042;

/** A stable 0..1 from a key, so a thread's phase never changes between frames. */
const unitFrom = (text: string): number => {
  let value = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    value = Math.imul(value ^ text.charCodeAt(i), 16777619);
  }
  return ((value ^ (value >>> 16)) >>> 0) / 0x1_0000_0000;
};

/**
 * A point on one thread, at `t` along the leg.
 *
 * THE SHAPE IS A BEZIER WITH A WEAVE ON TOP. `spread` fans the threads apart
 * across the leg's perpendicular and `weave` swings each one across its
 * neighbours, both faded by `sin(pi t)` so every thread converges on the world at
 * either end — which is what makes the bundle read as tied to two worlds rather
 * than as a ribbon passing near them.
 *
 * Both are passed in already resolved to world units by the caller, because they
 * are shares of THIS leg and the caller is what knows how long it is.
 */
const pointAlong = (
  start: Vec3Tuple,
  control: Vec3Tuple,
  end: Vec3Tuple,
  perpendicular: Vec3Tuple,
  t: number,
  strand: number,
  phase: number,
  spread: number,
): Vec3Tuple => {
  const inverse = 1 - t;
  const veil = Math.sin(Math.PI * t);
  // The weave is a share of the spread, so threads cross without ever unbundling.
  const weave = Math.sin(t * Math.PI * 2 * WEAVE_TURNS + phase) * spread * 0.45;
  const sideways = (strand * spread + weave) * veil;
  // A little lift as well, so the bundle has depth rather than lying flat.
  const lift = strand * spread * 0.35 * veil;
  return [
    inverse * inverse * start[0] + 2 * inverse * t * control[0] + t * t * end[0]
      + perpendicular[0] * sideways,
    inverse * inverse * start[1] + 2 * inverse * t * control[1] + t * t * end[1] + lift,
    inverse * inverse * start[2] + 2 * inverse * t * control[2] + t * t * end[2]
      + perpendicular[2] * sideways,
  ];
};

/** One immutable line buffer for the selected ownership topology. */
export function filamentGeometry(pairs: readonly OwnershipPair[]): THREE.BufferGeometry | null {
  if (pairs.length === 0) return null;

  const positions: number[] = [];
  const alphas: number[] = [];

  for (const pair of pairs) {
    const dx = pair.to.position[0] - pair.from.position[0];
    const dy = pair.to.position[1] - pair.from.position[1];
    const dz = pair.to.position[2] - pair.from.position[2];
    const distance = Math.hypot(dx, dy, dz);
    if (distance < 1e-4) continue;

    const ux = dx / distance;
    const uy = dy / distance;
    const uz = dz / distance;
    const startClearance = Math.min(distance * 0.2, pair.from.radius * 1.18);
    const endClearance = Math.min(distance * 0.2, pair.to.radius * 1.18);
    const start: Vec3Tuple = [
      pair.from.position[0] + ux * startClearance,
      pair.from.position[1] + uy * startClearance,
      pair.from.position[2] + uz * startClearance,
    ];
    const end: Vec3Tuple = [
      pair.to.position[0] - ux * endClearance,
      pair.to.position[1] - uy * endClearance,
      pair.to.position[2] - uz * endClearance,
    ];

    const horizontal = Math.hypot(dx, dz);
    const perpendicular: Vec3Tuple = horizontal > 1e-4
      ? [-dz / horizontal, 0, dx / horizontal]
      : [1, 0, 0];
    const direction = unitFrom(pair.key) < 0.5 ? -1 : 1;
    const bend = Math.min(1.8, Math.max(0.35, distance * 0.04)) * direction;
    const control: Vec3Tuple = [
      (start[0] + end[0]) / 2 + perpendicular[0] * bend,
      (start[1] + end[1]) / 2 + Math.min(0.7, distance * 0.018),
      (start[2] + end[2]) / 2 + perpendicular[2] * bend,
    ];

    // Half the total fan, in world units, resolved from THIS leg — see SPREAD_SHARE.
    const spread = Math.min(SPREAD_MAX, Math.max(SPREAD_MIN, distance * SPREAD_SHARE))
      / ((STRANDS - 1) / 2);
    const middle = (STRANDS - 1) / 2;

    for (let strandIndex = 0; strandIndex < STRANDS; strandIndex += 1) {
      const strand = strandIndex - middle;
      const phase = unitFrom(`${pair.key}:${String(strandIndex)}`) * Math.PI * 2;
      let previous = pointAlong(start, control, end, perpendicular, 0, strand, phase, spread);
      for (let segment = 1; segment <= SEGMENTS; segment += 1) {
        const t = segment / SEGMENTS;
        const current = pointAlong(start, control, end, perpendicular, t, strand, phase, spread);
        positions.push(...previous, ...current);
        const edgeFade = 0.58 + Math.sin(Math.PI * t) * 0.42;
        const base = pair.kind === 'own' ? ALPHA_OWN : ALPHA_SELECTED;
        // The centre thread carries the line; the outer ones are the tulle.
        const strandWeight = 1 - (Math.abs(strand) / (middle + 1)) * 0.45;
        const alpha = base * edgeFade * strandWeight;
        alphas.push(alpha, alpha);
        previous = current;
      }
    }
  }

  if (positions.length === 0) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('aAlpha', new THREE.Float32BufferAttribute(alphas, 1));
  return geometry;
}

export function OwnershipFilaments({
  nodes,
  selectedId,
}: {
  nodes: readonly PlanetNode[];
  selectedId: string | null;
}) {
  const reducedMotion = useReducedMotionPreference();
  const pairs = useMemo(() => ownershipPairs(nodes, selectedId), [nodes, selectedId]);
  const geometry = useMemo(() => filamentGeometry(pairs), [pairs]);
  const material = useMemo(
    () => new THREE.ShaderMaterial({
      uniforms: { uBreath: { value: 1 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      vertexShader: `
        attribute float aAlpha;
        varying float vAlpha;
        void main() {
          vAlpha = aAlpha;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uBreath;
        varying float vAlpha;
        void main() {
          gl_FragColor = vec4(vec3(0.9, 0.95, 1.0), vAlpha * uBreath);
        }
      `,
    }),
    [],
  );
  const line = useRef<THREE.LineSegments>(null);

  useFrame(({ clock }) => {
    material.uniforms.uBreath!.value = reducedMotion
      ? 0.92
      : 0.88 + Math.sin(clock.elapsedTime * 0.72) * 0.12;
  });

  useEffect(
    () => () => {
      geometry?.dispose();
    },
    [geometry],
  );
  useEffect(() => () => { material.dispose(); }, [material]);

  if (!geometry) return null;

  return (
    <lineSegments
      ref={line}
      name="ownership-filaments"
      geometry={geometry}
      frustumCulled={false}
      renderOrder={-2}
      raycast={() => null}
    >
      <primitive object={material} attach="material" />
    </lineSegments>
  );
}
