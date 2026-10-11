import { Suspense, useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { MODEL, MODEL_FACING } from '../ui/assets.js';
import { atlasFrame, ownedAtlas } from './atlas.js';
import { orientedCraft, unitModel, type UnitModel } from './model.js';
import { bombardmentLayers } from './strategicLayers.js';
import {
  fireTexture,
  EXPLOSION_ATLAS,
  SMOKE_ATLAS,
  SHOCK_ATLAS,
  TRAIL_MAP,
  plumeTexture,
  publicEffectIntensity,
  ringTexture,
  smokeTexture,
  sparkTexture,
} from './vfx.js';
import {
  MISSILE_OF_SHIP,
  blastProgress,
  ejectaSpray,
  flightDistance,
  impactPoint,
  shotProgress,
  volleyFor,
  behindTarget,
  type Shot,
} from './volley.js';
import { serverNow } from '../lib/clock.js';
import { FullRate } from './frames.jsx';
import { playSceneSound } from './audio.js';
import { SkinAssetBoundary } from './SkinAssetBoundary.js';

/**
 * THE TEN SECONDS A RAID TAKES TO LAND. D44, made public by D52.
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
 * AND EVERYBODY SEES THE EFFECT. D52 publishes the target and authoritative window
 * so a battle is not a database transaction with sound effects for its attacker
 * alone. D123 still governs the source craft. A sensed squadron mounts this under
 * its real formation; a blind observer mounts it under a deterministic synthetic
 * source with no hull, reticle, mass cue or real approach bearing. The mission id
 * keeps the volley itself stable on every screen. See `Fleets`, which owns that
 * disclosure split.
 *
 * WHAT THAT DISCLOSES is the already-public planet, the live attack and its clock.
 * Craft position/bearing is present only when the observer's sensors earned it;
 * owner, origin and exact foreign roster remain absent.
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
 * The fire and cooling smoke use the original Galaxy Division flipbooks. Each
 * round owns its atlas transform, so concurrent surface hits animate independently.
 */

/** Drawn on the last queue, over the worlds, like every other craft in the scene. */
const VFX_ORDER = 1000;

/** Local fire lobes and ejecta grow to a visible surface rupture, scaled to the world. */
const BLAST_SIZE = 0.48;

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
const PLUME_PEAK = 0.9;

/** A rack firing is a separate beat from the engine already burning in flight. */
const MUZZLE_SECONDS = 0.14;

/** One tangent-plane quad reused by every surface shock; module-lifetime by design. */
const SHOCK_PLANE = new THREE.PlaneGeometry(1, 1);

useGLTF.preload(MODEL.missile, false);

/** Exported for the disclosure test: blindness dims the effect, never the craft rules. */
export const bombardmentIntensity = (effectOnly: boolean): number =>
  publicEffectIntensity(effectOnly);

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
  /** One in sensor reach; reduced only for the synthetic, effect-only public view. */
  intensity = 1,
  engagementSeconds,
  strikesWorld = false,
}: {
  volleyKey: string;
  slots: readonly (readonly [number, number, number])[];
  distance: number;
  radius: number;
  shipScale: number;
  arriveAt: number;
  intensity?: number;
  /** Defaults to ordinary combat; the public convoy authors an exact five seconds. */
  engagementSeconds?: number;
  /** The target is a world, which hides a volley fired from its far side. Not a formation. */
  strikesWorld?: boolean;
}) {
  const shots = useMemo(
    () => volleyFor(volleyKey, slots.length, radius, engagementSeconds),
    [volleyKey, slots.length, radius, engagementSeconds],
  );
  const root = useRef<THREE.Group>(null);
  const sight = useMemo(() => ({ squadron: new THREE.Vector3(), centre: new THREE.Vector3() }), []);
  useFrame(({ camera }) => {
    const node = root.current;
    if (!node) return;
    // Everything here draws over the worlds so a burst is never cut by the sphere
    // it lands on; the struck world still hides the whole volley fired from behind it.
    sight.squadron.setFromMatrixPosition(node.matrixWorld);
    sight.centre.set(0, 0, distance).applyMatrix4(node.matrixWorld);
    const eye = camera.position;
    node.visible = !(strikesWorld && behindTarget([eye.x, eye.y, eye.z],
      [sight.squadron.x, sight.squadron.y, sight.squadron.z], [sight.centre.x, sight.centre.y, sight.centre.z], radius));
  });

  if (shots.length === 0 || distance <= 0 || radius <= 0) return null;

  return (
    <group ref={root}>
      <Suspense fallback={null}>
        {/**
         * THE DISPLAY'S REAL RATE, FOR THESE TEN SECONDS ONLY. D53.
         *
         * Nothing here ever asked for a frame. The disc renders on demand and the
         * only thing asking was the ambient floor, so the whole bombardment was
         * drawn at the rate chosen for a rock creeping round a forty-minute orbit: a
         * round crossing its gap in eight tenths of a second got about twenty stepped
         * positions, and the nozzle flicker at nearly seven hertz got three and a
         * half samples a cycle, which reads as noise rather than as an engine.
         *
         * `Meteors` and the camera rig have always done this; the one moment in the
         * game that a decision was made forty minutes for was the one that did not.
         */}
        <FullRate />
        {shots.map((shot, i) => (
          <Round
            key={i}
            shot={shot}
            from={slots[shot.slot] ?? [0, 0, 0]}
            distance={distance}
            radius={radius}
            size={shipScale * MISSILE_OF_SHIP}
            arriveAt={arriveAt}
            intensity={intensity}
          />
        ))}
      </Suspense>
    </group>
  );
}

