import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { DEBRIS } from '@astera/rules';
import { MODEL } from '../ui/assets.js';
import { unitModel } from './model.js';
import { toWorld, type PlanetNode, type Vec3Tuple } from './scene.js';
import { markHit, wasTap } from './tap.js';

/**
 * WRECKAGE ON THE DISC. D32.
 *
 * A battle leaves a field at the defender's coordinates, and everybody can see it.
 * That visibility IS the mechanic: a private fight becomes a public, timed,
 * contested second event, and somebody who is not at war gets a reason to watch
 * other people's.
 *
 * DRAWN AS A RING, NOT A CLOUD, AND THAT IS A BUG FIX. The first version scattered
 * motes in a sphere centred on the planet with a 0.85-radius tap sphere around it.
 * Planets are drawn between radius 0.44 and 1.4, so on anything but the largest
 * world the wreckage completely covered the planet — and since the tap target sat
 * in front, **a planet with debris over it could not be selected at all**. A player
 * could no longer open the dossier of the one world in the galaxy they had most
 * reason to look at.
 *
 * A ring clear of the surface fixes it geometrically rather than by fiddling with
 * hit-test order: the centre, the top and the bottom of the world are all open, and
 * the wreckage is tappable everywhere the planet is not. It also reads better —
 * debris settles into orbit, and a planet is never destroyed (the ownership
 * pillar), so drawing rubble ON one always said the wrong thing.
 */

/**
 * How far the ring sits out, as a MULTIPLE of the planet's own radius.
 *
 * It was a flat 0.42 world units of clearance, which is a different proportion on
 * each of the three planet sizes: on a 0.44-radius world the ring came out to 2.6
 * times the planet and dwarfed it, while on a 1.4-radius one it was barely half
 * again. Since one chunk's size is a fixed fraction OF THE RING, an oversized ring
 * is also an oversized boulder — so a small world got the coarsest-looking
 * wreckage, which is exactly backwards.
 *
 * Proportional, every world reads the same and the rubble scales with the thing it
 * is orbiting.
 */
const RING_RATIO = 1.5;
/** ...but never closer than this, so the band always clears the surface. */
const MIN_CLEARANCE = 0.22;

/** Half-thickness of the tap target. Proportional too, with a thumb-sized floor. */
const TUBE_RATIO = 0.28;
const MIN_TUBE = 0.24;

/**
 * The model's own axis, and what has to happen to it.
 *
 * The ring is authored in the YZ plane — its bounding box is 0.21 thick in X
 * against 0.95 and 0.97 in the other two — so its axis is +X. The disc's worlds
 * are laid out around +Y, so a quarter turn about Z stands the ring up the right
 * way. Measured off the file rather than guessed; see the note in `models.mjs`.
 */
const LIE_FLAT: readonly [number, number, number] = [0, 0, Math.PI / 2];

/**
 * HOW FLAT THE RING IS PRESSED, and why this is the lever rather than the model.
 *
 * The asset is a torus of rubble with real volume, and at full scale it reads as a
 * heavy collar of boulders rather than as a ring — three chunks deep, thicker than
 * the gap it leaves. Pressing the ring's own axis brings it towards a band.

 * Owner's figure, set between two versions they saw: unpressed it was a collar,
 * and 0.34 was flatter than they wanted.
 *
 * WHAT THIS CANNOT DO, so nobody tries: the size of one chunk RELATIVE TO the ring
 * is baked into the mesh. Scaling the object changes both together, so no number
 * here makes the rubble finer-grained — it only makes the band shallower. Genuinely
 * fine, sand-like particles would be a different model with more, smaller pieces.
 */
const FLATTEN = 0.6;

useGLTF.preload(MODEL.debris, false);

export interface WreckView {
  id: string;
  /** The world it orbits, or null when the battle was in open space. D150. */
  planetId: string | null;
  /** Where it actually is. Authoritative for every field, world or void. */
  at: { x: number; y: number; z: number };
  alloy: number;
  crystal: number;
  minutesLeft: number;
}

