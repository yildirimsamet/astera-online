import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { AsteroidView } from '../api/schemas.js';
import { ASTEROID_MODELS } from '../ui/assets.js';
import { asteroidRadius, asteroidWorldPosition, toWorld } from './scene.js';
import { unitModel } from './model.js';
import { markHit, wasTap } from './tap.js';
import { serverNow } from '../lib/clock.js';

/** No hit target smaller than this, whatever the rock. A fingertip is ~44 CSS px. */
const MIN_TOUCH = 0.42;

/**
 * THE FIELD — rocks crossing the disc. D19.
 *
 * Three low-poly models, so the whole field is three draw calls however many rocks
 * are in it. The models come out of the pipeline at ~1,500 triangles each
 * (`tools/models.mjs` simplifies this category hard, because forty rocks at the
 * raw 20,000 would be a million triangles of background on a phone).
 *
 * SIZE IS THE MESSAGE. Ore is a pure function of level, so a bigger rock is
 * literally worth more — a player sweeping the galaxy can pick a target without
 * opening a single panel. Nothing else about a rock is encoded visually, because
 * nothing else about it is free: how much is LEFT needs the panel.
 *
 * The tail is not decoration either. These move slowly enough to read as static in
 * a four-minute session, and a rock whose direction you cannot see is a rock you
 * cannot decide about — the whole question is whether your craft gets there first.
 */

/**
 * How much of an orbit the tail covers, as a fraction of the period.
 *
 * A FRACTION, not a fixed number of minutes. Periods run from about eight minutes
 * to twenty-eight depending on radius and speed, so a fixed eight-minute tail
 * would be a short arc on one rock and most of a full circle on another.
 *
 * Shortened from a twelfth (owner call). At the old speeds a twelfth of a
 * revolution read as a comet tail; at double the speed the same arc is a smear
 * that arrives before the rock does and makes the field look smudged. A
 * twenty-fourth keeps the heading obvious and leaves the rock as the thing you
 * look at.
 */
const TAIL_FRACTION = 1 / 24;

/** Model files, chosen per rock so the field does not look stamped. */
const MODELS = ASTEROID_MODELS;
for (const url of MODELS) useGLTF.preload(url, false);

interface Bucket {
  url: string;
  rocks: AsteroidView[];
}

export function Asteroids({
  asteroids,
  seasonStart,
  focusedIndex,
  onSelect,
}: {
  asteroids: readonly AsteroidView[];
  seasonStart: Date;
  focusedIndex: number | null;
  onSelect: (index: number) => void;
}) {
  const buckets = useMemo<Bucket[]>(() => {
    const out: Bucket[] = MODELS.map((url) => ({ url, rocks: [] }));
    for (const rock of asteroids) {
      // Deterministic per rock, so the same rock keeps the same body all season.
      out[rock.index % MODELS.length]!.rocks.push(rock);
    }
    return out.filter((b) => b.rocks.length > 0);
  }, [asteroids]);

  if (asteroids.length === 0) return null;

  return (
    <>
      {buckets.map((bucket) => (
        <RockBucket
          key={bucket.url}
          bucket={bucket}
          seasonStart={seasonStart}
          focusedIndex={focusedIndex}
          onSelect={onSelect}
        />
      ))}
      <Tails asteroids={asteroids} seasonStart={seasonStart} />
    </>
  );
}

const dummy = new THREE.Object3D();

