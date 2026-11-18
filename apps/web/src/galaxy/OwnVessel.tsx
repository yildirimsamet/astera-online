import { Html, useTexture } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import * as THREE from 'three';
import { VESSEL_SYSTEMS, vesselLook, type Vec3, type VesselHull, type VesselLook, type VesselProgress, type VesselSystem } from '@astera/rules';
import { HULL_MODEL } from '../ui/assets.js';
import { BayReturnFx, RunningLights, SparkStreaks, WeldFx } from './BayFx.js';
import { Exhaust, Hull } from './Fleets.js';
import { HULL_LIGHT, HULL_VISUAL_SCALE } from './flightVisual.js';
import { HitboxMaterial } from './hitboxDebug.js';
import { TAG_STEP_SECONDS, tagLead } from './shipTags.js';
import { HULL_SHIFT_SECONDS, hullSweepAt, nextLook } from './hullShift.js';
import { VESSEL_BAYS, VESSEL_NOSE_TURN, damageSpots, starterShipYaw, systemCondition, vesselHitBox, vesselLights, vesselModelFile, type DamageSpot, type SystemCondition, type VesselLights } from './mainSky.js';
import type { Vec3Tuple } from './scene.js';
import { YARD_LAUNCH, yardLaunchAt } from './yardLaunch.js';
import type { Beat } from '../starter/director/director.js';
import '../starter/director/director.css';
import { VESSEL_LENGTH } from './scene.js';
import { markHit, wasTap } from './tap.js';
import { VesselBody, preloadVessel } from './VesselBody.js';

const LENGTH = VESSEL_LENGTH;
/** The scanner's lines (Synty Military Combat HUD, comms scanlines), lit along the cut. */
const SCANLINES = '/assets/vfx/library/scanlines.webp';
const NOSEWARD = new THREE.Vector3(1, 0, 0);
const TAILWARD = new THREE.Vector3(-1, 0, 0);

/**
 * THE HULL'S NEW LOOK, AS A MOMENT (owner 2026-11-18; `hullShift.ts`). VFX brief: a refit scanner
 * passes from the tail past the nose, a plane of hard scan lines that lays the new plating as it goes
 * and throws sparks where new meets old (`scanlines.webp`, sparks as streaks); behind it the new hull,
 * ahead of it the old, each cut by a plane that moves with it. Two hulls for a second and a half.
 */
function HullShift({ hull, from, to, damage, onDone }: {
  hull: VesselHull;
  from: VesselLook;
  to: VesselLook;
  damage: readonly DamageSpot[];
  onDone: () => void;
}) {
  const frame = useRef<THREE.Group>(null);
  const cut = useRef<THREE.Group>(null);
  const lines = useTexture(SCANLINES);
  const start = useRef<number | null>(null);
  const ended = useRef(false);
  const planes = useMemo(() => ({ fresh: [new THREE.Plane()], worn: [new THREE.Plane()] }), []);
  const [, tall, wide] = vesselHitBox(hull);
  const material = useMemo(() => new THREE.MeshBasicMaterial({ map: lines, color: '#8fe8ff', transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true, toneMapped: false }), [lines]);
  useEffect(() => () => { material.dispose(); }, [material]);
  useFrame(({ clock, invalidate }) => {
    const group = frame.current;
    if (!group) return;
    start.current ??= clock.elapsedTime;
    const t = clock.elapsedTime - start.current;
    const x = hullSweepAt(t, HULL_SHIFT_SECONDS);
    group.updateWorldMatrix(true, false);
    // The new hull where the sheet has passed (x' < x), the old one ahead of it.
    planes.fresh[0]?.set(TAILWARD, x).applyMatrix4(group.matrixWorld);
    planes.worn[0]?.set(NOSEWARD, -x).applyMatrix4(group.matrixWorld);
    if (cut.current) cut.current.position.x = x;
    if (t < HULL_SHIFT_SECONDS) { invalidate(); return; }
    if (!ended.current) { ended.current = true; onDone(); }
  });
  return (
    <group ref={frame}>
      <VesselBody file={vesselModelFile(hull, from)} hull={hull} damage={[]} clip={planes.worn} />
      <VesselBody file={vesselModelFile(hull, to)} hull={hull} damage={damage} clip={planes.fresh} />
      <group ref={cut}>
        <mesh rotation={[0, Math.PI / 2, 0]} material={material} raycast={() => null}>
          <planeGeometry args={[wide * 1.1, tall * 1.3]} />
        </mesh>
        {/* The cut throws sparks where the new plate meets the old. */}
        <SparkStreaks at={[0, tall * 0.25, 0]} count={10} stream seed={2} />
        <SparkStreaks at={[0, 0, wide * 0.3]} count={8} stream seed={3} />
        <SparkStreaks at={[0, 0, -wide * 0.3]} count={8} stream seed={4} />
      </group>
    </group>
  );
}