/**
 * The ring a void field is drawn at, in the same units a planet radius is in.
 *
 * A wreck over a world is sized against that world so the ring reads as orbiting
 * it. A pirate battle has no world, so it needs a size of its own — small enough
 * that it cannot be mistaken for a planet, large enough to be tappable at mobile
 * map scale. It sits between the smallest and largest world rings on purpose.
 */
const VOID_RADIUS = 0.5;

/**
 * WHERE A FIELD IS, AND THE ONLY PLACE THAT IS DECIDED.
 *
 * The ring has always been drawn from the field's own coordinates, which the
 * server sends on every field since D150. The CAMERA resolved it through the
 * planet the battle happened over instead — so a pirate wreck, which has no
 * planet, produced no subject and tapping it silently did nothing: no focus, no
 * zoom, and no way for the player to tell they had not simply missed it.
 *
 * One function, read by the renderer and the rig, so the two cannot disagree
 * again about where a wreck is.
 */
export const wreckPosition = (wreck: WreckView): Vec3Tuple => toWorld(wreck.at);

export function Wrecks({
  wrecks,
  nodes,
  focusedId,
  onSelect,
}: {
  wrecks: readonly WreckView[];
  /** The drawn worlds — a ring has to be sized against the planet it orbits. */
  nodes: readonly PlanetNode[];
  focusedId: string | null;
  onSelect: (id: string) => void;
}) {
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  /**
   * POSITION COMES FROM THE FIELD, SIZE COMES FROM THE WORLD IF THERE IS ONE.
   *
   * This used to resolve both through `planetId`, which quietly dropped any field
   * whose world was not currently drawn and could not represent a battle with no
   * world at all. Since D150 the server sends the coordinates on every field, so
   * a wreck is never missing because of what is around it — only its RING is
   * sized against a planet, and a void field brings its own size.
   */
  const placed = useMemo(
    () =>
      wrecks.map((w) => {
        const node = w.planetId === null ? undefined : byId.get(w.planetId);
        return {
          w,
          at: wreckPosition(w),
          radius: node?.radius ?? VOID_RADIUS,
        };
      }),
    [wrecks, byId],
  );

  if (placed.length === 0) return null;

  return (
    <>
      {placed.map(({ w, at, radius }) => (
        <Wreck
          key={w.id}
          wreck={w}
          at={at}
          planetRadius={radius}
          focused={focusedId === w.id}
          onSelect={() => {
            onSelect(w.id);
          }}
        />
      ))}
    </>
  );
}

