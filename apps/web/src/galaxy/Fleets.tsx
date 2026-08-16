import { Suspense, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { interpolatePosition } from '@blindspace/rules';
import type { Contact, PendingThread } from '../api/schemas.js';
import { MODEL } from '../ui/assets.js';
import { softGlow } from './Environment.jsx';
import { toWorld, type Vec3Tuple } from './scene.js';

/**
 * Things moving between the worlds.
 *
 * Your own craft are real geometry — the models are a thousand triangles each and
 * they are the only objects in the scene a player watches long enough to notice a
 * billboard turning. Everything else stays flat, because everything else is either
 * a world seen from far away or a contact you are not entitled to resolve.
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
  fleet: { url: MODEL.wasp, colour: '#6fd3e0', opacity: 0.09, scale: 0.3, flame: '#8fd8ff' },
  probe: { url: MODEL.probe, colour: '#d9a441', opacity: 0.1, scale: 0.24, flame: '#ffc073' },
} as const;

/**
 * The models are loaded with Draco off and meshopt on.
 *
 * Draco off matters: drei's default would build a DRACOLoader that pulls its
 * decoder from a CDN, and nothing here is Draco-compressed anyway. Meshopt is
 * bundled, so the whole thing works offline and behind a strict content policy.
 */
useGLTF.preload(MODEL.probe, false);
useGLTF.preload(MODEL.wasp, false);

/**
 * A hull, pointed the way it is going.
 *
 * Both models come out of the generator a metre long down +Z with the origin at
 * their centre, so the parent group's own +Z is all that has to be aimed. Get
 * this wrong and a ship crabs sideways down its own route, which is the single
 * most obvious way for a scene like this to look unfinished.
 */
function Hull({ url, scale }: { url: string; scale: number }) {
  const { scene } = useGLTF(url, false);

  const model = useMemo(() => {
    // Cloned because the same craft can be in the air more than once, and one
    // object cannot be in two places.
    const clone = scene.clone(true);
    clone.traverse((node) => {
      if (!isMesh(node)) return;
      node.renderOrder = SHIP_ORDER;
      /**
       * Marked transparent so the hull joins the LAST render queue.
       *
       * It is fully opaque and looks identical either way; what changes is when
       * it draws. The depth clear below has to be the last thing that happens in
       * the frame, or the disc rings and beams that draw after it would find an
       * empty depth buffer and bleed through the worlds.
       */
      for (const material of materialsOf(node)) {
        material.transparent = true;
        material.depthWrite = true;
      }
      /**
       * ALWAYS VISIBLE, AND STILL SOLID.
       *
       * A craft is a few pixels across against worlds that are hundreds, so
       * whenever a route passed behind a planet the ship simply disappeared —
       * and the one thing a player is tracking is the thing that vanished.
       *
       * Clearing the depth buffer immediately before the hull draws puts it in
       * front of everything already on screen while leaving depth testing intact
       * WITHIN the hull, so the far side of the model still does not draw through
       * the near side. Turning depth testing off instead would have been one line
       * and would have turned every ship inside out.
       */
      node.onBeforeRender = (renderer) => {
        renderer.clearDepth();
      };
    });
    return clone;
  }, [scene]);

  return <primitive object={model} scale={scale} />;
}

/**
 * The exhaust.
 *
 * A stack of soft billboards down the thrust axis rather than one flat sprite or
 * one cone. Both of those were tried and both are wrong for a top-down galaxy: a
 * single quad vanishes the moment you look at the ship from above, and a cone
 * renders as a hard-edged wedge that reads as a searchlight rather than as fire.
 *
 * Overlapping billboards have neither problem. They face the camera from every
 * angle, so there is no viewing direction where the engine appears to be off, and
 * because they overlap under additive blending they accumulate into something with
 * a bright core and a soft edge — volume, not a shape. Short on purpose: a long
 * plume reads as a comet, and this is a craft.
 */
/** Drawn after the worlds, on a cleared depth buffer. See `Hull`. */
const SHIP_ORDER = 999;

/**
 * `instanceof Mesh` narrows to `Mesh<any, any, any>` in three's own types, which
 * loses every material type downstream. The runtime flag is the narrowing three
 * itself uses internally, and it comes back typed.
 */
function isMesh(node: THREE.Object3D): node is THREE.Mesh<THREE.BufferGeometry, THREE.Material> {
  return (node as { isMesh?: boolean }).isMesh === true;
}

/** `Mesh.material` is one or many. */
function materialsOf(mesh: THREE.Mesh<THREE.BufferGeometry, THREE.Material>): THREE.Material[] {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}

/**
 * A funnel: widest where it leaves the hull, tapering to nothing behind.
 *
 * Enough overlapping steps that the soft edges merge into one continuous shape
 * rather than reading as a string of beads — four was too few and each puff was
 * separately visible. The falloff is squared so the taper closes quickly near the
 * tail, which is what a thruster actually looks like.
 */
const PLUME_STEPS = 9;

const plumeShape = (i: number) => {
  const t = i / (PLUME_STEPS - 1);
  return {
    at: t,
    size: 1 - t * t * 0.92,
    alpha: 0.34 * (1 - t) ** 1.4 + 0.03,
    // Toward white at the nozzle: an engine's core is hotter than its edge, and
    // hotter reads as whiter.
    white: 0.8 * (1 - t) ** 2,
  };
};

function Exhaust({ colour, length, width }: { colour: string; length: number; width: number }) {
  const group = useRef<THREE.Group>(null);
  const glow = useMemo(() => softGlow(), []);

  const puffs = useMemo(
    () =>
      Array.from({ length: PLUME_STEPS }, (_, i) => {
        const puff = plumeShape(i);
        return {
          ...puff,
          tint: new THREE.Color(colour).lerp(new THREE.Color('#ffffff'), puff.white),
        };
      }),
    [colour],
  );

  // Engines are not steady. Two frequencies that do not divide into each other, so
  // the flicker never settles into a visible loop.
  useFrame(({ clock }) => {
    const node = group.current;
    if (!node) return;
    const t = clock.elapsedTime;
    const pulse = 1 + Math.sin(t * 17) * 0.09 + Math.sin(t * 6.3) * 0.06;
    node.scale.set(1, 1, pulse);
  });

  return (
    <group ref={group}>
      {puffs.map((puff, i) => (
        <sprite
          key={i}
          renderOrder={SHIP_ORDER + 1}
          position={[0, 0, -length * puff.at]}
          scale={[width * puff.size, width * puff.size, 1]}
        >
          <spriteMaterial
            map={glow}
            color={puff.tint}
            transparent
            opacity={puff.alpha}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
      ))}
    </group>
  );
}

function Flight({ thread }: { thread: PendingThread }) {
  const path = thread.path;
  const isProbe = thread.kind === 'probe';
  const style = isProbe ? ROUTE.probe : ROUTE.fleet;
  const group = useRef<THREE.Group>(null);

  const from = useMemo(() => (path ? toWorld(path.from) : ([0, 0, 0] as Vec3Tuple)), [path]);
  const to = useMemo(() => (path ? toWorld(path.to) : ([0, 0, 0] as Vec3Tuple)), [path]);

  /**
   * THE ROUTE IS ONLY EVER WHAT IS LEFT TO FLY.
   *
   * It starts at the craft's nose and ends at the target — no line behind it, so a
   * fleet does not drag a record of where it came from across the disc. Read as
   * intent rather than as a trail: a thread the ship is pulling itself along, thin
   * enough that a glance at the galaxy sees worlds first and traffic second.
   */
  const line = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([...from, ...to], 3));
    return g;
  }, [from, to]);

  useFrame(() => {
    if (!path || !group.current) return;
    const at = positionAt(path, Date.now());
    group.current.position.set(at[0], at[1], at[2]);
    /**
     * Nose on the destination.
     *
     * Both models are built a metre long down +Z, which is the axis `lookAt`
     * aims, so pointing the group at the far end of the leg points the ship. Done
     * this way rather than with a rotation between two vectors: that gives the
     * shortest rotation, which is correct about the nose and arbitrary about
     * everything else, and a craft rolled onto its side on the way home was the
     * result. `lookAt` keeps the hull level because it resolves the roll against
     * world up.
     *
     * It also makes the return leg free — the leg's own endpoints arrive in the
     * payload, so a craft that has turned for home turns on screen too.
     */
    group.current.lookAt(to[0], to[1], to[2]);

    // The near end follows the craft. Cheaper than rebuilding the geometry: three
    // floats and a flag, once a frame, for every craft in the air.
    const points = line.getAttribute('position') as THREE.BufferAttribute;
    const nose = style.scale * 0.6;
    const dx = to[0] - at[0];
    const dy = to[1] - at[1];
    const dz = to[2] - at[2];
    const left = Math.hypot(dx, dy, dz);
    const k = left > nose ? nose / left : 0;
    points.setXYZ(0, at[0] + dx * k, at[1] + dy * k, at[2] + dz * k);
    points.needsUpdate = true;
  });

  if (!path) return null;

  return (
    <>
      {/* Frustum culling off: the geometry moves every frame and its bounds do not. */}
      <lineSegments geometry={line} frustumCulled={false}>
        <lineBasicMaterial
          color={style.colour}
          transparent
          opacity={style.opacity}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>

      <group ref={group} name="flight">
        <Suspense fallback={null}>
          <Hull url={style.url} scale={style.scale} />
        </Suspense>
        {/* Behind the hull, in the hull's own space — so it is aimed by the group. */}
        <group position={[0, 0, -style.scale * 0.42]}>
          <Exhaust colour={style.flame} length={style.scale * 0.8} width={style.scale * 0.46} />
        </group>
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