/** Where each system's name stands off its bay, screen pixels: spread so five never sit on one another. */
const TAG_OFFSET: Record<VesselSystem, readonly [number, number]> = { SURVEY: [0, -46], CARGO: [0, 46], REFINERY: [42, -24], DEFENCE: [40, 26], DRIVE: [-44, -10] };
/** Under the letterbox (z 80) and every sheet, over the galaxy's own labels. */
const TAG_LAYER: [number, number] = [14, 14];

/** Where a tag's chip stands from its pin, and the lead's angle to it. */
const tagStyle = (dx: number, dy: number): Record<string, string> => ({
  '--dx': `${String(dx)}px`, '--dy': `${String(dy)}px`, '--len': `${Math.hypot(dx, dy).toFixed(1)}px`, '--ang': `${Math.atan2(dy, dx).toFixed(3)}rad`,
});
const tagSide = (dx: number, dy: number): string => dx < 0 ? 'left' : dx > 0 ? 'right' : dy < 0 ? 'up' : 'down';
const TAG_AT = new THREE.Vector3();

/** One system named on the hull. Its chip turns to the other side where its own would leave the screen. */
function SystemTag({ at, system, condition, index }: { at: Vec3Tuple; system: VesselSystem; condition: SystemCondition; index: number }) {
  const { t } = useTranslation();
  const tag = useRef<HTMLSpanElement>(null);
  const [dx, dy] = TAG_OFFSET[system];
  const lead = useRef(dx);
  // Drei asks where the pin is on the screen every frame; the answer also says which way the chip fits.
  const place = useCallback((anchor: THREE.Object3D, camera: THREE.Camera, size: { width: number; height: number }): [number, number] => {
    const screen = TAG_AT.setFromMatrixPosition(anchor.matrixWorld).project(camera);
    const x = (screen.x + 1) * size.width / 2;
    const next = tagLead(x, size.width, dx);
    if (next !== lead.current && tag.current) {
      lead.current = next;
      tag.current.dataset.side = tagSide(next, dy);
      for (const [name, value] of Object.entries(tagStyle(next, dy))) tag.current.style.setProperty(name, value);
    }
    return [x, (1 - screen.y) * size.height / 2];
  }, [dx, dy]);
  const style = { ...tagStyle(dx, dy), '--delay': `${(index * TAG_STEP_SECONDS).toFixed(2)}s` } as CSSProperties;
  return (
    <Html position={at} zIndexRange={TAG_LAYER} style={{ pointerEvents: 'none' }} calculatePosition={place}>
      <span ref={tag} className="ship-tag" data-system={system} data-condition={condition} data-side={tagSide(dx, dy)} style={style}>
        <i className="ship-tag__pin" />
        <i className="ship-tag__lead" />
        <span className="ship-tag__chip"><b>{t(`starter.systemShort.${system}`)}</b>{t(`starter.director.condition.${condition}`)}</span>
      </span>
    </Html>
  );
}

/**
 * THE REPORT'S WORDS ON THE HULL (plan 2026-11-18 §4 İ5): each system named where it is, with what its
 * damage is doing — the same fire, embers or sparks the hull shows — one after another.
 */
function SystemTags({ hull, lights, tags }: { hull: VesselHull; lights: VesselLights; tags: readonly VesselSystem[] }) {
  return (
    <>
      {tags.map((system, index) => (
        <SystemTag key={system} at={VESSEL_BAYS[hull][system]} system={system} condition={systemCondition(lights[system], system)} index={index} />
      ))}
    </>
  );
}

