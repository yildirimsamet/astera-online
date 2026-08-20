import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { engagementEndsAt, isEngaging } from '@blindspace/rules';
import type { Contact, PendingThread } from '../api/schemas.js';
import { HULL_MODEL, MODEL, MODEL_FACING } from '../ui/assets.js';
import { Bombardment } from './Bombardment.jsx';
import { softGlow } from './Environment.jsx';
import { orientedCraft } from './model.js';
import {
  clearOfWorlds,
  contactPosition,
  engagementHold,
  legEnd,
  legStandoff,
  legStart,
  targetNodeOf,
  threadPosition,
  toWorld,
  type PlanetNode,
  type Vec3Tuple,
} from './scene.js';
import {
  PER_MODEL,
  formationFor,
  slotOffset,
  type Formation,
  type Marker,
} from './Squadrons.js';
import { markHit, wasTap } from './tap.js';
import { serverNow } from '../lib/clock.js';

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

export function OwnFleets({
  pending,
  nodes,
  focusedKey,
  onSelect,
}: {
  pending: readonly PendingThread[];
  /**
   * The worlds, so a leg can find the one it ends at.
   *
   * A thread carries coordinates and no id, and what a leg needs from its target
   * is how BIG it is — where to stop short of it (D44), and how far to scatter a
   * bombardment across its face. Both are the drawn radius, which only the disc
   * knows.
   */
  nodes: readonly PlanetNode[];
  focusedKey: string | null;
  onSelect: (key: string) => void;
}) {
  const flying = pending.filter((thread) => thread.path !== undefined);
  if (flying.length === 0) return null;

  return (
    <>
      {flying.map((thread, i) => {
        const key = threadKey(thread, i);
        return (
          <Flight
            key={key}
            id={key}
            thread={thread}
            nodes={nodes}
            focused={key === focusedKey}
            onSelect={() => {
              onSelect(key);
            }}
          />
        );
      })}
    </>
  );
}

/** Stable enough to survive a refetch, which is what focus needs to persist. */
/**
 * THE MISSION'S OWN ID WHERE THERE IS ONE. D52.
 *
 * It is focus's identity AND the volley's seed, and the fallback is neither stable
 * nor shared: `fleet:outbound:Tharsis:0` changes if the list reorders, and it can
 * never match the key a bystander's client uses for the same raid — so the two of
 * them generated different bombardments of the same world. Your own threads carry
 * the id now; the fallback survives only for an `incoming` thread, which is
 * deliberately anonymous and never draws a craft anyway.
 */
export const threadKey = (thread: PendingThread, i: number): string =>
  thread.id ?? `${thread.kind}:${thread.leg ?? 'out'}:${thread.targetName}:${String(i)}`;

/**
 * A probe reads differently from a fleet, on purpose.
 *
 * They are different bets — one costs a little of both resources and some minutes,
 * the other costs ships you cannot get back — and a player glancing at the disc
 * should never have to work out which of the two is in the air.
 *
 * TWO SIGNALS, AND THEY ANSWER DIFFERENT QUESTIONS. Owner decision.
 *
 *   NEON is on the CRAFT, and everyone who can see the craft sees it. Green means
 *   scout, blue means warship. A hull at this distance is a few dark pixels
 *   against a nebula; the rim is what makes it an object rather than a smudge, and
 *   the colour is what makes it a KIND of object without a label.
 *
 *   THE ROUTE is on the OWNER'S SCREEN ONLY, and it is orange. Where a craft is
 *   going is intent — the single most valuable thing another commander could read
 *   off this map — so it is drawn from your own pending payload and the server
 *   never sends anyone else's. Nothing here filters it: an inbound attack arrives
 *   with no `path` key at all, so there is no field for a modified client to
 *   render. See `pendingThreads` on the server.
 *
 * Orange for both legs and both kinds, because the line answers one question and
 * one question deserves one colour. The craft at its head already says which of
 * them it is.
 */
export const ROUTE_COLOUR = '#ff8b3d';

/**
 * How loud a route is. One number, and every line in the galaxy reads it.
 *
 * Taken down on the owner's eye: at 0.34 the threads were the brightest thing on
 * the disc and the worlds had to compete with them. A route is context — it says
 * where a craft you have already found is going — so it belongs under the objects
 * rather than over them. Thin and faint, and brighter only for the one you have
 * selected.
 */
