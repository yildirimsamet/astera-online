import { useTexture } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { Suspense, useRef } from 'react';
import type * as THREE from 'three';
import { serverNow } from '../lib/clock.js';
import { JumpingShip, type JumpingShipState } from './JumpingShip.js';
import { shipStateAt } from './jumpShipState.js';
import { VESSEL_LENGTH } from './scene.js';
import { trackFrame } from './trackFrame.js';
import { watchSeconds, type WatchedFlight } from './watchedFlights.js';

const TRACK_FRAME_URL = '/assets/vfx/library/track-frame.webp';

/** The sensors' frame locked on a far jump (`trackFrame`): a ship across the galaxy still reads as a ship. */
function TrackFrame({ live }: { live: React.RefObject<JumpingShipState | null> }) {
  const map = useTexture(TRACK_FRAME_URL);
  const frame = useRef<THREE.Sprite>(null);
  const lockedSince = useRef<number | null>(null);
  useFrame(({ camera, clock }) => {
    const sprite = frame.current, state = live.current;
    if (!sprite || !state) return;
    const burn = Math.max(state.lever, state.turbo);
    if (burn <= 0.01 || state.vanish >= 1) lockedSince.current = null;
    else lockedSince.current ??= clock.elapsedTime;
    const shown = trackFrame({
      burn, vanish: state.vanish,
      lockedFor: lockedSince.current === null ? 0 : clock.elapsedTime - lockedSince.current,
      shipOnScreen: VESSEL_LENGTH / Math.max(1e-6, camera.position.distanceTo(state.at)),
    });
    sprite.visible = shown.visible;
    sprite.position.copy(state.at);
    sprite.material.opacity = shown.opacity;
    sprite.scale.setScalar(shown.scale);
  });
  return (
    <sprite ref={frame} name="jump-watch-frame" visible={false} raycast={() => null}>
      <spriteMaterial map={map} color="#bfe0ff" sizeAttenuation={false} transparent opacity={0} depthWrite={false} toneMapped={false} />
    </sprite>
  );
}

function Watched({ flight, seed }: { flight: WatchedFlight; seed: number }) {
  const invalidate = useThree(state => state.invalidate);
  const live = useRef<JumpingShipState | null>(null);
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
      <Suspense fallback={null}><TrackFrame live={live} /></Suspense>
    </>
  );
}

/**
 * OTHER COMMANDERS' JUMPS, as everyone sees them (owner, 2026-11-09): the neighbours watch the ship light
 * and leave, the main galaxy watches it come in, on the one clock the pilot's own scene runs. Close by it
 * is the hull and its flames; far off, a speck your sensors lock a tracking frame on. It ends at the main galaxy's rim, so
 * nobody learns which world it took.
 */
export function JumpWatch({ flights }: { flights: readonly WatchedFlight[] }) {
  return <>{flights.map((flight, i) => <Watched key={flight.key} flight={flight} seed={17 + i * 31} />)}</>;
}
