import { useModelScale } from './modelScale.js';
import { Suspense, useEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { AsteroidView, MiningRun } from '../api/schemas.js';
import { MODEL } from '../ui/assets.js';
import { Hull, Wake, useLine } from './Fleets.jsx';
import {
  asteroidRadius,
  asteroidWorldPosition,
  CRAFT_SCALE,
  runHomePosition,
  runPosition,
  toWorld,
  type PlanetNode,
  type Vec3Tuple,
} from './scene.js';
import { markersFor, slotOffset } from './Squadrons.js';
import { markHit, wasTap } from './tap.js';
import { HitboxMaterial } from './hitboxDebug.jsx';
import { serverNow } from '../lib/clock.js';
import { EngineJets, type EngineUnit } from './EngineJets.js';
import { nativeEngineAnchors } from './engineAnchors.js';
import { DIG_SECONDS, forgetReach, heldReach, runDig } from './miningDig.js';
import { MiningDig, type DrillMotion } from './MiningDig.js';
import { SkinAssetBoundary } from './SkinAssetBoundary.js';
import { VOID_RADIUS, wreckRadius, type WreckView } from './Wrecks.js';

/**
 * PROSPECTORS, IN TRANSIT. D19.
 *
 * Drawn warm and amber rather than in the fleet's cold blue, because a mining run
 * is not a threat and must never be mistaken for one — by its owner or by anyone
 * glancing at the disc. It is the same reasoning that gives probes their own
 * colour: these are three different bets and a player should never have to work
 * out which is in the air.
 *
 * It is a drill now, nose-first. The craft flew as a Hauler for three phases
 * because no mining model existed; the owner supplied one and the silhouette says
 * what the run is before the colour does.
 *
 * The leg is a straight line to the INTERCEPTION POINT, not to the rock. That is
 * the whole of D19 made visible: the craft flies to where the rock will be, and
 * the two arrive together. Seeing a squadron head for apparently empty space is
 * confusing exactly once, and then it is the most legible thing in the game.
 */

const STYLE = { colour: '#d9a441', scale: 0.26 * CRAFT_SCALE, flame: '#ffc073' } as const;
/** A drill's drawn length at model scale one. */
export const MINING_CRAFT_LENGTH = STYLE.scale;

/**
 * How far from its target's centre a run's drill comes to rest (`runPosition`): the target's drawn
 * radius plus half the drill, so the nose is on the face. Zero for a target this client cannot see,
 * which keeps the old path.
 */
export function miningReach(
  run: Pick<MiningRun, 'targetKind' | 'asteroidId' | 'debrisFieldId'>,
  asteroids: readonly Pick<AsteroidView, 'id' | 'level'>[],
  wrecks: readonly WreckView[],
  nodes: readonly Pick<PlanetNode, 'id' | 'radius'>[],
  scale: number,
): number {
  const half = (MINING_CRAFT_LENGTH * scale) / 2;
  if (run.targetKind === 'asteroid') {
    const rock = asteroids.find((a) => a.id === run.asteroidId);
    return rock ? asteroidRadius(rock.level, scale) + half : 0;
  }
  const field = wrecks.find((w) => w.id === run.debrisFieldId);
  if (!field) return 0;
  if (field.planetId === null) return wreckRadius(null, scale) + half;
  // A world this client does not draw: `Wrecks` rings its field about a stand-in world.
  const world = nodes.find((n) => n.id === field.planetId);
  return wreckRadius(world?.radius ?? VOID_RADIUS * scale, scale) + half;
}

/** Where a run's rock is drawn at a server instant, so its drill rides with it (`runPosition`); none for a field. */
export function miningRockAt(
  run: Pick<MiningRun, 'targetKind' | 'asteroidId'>,
  asteroids: readonly AsteroidView[],
  seasonStart: Date | undefined,
): ((ms: number) => Vec3Tuple) | undefined {
  if (run.targetKind !== 'asteroid' || !seasonStart) return undefined;
  const rock = asteroids.find((a) => a.id === run.asteroidId);
  return rock ? (ms) => asteroidWorldPosition(rock, seasonStart, ms) : undefined;
}

export function miningFocusRadius(craft: number): number {
  const hullRadius = STYLE.scale * Math.sqrt(3) / 2;
  return markersFor({ PROSPECTOR: craft }).reduce((radius, _, index) =>
    Math.max(radius, Math.hypot(...slotOffset(index, STYLE.scale * 1.5)) + hullRadius), hullRadius);
}

/**
 * A MINING ROUTE IS FAINTER THAN A WAR ROUTE. Owner call.
 *
 * `ROUTE_OPACITY` is 0.16 and settled — 0.09 hid a raid's thread and 0.34 made the
 * threads the brightest thing on the disc. A mining run is not a raid: several are
 * in the air at once, they carry no threat, and at the shared figure a busy disc
 * turned into a lattice of orange lines with the worlds behind it.
 *
 * OPACITY IS THE ONLY LEVER, and it does the job of both. WebGL ignores
 * `linewidth` on `lineBasicMaterial` — every line is one pixel whatever it asks
 * for — so an additive hairline is made "thinner" by being made dimmer, which is
 * the same edit. Focused stays clearly legible: selecting a run is the moment its
 * route is the thing you want to see.
 */
const MINING_ROUTE_OPACITY = 0.09;
const MINING_ROUTE_OPACITY_FOCUSED = 0.3;

useGLTF.preload(MODEL.drill, false);

export function MiningFlights({
  runs,
  asteroids,
  wrecks,
  home,
  nodes,
  seasonStart,
  focusedId,
  onSelect,
}: {
  runs: readonly MiningRun[];
  /** The targets, so a drill stops on its target's face (`miningReach`) and rides its rock (`miningRockAt`). */
  asteroids: readonly AsteroidView[];
  seasonStart: Date | undefined;
  wrecks: readonly WreckView[];
  home: { x: number; y: number; z: number };
  /** The worlds, so the home endpoint uses its shared surface clearance. D120. */
  nodes: readonly PlanetNode[];
  focusedId: string | null;
  onSelect: (id: string) => void;
}) {
  const scale = useModelScale();
  const flying = runs.filter((r) => r.status !== 'done');
  useEffect(() => { forgetReach(new Set(runs.filter((r) => r.status !== 'done').map((r) => r.id))); }, [runs]);
  if (flying.length === 0) return null;

  return (
    <>
      {flying.map((run) => (
        <Run
          key={run.id}
          run={run}
          home={runHomePosition(run, nodes, home)}
          nodes={nodes}
          reach={heldReach(run.id, miningReach(run, asteroids, wrecks, nodes, scale))}
          rockAt={miningRockAt(run, asteroids, seasonStart)}
          focused={run.id === focusedId}
          onSelect={() => {
            onSelect(run.id);
          }}
        />
      ))}
    </>
  );
}

function Run({
  run,
  home,
  nodes,
  reach,
  rockAt,
  focused,
  onSelect,
}: {
  run: MiningRun;
  home: { x: number; y: number; z: number };
  nodes: readonly PlanetNode[];
  reach: number;
  rockAt: ((ms: number) => Vec3Tuple) | undefined;
  focused: boolean;
  onSelect: () => void;
}) {
  const scale = useModelScale();
  const group = useRef<THREE.Group>(null);
  const returning = run.status === 'returning';

  /**
   * Where this leg ENDS. Outbound that is the interception point; on the way home
   * it is the planet, because the leg is flown backwards.
   *
   * The rock is not an endpoint on either leg: by the time the craft is heading
   * home the rock has moved on and is no longer where the meeting was.
   *
   * The leg's start is not needed — the line's near end follows the craft, which
   * `runPosition` already places from the clock.
   */
  const to = useMemo(
    () => toWorld(returning ? home : run.intercept),
    [home, run.intercept, returning],
  );

  const markers = useMemo(
    () => markersFor({ PROSPECTOR: run.craft }),
    [run.craft],
  );
  const aimDistance = useRef(1000);
  const engines = useMemo<EngineUnit[]>(() => markers.map((_, index) => ({
    at: slotOffset(index, STYLE.scale * 1.5),
    nozzles: nativeEngineAnchors(MODEL.drill) ?? [],
    size: STYLE.scale,
    colour: STYLE.flame,
    intensity: 0.8,
    widthFactor: 1, lengthFactor: 1,
  })), [markers]);

  /** One buffer for the life of the run, written both ends per frame. See `useLine`. */
  const line = useLine();
  const rock = useMemo(() => toWorld(run.intercept), [run.intercept]);
  const motion = useRef<DrillMotion>({ roll: 0, shake: 0 });
  const aim = useMemo(() => ({ pose: new THREE.Object3D(), placed: false }), []);

  useFrame((_, delta) => {
    const node = group.current;
    if (!node) return;
    const now = serverNow();
    // The same helper the camera reads, so a focused run stays centred.
    const at = runPosition(run, home, now, nodes, reach, rockAt);
    node.position.set(at[0], at[1], at[2]);
    // It faces its target through the bite, then turns for home rather than snapping round.
    const dig = runDig(run, now);
    const facing = dig !== null && dig < DIG_SECONDS ? rockAt?.(now) ?? rock : to;
    aim.pose.position.copy(node.position);
    aim.pose.lookAt(facing[0], facing[1], facing[2]);
    if (aim.placed) node.quaternion.slerp(aim.pose.quaternion, 1 - Math.exp(-delta * 4));
    else node.quaternion.copy(aim.pose.quaternion);
    aim.placed = true;

    const points = line.getAttribute('position') as THREE.BufferAttribute;
    points.setXYZ(0, at[0], at[1], at[2]);
    points.setXYZ(1, to[0], to[1], to[2]);
    points.needsUpdate = true;
  });

  return (
    <>
      <lineSegments geometry={line} frustumCulled={false}>
        <lineBasicMaterial
          color={STYLE.colour}
          transparent
          opacity={focused ? MINING_ROUTE_OPACITY_FOCUSED : MINING_ROUTE_OPACITY}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>

      {/* Named like `flight` and `contact`, so the visual harness can find a run
          and photograph it rather than guessing at a sphere in the scene graph. */}
      <group ref={group} name="mining" userData={{ craftId: run.id }}>
        <mesh
          onPointerUp={(event) => {
            if (!wasTap()) return;
            markHit();
            event.stopPropagation();
            onSelect();
          }}
        >
          <sphereGeometry args={[0.45, 8, 6]} />
          <HitboxMaterial kind="miner" />
        </mesh>

        <group scale={scale}><Suspense fallback={null}>
          <EngineJets units={engines} aimDistance={aimDistance} name="mining-engine-jets" />
          {markers.map((marker, i) => (
            <Craft key={marker.ordinal} offset={slotOffset(i, STYLE.scale * 1.5)} motion={motion} />
          ))}
        </Suspense>
        {/* No dig where this client cannot see the target: it would spark in empty space, or inside a world. */}
        {!run.recalledAt && reach > 0 && (
          <SkinAssetBoundary fallback={null}>
            <Suspense fallback={null}>
              <MiningDig run={run} length={STYLE.scale} motion={motion} />
            </Suspense>
          </SkinAssetBoundary>
        )}</group>
      </group>
    </>
  );
}

/**
 * ONE DRAWN MODEL PER FIVE CRAFT, AND NO PIPS. Owner decision.
 *
 * A war squadron is a group of ships and the pips say how many; a mining run is
 * craft doing one job together and reads as a single object. Five slots above it
 * would state a capacity it does not have.
 */
function Craft({ offset, motion }: { offset: [number, number, number]; motion: RefObject<DrillMotion> }) {
  const bit = useRef<THREE.Group>(null);
  // Turning and shuddering through the bite (`MiningDig`), still the rest of the trip.
  useFrame(({ clock }) => {
    const node = bit.current;
    if (!node) return;
    const { roll, shake } = motion.current;
    node.rotation.z = roll;
    const jolt = shake * STYLE.scale * 0.012;
    node.position.set(jolt * Math.sin(clock.elapsedTime * 91), jolt * Math.sin(clock.elapsedTime * 73 + 1), 0);
  });
  return (
    <group position={offset}>
      <Wake scale={STYLE.scale} colour={STYLE.flame} />
      <group ref={bit}>
        <Hull url={MODEL.drill} scale={STYLE.scale} glow={STYLE.colour} focused={false} />
      </group>
    </group>
  );
}


export type { Vec3Tuple };
