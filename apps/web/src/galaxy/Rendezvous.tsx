import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useLine } from './Fleets.js';
import type { Vec3Tuple } from './scene.js';

/**
 * THE POINTS IN OPEN SPACE A FLEET IS AIMED AT — COMMITTED, AND PROPOSED. D40 · D155.
 *
 * An interception is the single least obvious thing in the game: a craft heading
 * for apparently empty space looks like a bug until the thing it is meeting
 * arrives there. Seeing it once is confusing; seeing the MARK is the explanation,
 * and after that it is the most legible thing on the disc.
 *
 * THIS LIVED IN `Asteroids.tsx` AND SERVED ONE LANE. Mining explained itself and
 * the pirate lane did not — even though a pirate leads further than a rock does,
 * because its orbit is slower and its hunter is a warship rather than a drill. So
 * a raid set off at an angle to the contact the player had just tapped with
 * nothing on screen saying why, which is what D124 refuses. The mark is the same
 * mark; only the list it reads grew (`rendezvousMarks`).
 *
 * AND THE PROPOSED ONE IS THE OTHER HALF. A committed mark explains a flight that
 * is already irreversible. `AimMark` puts the same point on the disc while the
 * launch sheet is still open, which is the only moment the player can still act
 * on it.
 */

/** Where a craft of yours is going, right now. One ring per outbound leg. */
export function RendezvousMarks({ points }: { points: readonly Vec3Tuple[] }) {
  const ring = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    /**
     * A slow pulse, so it reads as a target being held rather than as a decal.
     *
     * EACH RING, NEVER THE GROUP. Scaling the parent scaled its children's
     * POSITIONS too, about the galaxy's origin — so a marker fifty units out swung
     * six units back and forth every cycle and read as a target sliding around
     * rather than breathing. Scaling each mesh applies about that mesh's own
     * centre, which is what a pulse means.
     *
     * The amplitude came down with the fix (owner call): the old figure was doing
     * two jobs at once, and once the swing is gone what is left only has to be
     * enough to say the marker is live.
     */
    const s = 1 + Math.sin(clock.elapsedTime * 1.6) * 0.05;
    for (const mark of ring.current?.children ?? []) mark.scale.setScalar(s);
  });

  if (points.length === 0) return null;

  return (
    <group ref={ring} name="rendezvous-marks">
      {points.map((at, i) => (
        <mesh key={i} position={at} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.22, 0.26, 24]} />
          <meshBasicMaterial
            color="#d9a441"
            transparent
            opacity={0.75}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

/**
 * WHERE THE WING BEING CHOSEN WOULD MEET IT, AND THE LINE IT WOULD FLY. D155.
 *
 * The launch sheet is the last surface before a fleet stops being recallable, and
 * every figure on it was a number in a box: "44 minutes, 1,500 units" about a
 * coordinate nothing on screen named. A pirate is on a closed orbit, so the
 * meeting point sits AHEAD of the contact — for a heavy wing, most of a lap ahead
 * — and the launch therefore read as a squadron setting off somewhere unrelated.
 *
 * IT FOLLOWS THE PICKER, because the rendezvous does: adding one slow hull moves
 * the whole wing's meeting point, and that is the most surprising consequence of
 * this screen and the one most worth seeing rather than reading.
 *
 * DRAWN IN THE PIRATE'S OWN HUE, never the committed mark's amber. Nothing has
 * been committed yet, and a proposal that looks like a live target would be this
 * component telling the player they had already launched.
 */
export function AimMark({ from, to }: { from: Vec3Tuple; to: Vec3Tuple }) {
  const ring = useRef<THREE.Mesh>(null);
  /** One buffer for the life of the sheet, written in the frame loop. See `useLine`. */
  const line = useLine();

  useFrame(({ clock }) => {
    ring.current?.scale.setScalar(1 + Math.sin(clock.elapsedTime * 2.4) * 0.08);
    // Written in the frame loop rather than an effect: the scene renders on
    // demand, so a buffer filled outside a frame is a line nothing has drawn yet.
    const points = line.getAttribute('position') as THREE.BufferAttribute;
    points.setXYZ(0, from[0], from[1], from[2]);
    points.setXYZ(1, to[0], to[1], to[2]);
    points.needsUpdate = true;
  });

  return (
    <group name="launch-aim">
      {/*
        Fainter than a mining route (0.09) would be too faint to follow across the
        disc, and as bright as a raid thread would make an uncommitted proposal the
        loudest thing on screen. WebGL ignores `linewidth`, so opacity is the only
        lever and it does the job of both.
      */}
      <lineSegments geometry={line} frustumCulled={false}>
        <lineBasicMaterial
          color="#c46bff"
          transparent
          opacity={0.22}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>
      <mesh ref={ring} position={to} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.3, 0.36, 28]} />
        <meshBasicMaterial
          color="#c46bff"
          transparent
          opacity={0.85}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
