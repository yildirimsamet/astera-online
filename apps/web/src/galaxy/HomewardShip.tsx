import { Suspense, useMemo, useRef } from 'react';
import type * as THREE from 'three';
import { useShipModels } from '../arena/hangar/shipModels.js';
import { serverNow } from '../lib/clock.js';
import { ESCORT_LENGTH, FLEET_CRAFT } from './flightVisual.js';
import { HitboxMaterial } from './hitboxDebug.js';
import type { HomewardShip } from './parkedShip.js';
import { ShipBody } from './ParkedShip.js';
import { CRAFT_SCALE, homewardStandoff, threadPosition, toWorld, type PlanetNode } from './scene.js';
import { markHit, wasTap } from './tap.js';
import { useVisualFrame } from './visualFrame.js';

/**
 * THE COMMANDER SHIP FLYING HOME ALONE (Y9, doc 23): its fleet was lost, or stayed in a monument.
 * The same size it had at the rear of the fleet, engines lit, on the server's way and clocks, off
 * the battle world's orbit down to home. It lands where the parked ship then appears; a tap opens
 * the hangar, as the parked ship's does.
 */
export default function HomewardShipModel({ home, nodes, onSelect }: { home: HomewardShip; nodes: readonly PlanetNode[]; onSelect: () => void }) {
  const model = useShipModels(true, true)?.[home.ship];
  const standoff = useMemo(() => homewardStandoff(home.path, nodes), [home.path, nodes]);
  const end = useMemo(() => toWorld(home.path.to), [home.path]);
  const root = useRef<THREE.Group>(null);
  useVisualFrame(() => {
    const group = root.current; if (!group) return;
    const now = serverNow();
    group.visible = now < home.path.arriveAt.getTime();
    if (!group.visible) return;
    const at = threadPosition(home.path, now, standoff);
    group.position.set(at[0], at[1], at[2]);
    group.lookAt(end[0], end[1], end[2]);
  });
  if (!model) return null;
  return <group ref={root} name="homeward-escort" userData={{ ship: home.ship }}>
    <group scale={ESCORT_LENGTH * FLEET_CRAFT * CRAFT_SCALE}><Suspense fallback={null}><ShipBody model={model} lit /></Suspense></group>
    <mesh onPointerUp={event => { if (!wasTap()) return; markHit(); event.stopPropagation(); onSelect(); }}>
      <sphereGeometry args={[ESCORT_LENGTH * FLEET_CRAFT * CRAFT_SCALE * 0.7, 8, 6]} />
      <HitboxMaterial kind="fleet" />
    </mesh>
  </group>;
}
