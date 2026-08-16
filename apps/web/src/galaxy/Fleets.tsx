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

function Flight({ thread }: { thread: PendingThread }) {
  const path = thread.path;
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
      <lineSegments geometry={line}>
        <lineBasicMaterial
          color="#6fd3e0"
          transparent
          opacity={0.22}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>

      <group ref={group}>
        <mesh ref={trail} position={[-0.22, 0, -0.01]}>
          <planeGeometry args={[0.7, 0.16]} />
          <meshBasicMaterial
            map={glow}
            color="#7fc9ff"
            transparent
            opacity={0.55}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
        <mesh>
          <planeGeometry args={[0.34, 0.34]} />
          <meshBasicMaterial map={texture} transparent alphaTest={0.2} depthWrite={false} />
        </mesh>
      </group>
    </>
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