function RockBucket({
  bucket,
  seasonStart,
  focusedIndex,
  onSelect,
}: {
  bucket: Bucket;
  seasonStart: Date;
  focusedIndex: number | null;
  onSelect: (index: number) => void;
}) {
  const { scene } = useGLTF(bucket.url, false);
  const mesh = useRef<THREE.InstancedMesh>(null);

  /**
   * The first mesh in the file, reused as instanced geometry.
   *
   * These are single-mesh exports; taking the first one rather than merging keeps
   * this simple and is checked by the pipeline's own inspect output. If a future
   * model arrives split into parts, the rock would render as one of them — visibly
   * wrong, and better than silently drawing nothing.
   */
  // Normalised to unit radius, so `asteroidRadius(level)` is a real world size.
  // See `model.ts` — instancing the raw geometry loses the node transform, which
  // for these quantised models means a rock 65,534 units across.
  const source = useMemo(() => unitModel(scene), [scene]);
  const hits = useRef<THREE.InstancedMesh>(null);

  const tint = useMemo(() => new THREE.Color(), []);

  useLayoutEffect(() => {
    const node = mesh.current;
    if (!node) return;
    bucket.rocks.forEach((rock, i) => {
      // Focus is a brightening rather than an outline: an outline on a tumbling
      // lump reads as a rendering fault, and these are already small.
      const lit = rock.index === focusedIndex ? 1.9 : 1;
      node.setColorAt(i, tint.setRGB(lit, lit, lit));
    });
    if (node.instanceColor) node.instanceColor.needsUpdate = true;
    if (!Array.isArray(node.material)) node.material.needsUpdate = true;
  }, [bucket.rocks, focusedIndex, tint]);

  useFrame(({ clock }) => {
    const node = mesh.current;
    if (!node) return;
    const now = serverNow();
    const t = clock.elapsedTime;

    const hit = hits.current;

    bucket.rocks.forEach((rock, i) => {
      const at = asteroidWorldPosition(rock, seasonStart, now);
      const r = asteroidRadius(rock.level);

      dummy.position.set(at[0], at[1], at[2]);
      /**
       * TUMBLE, not a turntable.
       *
       * The old version shared one rate across the field and turned at 0.08 rad/s
       * — about eighty seconds a revolution, which in a four-minute session is
       * indistinguishable from a rock glued to its heading. It also spun every
       * rock in step, which reads as one object drawn eleven times.
       *
       * Each rock now gets its own rate from its index, and the three axes run at
       * different multiples of it so the motion never settles into a single
       * readable axis. Smaller rocks turn faster: less mass, and it keeps the
       * cheap ones from looking like debris that has stopped.
       */
      const rate = 0.34 + ((rock.index * 7) % 11) * 0.052 + (5 - rock.level) * 0.03;
      dummy.rotation.set(
        t * rate + rock.index,
        t * rate * 0.63 + rock.index * 2.1,
        t * rate * 0.41 + rock.index * 0.4,
      );
      dummy.scale.setScalar(r);
      dummy.updateMatrix();
      node.setMatrixAt(i, dummy.matrix);

      if (hit) {
        // The hit target does not tumble — a rotating sphere is the same sphere,
        // and skipping the rotation keeps this to a translate and a scale.
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(Math.max(r * 2.4, MIN_TOUCH));
        dummy.updateMatrix();
        hit.setMatrixAt(i, dummy.matrix);
      }
    });

    node.instanceMatrix.needsUpdate = true;
    if (hit) {
      hit.instanceMatrix.needsUpdate = true;
      /**
       * Recomputed every frame, and it has to be.
       *
       * `InstancedMesh.raycast` rejects a ray against a CACHED bounding sphere
       * before it tests any instance. These rocks move continuously, so a sphere
       * computed once at mount stops containing them within minutes and every tap
       * silently misses. Thirteen instances make this free; the alternative is a
       * hit target that works when the page loads and quietly dies afterwards.
       */
      hit.computeBoundingSphere();
    }
  });

  if (!source) return null;

  const pick = (event: ThreeEvent<PointerEvent>): void => {
    if (!wasTap()) return;
    markHit();
    event.stopPropagation();
    const i = event.instanceId;
    if (i === undefined) return;
    const rock = bucket.rocks[i];
    if (rock) onSelect(rock.index);
  };

  return (
    <>
      <instancedMesh
        ref={mesh}
        // Named so the scene can be inspected — tools/visual.mjs measures rock
        // drift straight off these matrices, because a screenshot cannot tell a
        // slow orbit from a stopped one.
        name="asteroid-rocks"
        args={[source.geometry, source.material, bucket.rocks.length]}
        // Every bucket spans the whole disc, so a bounding sphere is either fully
        // in or fully out and a grazing frustum can drop the lot — the same trap
        // the planet field had to be rescued from.
        frustumCulled={false}
      />

      {/*
        A separate, generous, invisible hit target.

        The rocks are deliberately small — the biggest is two thirds of the
        smallest planet — and a fingertip on a phone is nowhere near that precise.
        Raycasting the tumbling low-poly body itself also means the hit area
        changes shape as it spins, so a tap that worked a second ago misses now.
        A plain sphere at 2.4x the radius, with a floor for the smallest rocks,
        is stable and forgiving.

        `opacity={0}` rather than `visible={false}`: an invisible object is not
        raycast at all, which would leave nothing to press.
      */}
      <instancedMesh
        ref={hits}
        name="asteroid-hits"
        args={[undefined, undefined, bucket.rocks.length]}
        onPointerUp={pick}
        frustumCulled={false}
        renderOrder={-1}
      >
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </instancedMesh>
    </>
  );
}