export const ROUTE_OPACITY = 0.16;
export const ROUTE_OPACITY_FOCUSED = 0.42;

const ROUTE = {
  fleet: {
    url: MODEL.wasp,
    scale: 0.225,
    flame: '#8fd8ff',
    /** Blue: this is a warship. */
    neon: '#3fa9ff',
  },
  probe: {
    url: MODEL.probe,
    scale: 0.18,
    flame: '#9dffc4',
    /** Green: this is the scout. */
    neon: '#3ff08a',
  },
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
    // Centred, turned so the NOSE runs down +Z, and normalised into a unit box —
    // so `lookAt` points the nose and `scale` is a real world size. The facing is
    // declared per model; a bounding box cannot tell a fuselage from a wingspan.
    const clone = orientedCraft(scene, MODEL_FACING[url] ?? '+z');
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
  }, [scene, url]);

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

/** The neon's diameter, as a multiple of the hull's own drawn size. Owner's eye. */
const NEON_SIZE = 1.55 * 0.7;

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

function Flight({
  id,
  thread,
  nodes,
  focused,
  onSelect,
}: {
  /** The same key focus uses. Stable across refetches, so a volley does not re-roll. */
  id: string;
  thread: PendingThread;
  nodes: readonly PlanetNode[];
  focused: boolean;
  onSelect: () => void;
}) {
  const path = thread.path;
  const isProbe = thread.kind === 'probe';
  const style = isProbe ? ROUTE.probe : ROUTE.fleet;
  const group = useRef<THREE.Group>(null);

  const to = useMemo(() => (path ? toWorld(path.to) : ([0, 0, 0] as Vec3Tuple)), [path]);

  /**
   * A CRAFT ARRIVES IN ORBIT, NOT AT THE MIDDLE OF A WORLD — AND LEAVES FROM THERE
   * AGAIN. D44.
   *
   * The leg's endpoint is the target planet's own coordinates, which are its
   * centre — so an arriving squadron used to be drawn inside the thing it had come
   * to attack. That was invisible while an arrival lasted zero seconds; the
   * engagement window makes it a moment somebody watches, and it is also the
   * distance the missiles have to cross.
   *
   * The RETURN leg reads the same figure at its own near end, so a fleet sets off
   * home from the point it was holding rather than from the middle of the world.
   * See `legStandoff` for what the seam looked like before it did.
   */
  const standoff = useMemo(() => legStandoff(thread, nodes), [thread, nodes]);
  const from = useMemo(
    () => (path ? legStart(path, standoff.start) : ([0, 0, 0] as Vec3Tuple)),
    [path, standoff],
  );
  const stop = useMemo(
    () => (path ? legEnd(path, standoff.end) : ([0, 0, 0] as Vec3Tuple)),
    [path, standoff],
  );

  /**
   * The world being raided, for how big it is and nothing else.
   *
   * Only an outbound FLEET bombards: a probe takes a photograph, and a leg coming
   * home is landing rather than arriving.
   */
  const target = useMemo(
    () =>
      path && !isProbe && thread.leg !== 'return' ? targetNodeOf(nodes, path.to) : undefined,
    [path, isProbe, thread.leg, nodes],
  );

  /**
   * The formation. D20 / D40: one model per `PER_MODEL` ships, pips for the rest.
   *
   * A probe is always exactly one craft and gets no pips — empty slots above
   * a scout would be stating a capacity it does not have.
   */
  const formation = useMemo(
    () => (isProbe ? null : formationFor(thread.fleet ?? {})),
    [isProbe, thread.fleet],
  );

  /** Where each drawn model sits. Needed twice now: to place it, and to fire from it. */
  const slots = useMemo<Vec3Tuple[]>(
    () =>
      formation
        ? formation.markers.map((_, i) => slotOffset(i, style.scale * 1.5))
        : [[0, 0, 0]],
    [formation, style.scale],
  );

  const engaging = useEngagement(path ? path.arriveAt.getTime() : null);

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
    g.setAttribute('position', new THREE.Float32BufferAttribute([...from, ...stop], 3));
    return g;
  }, [from, stop]);

  useFrame(() => {
    if (!path || !group.current) return;
    // The same helper the camera reads, so a focused squadron stays centred.
    const at = threadPosition(path, serverNow(), standoff);
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
     */
    group.current.lookAt(to[0], to[1], to[2]);

    // The near end follows the craft. Cheaper than rebuilding the geometry: three
    // floats and a flag, once a frame, for every craft in the air.
    const points = line.getAttribute('position') as THREE.BufferAttribute;
    const nose = style.scale * 0.6;
    const dx = stop[0] - at[0];
    const dy = stop[1] - at[1];
    const dz = stop[2] - at[2];
    const left = Math.hypot(dx, dy, dz);
    const k = left > nose ? nose / left : 0;
    points.setXYZ(0, at[0] + dx * k, at[1] + dy * k, at[2] + dz * k);
    points.needsUpdate = true;
  });

  if (!path) return null;

  return (
    <>
      {/*
        THE ROUTE. Yours alone — see `ROUTE_COLOUR`.

        Frustum culling off: the geometry moves every frame and its bounds do not.
        Faint on purpose — see `ROUTE_OPACITY`. It was a hairline at 0.09, which
        hid the one thing it exists to show, then too loud at 0.34, which made the
        threads the brightest objects on the disc. This is the settled middle.
      */}
      <lineSegments geometry={line} frustumCulled={false}>
        <lineBasicMaterial
          color={ROUTE_COLOUR}
          transparent
          opacity={focused ? ROUTE_OPACITY_FOCUSED : ROUTE_OPACITY}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>

      <group ref={group} name="flight">
        {/*
          One generous invisible target for the whole squadron. Picking an
          individual model would be fiddly on a phone and would say the models are
          separately meaningful, which they are not — the squadron is the object.
        */}
        <mesh
          onPointerUp={(event) => {
            if (!wasTap()) return;
            markHit();
            event.stopPropagation();
            onSelect();
          }}
        >
          <sphereGeometry args={[Math.max(0.45, style.scale * 1.6), 8, 6]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>

        <Suspense fallback={null}>
          {formation ? (
            formation.markers.map((marker, i) => (
              <Craft
                key={`${marker.hull}-${String(marker.ordinal)}`}
                marker={marker}
                offset={slots[i] ?? [0, 0, 0]}
                scale={style.scale}
                flame={style.flame}
                neon={style.neon}
                focused={focused}
              />
            ))
          ) : (
            <>
              <Wake scale={style.scale} colour={style.neon} />
              <Neon colour={style.neon} scale={style.scale} lit={focused} />
              <Hull url={style.url} scale={style.scale} />
              <group position={[0, 0, -style.scale * 0.42]}>
                <Exhaust
                  colour={style.flame}
                  length={style.scale * 0.8}
                  width={style.scale * 0.46}
                />
              </group>
            </>
          )}
        </Suspense>

        {/*
          THE ENGAGEMENT. D44.

          Ten seconds from the moment the fleet is over the world, drawn inside the
          squadron's own group so a missile's line is simply "from this craft,
          straight ahead, to that world". Mounted only while the window is open, so
          nothing is allocated for the forty minutes of flight that precede it.
        */}
        {target && engaging && (
          <Bombardment
            volleyKey={id}
            slots={slots}
            distance={Math.hypot(to[0] - stop[0], to[1] - stop[1], to[2] - stop[2])}
            radius={target.radius}
            shipScale={style.scale}
            arriveAt={path.arriveAt.getTime()}
          />
        )}
      </group>
    </>
  );
}