/*
  VFX brief (plan 2026-11-18 §5 A11; owner phone playtest 2026-11-18, item 8).
  - In the world: the craft a repair hands over (the telescope's Prospector, the yard's two Darts) slide out
    of the cargo bay under the hull, swing round to hold station beside the ship nose forward, turn about,
    and slide back into the bay where they are kept.
  - Assets: the game's own hull models (`HULL_MODEL[hull]`, what each craft flies with) and the jets every
    craft burns in flight (`Exhaust`, premium-v2 thruster grunge).
  - Why: these are your ships and they stay with you; a craft burning away left the player asking where it went.
*/
/** A Dart beside the colony ship, in its model units: about a tenth of its length; other hulls by their scale. */
const DART_SIZE = 0.11;
/** The second leaves a moment after the first. */
const LAUNCH_STAGGER = 0.35;
/** Two stations beside the hull at most; more craft than that are counted on the line. */
const STATIONS = 2;

function CraftHandover({ hull, craft, onDone }: { hull: VesselHull; craft: Craft; onDone: () => void }) {
  const ships = useRef<(THREE.Group | null)[]>([]);
  const start = useRef<number | null>(null);
  const ended = useRef(false);
  const ahead = useMemo(() => new THREE.Vector3(), []);
  const bay = VESSEL_BAYS[hull].CARGO;
  const size = DART_SIZE * HULL_VISUAL_SCALE[craft.hull] / HULL_VISUAL_SCALE.DART;
  // Stations beside the hull, clear of it on either side, a little below.
  const slots = useMemo<Vec3Tuple[]>(() => {
    const [, tall, wide] = vesselHitBox(hull);
    const both: Vec3Tuple[] = [[0.3, -tall * 0.35, wide / 2 + 0.1], [0.18, -tall * 0.45, -(wide / 2 + 0.1)]];
    return both.slice(0, Math.max(1, Math.min(STATIONS, craft.count)));
  }, [hull, craft.count]);
  useFrame(({ clock, invalidate }) => {
    start.current ??= clock.elapsedTime;
    const t = clock.elapsedTime - start.current;
    slots.forEach((slot, index) => {
      const ship = ships.current[index];
      if (!ship) return;
      const own = t - index * LAUNCH_STAGGER;
      // Out of sight before it leaves the bay and once it is back inside it.
      ship.visible = own >= 0 && own < YARD_LAUNCH.total - 0.05;
      const { at, facing } = yardLaunchAt(bay, slot, own);
      ship.position.set(at[0], at[1], at[2]);
      ahead.set(at[0] + facing[0], at[1] + facing[1], at[2] + facing[2]);
      ship.parent?.localToWorld(ahead);
      ship.lookAt(ahead);
    });
    if (t < YARD_LAUNCH.total + LAUNCH_STAGGER) { invalidate(); return; }
    if (!ended.current) { ended.current = true; onDone(); }
  });
  return (
    <>
      {slots.map((slot, index) => (
        <group key={slot.join()} ref={(node) => { ships.current[index] = node; }} visible={false}>
          <Hull url={HULL_MODEL[craft.hull]} scale={size} glow={HULL_LIGHT[craft.hull].glow} focused={false} />
          <Exhaust url={HULL_MODEL[craft.hull]} colour={HULL_LIGHT[craft.hull].flame} scale={size} />
        </group>
      ))}
    </>
  );
}

/** What the director's shot asks of the hull: the names to show, and the beat (the yard's launch). */
type Craft = NonNullable<Beat['craft']>;
export interface VesselCue { key: number; beat: string; tags: readonly VesselSystem[] | undefined; craft?: Craft | undefined }

const BAY_COLOUR: Record<VesselSystem, string> = {
  REFINERY: '#ffb46a',
  SURVEY: '#9fd8ff',
  DEFENCE: '#8fe8ff',
  CARGO: '#ffd9a0',
  DRIVE: '#7fb6ff',
};