/**
 * The streak a rock draws behind it.
 *
 * Two attempts preceded this one and both were rejected, which is worth recording
 * because they were rejected for opposite reasons:
 *
 *   1. AN ADDITIVE LINE. Two vertices per rock. Cheap and readable, but a
 *      one-pixel line has no thickness to lose and no edge to soften, so it can
 *      only ever be a hard white streak — a vector diagram, not a body in motion.
 *   2. A ROW OF SOFT BILLBOARDS. Solved the softness and introduced beads: round
 *      blobs with sky between them, because the tail's length in world units
 *      varies about fivefold across the orbits while a rock's size does not vary
 *      with it at all. Widening them to overlap only made fatter beads.
 *
 * What the owner asked for is a shooting star: a translucent streak that TAPERS
 * and FADES along its length. That is a ribbon, not a line and not a particle
 * system — and it is the cheapest of the three by a distance.
 *
 * So each rock gets a strip of quads laid along its own orbit, camera-facing,
 * widest at the rock and narrowing to nothing behind it. One geometry holds the
 * whole field, one draw call, `SEGMENTS × 2` vertices per rock — about 260
 * vertices for a full disc, which is less than a single planet. No texture, no
 * sorting, no per-rock material: the taper is geometry and the fade is vertex
 * colour, both of which are free.
 *
 * The ribbon follows the ORBIT rather than a straight line back, so it curves the
 * way the rock actually travelled and the heading stays readable at a glance.
 */
const SEGMENTS = 11;

/** Brightness at the rock. Additive on a near-black sky, so this is a whisper. */
const TAIL_PEAK = 0.3;

/**
 * Half-width at the rock, as a multiple of its radius.
 *
 * Halved from 0.62 (owner call). A streak that is as wide as the body reads as a
 * cone bolted to the rock; at a third of its radius it reads as something shed,
 * which is the whole point of a shooting star. The taper does the rest.
 */
const TAIL_WIDTH = 0.31;

