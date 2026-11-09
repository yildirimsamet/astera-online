import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { serverNow } from '../lib/clock.js';
import { softGlow } from './Environment.js';
import { JumpingShip, type JumpingShipState } from './JumpingShip.js';
import { shipStateAt } from './jumpShipState.js';
import { watchSeconds, type WatchedFlight } from './watchedFlights.js';

/** The beacon's size on screen, whatever the distance: a ship across the galaxy still reads as a moving star. */
const BEACON = 0.045;

function Watched({ flight, seed }: { flight: WatchedFlight; seed: number }) {
  const invalidate = useThree(state => state.invalidate);
  const beacon = useRef<THREE.Sprite>(null);
  const live = useRef<JumpingShipState | null>(null);
  useFrame(() => {
    const sprite = beacon.current, state = live.current;
    if (!sprite || !state) return;
    const burn = Math.max(state.lever, state.turbo);
    sprite.visible = state.vanish < 1 && burn > 0.01;
    sprite.position.copy(state.at);
    sprite.material.opacity = 0.9 * burn * (1 - state.vanish);
    sprite.scale.setScalar(BEACON * (0.7 + 0.5 * state.turbo));
  });
  return (
    <>
      <JumpingShip hull={flight.hull} look="RENEWED" seed={seed} poseAt={(into) => {
        live.current = into;
        const s = watchSeconds(flight, serverNow());
        if (s === null) { into.vanish = 1; into.lever = 0; into.turbo = 0; return; }
        shipStateAt(flight.from, flight.stop, s, into);
        // The galaxy draws on demand: while a ship is in the sky, each frame asks for the next.
        invalidate();
      }} />
      <sprite ref={beacon} name="jump-watch-beacon" visible={false} raycast={() => null}>
        <spriteMaterial map={softGlow()} color="#bfe0ff" sizeAttenuation={false} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </sprite>
    </>
  );
}

/**
 * OTHER COMMANDERS' JUMPS, as everyone sees them (owner, 2026-11-09): the neighbours watch the ship light
 * and leave, the main galaxy watches it come in, on the one clock the pilot's own scene runs. Close by it
 * is the hull and its flames; far off, a star crossing the sky. It ends at the main galaxy's rim, so
 * nobody learns which world it took.
 */
export function JumpWatch({ flights }: { flights: readonly WatchedFlight[] }) {
  return <>{flights.map((flight, i) => <Watched key={flight.key} flight={flight} seed={17 + i * 31} />)}</>;
}