/**
 * One drawn model, standing for up to `PER_MODEL` ships, with its count above it.
 *
 * The pips are the honest half of the abstraction. Without them a multi-ship group
 * and a one-ship group are the same picture, and the player is reading a rounded
 * number while believing it exact.
 *
 * THEY BELONG TO SQUADRONS ONLY. Owner decision. A probe and a mining run are one
 * craft each, and five slots above a single object state a capacity it does not
 * have — the reader is being told "one of five" about a thing that can only ever be
 * one. `pips` is therefore a decision the caller makes, not a property of drawing a
 * hull.
 */
function Craft({
  marker,
  offset,
  scale,
  flame,
  neon,
  focused,
  pips = true,
}: {
  marker: Marker;
  offset: [number, number, number];
  scale: number;
  flame: string;
  neon: string;
  focused: boolean;
  /** False for anything that is one craft rather than a group of them. */
  pips?: boolean;
}) {
  return (
    <group position={offset}>
      <Wake scale={scale} colour={neon} />
      <Neon colour={neon} scale={scale} lit={focused} />
      <Hull url={HULL_MODEL[marker.hull]} scale={scale} />
      <group position={[0, 0, -scale * 0.42]}>
        <Exhaust colour={flame} length={scale * 0.8} width={scale * 0.46} />
      </group>
      {pips && <Pips filled={marker.filled} scale={scale} lit={focused} />}
    </group>
  );
}