function Tails({
  asteroids,
  seasonStart,
}: {
  asteroids: readonly AsteroidView[];
  seasonStart: Date;
}) {
  const mesh = useRef<THREE.Mesh>(null);

  /**
   * One strip per rock, all in one buffer.
   *
   * Indices and colours never change — only the vertices move — so both are built
   * once here and the frame loop writes positions alone.
   */
  const geometry = useMemo(() => {
    const rocks = Math.max(1, asteroids.length);
    const verts = rocks * SEGMENTS * 2;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts * 3), 3));

    const colours = new Float32Array(verts * 3);
    const index: number[] = [];
    for (let r = 0; r < rocks; r += 1) {
      for (let k = 0; k < SEGMENTS; k += 1) {
        // Squared falloff. A linear fade leaves a visible hard end, because the
        // last quad is still a quarter lit at the moment it stops existing.
        const back = k / (SEGMENTS - 1);
        const lit = TAIL_PEAK * (1 - back) * (1 - back);
        const v = (r * SEGMENTS + k) * 2;
        colours.set([lit, lit * 1.03, lit * 1.14], v * 3);
        colours.set([lit, lit * 1.03, lit * 1.14], (v + 1) * 3);
        if (k < SEGMENTS - 1) index.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
      }
    }
    g.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    g.setIndex(index);
    return g;
  }, [asteroids.length]);

  const tangent = useMemo(() => new THREE.Vector3(), []);
  const toEye = useMemo(() => new THREE.Vector3(), []);
  const side = useMemo(() => new THREE.Vector3(), []);
  const here = useMemo(() => new THREE.Vector3(), []);
  const ahead = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ camera }) => {
    const node = mesh.current;
    if (!node) return;
    const now = serverNow();
    const position = node.geometry.getAttribute('position') as THREE.BufferAttribute;

    asteroids.forEach((rock, i) => {
      const half = asteroidRadius(rock.level) * TAIL_WIDTH;
      const span = rock.period * TAIL_FRACTION * 60_000;

      for (let k = 0; k < SEGMENTS; k += 1) {
        const back = k / (SEGMENTS - 1);
        const at = asteroidWorldPosition(rock, seasonStart, now - span * back);
        here.set(at[0], at[1], at[2]);

        /**
         * Which way is "across" the ribbon.
         *
         * The cross product of the direction of travel with the direction to the
         * camera. Doing it per segment rather than once per rock is what keeps the
         * strip edge-on-proof: a ribbon built on a fixed axis vanishes to a line
         * whenever the player flies into its plane, and this disc can be viewed
         * from underneath.
         */
        const next = asteroidWorldPosition(rock, seasonStart, now - span * back + 900);
        ahead.set(next[0], next[1], next[2]);
        tangent.subVectors(ahead, here);
        toEye.subVectors(camera.position, here);
        side.crossVectors(tangent, toEye);
        const length = side.length();
        // Exactly edge-on the cross product collapses; leave the width from the
        // previous segment rather than writing a NaN into the buffer.
        if (length > 1e-6) side.multiplyScalar(1 / length);

        // Tapers to a point. The rock's own body covers the widest end, so the
        // ribbon reads as shed from it rather than stuck to it.
        const w = half * (1 - back);
        const v = (i * SEGMENTS + k) * 2;
        position.setXYZ(v, here.x + side.x * w, here.y + side.y * w, here.z + side.z * w);
        position.setXYZ(v + 1, here.x - side.x * w, here.y - side.y * w, here.z - side.z * w);
      }
    });

    // Anything past the live rocks is parked at the origin rather than left
    // holding last frame's coordinates.
    for (let v = asteroids.length * SEGMENTS * 2; v < position.count; v += 1) {
      position.setXYZ(v, 0, 0, 0);
    }
    position.needsUpdate = true;
  });

  return (
    <mesh ref={mesh} name="asteroid-dust" geometry={geometry} frustumCulled={false}>
      <meshBasicMaterial
        vertexColors
        transparent
        opacity={0.9}
        depthWrite={false}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

/**
 * The straight line a mining squadron is flying, and the point it is aimed at.
 *
 * Drawn because the interception is the single least obvious thing in the game: a
 * craft heading for empty space looks like a bug until you see the rock arrive
 * there. The marker is the explanation.
 */
export function InterceptMarks({
  runs,
}: {
  runs: readonly { intercept: { x: number; y: number; z: number }; status: string }[];
}) {
  const points = useMemo(
    () => runs.filter((r) => r.status === 'outbound').map((r) => toWorld(r.intercept)),
    [runs],
  );
  const ring = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    // A slow pulse, so it reads as a target being held rather than as a decal.
    const s = 1 + Math.sin(clock.elapsedTime * 2) * 0.12;
    ring.current?.scale.setScalar(s);
  });

  if (points.length === 0) return null;

  return (
    <group ref={ring}>
      {points.map((at, i) => (
        <mesh key={i} position={at} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.22, 0.26, 24]} />
          <meshBasicMaterial
            color="#d9a441"
            transparent
            opacity={0.75}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}
