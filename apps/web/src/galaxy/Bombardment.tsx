import { Suspense, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { MODEL, MODEL_FACING } from '../ui/assets.js';
import { orientedCraft } from './model.js';
import { fireTexture, plumeTexture, ringTexture, sparkTexture } from './vfx.js';
import {
  MISSILE_OF_SHIP,
  blastProgress,
  emberSpray,
  impactPoint,
  shotProgress,
  volleyFor,
  type Shot,
} from './volley.js';
import { serverNow } from '../lib/clock.js';

/**
 * THE TEN SECONDS A RAID TAKES TO LAND. D44.
 *
 * A fleet reaches its target at `arriveAt` and the outcome is settled ten seconds
 * later (`COMBAT.engagementSeconds`). In between, the squadron holds in orbit and
 * puts missiles into the world. This draws that.
 *
 * IT DRAWS A STATE; IT DOES NOT INVENT ONE. The window is a real server window —
 * the mission is genuinely still `in_flight`, the ships are genuinely still
 * committed, and nothing has been decided. That is the difference between a
 * cinematic and a re-enactment, and it is why the ten seconds live in
 * `packages/rules` rather than in a constant in this file.
 *
 * WHAT IT DELIBERATELY DOES NOT DRAW. Only your OWN outbound raid, never an
 * inbound one on your own world. An inbound attack reaches the client radar-gated
 * and stripped of its composition (D9), so there is no ship in the payload to fire
 * anything — drawing a bombardment of your own planet would either invent a fleet
 * or hand the arrival to a commander who never bought a radar. The fog holds
 * because there is nothing here to render, not because something filters it.
 *
 * EVERYTHING IS IN THE SQUADRON'S OWN FRAME. The parent group is already placed at
 * the fleet and turned to face the world (`lookAt`, in `Fleets`), so the world's
 * centre is straight ahead down local +Z at `distance` and a shot is a line from a
 * craft's slot to a point near it. Working in world space would mean re-deriving
 * the squadron's position and heading here — a second copy of an interpolation,
 * which is the pairing `scene.ts` exists to prevent.
 *
 * AND THAT FRAME IS WHY THE ROUNDS ONCE FLEW SIDEWAYS. `Object3D.lookAt` takes a
 * point in WORLD space; the impact points here are local. Handing local
 * coordinates to `lookAt` aims a craft at an unrelated place in the galaxy, which
 * is exactly what it looked like — a volley of missiles travelling flat across
 * their own trails. The aim is now a quaternion built from the local direction,
 * solved once per round because a straight line does not change its mind.
 *
 * WHAT THE FIRE IS MADE OF is in `vfx.ts`: four baked, coloured, noisy textures
 * rather than one smooth grey blob, which is where almost all of the difference
 * between this and a placeholder lives.
 */

/** Drawn on the last queue, over the worlds, like every other craft in the scene. */
const VFX_ORDER = 1000;

/**
 * How wide the burst grows, as a share of the world's radius.
 *
 * A HIT, NOT A CLOUD. Photographed at 0.62 the halo grew to a full planet radius
 * and read as fog hanging off the limb rather than as something landing on the
 * surface — a billboard centred on the impact hangs half of anything that big
 * outside the silhouette. A third of a radius is a mark on the face that is still
 * unmistakable from the distance a squadron is watched at, and it leaves the world
 * recognisable underneath it.
 */
const BLAST_SIZE = 0.34;

/** Quads down the streak. */
const TRAIL_STEPS = 9;

/**
 * How far the streak reaches back, as a multiple of the round's own length.
 *
 * A TAIL, NOT A ROPE. It first drew the whole flown path, which across the gap
 * between a squadron and the world it is hitting is a solid bar most of the way
 * over the shot — the rounds read as beams rather than as things travelling.
 */
const TRAIL_REACH = 9;

/**
 * Half-width at the nozzle and at the tail, as multiples of the round's length.
 *
 * IT WIDENS GOING BACK, which is most of why this is not the ships' wake with a
 * different colour on it. A wake is shed by a hull and tapers to nothing behind
 * it; an exhaust plume is thrown out of a nozzle under pressure and SPREADS as it
 * cools. Getting that backwards is what made the first version read as the same
 * ribbon every other object in the galaxy already draws.
 */
const PLUME_NEAR = 0.11;
const PLUME_FAR = 0.46;

/** Brightness at the nozzle. Bloom threshold is 0.62; this stays under it. */
const PLUME_PEAK = 0.55;

useGLTF.preload(MODEL.missile, false);

export function Bombardment({
  /** Stable per raid, so the volley is the same one from frame to frame. */
  volleyKey,
  /** Slot offsets of the drawn models, in the squadron's own frame. */
  slots,
  /** World units from the squadron to the target's centre, straight down +Z. */
  distance,
  /** The target world's drawn radius. */
  radius,
  /** How big the ships firing are, so a round is sized against them and not the map. */
  shipScale,
  /** Epoch milliseconds at which the fleet reaches the world. */
  arriveAt,
}: {
  volleyKey: string;
  slots: readonly (readonly [number, number, number])[];
  distance: number;
  radius: number;
  shipScale: number;
  arriveAt: number;
}) {
  const shots = useMemo(
    () => volleyFor(volleyKey, slots.length, radius),
    [volleyKey, slots.length, radius],
  );

  if (shots.length === 0 || distance <= 0 || radius <= 0) return null;

  return (
    <Suspense fallback={null}>
      {shots.map((shot, i) => (
        <Round
          key={i}
          shot={shot}
          from={slots[shot.slot] ?? [0, 0, 0]}
          distance={distance}
          radius={radius}
          size={shipScale * MISSILE_OF_SHIP}
          arriveAt={arriveAt}
        />
      ))}
    </Suspense>
  );
}

/**
 * One round, its plume, and the mark it leaves.
 *
 * All of it in one component because it is one event at two moments: the round
 * while it flies, the fire while it burns, and never both. Splitting them would
 * compute the same impact point twice and leave two schedules to keep in step.
 */
function Round({
  shot,
  from,
  distance,
  radius,
  size,
  arriveAt,
}: {
  shot: Shot;
  from: readonly [number, number, number];
  distance: number;
  radius: number;
  /** The round's own length in world units. Everything about it is scaled off this. */
  size: number;
  arriveAt: number;
}) {
  const body = useRef<THREE.Group>(null);
  const strip = useRef<THREE.Mesh>(null);
  const flash = useRef<THREE.Sprite>(null);
  const fireball = useRef<THREE.Sprite>(null);
  const shock = useRef<THREE.Sprite>(null);
  const embers = useRef<THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>>(null);
  const nozzle = useRef<THREE.Sprite>(null);

  const fire = useMemo(() => fireTexture(), []);
  const shockMap = useMemo(() => ringTexture(), []);
  const sparkMap = useMemo(() => sparkTexture(), []);
  const plumeMap = useMemo(() => plumeTexture(), []);

  const impact = useMemo(
    () => impactPoint(from, shot.aim, distance, radius),
    [from, shot.aim, distance, radius],
  );

  /**
   * WHICH WAY THE ROUND POINTS, solved once and in the right space.
   *
   * `lookAt` would have to be given a WORLD point and everything here is local, so
   * the aim is built directly from the local direction instead. It is also
   * constant — a round flies a straight line — so re-solving it every frame would
   * be work spent to get the same answer.
   */
  const aim = useMemo(() => {
    const dir = new THREE.Vector3(
      impact[0] - from[0],
      impact[1] - from[1],
      impact[2] - from[2],
    );
    if (dir.lengthSq() < 1e-12) return new THREE.Quaternion();
    return new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      dir.normalize(),
    );
  }, [impact, from]);

  /** Where each ember is thrown. Fixed per round, so the spray does not re-roll. */
  const spray = useMemo(() => emberSpray(shot), [shot]);

  /**
   * The plume, allocated once and moved.
   *
   * A ribbon with UVs ACROSS it, so its softness comes from `plumeTexture` rather
   * than from vertex colours — a vertex-coloured strip has hard edges however
   * carefully its brightness is tapered, and hard edges are what made the first
   * version read as a drawn line rather than as exhaust. The ramp along its LENGTH
   * still comes from vertex colours, because that is free.
   */
  const trail = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const verts = TRAIL_STEPS * 2;
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts * 3), 3));

    const colours = new Float32Array(verts * 3);
    const uv = new Float32Array(verts * 2);
    const index: number[] = [];

    for (let k = 0; k < TRAIL_STEPS; k++) {
      const back = k / (TRAIL_STEPS - 1);
      /**
       * THE COLOUR RAMP, which is the other half of "not the ships' wake".
       *
       * White-hot at the nozzle, through yellow and orange, to a dark red that is
       * out before the tail. One colour dimmed along its length is a glowing line;
       * a ramp through the temperatures fire actually passes through is fire.
       */
      const lit = PLUME_PEAK * (1 - back) ** 1.5;
      const v = k * 2;
      const tint = [lit, lit * (1 - back) ** 0.9, lit * (1 - back) ** 3.4];
      colours.set(tint, v * 3);
      colours.set(tint, (v + 1) * 3);
      uv.set([0, back], v * 2);
      uv.set([1, back], (v + 1) * 2);
      if (k < TRAIL_STEPS - 1) index.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
    }

    g.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(index);
    return g;
  }, []);

  /** The embers, thrown outward from the impact. Positions move; nothing else does. */
  const emberGeometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(spray.length * 3), 3),
    );
    return g;
  }, [spray.length]);

  const here = useMemo(() => new THREE.Vector3(), []);
  const tail = useMemo(() => new THREE.Vector3(), []);
  const eye = useMemo(() => new THREE.Vector3(), []);
  const side = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ camera }) => {
    const seconds = (serverNow() - arriveAt) / 1000;
    const flying = shotProgress(shot, seconds);
    const burning = blastProgress(shot, seconds);

    const round = body.current;
    const ribbon = strip.current;
    if (round) round.visible = flying !== null;
    if (ribbon) ribbon.visible = flying !== null;
    if (flash.current) flash.current.visible = burning !== null;
    if (fireball.current) fireball.current.visible = burning !== null;
    if (shock.current) shock.current.visible = burning !== null;
    if (embers.current) embers.current.visible = burning !== null;

    if (flying !== null && round && ribbon) {
      here.set(
        from[0] + (impact[0] - from[0]) * flying,
        from[1] + (impact[1] - from[1]) * flying,
        from[2] + (impact[2] - from[2]) * flying,
      );
      round.position.copy(here);

      // The engine flickers. Two rates that do not divide into each other, so it
      // never settles into a visible loop.
      if (nozzle.current) {
        const beat = size * 0.62 * (1 + Math.sin(seconds * 43) * 0.16 + Math.sin(seconds * 17.3) * 0.1);
        nozzle.current.scale.set(beat, beat, 1);
      }

      /**
       * The plume lives in the PARENT's frame, not the round's.
       *
       * It has to stay behind the round while the round holds its own heading, and
       * a strip parented to the round would inherit its roll. Written straight into
       * the frame the flight is solved in, so its far end is always exactly on the
       * line the round came down.
       */
      tail.set(from[0] - here.x, from[1] - here.y, from[2] - here.z);
      const flown = tail.length();
      const span = Math.min(flown, size * TRAIL_REACH);
      if (flown > 1e-6) {
        tail.multiplyScalar(span / flown);

        // Which way is "across", from where the camera actually is — resolved per
        // frame, because this disc can be flown under and a strip that only faces
        // one way collapses to a line from the other side.
        ribbon.updateWorldMatrix(true, false);
        eye.copy(camera.position);
        ribbon.worldToLocal(eye);
        side.copy(tail).normalize().cross(eye.sub(here));
        if (side.lengthSq() < 1e-12) side.set(1, 0, 0);
        else side.normalize();

        const position = trail.getAttribute('position') as THREE.BufferAttribute;
        for (let k = 0; k < TRAIL_STEPS; k++) {
          const along = k / (TRAIL_STEPS - 1);
          // Widening, not tapering: a jet spreading as it cools.
          const w = size * (PLUME_NEAR + (PLUME_FAR - PLUME_NEAR) * along);
          const px = here.x + tail.x * along;
          const py = here.y + tail.y * along;
          const pz = here.z + tail.z * along;
          const v = k * 2;
          position.setXYZ(v, px + side.x * w, py + side.y * w, pz + side.z * w);
          position.setXYZ(v + 1, px - side.x * w, py - side.y * w, pz - side.z * w);
        }
        position.needsUpdate = true;
      }
    }

    if (burning !== null) {
      /**
       * FOUR LAYERS ON ONE CLOCK, each on its own curve. That is what makes this an
       * explosion rather than a light being turned down:
       *
       *   FLASH   white, huge for an instant, gone inside a sixth of the burn.
       *   FIREBALL the body of it, bursting outward and cooling.
       *   SHOCK   a ring leaving the impact faster than the fire, and out first.
       *   EMBERS  thrown outward, still travelling when everything else is dark.
       */
      const t = burning;
      const wide = radius * BLAST_SIZE;

      if (flash.current) {
        const punch = Math.max(0, 1 - t / 0.16);
        const s = wide * (0.5 + t * 2.2);
        flash.current.scale.set(s, s, 1);
        flash.current.material.opacity = punch ** 1.4;
      }

      if (fireball.current) {
        // Eased outward, so it bursts and then swells rather than growing evenly.
        const s = wide * (0.45 + 1.15 * Math.sqrt(t));
        fireball.current.scale.set(s, s, 1);
        fireball.current.material.opacity = (1 - t) ** 1.6;
        // A slow turn, so two impacts in the same second are not one picture twice.
        fireball.current.material.rotation = shot.launchAt * 3.1 + t * 0.6;
      }

      if (shock.current) {
        const s = wide * (0.4 + 3.1 * t ** 0.55);
        shock.current.scale.set(s, s, 1);
        shock.current.material.opacity = 0.85 * (1 - t) ** 2.4;
      }

      if (embers.current) {
        const reach = wide * 2.6 * t ** 0.6;
        const position = emberGeometry.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i < spray.length; i++) {
          const dir = spray[i]!;
          position.setXYZ(
            i,
            impact[0] + dir[0] * reach,
            impact[1] + dir[1] * reach,
            impact[2] + dir[2] * reach,
          );
        }
        position.needsUpdate = true;
        embers.current.material.opacity = (1 - t) ** 2;
        embers.current.material.size = size * 0.5 * (1 - t * 0.6);
      }
    }
  });

  return (
    <>
      <mesh
        ref={strip}
        geometry={trail}
        frustumCulled={false}
        visible={false}
        renderOrder={VFX_ORDER - 1}
        name="missile-trail"
      >
        <meshBasicMaterial
          {...(plumeMap ? { map: plumeMap } : {})}
          vertexColors
          transparent
          opacity={0.95}
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <group ref={body} quaternion={aim} visible={false} name="missile">
        <Warhead size={size} />
        {/*
          The engine, set back behind the tail and kept UNDER the round's own
          length. The round's nose runs down +Z like every other craft in the game,
          so behind it is −Z.
        */}
        <sprite ref={nozzle} position={[0, 0, -size * 0.66]} renderOrder={VFX_ORDER}>
          <spriteMaterial
            {...(fire ? { map: fire } : {})}
            transparent
            opacity={0.95}
            depthWrite={false}
            depthTest={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
      </group>

      {/*
        THE IMPACT, where the round actually crossed the surface.

        Depth testing off on every layer, because the burst sits exactly ON a
        sphere — z-fighting it would drop half the volley from half the angles.
      */}
      <group position={impact} name="blast">
        <sprite ref={shock} visible={false} renderOrder={VFX_ORDER}>
          <spriteMaterial
            {...(shockMap ? { map: shockMap } : {})}
            transparent
            opacity={0}
            depthWrite={false}
            depthTest={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
        <sprite ref={fireball} visible={false} renderOrder={VFX_ORDER + 1}>
          <spriteMaterial
            {...(fire ? { map: fire } : {})}
            transparent
            opacity={0}
            depthWrite={false}
            depthTest={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
        <sprite ref={flash} visible={false} renderOrder={VFX_ORDER + 2}>
          <spriteMaterial
            {...(fire ? { map: fire } : {})}
            color="#ffffff"
            transparent
            opacity={0}
            depthWrite={false}
            depthTest={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
      </group>

      <points
        ref={embers}
        geometry={emberGeometry}
        frustumCulled={false}
        visible={false}
        renderOrder={VFX_ORDER + 1}
        name="embers"
      >
        <pointsMaterial
          {...(sparkMap ? { map: sparkMap } : {})}
          size={size * 0.5}
          sizeAttenuation
          transparent
          opacity={0}
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </>
  );
}

/**
 * The round itself.
 *
 * Its nose is the one in the game that is not on a principal axis — the model
 * arrived lying at 56.5° in its own XZ plane — so the facing is a measured bearing
 * rather than a compass point. See `MODEL_FACING`.
 */
function Warhead({ size }: { size: number }) {
  const { scene } = useGLTF(MODEL.missile, false);
  const model = useMemo(
    () => orientedCraft(scene, MODEL_FACING[MODEL.missile] ?? '+z'),
    [scene],
  );
  return <primitive object={model} scale={size} />;
}