/**
 * THE STREAK A CRAFT DRAWS BEHIND IT.
 *
 * The same object as `Tails` in `Asteroids.tsx`, and deliberately so — the owner
 * asked for the rock's streak, thinner and shorter. Read that file for why it is a
 * tapering ribbon rather than a line or a row of billboards: a one-pixel line has
 * no edge to soften and can only ever be a vector diagram, and soft billboards bead
 * up into a string of blobs.
 *
 * WHAT IS SIMPLER HERE THAN ON A ROCK. A rock's ribbon follows a curved orbit, so
 * every segment has to be re-solved against the path and given its own facing. A
 * craft flies straight, so the whole strip lies along its own local −Z and the
 * "across" direction is ONE cross product per craft per frame. That is what makes
 * it affordable on a dozen models at once where the rocks pay for a whole field.
 *
 * ONE PER DRAWN MODEL, not one per squadron. Six Wasps are two models and get two
 * streaks, which is the owner's rule: what is drawn is what trails.
 */

/** Quads down the strip. Fewer than a rock's eleven — it is half the length. */
const WAKE_SEGMENTS = 9;

/**
 * Half-width at the craft, as a multiple of its drawn size.
 *
 * The rock's is 0.31 of its radius; the owner asked for 75% thinner, so a quarter
 * of that. At map distance this is a hairline and at close focus it is a wisp,
 * which is the intent — a craft should read as the object and the streak as
 * something it has shed.
 */
const WAKE_WIDTH = 0.31 * 0.25;

/**
 * How far back it reaches, as a multiple of the craft's own size.
 *
 * A rock's streak spans a twenty-fourth of its orbit, which works out around
 * nineteen times its radius. Half that is the owner's figure, and it lands at
 * roughly nine times a craft's length — long enough to say which way something is
 * going from across the disc, short enough not to read as a comet.
 */
const WAKE_LENGTH = 9.5;

/**
 * Brightness at the craft. Additive on a near-black sky, so this is a whisper.
 *
 * CUT FROM 0.42 AFTER LOOKING AT IT. The scene runs a bloom pass with a luminance
 * threshold of 0.62, and an additive strip at 0.42 crosses it — so the mipmap blur
 * spread a hairline ribbon into a fat glowing beam wider than the ship towing it.
 * The number that matters is not the ribbon's width, it is whether the ribbon
 * blooms; under the threshold it reads as the thin streak it actually is.
 */
const WAKE_PEAK = 0.16;