/**
 * One round, its plume, and the mark it leaves.
 *
 * All of it in one component because it is one event at two moments: the round
 * while it flies, the fire while it burns, and never both. Splitting them would
 * compute the same impact point twice and leave two schedules to keep in step.
 */
interface RoundProps {
  shot: Shot;
  from: readonly [number, number, number];
  distance: number;
  radius: number;
  /** The round's own length in world units. Everything about it is scaled off this. */
  size: number;
  arriveAt: number;
  intensity: number;
}

/** Optional artwork loading or failure keeps the existing fire effect on screen. */
function Round(props: RoundProps) {
  const fallback = <RoundEffect {...props} />;
  return (
    <SkinAssetBoundary fallback={fallback}>
      <Suspense fallback={fallback}><TexturedRound {...props} /></Suspense>
    </SkinAssetBoundary>
  );
}

const IMPACT_FRAGMENT = '/assets/models/debris/wreck-plate-gd-v3.glb';

/** Called for a known approaching raid; loader caches share every subsequent round. */
export function prewarmBombardment(): void {
  useGLTF.preload(MODEL.missile, false);
  useGLTF.preload(IMPACT_FRAGMENT, false);
  useTexture.preload([EXPLOSION_ATLAS, SMOKE_ATLAS, SHOCK_ATLAS, TRAIL_MAP]);
}

function TexturedRound(props: RoundProps) {
  const { scene } = useGLTF(IMPACT_FRAGMENT, false);
  const fragment = useMemo(() => unitModel(scene), [scene]);
  const maps = useTexture([EXPLOSION_ATLAS, SMOKE_ATLAS, SHOCK_ATLAS, TRAIL_MAP]);
  return <RoundEffect {...props} atlas={maps[0]} smokeAtlas={maps[1]} shockAtlas={maps[2]} trailMap={maps[3]} fragment={fragment ?? undefined} />;
}

