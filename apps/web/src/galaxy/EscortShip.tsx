import { Suspense } from 'react';
import { Html } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import type { AdmiralSnapshot } from '@astera/rules/arena';
import { arenaCopy } from '../arena/copy.js';
import { useGalaxyShipModels } from '../arena/hangar/shipModels.js';
import { ShipBody } from './ParkedShip.js';
import { HitboxMaterial } from './hitboxDebug.js';

/**
 * THE COMMANDER SHIP AT THE REAR OF ITS FLEET (Y9, doc 23). Drawn inside the flight's own group,
 * whose +Z is already on the destination, so a position behind the wing is all it needs. It is not
 * a separate target: tapping it selects the squadron. It wears the
 * parked ship's tag, so the player finds their own ship in the wing (F26).
 */
export default function EscortShip({ escort, at, length, own = true, onPointerUp }: { escort: AdmiralSnapshot; at: [number, number, number]; length: number; own?: boolean; onPointerUp?: (event: ThreeEvent<PointerEvent>) => void }) {
  const model = useGalaxyShipModels(true)?.[escort.ship];
  return <group name="flight-escort" position={at} scale={length} userData={{ ship: escort.ship }} onPointerUp={onPointerUp}>
    <mesh name="escort-hit-target">
      <sphereGeometry args={[0.6, 8, 6]} />
      <HitboxMaterial kind={own ? 'fleet' : 'contact'} />
    </mesh>
    <Suspense fallback={null}><ShipBody model={model} lit /></Suspense>
    <Html zIndexRange={[9, 9]} style={{ pointerEvents: 'none' }}><EscortTag escort={escort} own={own} /></Html>
  </group>;
}

/** The class and level under the escort, in the parked ship's tag. */
export function EscortTag({ escort, own = true }: { escort: AdmiralSnapshot; own?: boolean }) {
  const c = arenaCopy();
  return <div data-part="escort-ship-tag" className={`-translate-x-1/2 translate-y-3.5 whitespace-nowrap galaxy-ship-tag font-v2-mono text-micro uppercase tracking-label ${own ? "text-v2-self" : "text-v2-ink-2"}`}>
    {c.classes[escort.ship].name} · {c.level(escort.level)}
  </div>;
}