/**
 * THE PLAYER'S OWN SHIP, THE ONLY ONE DRAWN AS IT TRULY IS: its hull follows the repairs, and each
 * mended system carries a running light at its place on that hull (`BayFx`). No real light, as
 * everything else in this scene.
 */
export function OwnVessel({ at, offset, hull, progress, onSelect, awaken, working = [], look: shownLook, cue }: {
  at: readonly [number, number, number];
  offset: Vec3;
  hull: VesselHull;
  progress: VesselProgress;
  onSelect: () => void;
  /** A system that just came back; a new key beats again. */
  awaken?: { system: VesselSystem; key: number } | undefined;
  /** Systems with a short repair under way: their bays weld. */
  working?: readonly VesselSystem[];
  /** The look to show, held back until its moment (the director's hull shot); the repairs' own look otherwise. */
  look?: VesselLook | undefined;
  /** The director's shot while it plays over the galaxy. */
  cue?: VesselCue | undefined;
}) {
  const lights = useMemo(() => vesselLights(progress), [progress]);
  const damage = useMemo(() => damageSpots(lights), [lights]);
  // A mended bay carries a running light, each off the others' beat.
  const running = useMemo(() => VESSEL_SYSTEMS.flatMap((system, i) => (lights[system] > 0 ? [{ at: VESSEL_BAYS[hull][system], colour: BAY_COLOUR[system], offset: i * 0.19 }] : [])), [lights, hull]);
  const look = shownLook ?? vesselLook(progress);
  // A change of look runs along the hull as a moment; it never swaps under the player's eyes.
  const [drawn, setDrawn] = useState(look);
  const [shift, setShift] = useState<{ from: VesselLook; to: VesselLook } | null>(null);
  if (look !== drawn) { setShift({ from: drawn, to: look }); setDrawn(look); }
  // The handed-over craft go once per shot of them, and fly their whole way out and back past its end.
  const [launch, setLaunch] = useState<{ key: number; live: boolean; craft: Craft } | null>(null);
  if (cue?.craft && launch?.key !== cue.key) setLaunch({ key: cue.key, live: true, craft: cue.craft });
  useEffect(() => {
    const next = nextLook(look);
    if (next) preloadVessel(vesselModelFile(hull, next));
  }, [hull, look]);
  return (
    <group position={[at[0], at[1], at[2]]} rotation={[0, starterShipYaw([at[0], at[1], at[2]], offset), 0]} scale={LENGTH}>
      <group rotation={[0, VESSEL_NOSE_TURN, 0]}>
        <mesh onPointerUp={(event) => { if (!wasTap()) return; markHit(); event.stopPropagation(); onSelect(); }}>
          <boxGeometry args={vesselHitBox(hull)} />
          <HitboxMaterial kind="fleet" />
        </mesh>
        {/* Its own boundary: a new state loading must not take the main galaxy's sky with it. */}
        {/* Owner 2026-11-06: lit from its own texture, a light rim, and its damage burning on it. */}
        {shift
          ? (
            <Suspense fallback={<VesselBody file={vesselModelFile(hull, shift.from)} hull={hull} damage={damage} />}>
              <HullShift key={`${shift.from}>${shift.to}`} hull={hull} from={shift.from} to={shift.to} damage={damage} onDone={() => { setShift(null); }} />
            </Suspense>
          )
          : <Suspense fallback={null}><VesselBody file={vesselModelFile(hull, look)} hull={hull} damage={damage} /></Suspense>}
        <RunningLights lights={running} />
        <Suspense fallback={null}>
          {awaken && <BayReturnFx key={awaken.key} system={awaken.system} at={VESSEL_BAYS[hull][awaken.system]} colour={BAY_COLOUR[awaken.system]} />}
          {working.map(system => <WeldFx key={system} at={VESSEL_BAYS[hull][system]} />)}
          {launch?.live === true && <CraftHandover key={launch.key} hull={hull} craft={launch.craft} onDone={() => { setLaunch({ ...launch, live: false }); }} />}
        </Suspense>
        {cue?.tags && <SystemTags key={cue.key} hull={hull} lights={lights} tags={cue.tags} />}
      </group>
    </group>
  );
}