function Wreck({
  wreck,
  at,
  planetRadius,
  focused,
  onSelect,
}: {
  wreck: WreckView;
  at: Vec3Tuple;
  planetRadius: number;
  focused: boolean;
  onSelect: () => void;
}) {
  /**
   * Pirate / open-space battle debris (`wreck.planetId === null`) is drawn as a
   * compact, dense cluster (outer radius ~0.42, flatten = 1.6) with the inner hole closed up.
   */
  const isVoid = wreck.planetId === null;
  const baseRingRadius = Math.max(planetRadius * RING_RATIO, planetRadius + MIN_CLEARANCE);
  const ringRadius = isVoid ? 0.35 : baseRingRadius;
  const tube = isVoid ? 0.4 : Math.max(ringRadius * TUBE_RATIO, MIN_TUBE);
  const flatten = isVoid ? 1 : FLATTEN;

  /**
   * THE MODEL IS THE WHOLE RING, NOT ONE PIECE OF IT.
   *
   * Worth stating plainly, because the first integration got it exactly backwards:
   * it treated the file as a single chunk of wreckage and instanced it fourteen
   * times around a circle, which drew fourteen complete rubble rings orbiting the
   * planet like a chain of tyres. The asset is an annulus already built out of
   * dozens of small pieces — one object, placed once.
   *
   * That also makes it cheap: 2,087 triangles per field rather than 29,000.
   */
  const { scene } = useGLTF(MODEL.debris, false);
  const source = useMemo(() => unitModel(scene), [scene]);

  /**
   * What is left, as a fraction of a field's whole life. Drives the fade.
   *
   * READ FROM THE RULE, NOT WRITTEN OUT. This was the literal 180 of the old
   * three-hour decay; when D63 cut it to twenty minutes the ratio could never
   * exceed 0.11, so every wreck in the galaxy rendered at the bottom of its
   * opacity range from the instant it was created and "nearly gone is legible
   * without a label" stopped being true — silently, on a green build.
   */
  const life = Math.max(0, Math.min(1, wreck.minutesLeft / DEBRIS.decayMinutes));

  /**
   * The model's own material, cloned per field.
   *
   * Cloned rather than shared because each field fades on its own clock and one of
   * them may be focused — mutating the loader's cached material would tint every
   * wreck on the disc at once. Double-sided because the ring is a thin shell and
   * its far side faces the camera for half of every turn.
   */
  const material = useMemo(() => {
    if (!source) return null;
    const m = source.material.clone();
    m.side = THREE.DoubleSide;
    m.transparent = true;
    return m;
  }, [source]);

  useLayoutEffect(() => {
    if (!material) return;
    // Fades as the field decays, so "nearly gone" is legible without a label.
    // Never fully opaque: a little transparency lets the ring read as a scatter of
    // separate pieces rather than as one solid band of rock.
    material.opacity = 0.3 + life * 0.55;
    if ('emissive' in material && material.emissive instanceof THREE.Color) {
      material.emissive.set(focused ? '#ffb44d' : '#000000');
      if ('emissiveIntensity' in material) material.emissiveIntensity = focused ? 0.6 : 0;
    }
    material.needsUpdate = true;
  }, [material, life, focused]);

  /**
   * A per-field tilt and starting angle, seeded from the id.
   *
   * Every wreck would otherwise be the same ring at the same attitude, and a
   * galaxy with three battles in it would look stamped. Seeded rather than random
   * so a field does not jump to a new attitude on every refetch.
   */
  const attitude = useMemo(() => {
    let seed = 0;
    for (const c of wreck.id) seed = (seed * 31 + c.charCodeAt(0)) >>> 0;
    const rand = (): number => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0xffffffff;
    };
    return {
      // Kept shallow: a ring tipped past this stops reading as an orbit.
      tiltX: (rand() * 2 - 1) * 0.35,
      tiltZ: (rand() * 2 - 1) * 0.35,
      spin: rand() * Math.PI * 2,
    };
  }, [wreck.id]);

  const group = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    // Turning slowly, so it is alive on screen without asking for attention.
    if (group.current) group.current.rotation.y += dt * 0.12;
  });

  const pick = (event: ThreeEvent<PointerEvent>): void => {
    if (!wasTap()) return;
    markHit();
    event.stopPropagation();
    onSelect();
  };

  return (
    <group ref={group} position={at} rotation={[attitude.tiltX, attitude.spin, attitude.tiltZ]}>
      {source && material && (
        <mesh
          geometry={source.geometry}
          material={material}
          rotation={LIE_FLAT}
          scale={[(ringRadius + tube) * flatten, ringRadius + tube, ringRadius + tube]}
        />
      )}

      {/*
        THE TAP TARGET IS A TORUS, WHICH IS THE WHOLE POINT.

        A sphere here is what broke planet selection: it filled the centre. A torus
        is hollow, so the world inside it — and the space above and below — stay
        open for the planet's own hit test.
      */}
      <mesh onPointerUp={pick} rotation={[Math.PI / 2, 0, 0]} frustumCulled={false} renderOrder={-1}>
        <torusGeometry args={[ringRadius, tube, 6, 24]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}
