import { useMemo, useRef } from 'react';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { interpolatePosition } from '@blindspace/rules';
import type { Contact, PendingThread } from '../api/schemas.js';
import { HULL_ART, PROBE_ART } from '../ui/assets.js';
import { softGlow } from './Environment.jsx';
import { toWorld, type Vec3Tuple } from './scene.js';

/**
 * Things moving between the worlds.
 *
 * Ships are billboarded sprites of the same renders the shipyard uses — not a
 * placeholder for models that never arrived, but the same choice the planets made
 * for the same reason: the art is finished, lit and shaded, and facing it at the
 * camera keeps all of that for one quad. If `.glb` models arrive later this is
 * where they slot in, and nothing else changes.
 *
 * WHAT IS DRAWN HERE IS EXACTLY WHAT THE PLAYER IS ENTITLED TO SEE:
 *
 *   · Your own fleets and probes, in full, along their real path.
 *   · Other people's traffic as unattributable contacts — mid-flight only, offset,
 *     no endpoints. The server decides that; this only renders it.
 *   · An inbound attack has NO path in the payload and so cannot be drawn as one.
 *     It appears as a threat on your own world, which is all radar sold you.
 */

/** Positions come from timestamps, so a fleet in flight costs no bandwidth at all. */
function positionAt(path: NonNullable<PendingThread['path']>, now: number): Vec3Tuple {
  const point = interpolatePosition(
    path.from,
    path.to,
    path.departAt.getTime(),
    path.arriveAt.getTime(),
    now,
  );
  return toWorld(point);
}

export function OwnFleets({ pending }: { pending: readonly PendingThread[] }) {
  const flying = pending.filter((thread) => thread.path !== undefined);
  if (flying.length === 0) return null;

  return (
    <>
      {flying.map((thread, i) => (
        <Flight key={`${thread.kind}-${thread.targetName}-${String(i)}`} thread={thread} />
      ))}
    </>
  );
}

/**
 * A probe reads differently from a fleet, on purpose.
 *
 * They are different bets — one costs 220 alloy and some minutes, the other costs
 * ships you cannot get back — and a player glancing at the disc should never have
 * to work out which of the two is in the air. Warm and dashed for the scout, cold
 * and solid for the fleet.
 */
const ROUTE = {
  fleet: { colour: '#6fd3e0', opacity: 0.22, scale: 0.34 },
  probe: { colour: '#d9a441', opacity: 0.3, scale: 0.24 },
} as const;

function Flight({ thread }: { thread: PendingThread }) {
  const path = thread.path;
  const isProbe = thread.kind === 'probe';
  const style = isProbe ? ROUTE.probe : ROUTE.fleet;
  const camera = useThree((state) => state.camera);
  const group = useRef<THREE.Group>(null);
  const trail = useRef<THREE.Mesh>(null);

  // A probe is a sensor package, not a warship, and it should not look like one.
  const art = thread.kind === 'probe' ? PROBE_ART : (HULL_ART.WASP ?? PROBE_ART);
  const texture = useLoader(THREE.TextureLoader, art);
  const glow = useMemo(() => softGlow(), []);

  const from = useMemo(() => (path ? toWorld(path.from) : ([0, 0, 0] as Vec3Tuple)), [path]);
  const to = useMemo(() => (path ? toWorld(path.to) : ([0, 0, 0] as Vec3Tuple)), [path]);

  const line = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([...from, ...to], 3));
    // Dashes need the per-vertex distance along the line; without this call a
    // dashed material silently renders solid.
    return g;
  }, [from, to]);

  useFrame(() => {
    if (!path || !group.current) return;
    const at = positionAt(path, Date.now());
    group.current.position.set(at[0], at[1], at[2]);
    group.current.quaternion.copy(camera.quaternion);

    // The trail points back the way it came, and shortens as it arrives — so a
    // glance tells you both the heading and roughly how far along it is.
    const t = trail.current;
    if (t) {
      const dx = to[0] - from[0];
      const dz = to[2] - from[2];
      const heading = Math.atan2(dz, dx);
      t.rotation.z = -heading;
    }
  });

  if (!path) return null;

  return (
    <>
      {/* The route, drawn faintly. Yours, so there is nothing to hide. */}
      <lineSegments geometry={line} onUpdate={(self) => self.computeLineDistances()}>
        {isProbe ? (
          <lineDashedMaterial
            color={style.colour}
            dashSize={0.28}
            gapSize={0.22}
            transparent
            opacity={style.opacity}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        ) : (
          <lineBasicMaterial
            color={style.colour}
            transparent
            opacity={style.opacity}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        )}
      </lineSegments>

      <group ref={group}>
        <mesh ref={trail} position={[-0.22, 0, -0.01]}>
          <planeGeometry args={[0.7, 0.16]} />
          <meshBasicMaterial
            map={glow}
            color={isProbe ? '#f0c070' : '#7fc9ff'}
            transparent
            opacity={0.55}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
        <mesh>
          <planeGeometry args={[style.scale, style.scale]} />
          <meshBasicMaterial map={texture} transparent alphaTest={0.2} depthWrite={false} />
        </mesh>
      </group>
    </>
  );
}

