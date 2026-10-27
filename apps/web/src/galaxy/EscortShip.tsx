import { Suspense } from 'react';
import { Html } from '@react-three/drei';
import type { AdmiralSnapshot } from '@astera/rules/arena';
import { arenaCopy } from '../arena/copy.js';
import { useShipModels } from '../arena/hangar/shipModels.js';
import { ShipBody } from './ParkedShip.js';

/**
 * THE COMMANDER SHIP AT THE REAR OF ITS FLEET (Y9, doc 23). Drawn inside the flight's own group,
 * whose +Z is already on the destination, so a position behind the wing is all it needs. It is not
 * a target and adds no hit box: the squadron is still the one object a tap selects. It wears the
 * parked ship's tag, so the player finds their own ship in the wing (F26).
 */
export default function EscortShip({ escort, at, length }: { escort: AdmiralSnapshot; at: [number, number, number]; length: number }) {
  const model = useShipModels(true, true)?.[escort.ship];
  if (!model) return null;
  return <group name="flight-escort" position={at} scale={length} userData={{ ship: escort.ship }}>
    <Suspense fallback={null}><ShipBody model={model} lit /></Suspense>
    <Html zIndexRange={[9, 9]} style={{ pointerEvents: 'none' }}><EscortTag escort={escort} /></Html>
  </group>;
}

/** The class and level under the escort, in the parked ship's tag. */
export function EscortTag({ escort }: { escort: AdmiralSnapshot }) {
  const c = arenaCopy();
  return <div data-part="escort-ship-tag" className="-translate-x-1/2 translate-y-3.5 whitespace-nowrap galaxy-ship-tag font-v2-mono text-micro uppercase tracking-label text-v2-self">
    {c.classes[escort.ship].name} · {c.level(escort.level)}
  </div>;
}