function RoundEffect({ shot, from, distance, radius, size, arriveAt, intensity, atlas, smokeAtlas, shockAtlas, trailMap, fragment }: RoundProps & { atlas?: THREE.Texture; smokeAtlas?: THREE.Texture; shockAtlas?: THREE.Texture; trailMap?: THREE.Texture; fragment?: UnitModel }) {
  const body = useRef<THREE.Group>(null);
  const strip = useRef<THREE.Mesh>(null);
  const trailMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const flash = useRef<THREE.Sprite>(null);
  const fireball = useRef<THREE.Sprite>(null);
  const sideFire = useRef<(THREE.Sprite | null)[]>([]);
  const debris = useRef<THREE.InstancedMesh>(null);
  const shock = useRef<THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>>(null);
  const smoke = useRef<THREE.Sprite>(null);
  const muzzle = useRef<THREE.Sprite>(null);
  const embers = useRef<THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>>(null);
  const nozzle = useRef<THREE.Sprite>(null);

  const fire = useMemo(() => fireTexture(), []);
  const bitMaterial = useMemo(() => {
    const material = fragment?.material.clone() ?? new THREE.MeshStandardMaterial({ metalness: 0.72, roughness: 0.68 });
    material.transparent = true; material.depthWrite = false; material.depthTest = false;
    return material;
  }, [fragment]);
  const bitPose = useMemo(() => new THREE.Object3D(), []);
  const bitTint = useMemo(() => new THREE.Color(), []);
  useEffect(() => () => { bitMaterial.dispose(); }, [bitMaterial]);
  const explosion = useMemo(() => atlas ? ownedAtlas(atlas, 8) : null, [atlas]);
  const smokeSheet = useMemo(() => smokeAtlas ? ownedAtlas(smokeAtlas, 8) : null, [smokeAtlas]);
  const secondary = useMemo(() => atlas ? [ownedAtlas(atlas, 8), ownedAtlas(atlas, 8)] : [], [atlas]);
  const shockSheet = useMemo(() => shockAtlas ? ownedAtlas(shockAtlas, 4) : null, [shockAtlas]);
  useEffect(() => () => { explosion?.dispose(); smokeSheet?.dispose(); shockSheet?.dispose(); secondary.forEach((map) => { map.dispose(); }); }, [explosion, smokeSheet, shockSheet, secondary]);
  const shockMap = useMemo(() => ringTexture(), []);
  const sparkMap = useMemo(() => sparkTexture(), []);
  const plumeMap = useMemo(() => plumeTexture(), []);
  const smokeMap = useMemo(() => smokeTexture(), []);

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

  const surfaceNormal = useMemo<readonly [number, number, number]>(() => {
    const x = impact[0];
    const y = impact[1];
    const z = impact[2] - distance;
    const length = Math.hypot(x, y, z) || 1;
    return [x / length, y / length, z / length];
  }, [impact, distance]);
  const surfaceFacing = useMemo(
    () =>
      new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(...surfaceNormal),
      ),
    [surfaceNormal],
  );

  /** Stable per round, and every fragment leaves the world's surface. */
  const spray = useMemo(() => ejectaSpray(shot, surfaceNormal), [shot, surfaceNormal]);

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

  useEffect(
    () => () => {
      trail.dispose();
      emberGeometry.dispose();
    },
    [trail, emberGeometry],
  );

  const here = useMemo(() => new THREE.Vector3(), []);
  const tail = useMemo(() => new THREE.Vector3(), []);
  const eye = useMemo(() => new THREE.Vector3(), []);
  const side = useMemo(() => new THREE.Vector3(), []);
  const heard = useRef({ launch: false, impact: false });

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
    sideFire.current.forEach((node) => { if (node) node.visible = burning !== null; });
    if (debris.current) debris.current.visible = burning !== null;
    if (shock.current) shock.current.visible = burning !== null && burning < 0.42;
    if (smoke.current) smoke.current.visible = burning !== null && burning > 0.12;
    if (embers.current) embers.current.visible = burning !== null;
    if (flying !== null && !heard.current.launch) {
      heard.current.launch = true;
      if (flying < 0.16 && muzzle.current) {
        muzzle.current.getWorldPosition(here);
        playSceneSound('weapon', here, camera, intensity, `weapon:${arriveAt}:${shot.launchAt}:${from.join(',')}`);
      }
    }
    if (burning !== null && !heard.current.impact) {
      heard.current.impact = true;
      if (burning < 0.16 && fireball.current) {
        fireball.current.getWorldPosition(here);
        playSceneSound('impact', here, camera, intensity, `impact:${arriveAt}:${shot.launchAt}:${from.join(',')}`);
      }
    }

    const sinceLaunch = seconds - shot.launchAt;
    if (muzzle.current) {
      const firing = sinceLaunch >= 0 && sinceLaunch < MUZZLE_SECONDS;
      muzzle.current.visible = firing;
      if (firing) {
        const t = sinceLaunch / MUZZLE_SECONDS;
        const s = size * (1.9 + Math.sin(Math.PI * t) * 1.4);
        muzzle.current.scale.set(s, s, 1);
        muzzle.current.material.opacity = (1 - t) ** 1.7 * intensity;
      }
    }

    if (flying !== null && round && ribbon) {
      const travelled = flightDistance(flying);
      here.set(
        from[0] + (impact[0] - from[0]) * travelled,
        from[1] + (impact[1] - from[1]) * travelled,
        from[2] + (impact[2] - from[2]) * travelled,
      );
      round.position.copy(here);

      if (trailMaterial.current) {
        const ignite = Math.min(1, flying / 0.11);
        const contact = 1 - Math.max(0, (flying - 0.88) / 0.12);
        trailMaterial.current.opacity = 0.92 * ignite * contact * intensity;
      }

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
       * One authoritative burn stages a hard flash, turbulent fire, ash and
       * incandescent metal ejecta. The source flipbook supplies real fire detail;
       * the envelope preserves its energetic middle instead of fading it at once.
       */
      const t = burning;
      const phases = bombardmentLayers(t);
      const wide = radius * BLAST_SIZE;

      if (flash.current) {
        const s = wide * (1.1 + t * 4.2);
        flash.current.scale.set(s, s, 1);
        flash.current.material.opacity = phases.flash * intensity;
      }

      if (fireball.current) {
        if (explosion) atlasFrame(explosion, phases.fireProgress, 8);
        // Eased outward, so it bursts and then swells rather than growing evenly.
        const s = wide * (0.85 + 1.6 * Math.sqrt(t));
        fireball.current.scale.set(s, s, 1);
        fireball.current.material.opacity = phases.fire * intensity;
        // A slow turn, so two impacts in the same second are not one picture twice.
        fireball.current.material.rotation = shot.launchAt * 3.1 + t * 0.6;
      }

      sideFire.current.forEach((node, i) => {
        if (!node) return;
        const age = Math.max(0, t - (i + 1) * 0.07);
        const map = secondary[i];
        if (map) atlasFrame(map, age / 0.78, 8);
        const angle = shot.launchAt * 3.7 + i * 2.3;
        const displacement = wide * (0.1 + Math.sqrt(age) * 0.35);
        node.position.set(Math.cos(angle) * displacement, Math.sin(angle) * displacement, surfaceNormal[2] * wide * age * 0.3);
        const scale = wide * (0.68 + Math.sqrt(age) * 1.1);
        node.scale.setScalar(scale);
        node.material.opacity = (t > (i + 1) * 0.07 ? phases.fire : 0) * 0.72 * intensity;
        node.material.rotation = angle + age * 0.15;
      });

      if (shock.current) {
        if (shockSheet) atlasFrame(shockSheet, t / 0.42, 4);
        const shockTime = Math.min(1, t / 0.42);
        const s = wide * (0.35 + 2.4 * shockTime ** 0.55);
        shock.current.scale.set(s, s, 1);
        shock.current.material.opacity = 0.17 * (1 - shockTime) ** 2.7 * intensity;
      }

      if (smoke.current) {
        if (smokeSheet) atlasFrame(smokeSheet, phases.smokeProgress, 8);
        const s = wide * (0.85 + 2.1 * t ** 0.65);
        smoke.current.scale.set(s, s, 1);
        smoke.current.position.set(
          surfaceNormal[0] * wide * 0.42 * t,
          surfaceNormal[1] * wide * 0.42 * t,
          surfaceNormal[2] * wide * 0.42 * t,
        );
        smoke.current.material.opacity = phases.smoke * 0.68 * intensity;
        smoke.current.material.rotation = shot.flight * 4.7 - t * 0.34;
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
        embers.current.material.opacity = phases.ejecta * 0.45 * intensity;
        embers.current.material.size = size * 0.16 * (1 - t * 0.6);
      }
      if (debris.current) {
        const reach = wide * (0.1 + t * 3.6);
        for (let i = 0; i < 6; i++) {
          const dir = spray[i]!;
          bitPose.position.set(impact[0] + dir[0] * reach, impact[1] + dir[1] * reach, impact[2] + dir[2] * reach);
          bitPose.rotation.set(shot.launchAt + t * (i + 2), i * 1.9 + t * 5, i + t * (i - 3));
          const scale = wide * (0.022 + (i % 3) * 0.012);
          bitPose.scale.set(scale * 1.4, scale, scale * 0.75);
          bitPose.updateMatrix(); debris.current.setMatrixAt(i, bitPose.matrix);
          const heat = Math.max(0, 1 - t / 0.45);
          debris.current.setColorAt(i, bitTint.setRGB(0.3 + heat * 2.2, 0.3 + heat * 0.7, 0.32 + heat * 0.08));
        }
        bitMaterial.opacity = phases.ejecta * intensity;
        debris.current.instanceMatrix.needsUpdate = true;
        if (debris.current.instanceColor) debris.current.instanceColor.needsUpdate = true;
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
          ref={trailMaterial}
          map={trailMap ?? plumeMap}
          vertexColors
          transparent
          opacity={0.95 * intensity}
          depthWrite={false}
          side={THREE.DoubleSide}
          forceSinglePass
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
            opacity={0.95 * intensity}
            depthWrite={false}
            depthTest={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
      </group>

      <sprite ref={muzzle} position={from} visible={false} renderOrder={VFX_ORDER + 2} name="muzzle-flash">
        <spriteMaterial
          {...(fire ? { map: fire } : {})}
          transparent
          opacity={0}
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>

      {/*
        THE IMPACT, where the round actually crossed the surface.

        Depth testing off on every layer, because the burst sits exactly ON a
        sphere — z-fighting it would drop half the volley from half the angles.
      */}
      <group position={impact} name="blast">
        <mesh
          ref={shock}
          geometry={SHOCK_PLANE}
          quaternion={surfaceFacing}
          visible={false}
          renderOrder={VFX_ORDER}
        >
          <meshBasicMaterial
            map={shockSheet ?? shockMap}
            transparent
            opacity={0}
            depthWrite={false}
            depthTest={false}
            side={THREE.DoubleSide}
            forceSinglePass
            blending={THREE.AdditiveBlending}
          />
        </mesh>
        <sprite ref={fireball} visible={false} renderOrder={VFX_ORDER + 1}>
          <spriteMaterial
            map={explosion ?? fire}
            transparent
            opacity={0}
            depthWrite={false}
            depthTest={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
        {[0, 1].map((i) => (
          <sprite key={i} ref={(node) => { sideFire.current[i] = node; }} visible={false} renderOrder={VFX_ORDER + 1}>
            <spriteMaterial map={secondary[i] ?? fire} transparent opacity={0} depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} />
          </sprite>
        ))}
        <sprite ref={smoke} visible={false} renderOrder={VFX_ORDER}>
          <spriteMaterial
            map={smokeSheet ?? smokeMap}
            color="#626975"
            transparent
            opacity={0}
            depthWrite={false}
            depthTest={false}
            blending={THREE.NormalBlending}
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

      {fragment ? <instancedMesh ref={debris} args={[fragment.geometry, bitMaterial, 6]} name="missile-metal-ejecta" frustumCulled={false} visible={false} renderOrder={VFX_ORDER + 1} raycast={() => null} /> : null}
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
 * Its source mesh uses the measured +Z compilation declared in MODEL_FACING.
 */
function Warhead({ size }: { size: number }) {
  const { scene } = useGLTF(MODEL.missile, false);
  const model = useMemo(
    () => orientedCraft(scene, MODEL_FACING[MODEL.missile] ?? '+z'),
    [scene],
  );
  return <primitive object={model} scale={size} />;
}