/**
 * WHAT YOU ARE LOOKING AT.
 *
 * A faint beam from your world to each planet a telescope slot is pointed at. Only
 * you can see it, because it is drawn from your own intel payload and nothing
 * about a watch ever leaves your client — that asymmetry is the design's, not an
 * accident: watching is silent and the target is never told.
 *
 * Tapered rather than uniform. The beam is bright where you are and fades to
 * nothing before it arrives, which reads as *looking* rather than as a link
 * between two things, and keeps it from competing with the fleet routes.
 */
export function WatchBeams({
  from,
  targets,
}: {
  from: Vec3Tuple;
  targets: readonly Vec3Tuple[];
}) {
  const material = useRef<THREE.LineBasicMaterial>(null);

  const geometry = useMemo(() => {
    if (targets.length === 0) return null;
    const positions: number[] = [];
    const colours: number[] = [];
    for (const target of targets) {
      // Stop short of the target: a line that touches the planet reads as a tether.
      const end: Vec3Tuple = [
        from[0] + (target[0] - from[0]) * 0.82,
        from[1] + (target[1] - from[1]) * 0.82,
        from[2] + (target[2] - from[2]) * 0.82,
      ];
      positions.push(...from, ...end);
      colours.push(0.85, 0.92, 1, 0, 0, 0);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
    return g;
  }, [from, targets]);

  // A slow breath, so the beam reads as an instrument doing something rather than
  // a line someone drew.
  useFrame(({ clock }) => {
    const m = material.current;
    if (m) m.opacity = 0.16 + Math.sin(clock.elapsedTime * 1.1) * 0.05;
  });

  if (!geometry) return null;

  return (
    <lineSegments geometry={geometry} frustumCulled={false}>
      <lineBasicMaterial
        ref={material}
        vertexColors
        transparent
        opacity={0.18}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </lineSegments>
  );
}

/**
 * Other people's traffic.
 *
 * Motes, not ships — deliberately. The server already strips these of every
 * identifying fact and offsets them past the point of attribution; rendering them
 * as a recognisable hull would invite a player to read a fidelity into them that
 * is not there. A moving point says "the galaxy is busy" and says nothing else,
 * which is exactly the contract.
 */
export function Traffic({ contacts }: { contacts: readonly Contact[] }) {
  const points = useRef<THREE.Points>(null);
  const glow = useMemo(() => softGlow(), []);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(Math.max(1, contacts.length) * 3), 3),
    );
    return g;
  }, [contacts.length]);

  useFrame(() => {
    const node = points.current;
    if (!node || contacts.length === 0) return;
    const now = Date.now();
    const attribute = node.geometry.getAttribute('position');

    contacts.forEach((contact, i) => {
      const span = contact.endAt.getTime() - contact.startAt.getTime();
      const t = span <= 0 ? 1 : (now - contact.startAt.getTime()) / span;
      const clamped = Math.max(0, Math.min(1, t));
      const at = toWorld({
        x: contact.from.x + (contact.to.x - contact.from.x) * clamped,
        y: contact.from.y + (contact.to.y - contact.from.y) * clamped,
        z: contact.from.z + (contact.to.z - contact.from.z) * clamped,
      });
      attribute.setXYZ(i, at[0], at[1], at[2]);
    });
    attribute.needsUpdate = true;
  });

  if (contacts.length === 0) return null;

  return (
    <points ref={points} geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        map={glow}
        color="#9fb4d4"
        size={0.34}
        sizeAttenuation
        transparent
        opacity={0.5}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
