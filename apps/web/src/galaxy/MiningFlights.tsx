import { Suspense, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { MiningRun } from '../api/schemas.js';
import { MODEL } from '../ui/assets.js';
import { Hull, Wake, useLine } from './Fleets.jsx';
import { CRAFT_SCALE, runPosition, toWorld, type PlanetNode, type Vec3Tuple } from './scene.js';
import { markersFor, slotOffset } from './Squadrons.js';
import { markHit, wasTap } from './tap.js';
import { serverNow } from '../lib/clock.js';

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
  home,
  nodes,
  focusedId,
  onSelect,
}: {
  runs: readonly MiningRun[];
  home: { x: number; y: number; z: number };
  /** The worlds, so a Prospector is never drawn inside one. See `clearOfWorlds`. */
  nodes: readonly PlanetNode[];
  focusedId: string | null;
  onSelect: (id: string) => void;
}) {
  const flying = runs.filter((r) => r.status !== 'done');
  if (flying.length === 0) return null;

  return (
    <>
      {flying.map((run) => (
        <Run
          key={run.id}
          run={run}
          home={home}
          nodes={nodes}
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
  focused,
  onSelect,
}: {
  run: MiningRun;
  home: { x: number; y: number; z: number };
  nodes: readonly PlanetNode[];
  focused: boolean;
  onSelect: () => void;
}) {
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

  /** One buffer for the life of the run, written both ends per frame. See `useLine`. */
  const line = useLine();

  useFrame(() => {
    const node = group.current;
    if (!node) return;
    // The same helper the camera reads, so a focused run stays centred.
    const at = runPosition(run, home, serverNow(), nodes);
    node.position.set(at[0], at[1], at[2]);
    node.lookAt(to[0], to[1], to[2]);

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
      <group ref={group} name="mining">
        <mesh
          onPointerUp={(event) => {
            if (!wasTap()) return;
            markHit();
            event.stopPropagation();
            onSelect();
          }}
        >
          <sphereGeometry args={[0.45, 8, 6]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>

        <Suspense fallback={null}>
          {markers.map((marker, i) => (
            <Craft key={marker.ordinal} offset={slotOffset(i, STYLE.scale * 1.5)} />
          ))}
        </Suspense>
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
function Craft({ offset }: { offset: [number, number, number] }) {
  return (
    <group position={offset}>
      <Wake scale={STYLE.scale} colour={STYLE.flame} />
      <Hull url={MODEL.drill} scale={STYLE.scale} glow={STYLE.colour} focused={false} />
    </group>
  );
}


export type { Vec3Tuple };