export function Wake({ scale, colour }: { scale: number; colour: string }) {
  const mesh = useRef<THREE.Mesh>(null);

  /** Colours and indices never change; only the vertices move. Built once. */
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const verts = WAKE_SEGMENTS * 2;
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts * 3), 3));

    const tint = new THREE.Color(colour);
    const colours = new Float32Array(verts * 3);
    const index: number[] = [];
    for (let k = 0; k < WAKE_SEGMENTS; k += 1) {
      // Squared falloff, as on the rocks: a linear fade leaves a hard end,
      // because the last quad is still a quarter lit when it stops existing.
      const back = k / (WAKE_SEGMENTS - 1);
      const lit = WAKE_PEAK * (1 - back) * (1 - back);
      const v = k * 2;
      colours.set([tint.r * lit, tint.g * lit, tint.b * lit], v * 3);
      colours.set([tint.r * lit, tint.g * lit, tint.b * lit], (v + 1) * 3);
      if (k < WAKE_SEGMENTS - 1) index.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
    }
    g.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    g.setIndex(index);
    return g;
  }, [colour]);

  const eye = useMemo(() => new THREE.Vector3(), []);
  const side = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ camera }) => {
    const node = mesh.current;
    if (!node) return;

    /**
     * Which way is "across" the ribbon, solved in the craft's OWN space.
     *
     * The craft is already turned so its nose runs down local +Z, so the tangent
     * is a constant and only the camera has to be brought into local space. Doing
     * it per frame rather than once is what keeps the strip from vanishing to a
     * line when the player flies into its plane — and this disc can be viewed from
     * underneath.
     */
    node.updateWorldMatrix(true, false);
    eye.copy(camera.position);
    node.worldToLocal(eye);
    side.set(0, 0, 1).cross(eye);
    if (side.lengthSq() < 1e-12) side.set(1, 0, 0);
    else side.normalize();

    const position = node.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let k = 0; k < WAKE_SEGMENTS; k += 1) {
      const back = k / (WAKE_SEGMENTS - 1);
      // Tapers to a point. The hull covers the widest end, so the streak reads as
      // shed from the craft rather than bolted to it.
      const w = scale * WAKE_WIDTH * (1 - back);
      const z = -scale * WAKE_LENGTH * back;
      const v = k * 2;
      position.setXYZ(v, side.x * w, side.y * w, z + side.z * w);
      position.setXYZ(v + 1, -side.x * w, -side.y * w, z - side.z * w);
    }
    position.needsUpdate = true;
  });

  return (
    <mesh ref={mesh} geometry={geometry} frustumCulled={false} renderOrder={SHIP_ORDER - 2}>
      {/*
        Depth-tested, unlike the hull it trails. A craft is deliberately drawn over
        everything because losing the thing you are tracking behind a planet is
        worse than a small cheat; a streak has no such claim, and one lying across a
        world it is nowhere near reads as a scratch on the screen.
      */}
      <meshBasicMaterial
        vertexColors
        transparent
        opacity={0.85}
        depthWrite={false}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

/**
 * THE RIM LIGHT THAT MAKES A CRAFT FINDABLE.
 *
 * A hull is a few hundred triangles seen from tens of world units away, unlit on
 * its far side, against a nebula that is itself bright — so at any real viewing
 * distance a ship is a dark smudge you locate by watching its exhaust move. The
 * owner's note was that craft need to be NOTICEABLE, and that a scout and a
 * warship should be distinguishable at a glance.
 *
 * A single soft additive sprite behind the model does both. It is one draw call,
 * it faces the camera from every angle so there is no direction from which the
 * ship goes dark, and because it sits BEHIND the hull it reads as a rim rather
 * than as a wash over the model — the silhouette stays sharp and the colour is
 * unmistakable.
 *
 * Deliberately small — the owner's word was *çok ufak*, and the size has been cut
 * twice on their eye rather than on an argument: 2.1× was a glow ball with a ship
 * somewhere inside it, 1.55× was still a wide circle, and this is that figure
 * taken down another 30%. Barely past the hull's own extent, so it reads as a rim
 * on a craft rather than as a bubble around one, and a formation of five reads as
 * five lights instead of one blob.
 */
function Neon({ colour, scale, lit }: { colour: string; scale: number; lit: boolean }) {
  const glow = useMemo(() => softGlow(), []);

  return (
    <sprite renderOrder={SHIP_ORDER - 1} scale={[scale * NEON_SIZE, scale * NEON_SIZE, 1]}>
      <spriteMaterial
        map={glow}
        color={colour}
        transparent
        opacity={lit ? 0.7 : 0.5}
        depthWrite={false}
        depthTest={false}
        blending={THREE.AdditiveBlending}
      />
    </sprite>
  );
}

/**
 * Five slots above a model; as many are lit as that model actually carries.
 *
 * FILLED IS BLUE AND EMPTY IS GREY, and that never changes. A focused squadron
 * used to switch its filled pips to white, which read as a different STATE rather
 * than as the same squadron with a highlight on it — the owner saw white pips and
 * asked where the blue had gone. Focus now brightens the same blue instead, so the
 * colour keeps meaning one thing.
 */
function Pips({ filled, scale, lit }: { filled: number; scale: number; lit: boolean }) {
  /**
   * SMALLER AND CLOSER, at owner request.
   *
   * The tally was a bank of chunky squares floating well clear of the craft — big
   * enough to compete with the hull for attention and far enough above it to read
   * as its own object rather than as a label on one. A readout should be the
   * quietest thing on the marker.
   */
  const size = scale * 0.085;
  const gap = size * 1.6;
  /**
   * TWO ROWS OF FIVE, not one row of ten.
   *
   * `PER_MODEL` doubled to ten (owner decision), and the pips follow it because
   * they are the exact count — but ten in a line is twice as wide as the craft
   * carrying them, which turns a readout into a banner. Five and five keeps the
   * width exactly where it was and still reads as a tally.
   */
  const perRow = Math.min(PER_MODEL, 5);
  const rows = Math.ceil(PER_MODEL / perRow);
  const width = gap * (perRow - 1);

  return (
    <group position={[0, scale * 0.6, 0]}>
      {Array.from({ length: PER_MODEL }, (_, i) => (
        <sprite
          key={i}
          position={[
            (i % perRow) * gap - width / 2,
            // Top row first, so a partly-filled marker fills left-to-right and
            // downward — the direction a tally is read.
            ((rows - 1) / 2 - Math.floor(i / perRow)) * gap,
            0,
          ]}
          scale={[size, size, 1]}
          renderOrder={SHIP_ORDER + 2}
        >
          <spriteMaterial
            color={i < filled ? (lit ? '#7fd4ff' : '#4aa8e8') : '#33404f'}
            transparent
            opacity={i < filled ? 0.95 : 0.35}
            depthWrite={false}
            depthTest={false}
          />
        </sprite>
      ))}
    </group>
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
    // Named for the same reason the planet and rock instances are: the visual
    // harness picks objects out of the graph by name, and "the line buffer with
    // few vertices and a colour attribute" also describes the meteors.
    <lineSegments name="watch-beams" geometry={geometry} frustumCulled={false}>
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
 * OTHER PEOPLE'S CRAFT. D24.
 *
 * These used to be motes: featureless points, offset past attribution, drawn only
 * through the middle of a flight. That protected the fog completely and left a
 * galaxy of two hundred real people looking deserted.
 *
 * They are real craft now, at real positions, for the whole flight, wearing the
 * same neon everyone's own craft wear — green for a scout, blue for a warship,
 * amber for a Prospector — and trailing the same streak. What they do NOT wear is
 * a route: the server sends a bearing window rather than endpoints, so there is
 * nothing here to draw a line from even if this file wanted to. The one exception
 * is a mining run, whose leg and clock are public because the race for a rock is.
 *
 * THEY CARRY THEIR PIPS TOO. Composition is public (D24), so a foreign squadron is
 * drawn exactly the way your own is: one model per `PER_MODEL` ships, pips above each for
 * what it really holds. Showing a single anonymous hull while the focus panel spelt
 * out "8 Wasps" was the interface disagreeing with itself about the same fact.
 */
const CONTACT_STYLE: Record<Contact['kind'], { neon: string; scale: number; flame: string }> = {
  fleet: { neon: '#3fa9ff', scale: 0.195, flame: '#8fd8ff' },
  probe: { neon: '#3ff08a', scale: 0.15, flame: '#9dffc4' },
  mining: { neon: '#ffb057', scale: 0.18, flame: '#ffd9a8' },
  // A harvest is the same craft on a different errand, so it keeps the miner's
  // amber and goes a shade paler — recognisably the same kind of thing, visibly
  // not headed for a rock. D32.
  harvest: { neon: '#ffcf8f', scale: 0.18, flame: '#ffe9cc' },
};

/** A probe is one craft; anything else is drawn from what the payload says is in it. */
const contactFormation = (contact: Contact): Formation | null => {
  if (contact.kind === 'probe') return null;
  // A harvest is Prospectors too, and its count is in `craft` like a mining run's.
  // Falling through to `fleet` — which a run never carries — drew NOTHING at all.
  if (contact.kind === 'mining' || contact.kind === 'harvest') {
    return formationFor({ PROSPECTOR: contact.craft ?? 1 });
  }
  return formationFor(contact.fleet ?? {});
};

export function Traffic({
  contacts,
  nodes,
  focusedId,
  onSelect,
}: {
  contacts: readonly Contact[];
  /** The worlds, so no contact is ever drawn inside one. See `clearOfWorlds`. */
  nodes: readonly PlanetNode[];
  focusedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (contacts.length === 0) return null;

  return (
    <Suspense fallback={null}>
      {contacts.map((contact) => (
        <Foreign
          key={contact.id}
          contact={contact}
          nodes={nodes}
          focused={contact.id === focusedId}
          onSelect={() => {
            onSelect(contact.id);
          }}
        />
      ))}
    </Suspense>
  );
}

function Foreign({
  contact,
  nodes,
  focused,
  onSelect,
}: {
  contact: Contact;
  nodes: readonly PlanetNode[];
  focused: boolean;
  onSelect: () => void;
}) {
  const group = useRef<THREE.Group>(null);
  const style = CONTACT_STYLE[contact.kind];
  const formation = useMemo(() => contactFormation(contact), [contact]);

  const from = useMemo(() => toWorld(contact.from), [contact.from]);
  const to = useMemo(() => toWorld(contact.to), [contact.to]);

  /**
   * THE BATTLE, DRAWN FOR EVERYBODY. D52.
   *
   * D44 gave the ten-second engagement to the attacker alone, because it needed a
   * target to fire at and a contact carried none. The payload names it now, for
   * exactly those ten seconds, so this mounts the SAME `Bombardment` off the SAME
   * mission id — which is what makes every player in the galaxy watch the identical
   * volley rather than each seeing their own version of it.
   */
  const fight = contact.engagement;
  const engaging = useEngagement(fight ? fight.arriveAt.getTime() : null);
  const world = useMemo(
    () => (fight ? targetNodeOf(nodes, fight.target) : undefined),
    [fight, nodes],
  );
  const hold = useMemo(
    () => (fight ? engagementHold(fight.target, contact.from, nodes) : null),
    [fight, contact.from, nodes],
  );
  const centre = useMemo(() => (fight ? toWorld(fight.target) : null), [fight]);
  const slots = useMemo<Vec3Tuple[]>(
    () =>
      formation && formation.markers.length > 0
        ? formation.markers.map((_, i) => slotOffset(i, style.scale * 1.5))
        : [[0, 0, 0]],
    [formation, style.scale],
  );

  /**
   * A MINING RUN'S LINE IS PUBLIC; NOTHING ELSE'S IS.
   *
   * Read straight off `route`, which the server only ever populates for `mining` —
   * so this branch cannot be reached for a fleet or a probe however the payload is
   * shaped. The fog is enforced there, not here.
   *
   * IT IS ONLY EVER WHAT IS LEFT TO FLY. Owner rule, and the same one your own
   * craft obey: the near end is moved onto the craft every frame, so nothing drags
   * a record of where it has been across the disc. A route is intent, not history —
   * a line behind a craft says where it came from, which is the one thing this
   * payload exists to withhold, and on a mining run it is simply clutter.
   */
  const route = useMemo(() => {
    if (!contact.route) return null;
    const a = toWorld(contact.route.from);
    const b = toWorld(contact.route.to);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b], 3));
    return g;
  }, [contact.route]);
  const ahead = useMemo(
    () => (contact.route ? toWorld(contact.route.to) : null),
    [contact.route],
  );

  useFrame(() => {
    const node = group.current;
    if (!node) return;
    /**
     * The same helper the camera reads, so a focused contact stays centred — and
     * the same correction, so the craft and the rig agree about where it is.
     *
     * A contact's published position is the truth to the metre, and on the last
     * minute of a raid the truth is INSIDE the world being attacked. See
     * `clearOfWorlds`.
     */
    const at = clearOfWorlds(nodes, contactPosition(contact, serverNow(), nodes));
    node.position.set(at[0], at[1], at[2]);
    // Aimed down its own window, which is its heading and nothing further — or, once
    // it is over a world, at the world it is putting rounds into.
    const aim = centre ?? to;
    if (Math.hypot(aim[0] - from[0], aim[1] - from[1], aim[2] - from[2]) > 1e-4) {
      node.lookAt(aim[0], aim[1], aim[2]);
    }

    // The near end of a mining run's line follows the craft, so only what is left
    // to fly is ever drawn. Three floats and a flag, once a frame.
    if (route && ahead) {
      const points = route.getAttribute('position') as THREE.BufferAttribute;
      points.setXYZ(0, at[0], at[1], at[2]);
      points.setXYZ(1, ahead[0], ahead[1], ahead[2]);
      points.needsUpdate = true;
    }
  });

  return (
    <>
      {route && (
        <lineSegments geometry={route} frustumCulled={false}>
          <lineBasicMaterial
            color={ROUTE_COLOUR}
            transparent
            opacity={focused ? ROUTE_OPACITY_FOCUSED : ROUTE_OPACITY}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </lineSegments>
      )}

      <group ref={group} name="contact">
        {/*
          Tappable, exactly like your own squadrons and the rocks. D24: somebody
          else's craft is an object in the world, and an object you can see but
          cannot select reads as scenery — which is the opposite of the liveliness
          this is for.
        */}
        <mesh
          onPointerUp={(event) => {
            if (!wasTap()) return;
            markHit();
            event.stopPropagation();
            onSelect();
          }}
        >
          <sphereGeometry args={[Math.max(0.45, style.scale * 1.6), 8, 6]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>

        {formation ? (
          formation.markers.map((marker, i) => (
            <Craft
              key={`${marker.hull}-${String(marker.ordinal)}`}
              marker={marker}
              offset={slotOffset(i, style.scale * 1.5)}
              scale={style.scale}
              flame={style.flame}
              neon={style.neon}
              focused={focused}
              // Only a war squadron is a group of ships. A mining run is craft
              // doing one job together and reads as one object.
              pips={contact.kind === 'fleet'}
            />
          ))
        ) : (
          <>
            <Wake scale={style.scale} colour={style.neon} />
            <Neon colour={style.neon} scale={style.scale} lit={focused} />
            <Hull url={MODEL.probe} scale={style.scale} />
            <group position={[0, 0, -style.scale * 0.42]}>
              <Exhaust colour={style.flame} length={style.scale * 0.7} width={style.scale * 0.4} />
            </group>
          </>
        )}

        {/*
          The volley, seeded from the mission id — the same key the attacker's own
          client uses, so the two of them watch the identical bombardment.
        */}
        {fight && world && hold && centre && engaging && (
          <Bombardment
            volleyKey={contact.id}
            slots={slots}
            distance={Math.hypot(
              centre[0] - hold[0],
              centre[1] - hold[1],
              centre[2] - hold[2],
            )}
            radius={world.radius}
            shipScale={style.scale}
            arriveAt={fight.arriveAt.getTime()}
          />
        )}
      </group>
    </>
  );
}

/**
 * IS THIS FLEET OVER ITS TARGET RIGHT NOW, WITH NOTHING YET DECIDED? D44.
 *
 * State rather than a per-frame read, because it decides whether the bombardment
 * EXISTS. A frame-level check would have to keep three dozen missile groups
 * mounted for the whole forty-minute flight so that one of them could become
 * visible at the end of it; two timers cost nothing and mount the volley for
 * exactly the ten seconds it is wanted.
 *
 * Both edges are armed, and the window is re-read on every change of `arriveAt`,
 * so a tab that was asleep across the whole engagement wakes to the correct answer
 * rather than to a squadron firing at a world whose report it has already read.
 */
function useEngagement(arriveAt: number | null): boolean {
  const [engaging, setEngaging] = useState(
    () => arriveAt !== null && isEngaging(arriveAt, serverNow()),
  );

  useEffect(() => {
    if (arriveAt === null) {
      setEngaging(false);
      return;
    }
    setEngaging(isEngaging(arriveAt, serverNow()));

    const timers: ReturnType<typeof setTimeout>[] = [];
    const arm = (at: number, to: boolean): void => {
      const delay = at - serverNow();
      // `setTimeout` overflows past 2^31 ms and fires IMMEDIATELY, which would
      // start a bombardment the moment a very distant raid launched. A flight that
      // far out simply arms on a later poll instead.
      if (delay > 0 && delay <= 2_147_483_647) {
        timers.push(
          setTimeout(() => {
            setEngaging(to);
          }, delay),
        );
      }
    };
    arm(arriveAt, true);
    arm(engagementEndsAt(arriveAt), false);

    return () => {
      for (const timer of timers) clearTimeout(timer);
    };
  }, [arriveAt]);

  return engaging;
}
