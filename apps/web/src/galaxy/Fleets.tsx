import { Suspense, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { engagementEndsAt, isEngaging, seededFrom } from '@astera/rules';
import type { Contact, PendingThread } from '../api/schemas.js';
import { HULL_MODEL, MODEL, MODEL_FACING } from '../ui/assets.js';
import { Bombardment, bombardmentIntensity } from './Bombardment.jsx';
import { softGlow } from './Environment.jsx';
import { orientedCraft } from './model.js';
import {
  contactPosition,
  CRAFT_SCALE,
  engagementHold,
  legEnd,
  legStandoff,
  orbitStandoff,
  targetNodeOf,
  threadPosition,
  toWorld,
  type PlanetNode,
  type Vec3Tuple,
} from './scene.js';
import {
  PER_MODEL,
  formationHitBox,
  markersFor,
  slotOffset,
  type Marker,
} from './Squadrons.js';
import { markHit, wasTap } from './tap.js';
import { serverNow } from '../lib/clock.js';
import {
  DEATH_STAR_LIGHT,
  HULL_LIGHT,
  TRACKING_MARK,
  UNKNOWN_CONTACT_MARK,
  formationAimDirection,
} from './flightVisual.js';
import { fireTexture } from './vfx.js';
import { threadKey } from './threadKey.js';

export { threadKey } from './threadKey.js';

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
    scale: 0.225 * CRAFT_SCALE,
    flame: '#8fd8ff',
    /** Blue: this is a warship. */
    neon: '#3fa9ff',
  },
  probe: {
    url: MODEL.probe,
    scale: 0.18 * CRAFT_SCALE,
    flame: '#9dffc4',
    /** Green: this is the scout. */
    neon: '#3ff08a',
  },
} as const;

/**
 * Drive and silhouette colours belong to the hull, not to the mission carrying it.
 * In particular the Runner is the fast amber courier and the Breacher is the red
 * shield-breaker; painting an entire mixed fleet blue erased both identities.
 */

/**
 * The models are loaded with Draco off and meshopt on.
 *
 * Draco off matters: drei's default would build a DRACOLoader that pulls its
 * decoder from a CDN, and nothing here is Draco-compressed anyway. Meshopt is
 * bundled, so the whole thing works offline and behind a strict content policy.
 */
useGLTF.preload(MODEL.probe, false);
useGLTF.preload(MODEL.wasp, false);
useGLTF.preload(MODEL.deathStar, false);

/**
 * A hull, pointed the way it is going.
 *
 * Both models come out of the generator a metre long down +Z with the origin at
 * their centre, so the parent group's own +Z is all that has to be aimed. Get
 * this wrong and a ship crabs sideways down its own route, which is the single
 * most obvious way for a scene like this to look unfinished.
 */
export function Hull({
  url,
  scale,
  glow,
  focused,
}: {
  url: string;
  scale: number;
  glow: string;
  focused: boolean;
}) {
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

  const { outline, outlineMaterials } = useMemo(() => {
    const clone = model.clone(true);
    const owned: THREE.ShaderMaterial[] = [];
    clone.traverse((node) => {
      if (!isMesh(node)) return;
      const material = new THREE.ShaderMaterial({
        uniforms: {
          uColour: { value: new THREE.Color(glow) },
          uOpacity: { value: focused ? 0.94 : 0.72 },
        },
        transparent: true,
        depthWrite: false,
        depthTest: false,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        vertexShader: `
          void main() {
            vec3 expanded = position + normal * 0.035;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(expanded, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 uColour;
          uniform float uOpacity;
          void main() {
            gl_FragColor = vec4(uColour, uOpacity);
          }
        `,
      });
      material.toneMapped = false;
      node.material = material;
      node.renderOrder = SHIP_ORDER - 1;
      owned.push(material);
    });
    return { outline: clone, outlineMaterials: owned };
  }, [model, glow, focused]);

  useEffect(
    () => () => {
      outlineMaterials.forEach((material) => { material.dispose(); });
    },
    [outlineMaterials],
  );

  return (
    <group scale={scale} name="craft-hull">
      <primitive object={outline} name="craft-silhouette-rim" />
      <primitive object={model} />
    </group>
  );
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
const PLUME_STEPS = 13;

const plumeShape = (i: number) => {
  const t = i / (PLUME_STEPS - 1);
  const expansion = Math.sin(Math.PI * Math.min(1, t * 1.08));
  return {
    at: t,
    // A rocket plume leaves a small throat, expands after the nozzle and then
    // loses density. Starting at full width was the source of the blue bubbles.
    size: (0.32 + expansion * 0.68) * (1 - t * 0.78),
    alpha: 0.31 * (1 - t) ** 1.55 + 0.01,
    // Toward white at the nozzle: an engine's core is hotter than its edge, and
    // hotter reads as whiter.
    white: 0.55 * (1 - t) ** 2,
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

/**
 * The Death Star is a strategic missile, not another small drive with a red tint.
 * Two interleaved additive volumes make a hot blue/white throat inside a much
 * fuller yellow-orange-red exhaust. The irregular offsets and independent pulse
 * keep the plume turbulent without allocating particles on every frame.
 */
function StrategicExhaust({ scale }: { scale: number }) {
  const root = useRef<THREE.Group>(null);
  const outer = useRef<THREE.Group>(null);
  const outerSprites = useRef<(THREE.Sprite | null)[]>([]);
  const coreSprites = useRef<(THREE.Sprite | null)[]>([]);
  const glow = useMemo(() => softGlow(), []);
  const fire = useMemo(fireTexture, []);
  const outerHot = useMemo(() => new THREE.Color('#fff5df'), []);
  const outerTail = useMemo(() => new THREE.Color('#ff3b2f'), []);
  const puffs = useMemo(() => {
    return Array.from({ length: 24 }, (_, i) => {
      const t = i / 23;
      const colour = new THREE.Color('#fff5df').lerp(new THREE.Color('#ff3b2f'), t ** 1.2);
      const turbulence = Math.sin(i * 8.173) * 0.05 * t;
      return {
        t,
        colour,
        x: turbulence,
        y: Math.cos(i * 5.731) * 0.04 * t,
        size: (0.32 + Math.sin(Math.PI * Math.min(1, t * 1.18)) * 0.8) * (1 - t * 0.45),
        opacity: 0.32 * (1 - t) ** 0.8 + 0.035,
      };
    });
  }, []);
  const core = useMemo(
    () => Array.from({ length: 16 }, (_, i) => {
      const t = i / 15;
      return {
        t,
        colour: new THREE.Color(t < 0.28 ? '#dffaff' : t < 0.58 ? '#fff7cf' : '#ffbd48'),
        size: (0.28 + Math.sin(Math.PI * t) * 0.32) * (1 - t * 0.55),
        opacity: 0.88 * (1 - t) ** 1.2,
      };
    }),
    [],
  );

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (root.current) {
      root.current.scale.z = 1 + Math.sin(t * 19.1) * 0.1 + Math.sin(t * 7.7) * 0.06;
    }
    if (outer.current) {
      const breath = 1 + Math.sin(t * 13.4) * 0.055;
      outer.current.scale.set(breath, breath, 1);
    }
    for (let i = 0; i < puffs.length; i++) {
      const sprite = outerSprites.current[i];
      if (!sprite) continue;
      const flow = (puffs[i]!.t + t * (0.85 + (i % 4) * 0.04)) % 1;
      const widen = 0.035 + flow * 0.14;
      sprite.position.set(
        scale * (Math.sin(i * 8.173 + t * 9.1) * widen),
        scale * (Math.cos(i * 5.731 + t * 7.3) * widen * 0.72),
        -scale * 0.85 * flow,
      );
      const size = (0.32 + Math.sin(Math.PI * Math.min(1, flow * 1.18)) * 0.8)
        * (1 - flow * 0.45);
      sprite.scale.set(scale * 1.1 * size, scale * 1.1 * size, 1);
      const material = sprite.material;
      material.opacity = 0.32 * (1 - flow) ** 0.8 + 0.035;
      material.color.copy(outerHot).lerp(outerTail, flow ** 1.2);
    }
    for (let i = 0; i < core.length; i++) {
      const sprite = coreSprites.current[i];
      if (!sprite) continue;
      const flow = (core[i]!.t + t * (1.2 + (i % 3) * 0.05)) % 1;
      sprite.position.set(
        scale * Math.sin(i * 3.7 + t * 12.2) * 0.02 * flow,
        scale * Math.cos(i * 4.1 + t * 10.8) * 0.016 * flow,
        -scale * 0.45 * flow,
      );
      const size = (0.28 + Math.sin(Math.PI * flow) * 0.32) * (1 - flow * 0.55);
      sprite.scale.set(scale * 0.6 * size, scale * 0.6 * size, 1);
      sprite.material.opacity = 0.88 * (1 - flow) ** 1.2;
    }
  });

  return (
    <group
      ref={root}
      position={[0, 0, -scale * 0.48]}
      name="death-star-rocket-exhaust"
    >
      <pointLight color="#78cfff" intensity={3.5} distance={scale * 3} decay={2} />
      <pointLight
        color="#ff4b21"
        intensity={6}
        distance={scale * 4.5}
        decay={2}
        position={[0, 0, -scale * 0.4]}
      />
      <group ref={outer}>
        {puffs.map((puff, i) => (
          <sprite
            ref={(node) => { outerSprites.current[i] = node; }}
            key={`outer-${String(i)}`}
            renderOrder={SHIP_ORDER + 1}
            position={[scale * puff.x, scale * puff.y, -scale * 0.85 * puff.t]}
            scale={[scale * 1.1 * puff.size, scale * 1.1 * puff.size, 1]}
          >
            <spriteMaterial
              map={fire}
              color={puff.colour}
              transparent
              opacity={puff.opacity}
              depthTest={false}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
            />
          </sprite>
        ))}
      </group>
      {core.map((puff, i) => (
        <sprite
          ref={(node) => { coreSprites.current[i] = node; }}
          key={`core-${String(i)}`}
          renderOrder={SHIP_ORDER + 2}
          position={[0, 0, -scale * 0.45 * puff.t]}
          scale={[scale * 0.6 * puff.size, scale * 0.6 * puff.size, 1]}
        >
          <spriteMaterial
            map={glow}
            color={puff.colour}
            transparent
            opacity={puff.opacity}
            depthTest={false}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </sprite>
      ))}
    </group>
  );
}

/**
 * ONE LINE BUFFER PER CRAFT, FOR AS LONG AS THAT CRAFT EXISTS.
 *
 * Every route on this disc was a `BufferGeometry` built inside a `useMemo` keyed on
 * the leg's endpoints — and those endpoints were derived from a payload that came
 * back as a brand new object on every single refetch (see `api/structural.ts`). So
 * a new buffer was allocated for every craft in the galaxy every time `pending` or
 * `traffic` was read, several times a minute.
 *
 * AND THE OLD ONE WAS NEVER FREED. Replacing the `geometry` prop on a mounted
 * object hands three.js a new buffer and simply drops the old one on the floor;
 * nothing disposes it, because nothing unmounted. That is a GPU allocation per
 * craft per refetch, for as long as the tab is open, and it is invisible until the
 * scene starts to stutter on a phone an hour into a session.
 *
 * Both ends are written every frame anyway — the near end has to follow the craft —
 * so the buffer never needed rebuilding at all. It is allocated once, mutated in
 * place, and disposed when the craft it belongs to leaves the disc.
 *
 * `enabled` is for the one caller that may have no line: a contact only publishes a
 * route when it is a mining or salvage run (D24). Passed as a flag rather than
 * decided by the caller so the hook is still called unconditionally, which is what
 * the rules of hooks require.
 */
export function useLine(): THREE.BufferGeometry;
export function useLine(enabled: boolean): THREE.BufferGeometry | null;
export function useLine(enabled = true): THREE.BufferGeometry | null {
  const geometry = useMemo(() => {
    if (!enabled) return null;
    const g = new THREE.BufferGeometry();
    // Two points, filled on the first frame. Never resized after this.
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6), 3));
    return g;
  }, [enabled]);

  useEffect(
    () => () => {
      geometry?.dispose();
    },
    [geometry],
  );

  return geometry;
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
  const isDeathStar = thread.kind === 'death_star';
  const style = isProbe ? ROUTE.probe : ROUTE.fleet;
  const group = useRef<THREE.Group>(null);
  const formationAim = useRef(100);

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
  /**
   * Only the FAR end is needed here now.
   *
   * The near end used to be baked into the route's geometry at construction; it is
   * written from the craft's own position every frame instead, so `legStart` is left
   * to `threadPosition`, which is the one place a leg's beginning still decides
   * anything. Keeping a second copy of it here was what forced the geometry to be
   * rebuilt whenever the standoff memo produced a new object.
   */
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
      path && !isProbe && !isDeathStar && thread.kind === 'fleet' && thread.leg !== 'return'
        ? targetNodeOf(nodes, path.to)
        : undefined,
    [path, isProbe, isDeathStar, thread.kind, thread.leg, nodes],
  );

  /**
   * The formation. D20 / D40: one model per `PER_MODEL` ships, pips for the rest.
   * Every marker the fleet needs, with nothing cut — D115.
   *
   * A probe is always exactly one craft and gets no pips — empty slots above
   * a scout would be stating a capacity it does not have.
   */
  const markers = useMemo(
    () => (isProbe || isDeathStar ? null : markersFor(thread.fleet ?? {})),
    [isProbe, isDeathStar, thread.fleet],
  );

  /** Where each drawn model sits. Needed twice now: to place it, and to fire from it. */
  const slots = useMemo<Vec3Tuple[]>(
    () =>
      markers
        ? markers.map((_, i) => slotOffset(i, style.scale * 1.5))
        : [[0, 0, 0]],
    [markers, style.scale],
  );
  const hitBox = useMemo(() => formationHitBox(slots, style.scale), [slots, style.scale]);

  const engaging = useEngagement(path ? path.arriveAt.getTime() : null);
  /**
   * A Death Star is spent at the instant it lands: it is the explosion. Kept here
   * rather than left to the payload because the mission is only resolved on the
   * worker's next tick, and until then this craft is still in `pending` — which
   * drew the weapon hovering over the world it had just detonated on.
   */
  const spent = useStrikeConsumed(isDeathStar && path ? path.arriveAt.getTime() : null);

  /**
   * THE ROUTE IS ONLY EVER WHAT IS LEFT TO FLY.
   *
   * It starts at the craft's nose and ends at the target — no line behind it, so a
   * fleet does not drag a record of where it came from across the disc. Read as
   * intent rather than as a trail: a thread the ship is pulling itself along, thin
   * enough that a glance at the galaxy sees worlds first and traffic second.
   */
  const line = useLine();

  useFrame(() => {
    if (!path || !group.current) return;
    // The same helper the camera reads, so a focused squadron stays centred.
    const at = threadPosition(path, serverNow(), standoff);
    group.current.position.set(at[0], at[1], at[2]);
    formationAim.current = Math.max(
      0.01,
      Math.hypot(to[0] - at[0], to[1] - at[1], to[2] - at[2]),
    );
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

    /**
     * BOTH ENDS, EVERY FRAME — which is also why the geometry itself never changes.
     *
     * The near end has always followed the craft. The far end used to be baked in
     * at construction, so the geometry had to be REBUILT whenever the leg's endpoint
     * memo produced a new tuple — which was every refetch, because the payload
     * behind it was a fresh object every time. Writing six floats is cheaper than
     * allocating a buffer, and it means the one buffer lives exactly as long as the
     * flight does. See `useLine`.
     */
    const points = line.getAttribute('position') as THREE.BufferAttribute;
    const nose = style.scale * 0.6;
    const dx = stop[0] - at[0];
    const dy = stop[1] - at[1];
    const dz = stop[2] - at[2];
    const left = Math.hypot(dx, dy, dz);
    const k = left > nose ? nose / left : 0;
    points.setXYZ(0, at[0] + dx * k, at[1] + dy * k, at[2] + dz * k);
    points.setXYZ(1, stop[0], stop[1], stop[2]);
    points.needsUpdate = true;
  });

  if (!path || spent) return null;

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

      <group ref={group} name="flight" userData={{ craftId: id }}>
        {/*
          One generous invisible target for the whole squadron. Picking an
          individual model would be fiddly on a phone and would say the models are
          separately meaningful, which they are not — the squadron is the object.
        */}
        <mesh
          position={hitBox.centre}
          onPointerUp={(event) => {
            if (!wasTap()) return;
            markHit();
            event.stopPropagation();
            onSelect();
          }}
        >
          <boxGeometry args={hitBox.size} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>

        <TrackingMark
          kind={isDeathStar ? 'death_star' : isProbe ? 'probe' : 'fleet'}
          scale={isDeathStar ? style.scale * 3.4 : style.scale}
          colour={isDeathStar ? DEATH_STAR_LIGHT.glow : style.neon}
          focused={focused}
        />

        <Suspense fallback={null}>
          {markers ? (
            <>
              <FormationLightField
                markers={markers}
                slots={slots}
                scale={style.scale}
                aimDistance={formationAim}
                focused={focused}
                showPips
              />
              <FormationWakes
                markers={markers}
                slots={slots}
                scale={style.scale}
                aimDistance={formationAim}
              />
              {markers.map((marker, i) => (
                <Craft
                  key={`${marker.hull}-${String(marker.ordinal)}`}
                  marker={marker}
                  offset={slots[i] ?? [0, 0, 0]}
                  scale={style.scale}
                  aimDistance={formationAim}
                  focused={focused}
                  batched
                />
              ))}
            </>
          ) : (
            <>
              <Wake
                scale={isDeathStar ? style.scale * 3.4 : style.scale}
                colour={isDeathStar ? DEATH_STAR_LIGHT.glow : style.neon}
                lengthScale={isDeathStar ? 0.5 : 1}
              />
              <Hull
                url={isDeathStar ? MODEL.deathStar : style.url}
                scale={isDeathStar ? style.scale * 3.4 : style.scale}
                glow={isDeathStar ? DEATH_STAR_LIGHT.glow : style.neon}
                focused={focused}
              />
              {isDeathStar ? (
                <StrategicExhaust scale={style.scale * 3.4} />
              ) : (
                <group position={[0, 0, -style.scale * 0.42]}>
                  <Exhaust
                    colour={style.flame}
                    length={style.scale * 0.8}
                    width={style.scale * 0.46}
                  />
                </group>
              )}
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
  aimDistance,
  focused,
  pips = true,
  batched = false,
}: {
  marker: Marker;
  offset: [number, number, number];
  scale: number;
  aimDistance?: RefObject<number>;
  focused: boolean;
  /** False for anything that is one craft rather than a group of them. */
  pips?: boolean;
  /** Formation-wide light and pip buffers replace this craft's individual sprites. */
  batched?: boolean;
}) {
  const light = HULL_LIGHT[marker.hull];
  const craft = useRef<THREE.Group>(null);
  const direction = useMemo(() => new THREE.Vector3(), []);
  const forward = useMemo(() => new THREE.Vector3(0, 0, 1), []);
  const aimed = useRef<Vec3Tuple>([0, 0, 1]);
  useFrame(() => {
    if (!craft.current || !aimDistance) return;
    formationAimDirection(offset, aimDistance.current, aimed.current);
    direction.set(...aimed.current);
    craft.current.quaternion.setFromUnitVectors(forward, direction);
  });
  return (
    <group ref={craft} position={offset}>
      {!batched && <Wake scale={scale} colour={light.glow} />}
      <Hull
        url={HULL_MODEL[marker.hull]}
        scale={scale}
        glow={light.glow}
        focused={focused}
      />
      {!batched && (
        <group position={[0, 0, -scale * 0.42]}>
          <Exhaust colour={light.flame} length={scale * 0.8} width={scale * 0.46} />
        </group>
      )}
      {pips && !batched && <Pips filled={marker.filled} scale={scale} lit={focused} />}
    </group>
  );
}

/**
 * Every soft light in a formation in one GPU draw.
 *
 * The previous shape was one sprite per exhaust puff, one neon sprite and five
 * pip sprites PER DRAWN CRAFT. A nine-marker raid therefore spent 135 transparent
 * draw calls before it fired a single round. These point buffers preserve the
 * exact same world positions and count semantics, while the GPU expands all of
 * them into camera-facing quads in two calls: one soft additive field, one pip
 * field. No per-frame React work and no per-craft material instances.
 */
function FormationLightField({
  markers,
  slots,
  scale,
  aimDistance,
  focused,
  showPips,
}: {
  markers: readonly Marker[];
  slots: readonly Vec3Tuple[];
  scale: number;
  aimDistance: RefObject<number>;
  focused: boolean;
  showPips: boolean;
}) {
  const aimed = useMemo<Vec3Tuple>(() => [0, 0, 1], []);
  const lights = useMemo(() => {
    const count = markers.length * PLUME_STEPS;
    const positions = new Float32Array(count * 3);
    const colours = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const alphas = new Float32Array(count);
    const pulses = new Float32Array(count);
    const energies = new Float32Array(count);
    const white = new THREE.Color('#ffffff');
    let cursor = 0;

    const put = (
      position: Vec3Tuple,
      colour: THREE.Color,
      size: number,
      alpha: number,
      pulse: number,
      energy: number,
    ): void => {
      positions.set(position, cursor * 3);
      colours.set([colour.r, colour.g, colour.b], cursor * 3);
      sizes[cursor] = size;
      alphas[cursor] = alpha;
      pulses[cursor] = pulse;
      energies[cursor] = energy;
      cursor += 1;
    };

    markers.forEach((marker, markerIndex) => {
      const slot = slots[markerIndex] ?? [0, 0, 0];
      const flameColour = new THREE.Color(HULL_LIGHT[marker.hull].flame);
      for (let i = 0; i < PLUME_STEPS; i += 1) {
        const puff = plumeShape(i);
        const tint = flameColour.clone().lerp(white, puff.white);
        put(
          [slot[0], slot[1], slot[2] - scale * (0.42 + 0.8 * puff.at)],
          tint,
          scale * 0.46 * puff.size,
          puff.alpha,
          0.12,
          0.65 + puff.white * 1.15,
        );
      }
    });

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
    geometry.setAttribute('aPulse', new THREE.BufferAttribute(pulses, 1));
    geometry.setAttribute('aEnergy', new THREE.BufferAttribute(energies, 1));
    return geometry;
  }, [markers, slots, scale]);

  const glowMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uProjectionScale: { value: 700 },
          uMotion: { value: 1 },
        },
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: `
          attribute float aSize;
          attribute float aAlpha;
          attribute float aPulse;
          attribute float aEnergy;
          varying vec3 vColour;
          varying float vAlpha;
          uniform float uTime;
          uniform float uProjectionScale;
          uniform float uMotion;
          void main() {
            vColour = color * aEnergy;
            vAlpha = aAlpha;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            float beat = 1.0 + uMotion * aPulse * (sin(uTime * 17.0 + position.x * 5.0) + sin(uTime * 6.3));
            gl_PointSize = max(1.0, aSize * beat * uProjectionScale / max(0.01, -mv.z));
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: `
          varying vec3 vColour;
          varying float vAlpha;
          void main() {
            float d = length(gl_PointCoord - vec2(0.5)) * 2.0;
            float soft = smoothstep(1.0, 0.08, d);
            float core = 1.0 + pow(max(0.0, 1.0 - d), 3.0) * 0.15;
            gl_FragColor = vec4(vColour * core, vAlpha * soft);
          }
        `,
      }),
    [],
  );

  useFrame(({ clock, camera, size: viewport, gl }) => {
    const positions = lights.getAttribute('position') as THREE.BufferAttribute;
    let cursor = 0;
    markers.forEach((_, markerIndex) => {
      const slot = slots[markerIndex] ?? [0, 0, 0];
      formationAimDirection(slot, aimDistance.current, aimed);
      for (let i = 0; i < PLUME_STEPS; i += 1) {
        const puff = plumeShape(i);
        const behind = scale * (0.42 + 0.8 * puff.at);
        positions.setXYZ(
          cursor,
          slot[0] - aimed[0] * behind,
          slot[1] - aimed[1] * behind,
          slot[2] - aimed[2] * behind,
        );
        cursor += 1;
      }
    });
    positions.needsUpdate = true;
    glowMaterial.uniforms.uTime!.value = clock.elapsedTime;
    glowMaterial.uniforms.uMotion!.value = 1;
    const perspective = camera as THREE.PerspectiveCamera;
    const fov = THREE.MathUtils.degToRad(perspective.fov || 45);
    glowMaterial.uniforms.uProjectionScale!.value =
      (viewport.height * gl.getPixelRatio()) / (2 * Math.tan(fov / 2));
  });

  useEffect(
    () => () => {
      lights.dispose();
      glowMaterial.dispose();
    },
    [lights, glowMaterial],
  );

  return (
    <>
      <points
        geometry={lights}
        material={glowMaterial}
        frustumCulled={false}
        renderOrder={SHIP_ORDER + 1}
        name="formation-lights"
      />
      {showPips && (
        <FormationPips markers={markers} slots={slots} scale={scale} focused={focused} />
      )}
    </>
  );
}

function FormationPips({
  markers,
  slots,
  scale,
  focused,
}: {
  markers: readonly Marker[];
  slots: readonly Vec3Tuple[];
  scale: number;
  focused: boolean;
}) {
  const geometry = useMemo(() => {
    const count = markers.length * PER_MODEL;
    const positions = new Float32Array(count * 3);
    const colours = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const lit = new THREE.Color(focused ? '#7fd4ff' : '#4aa8e8');
    const empty = new THREE.Color('#33404f');
    const pipSize = scale * 0.085;
    const gap = pipSize * 1.6;
    /**
     * WRAPPED AT FIVE, exactly like the sprite tally in `Pips` below.
     *
     * This used to lay every pip in ONE row while capping `width` at five of them,
     * which was invisible while `PER_MODEL` was 5 and became a row running off the
     * side of the marker the moment it was raised to 10. The two tallies draw the
     * same thing and have to agree on its shape.
     */
    const perRow = Math.min(PER_MODEL, 5);
    const rows = Math.ceil(PER_MODEL / perRow);
    const width = gap * (perRow - 1);
    let cursor = 0;

    markers.forEach((marker, markerIndex) => {
      const slot = slots[markerIndex] ?? [0, 0, 0];
      for (let i = 0; i < PER_MODEL; i += 1) {
        positions.set(
          [
            slot[0] + (i % perRow) * gap - width / 2,
            // Top row first, so a partly-filled marker fills left-to-right and
            // downward — the direction a tally is read.
            slot[1] + scale * 0.6 + ((rows - 1) / 2 - Math.floor(i / perRow)) * gap,
            slot[2],
          ],
          cursor * 3,
        );
        const colour = i < marker.filled ? lit : empty;
        colours.set([colour.r, colour.g, colour.b], cursor * 3);
        sizes[cursor] = pipSize;
        cursor += 1;
      }
    });

    const buffer = new THREE.BufferGeometry();
    buffer.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    buffer.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    buffer.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    return buffer;
  }, [markers, slots, scale, focused]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uProjectionScale: { value: 700 },
          uPixelRatio: { value: 1 },
        },
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        vertexShader: `
          attribute float aSize;
          varying vec3 vColour;
          uniform float uProjectionScale;
          uniform float uPixelRatio;
          void main() {
            vColour = color;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            float projected = aSize * uProjectionScale / max(0.01, -mv.z);
            gl_PointSize = clamp(projected, 1.0, 7.0 * uPixelRatio);
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: `
          varying vec3 vColour;
          void main() {
            float edge = max(abs(gl_PointCoord.x - 0.5), abs(gl_PointCoord.y - 0.5)) * 2.0;
            float alpha = smoothstep(1.0, 0.72, edge);
            gl_FragColor = vec4(vColour, alpha);
          }
        `,
      }),
    [],
  );

  useFrame(({ camera, size: viewport, gl }) => {
    const perspective = camera as THREE.PerspectiveCamera;
    const fov = THREE.MathUtils.degToRad(perspective.fov || 45);
    material.uniforms.uProjectionScale!.value =
      (viewport.height * gl.getPixelRatio()) / (2 * Math.tan(fov / 2));
    material.uniforms.uPixelRatio!.value = gl.getPixelRatio();
  });

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  return (
    <points
      geometry={geometry}
      material={material}
      frustumCulled={false}
      renderOrder={SHIP_ORDER + 2}
      name="formation-pips"
    />
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
const WAKE_WIDTH = 0.11;

/**
 * How far back it reaches, as a multiple of the craft's own size.
 *
 * A rock's streak spans a twenty-fourth of its orbit. A drive wake is much more
 * compact: enough to establish heading at map distance, short enough that a close
 * formation does not tow laser lines out of the frame.
 */
const WAKE_LENGTH = 6.4;

/**
 * Brightness at the craft. Additive on a near-black sky, so this is a whisper.
 *
 * CUT FROM 0.42 AFTER LOOKING AT IT. The scene runs a bloom pass with a luminance
 * threshold of 0.62, and an additive strip at 0.42 crosses it — so the mipmap blur
 * spread a hairline ribbon into a fat glowing beam wider than the ship towing it.
 * The number that matters is not the ribbon's width, it is whether the ribbon
 * blooms; under the threshold it reads as the thin streak it actually is.
 */
const WAKE_PEAK = 0.11;

/** Soft-edged energy shed behind a drive, shared by solo and formation ribbons. */
function makeWakeMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uMotion: { value: 1 },
    },
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    forceSinglePass: true,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vColour;
      void main() {
        vUv = uv;
        vColour = color;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uMotion;
      varying vec2 vUv;
      varying vec3 vColour;
      void main() {
        float across = abs(vUv.x * 2.0 - 1.0);
        float softEdge = 1.0 - smoothstep(0.18, 1.0, across);
        float tail = pow(max(0.0, 1.0 - vUv.y), 2.35);
        float breakup = 0.94 + uMotion * 0.06 * sin(uTime * 7.3 - vUv.y * 24.0);
        float alpha = softEdge * tail * breakup * 0.32;
        gl_FragColor = vec4(vColour * (0.55 + tail * 0.85), alpha);
      }
    `,
  });
}

export function Wake({
  scale,
  colour,
  lengthScale = 1,
}: {
  scale: number;
  colour: string;
  lengthScale?: number;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const material = useMemo(() => makeWakeMaterial(), []);

  /** Colours and indices never change; only the vertices move. Built once. */
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const verts = WAKE_SEGMENTS * 2;
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts * 3), 3));

    const tint = new THREE.Color(colour);
    const colours = new Float32Array(verts * 3);
    const uvs = new Float32Array(verts * 2);
    const index: number[] = [];
    for (let k = 0; k < WAKE_SEGMENTS; k += 1) {
      // Squared falloff, as on the rocks: a linear fade leaves a hard end,
      // because the last quad is still a quarter lit when it stops existing.
      const back = k / (WAKE_SEGMENTS - 1);
      const v = k * 2;
      colours.set([tint.r * WAKE_PEAK, tint.g * WAKE_PEAK, tint.b * WAKE_PEAK], v * 3);
      colours.set([tint.r * WAKE_PEAK, tint.g * WAKE_PEAK, tint.b * WAKE_PEAK], (v + 1) * 3);
      uvs.set([0, back, 1, back], v * 2);
      if (k < WAKE_SEGMENTS - 1) index.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
    }
    g.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    g.setIndex(index);
    return g;
  }, [colour]);

  // Freed with the craft. One strip is small; a season's worth of squadrons that
  // each left one behind is not. See `useLine` for the same reasoning at length.
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  const eye = useMemo(() => new THREE.Vector3(), []);
  const side = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ camera, clock }) => {
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
      const envelope = (0.42 + Math.sin(Math.PI * back) * 0.72) * (1 - back);
      const w = scale * WAKE_WIDTH * envelope;
      const flutter = Math.sin(clock.elapsedTime * 2.7 + back * 14) * w * back * 0.22;
      const z = -scale * WAKE_LENGTH * lengthScale * back;
      const v = k * 2;
      position.setXYZ(v, side.x * (w + flutter), side.y * (w + flutter), z + side.z * w);
      position.setXYZ(v + 1, side.x * (-w + flutter), side.y * (-w + flutter), z - side.z * w);
    }
    position.needsUpdate = true;
    material.uniforms.uTime!.value = clock.elapsedTime;
    material.uniforms.uMotion!.value = 1;
  });

  return (
    <mesh
      ref={mesh}
      geometry={geometry}
      material={material}
      frustumCulled={false}
      renderOrder={SHIP_ORDER - 2}
    />
  );
}

/** Parallel formation wakes share one camera-facing strip buffer and one draw. */
function FormationWakes({
  markers,
  slots,
  scale,
  aimDistance,
}: {
  markers: readonly Marker[];
  slots: readonly Vec3Tuple[];
  scale: number;
  aimDistance: RefObject<number>;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const material = useMemo(() => makeWakeMaterial(), []);
  const geometry = useMemo(() => {
    const verticesPerWake = WAKE_SEGMENTS * 2;
    const positions = new Float32Array(markers.length * verticesPerWake * 3);
    const colours = new Float32Array(markers.length * verticesPerWake * 3);
    const uvs = new Float32Array(markers.length * verticesPerWake * 2);
    const index: number[] = [];
    markers.forEach((marker, markerIndex) => {
      const tint = new THREE.Color(HULL_LIGHT[marker.hull].glow);
      const vertexBase = markerIndex * verticesPerWake;
      for (let k = 0; k < WAKE_SEGMENTS; k += 1) {
        const back = k / (WAKE_SEGMENTS - 1);
        const vertex = vertexBase + k * 2;
        colours.set([tint.r * WAKE_PEAK, tint.g * WAKE_PEAK, tint.b * WAKE_PEAK], vertex * 3);
        colours.set([tint.r * WAKE_PEAK, tint.g * WAKE_PEAK, tint.b * WAKE_PEAK], (vertex + 1) * 3);
        uvs.set([0, back, 1, back], vertex * 2);
        if (k < WAKE_SEGMENTS - 1) {
          index.push(vertex, vertex + 1, vertex + 2, vertex + 1, vertex + 3, vertex + 2);
        }
      }
    });

    const buffer = new THREE.BufferGeometry();
    buffer.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    buffer.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    buffer.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    buffer.setIndex(index);
    return buffer;
  }, [markers]);
  const eye = useMemo(() => new THREE.Vector3(), []);
  const side = useMemo(() => new THREE.Vector3(), []);
  const direction = useMemo(() => new THREE.Vector3(), []);
  const eyeFromCraft = useMemo(() => new THREE.Vector3(), []);
  const aimed = useMemo<Vec3Tuple>(() => [0, 0, 1], []);

  useFrame(({ camera, clock }) => {
    const node = mesh.current;
    if (!node) return;
    node.updateWorldMatrix(true, false);
    eye.copy(camera.position);
    node.worldToLocal(eye);
    side.set(0, 0, 1).cross(eye);
    if (side.lengthSq() < 1e-12) side.set(1, 0, 0);
    else side.normalize();

    const positions = node.geometry.getAttribute('position') as THREE.BufferAttribute;
    markers.forEach((_, markerIndex) => {
      const slot = slots[markerIndex] ?? [0, 0, 0];
      formationAimDirection(slot, aimDistance.current, aimed);
      direction.set(...aimed);
      eyeFromCraft.set(eye.x - slot[0], eye.y - slot[1], eye.z - slot[2]);
      side.copy(direction).cross(eyeFromCraft);
      if (side.lengthSq() < 1e-12) side.set(1, 0, 0);
      else side.normalize();
      const vertexBase = markerIndex * WAKE_SEGMENTS * 2;
      for (let k = 0; k < WAKE_SEGMENTS; k += 1) {
        const back = k / (WAKE_SEGMENTS - 1);
        const envelope = (0.42 + Math.sin(Math.PI * back) * 0.72) * (1 - back);
        const width = scale * WAKE_WIDTH * envelope;
        const flutter = Math.sin(clock.elapsedTime * 2.7 + back * 14 + markerIndex * 1.7) *
          width *
          back *
          0.22;
        const distance = scale * WAKE_LENGTH * back;
        const centreX = slot[0] - direction.x * distance;
        const centreY = slot[1] - direction.y * distance;
        const centreZ = slot[2] - direction.z * distance;
        const vertex = vertexBase + k * 2;
        positions.setXYZ(
          vertex,
          centreX + side.x * (width + flutter),
          centreY + side.y * (width + flutter),
          centreZ + side.z * (width + flutter),
        );
        positions.setXYZ(
          vertex + 1,
          centreX + side.x * (-width + flutter),
          centreY + side.y * (-width + flutter),
          centreZ + side.z * (-width + flutter),
        );
      }
    });
    positions.needsUpdate = true;
    material.uniforms.uTime!.value = clock.elapsedTime;
    material.uniforms.uMotion!.value = 1;
  });

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  return (
    <mesh
      ref={mesh}
      geometry={geometry}
      material={material}
      frustumCulled={false}
      renderOrder={SHIP_ORDER - 2}
    />
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
   * UP TO FIVE PIPS IN A ROW, AND AS MANY ROWS AS IT TAKES.
   *
   * The pips follow `PER_MODEL` because they are the exact count. Capping the row
   * at five is what keeps a ten-ship marker readable as two rows of five rather
   * than one strip nobody can count at a glance.
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
 * is a mining run to a rock this commander has discovered; its leg and clock make
 * that earned race readable.
 *
 * Radar contacts are silhouettes, not rosters. Once Telescope sight identifies a
 * fleet, it uses the real hull assets and the same exact-count pips as an owned
 * squadron.
 * A public engagement outside every sensor circle is not a contact at all:
 * `Traffic` routes it to `ConcealedEngagement`, which mounts only the volley.
 */
/** What a hostile leg aimed at one of your worlds is painted in. D126. */
const THREAT_NEON = '#ff5b6e';
const THREAT_FLAME = '#ffb0ba';

const CONTACT_STYLE: Record<Contact['kind'], { neon: string; scale: number; flame: string }> = {
  /**
   * A CONTACT YOU CANNOT IDENTIFY. D125.
   *
   * Deliberately colourless. Every other neon on this list is an ANSWER — blue is
   * a warship, green a scout, amber a drill — so an unidentified contact may not
   * borrow any of them, or the disc would be naming the thing it is meant to be
   * withholding. Cold steel says "a return, and nothing more", which is exactly
   * what a sensor at the edge of its range gives you.
   */
  unknown: { neon: '#c7ecff', scale: 0.19 * CRAFT_SCALE, flame: '#c7ecff' },
  fleet: { neon: '#3fa9ff', scale: 0.195 * CRAFT_SCALE, flame: '#8fd8ff' },
  probe: { neon: '#3ff08a', scale: 0.15 * CRAFT_SCALE, flame: '#9dffc4' },
  mining: { neon: '#ffb057', scale: 0.18 * CRAFT_SCALE, flame: '#ffd9a8' },
  // A harvest is the same craft on a different errand, so it keeps the miner's
  // amber and goes a shade paler — recognisably the same kind of thing, visibly
  // not headed for a rock. D32.
  harvest: { neon: '#ffcf8f', scale: 0.18 * CRAFT_SCALE, flame: '#ffe9cc' },
  death_star: { neon: '#ff4d67', scale: 0.34 * CRAFT_SCALE, flame: '#ff9cac' },
};

/**
 * HOW MANY UNMARKED HULLS A RADAR SILHOUETTE IS DRAWN WITH. D123.
 *
 * A Radar contact has no actual roster, so its mass bucket must not be rendered as
 * if it did. Telescope contacts bypass this table and draw their actual manifest.
 *
 * So the formation now says SIZE and nothing else. Three counts rather than a
 * continuous ramp, matching the three the server buckets into — the eye separates
 * "a few", "a lot" and "an awful lot", and nothing finer than that would survive
 * being looked at on a phone anyway.
 *
 * PIPS ARE OFF FOR RADAR SILHOUETTES, which matters more than it looks: a pip is a count of
 * real ships, and printing one over a marker that stands for an estimate would be
 * the interface inventing a precision the payload does not have. The panel names
 * the reading as an estimate for the same reason. The fog HIDES; it never lies.
 *
 * It is also the answer to the performance case D115 left open — twenty
 * simultaneous hundred-ship raids were roughly four hundred markers, and are now
 * at most three hundred and twenty in the worst case and typically far fewer.
 */
const SILHOUETTE: Record<'LIGHT' | 'MEDIUM' | 'HEAVY', number> = {
  LIGHT: 3,
  MEDIUM: 8,
  HEAVY: 16,
};

/** A probe is one craft; a run draws its public count; sight draws an exact fleet. */
const contactMarkers = (contact: Contact): Marker[] | null => {
  // An unidentified contact has no hull to draw, which is the whole point of it.
  if (contact.kind === 'unknown') return null;
  if (contact.kind === 'probe' || contact.kind === 'death_star') return null;
  // A harvest is Prospectors too, and its count is in `craft` like a mining run's.
  // Telescope has identified these Prospectors, so these are real counts rather
  // than the mass estimate a Radar contact may carry.
  if (contact.kind === 'mining' || contact.kind === 'harvest') {
    return markersFor({ PROSPECTOR: contact.craft ?? 1 });
  }
  // Telescope sight carries the real manifest, so use the same hull assets and
  // marker arithmetic as the owner's own squadron. The fallback is only for a
  // client briefly talking to an older server during a rolling deploy.
  if (contact.fleet) return markersFor(contact.fleet);
  return markersFor({ WASP: SILHOUETTE[contact.mass ?? 'LIGHT'] * PER_MODEL });
};

/**
 * A BLIND PUBLIC VOLLEY HAS A DRAWN SOURCE, NOT AN INTEL SOURCE. D52/D123.
 *
 * Rockets need somewhere to come from, but using the real orbit hold would hand
 * an out-of-range observer the squadron's final approach direction. This stable
 * unit vector is derived only from the opaque mission id. It is intentionally
 * unrelated to the real leg and therefore cannot be reverse-engineered into one.
 */
export function concealedEngagementDirection(id: string): Vec3Tuple {
  const random = seededFrom('concealed-engagement', id);
  const y = random() * 1.2 - 0.6;
  const angle = random() * Math.PI * 2;
  const horizontal = Math.sqrt(Math.max(0, 1 - y * y));
  return [Math.cos(angle) * horizontal, y, Math.sin(angle) * horizontal];
}

/** Fixed visual battery: it never scales with the hidden fleet's real mass. */
const CONCEALED_VOLLEY_SLOTS: Vec3Tuple[] = [
  [0, 0, 0],
  [-0.13, 0.035, -0.08],
  [0.13, -0.035, -0.08],
];

/**
 * The public half of a raid when no sensor can see the craft itself.
 *
 * No tracking mark, hull, wake, hit box or selectable contact is mounted here.
 * Only the deterministic rounds and their surface impacts exist. The synthetic
 * source keeps the cinematic readable without laundering a hidden bearing through
 * the renderer.
 */
function ConcealedEngagement({
  contact,
  nodes,
}: {
  contact: Contact;
  nodes: readonly PlanetNode[];
}) {
  const fight = contact.engagement;
  const engaging = useEngagement(fight ? fight.arriveAt.getTime() : null);
  const world = useMemo(
    () => (fight ? targetNodeOf(nodes, fight.target) : undefined),
    [fight, nodes],
  );
  const centre = useMemo(() => (fight ? toWorld(fight.target) : null), [fight]);
  const direction = useMemo(() => concealedEngagementDirection(contact.id), [contact.id]);
  const source = useMemo<Vec3Tuple | null>(() => {
    if (!world || !centre) return null;
    const distance = orbitStandoff(world.radius);
    return [
      centre[0] + direction[0] * distance,
      centre[1] + direction[1] * distance,
      centre[2] + direction[2] * distance,
    ];
  }, [centre, direction, world]);
  const orientation = useMemo(() => {
    if (!source || !centre) return null;
    const frame = new THREE.Object3D();
    frame.position.set(source[0], source[1], source[2]);
    frame.lookAt(centre[0], centre[1], centre[2]);
    return frame.quaternion.clone();
  }, [centre, source]);

  if (!fight || !world || !centre || !source || !orientation || !engaging) return null;

  return (
    <group
      name="concealed-engagement"
      position={source}
      quaternion={orientation}
      userData={{ engagementId: contact.id }}
    >
      <Bombardment
        volleyKey={contact.id}
        slots={CONCEALED_VOLLEY_SLOTS}
        distance={Math.hypot(
          centre[0] - source[0],
          centre[1] - source[1],
          centre[2] - source[2],
        )}
        radius={world.radius}
        shipScale={CONTACT_STYLE.fleet.scale}
        arriveAt={fight.arriveAt.getTime()}
        intensity={bombardmentIntensity(true)}
      />
    </group>
  );
}

/** The renderer's hard boundary between a sensed craft and a public effect. */
export const contactPresentation = (contact: Contact): 'effect' | 'craft' =>
  contact.effectOnly === true ? 'effect' : 'craft';

export function Traffic({
  contacts,
  nodes,
  focusedId,
  onSelect,
}: {
  contacts: readonly Contact[];
  /** The worlds are needed when a landed engagement holds in target orbit. */
  nodes: readonly PlanetNode[];
  focusedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (contacts.length === 0) return null;

  return (
    <>
      {contacts.map((contact) => (
        contactPresentation(contact) === 'effect' ? (
          <ConcealedEngagement key={contact.id} contact={contact} nodes={nodes} />
        ) : (
          <Foreign
            key={contact.id}
            contact={contact}
            nodes={nodes}
            focused={contact.id === focusedId}
            onSelect={() => {
              onSelect(contact.id);
            }}
          />
        )
      ))}
    </>
  );
}

/**
 * The question mark every unidentified contact wears. D125.
 *
 * ONE TEXTURE FOR THE WHOLE GALAXY, built once and shared by every sprite. A DOM
 * overlay per contact would have been fewer lines and would put a hundred elements
 * on the page in a busy season; a canvas glyph is the same picture for the cost of
 * one upload.
 */
let questionTexture: THREE.Texture | null = null;
function questionMark(): THREE.Texture {
  if (questionTexture) return questionTexture;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = size * 0.025;
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = size * 0.09;
    ctx.font = `800 ${String(size * 0.7)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeText('?', size / 2, size * 0.54);
    ctx.fillText('?', size / 2, size * 0.54);
  }
  questionTexture = new THREE.CanvasTexture(canvas);
  questionTexture.colorSpace = THREE.SRGBColorSpace;
  questionTexture.needsUpdate = true;
  return questionTexture;
}

/**
 * The question mark every unidentified contact wears. D125.
 *
 * ONE TEXTURE FOR THE WHOLE GALAXY, built once and shared. A DOM overlay per
 * contact would have been fewer lines and would put a hundred elements on the page
 * in a busy season; a canvas glyph is the same picture for one upload.
 *
 * A BILLBOARDED PLANE, NOT A SPRITE, AND THE FIRST DRAFT LEARNED WHY. `<sprite>`
 * was the obvious primitive and it rendered as large black screen-aligned
 * rectangles that flickered in and out — which is also why `docs/visual-design.md`
 * says camera-facing markers are not used here and why `TrackingMark`, the one
 * component doing exactly this job, is built from `Billboard` and meshes. Using
 * the primitive the scene already trusts is both the fix and the house style.
 */
function UnknownMark({
  scale,
  colour,
  focused,
}: {
  scale: number;
  colour: string;
  focused: boolean;
}) {
  const texture = useMemo(() => questionMark(), []);
  const size = scale * UNKNOWN_CONTACT_MARK.glyphScale;

  return (
    <Billboard follow lockX={false} lockY={false} lockZ={false}>
      <mesh renderOrder={SHIP_ORDER + 4}>
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial
          map={texture}
          color={colour}
          transparent
          opacity={focused
            ? UNKNOWN_CONTACT_MARK.focusedGlyphOpacity
            : UNKNOWN_CONTACT_MARK.glyphOpacity}
          depthWrite={false}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </Billboard>
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
  const formationAim = useRef(100);
  /**
   * A CONTACT AIMED AT YOU WEARS THE THREAT COLOUR. D126.
   *
   * The radar's long tier has no text and needs none: a mote you cannot identify,
   * turning hostile red as it crosses into the reach of a world you own, says
   * "that one is for you" in the only language this game trusts (D124). What it
   * still does not say is WHEN — that costs the tight ladder, and the picture is
   * careful not to imply otherwise by adding a clock anywhere near it.
   */
  const style = useMemo(() => {
    const base = CONTACT_STYLE[contact.kind];
    return contact.inbound === true
      ? { ...base, neon: THREAT_NEON, flame: THREAT_FLAME }
      : base;
  }, [contact.kind, contact.inbound]);
  const markers = useMemo(() => contactMarkers(contact), [contact]);
  const exactFleet = contact.kind === 'fleet' && contact.fleet !== undefined;

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
  /**
   * And the same rule from the other side of the payload. The finished mission is
   * republished for the length of the explosion so a client that was elsewhere can
   * still play it (`Contact.impact`) — the effect is what that contact is FOR, and
   * drawing a craft for it as well left a spent weapon parked over the world on
   * every screen in the galaxy.
   */
  const spent = useStrikeConsumed(contact.impact ? contact.impact.at.getTime() : null);
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
      markers && markers.length > 0
        ? markers.map((_, i) => slotOffset(i, style.scale * 1.5))
        : [[0, 0, 0]],
    [markers, style.scale],
  );
  const hitBox = useMemo(() => formationHitBox(slots, style.scale), [slots, style.scale]);

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
  const route = useLine(contact.route !== undefined);
  const ahead = useMemo(
    () => (contact.route ? toWorld(contact.route.to) : null),
    [contact.route],
  );

  useFrame(() => {
    const node = group.current;
    if (!node) return;
    /**
     * The same helper the camera reads, so a focused contact stays centred. The
     * published window is already on the shared visual leg; the only node-based
     * adjustment left is the explicit hold during a landed engagement.
     */
    const at = contactPosition(contact, serverNow(), nodes);
    node.position.set(at[0], at[1], at[2]);
    // Aimed down its own window, which is its heading and nothing further — or, once
    // it is over a world, at the world it is putting rounds into.
    const aim = centre ?? to;
    formationAim.current = Math.max(
      0.01,
      Math.hypot(aim[0] - at[0], aim[1] - at[1], aim[2] - at[2]),
    );
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

  if (spent) return null;

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

      <group ref={group} name="contact" userData={{ craftId: contact.id }}>
        {/*
          Tappable, exactly like your own squadrons and the rocks. D24: somebody
          else's craft is an object in the world, and an object you can see but
          cannot select reads as scenery — which is the opposite of the liveliness
          this is for.
        */}
        <mesh
          position={hitBox.centre}
          onPointerUp={(event) => {
            if (!wasTap()) return;
            markHit();
            event.stopPropagation();
            onSelect();
          }}
        >
          <boxGeometry args={hitBox.size} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>

        <TrackingMark
          kind={contact.kind}
          scale={contact.kind === 'death_star' ? style.scale * 3.4 : style.scale}
          colour={contact.kind === 'death_star' ? DEATH_STAR_LIGHT.glow : style.neon}
          focused={focused}
        />

        {/*
          CONTACT FIRST, MODEL SECOND.

          One Suspense boundary used to wrap the entire traffic layer. On a cold
          device the first Wasp, Probe or Prospector decode therefore hid every
          contact — including this already-cheap tracking mark — after the server
          payload had arrived. Keep the live marker mounted and let only the heavy
          hull geometry wait for its asset.
        */}
        <Suspense fallback={null}>
          {markers ? (
            <>
              <FormationLightField
                markers={markers}
                slots={slots}
                scale={style.scale}
                aimDistance={formationAim}
                focused={focused}
                // Telescope sight is exact, so its tally uses the same pips as an
                // owned squadron. Radar silhouettes and mining craft do not.
                showPips={exactFleet}
              />
              <FormationWakes
                markers={markers}
                slots={slots}
                scale={style.scale}
                aimDistance={formationAim}
              />
              {markers.map((marker, i) => (
                <Craft
                  key={`${marker.hull}-${String(marker.ordinal)}`}
                  marker={marker}
                  offset={slots[i] ?? [0, 0, 0]}
                  scale={style.scale}
                  aimDistance={formationAim}
                  focused={focused}
                  pips={exactFleet}
                  batched
                />
              ))}
            </>
          ) : contact.kind === 'unknown' ? (
            /**
             * NO HULL, BECAUSE THERE IS NO HULL TO SHOW. D125.
             *
             * Every other contact draws a model, and a model is an ANSWER — draw
             * a probe here and the disc has just told the player it is a probe.
             * What is left is a mark and a question, which is the honest content
             * of a sensor return at the edge of its range: something is there, and
             * your instrument cannot say what.
             */
            <UnknownMark scale={style.scale} colour={style.neon} focused={focused} />
          ) : (
            <>
              <Wake
                scale={contact.kind === 'death_star' ? style.scale * 3.4 : style.scale}
                colour={contact.kind === 'death_star' ? DEATH_STAR_LIGHT.glow : style.neon}
                lengthScale={contact.kind === 'death_star' ? 0.5 : 1}
              />
              <Hull
                url={contact.kind === 'death_star' ? MODEL.deathStar : MODEL.probe}
                scale={contact.kind === 'death_star' ? style.scale * 3.4 : style.scale}
                glow={contact.kind === 'death_star' ? DEATH_STAR_LIGHT.glow : style.neon}
                focused={focused}
              />
              {contact.kind === 'death_star' ? (
                <StrategicExhaust scale={style.scale * 3.4} />
              ) : (
                <group position={[0, 0, -style.scale * 0.42]}>
                  <Exhaust
                    colour={style.flame}
                    length={style.scale * 0.7}
                    width={style.scale * 0.4}
                  />
                </group>
              )}
            </>
          )}
        </Suspense>

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

function TrackingMark({
  kind,
  scale,
  colour,
  focused,
}: {
  kind: Contact['kind'] | 'fleet' | 'probe' | 'death_star';
  scale: number;
  colour: string;
  focused: boolean;
}) {
  const unknown = kind === 'unknown';
  const radius = scale * (
    kind === 'death_star'
      ? 0.225
      : unknown
        ? UNKNOWN_CONTACT_MARK.radius
        : TRACKING_MARK.standardRadius
  );
  const opacity = unknown
    ? focused
      ? UNKNOWN_CONTACT_MARK.focusedOpacity
      : UNKNOWN_CONTACT_MARK.opacity
    : focused
      ? 0.92
      : 0.46;
  const segments = kind === 'probe' ? 4 : kind === 'mining' || kind === 'harvest' ? 6 : 32;
  const ringOuter = kind === 'death_star'
    ? 1.0175
    : unknown
      ? UNKNOWN_CONTACT_MARK.ringOuter
      : TRACKING_MARK.ringOuter;
  return (
    <Billboard follow lockX={false} lockY={false} lockZ={false}>
      <group name={`tracking-mark-${kind}`} rotation={[0, 0, kind === 'probe' ? Math.PI / 4 : 0]}>
        {/*
          AN UNIDENTIFIED RETURN GETS A BROKEN RETICLE. D125.
          Three segments rather than a closed circle: the reticle itself says the
          lock did not complete, which is the same fact the question mark inside it
          states in words. Nothing here names a kind, because naming it is exactly
          what the Telescope is sold for.
        */}
        {kind === 'unknown' && (
          <mesh renderOrder={SHIP_ORDER + 3}>
            <ringGeometry args={[radius, radius * ringOuter, 3]} />
            <meshBasicMaterial
              color={colour}
              transparent
              opacity={opacity}
              depthWrite={false}
              toneMapped={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        )}
        {(kind === 'probe' || kind === 'mining' || kind === 'harvest' || kind === 'death_star') && (
          <mesh renderOrder={SHIP_ORDER + 3}>
            <ringGeometry args={[radius, radius * ringOuter, segments]} />
            <meshBasicMaterial color={colour} transparent opacity={opacity} depthWrite={false} />
          </mesh>
        )}
        {(kind === 'fleet' || kind === 'death_star') && [0, 1, 2, 3].map((quarter) => (
          <mesh
            key={quarter}
            position={[
              Math.sin(quarter * Math.PI / 2) * radius,
              Math.cos(quarter * Math.PI / 2) * radius,
              0,
            ]}
            rotation={[0, 0, quarter * Math.PI / 2]}
            renderOrder={SHIP_ORDER + 3}
          >
            <planeGeometry args={[
              scale * (kind === 'death_star' ? 0.02 : TRACKING_MARK.fleetTickWidth),
              scale * (kind === 'death_star' ? 0.225 : TRACKING_MARK.fleetTickLength),
            ]} />
            <meshBasicMaterial color={colour} transparent opacity={opacity} depthWrite={false} />
          </mesh>
        ))}
        {kind === 'death_star' && (
          <mesh renderOrder={SHIP_ORDER + 3}>
            <ringGeometry args={[radius * 1.11, radius * 1.135, 32]} />
            <meshBasicMaterial color={colour} transparent opacity={opacity * 0.7} depthWrite={false} />
          </mesh>
        )}
      </group>
    </Billboard>
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
 * Both edges are armed, and the window is re-read on every change of `arriveAt`
 * AND every time the page becomes visible again — because a backgrounded tab has
 * its timers throttled and its frames stopped, so the state it holds when it wakes
 * is the state it had when it went away rather than the state of the world.
 *
 * Exported for its own test. It decides whether a `Bombardment` EXISTS, which is
 * the one thing on this disc that cannot be checked by looking at a still frame.
 */
/**
 * A DEATH STAR DOES NOT SURVIVE ITS OWN STRIKE. Owner instruction. D106.
 *
 * *"Hedefe vardı → kendisi yok oldu → patlama animasyonu göründü."* The craft IS
 * the explosion: there is nothing left to hover, and a missile parked over a world
 * it has just detonated on is the single most confusing thing the disc can draw —
 * the player has watched the blast and is still looking at the weapon.
 *
 * It lingered for two different reasons, one on each side of the payload. The
 * attacker's own thread lives until the worker resolves the mission, which is up to
 * a poll later; and the finished mission is REPUBLISHED to the whole galaxy for the
 * length of the effect (see `Contact.impact`), so every other screen had a craft to
 * draw for those eight seconds. Both are correct payloads. What was missing was the
 * rule about what they MEAN, so it is stated once, here, and both renderers ask it.
 *
 * The instant is the authority and the timer only says when to look, exactly as in
 * `useEngagement` — including the wake on visibility, because a tab that was in the
 * background for the whole strike comes back holding the answer it had when it
 * left.
 */
export function useStrikeConsumed(at: number | null): boolean {
  const [consumed, setConsumed] = useState(() => at !== null && serverNow() >= at);

  useEffect(() => {
    if (at === null) {
      setConsumed(false);
      return;
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    const settle = (): void => {
      if (timer !== undefined) clearTimeout(timer);
      const now = serverNow();
      setConsumed(now >= at);
      const delay = at - now;
      if (delay > 0 && delay <= 2_147_483_647) {
        timer = setTimeout(() => {
          setConsumed(true);
        }, delay);
      }
    };

    settle();
    const wake = (): void => {
      if (document.visibilityState === 'visible') settle();
    };
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('pageshow', wake);

    return () => {
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('pageshow', wake);
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [at]);

  return consumed;
}

export function useEngagement(arriveAt: number | null): boolean {
  const [engaging, setEngaging] = useState(
    () => arriveAt !== null && isEngaging(arriveAt, serverNow()),
  );

  useEffect(() => {
    if (arriveAt === null) {
      setEngaging(false);
      return;
    }

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

    /**
     * THE CLOCK IS THE AUTHORITY; THE TIMERS ONLY SAY WHEN TO LOOK AT IT.
     *
     * A backgrounded tab has its timers throttled to about one a minute and its
     * animation frames stopped altogether, so a phone that was in a pocket across
     * a ten-second engagement comes back holding whatever `engaging` was when it
     * went away — which for a raid that has since resolved is `true`, and draws a
     * squadron bombarding a world whose battle report the player has already read.
     *
     * So the answer is recomputed from `serverNow()` whenever the page becomes
     * visible again, and the timers are re-armed from the same instant. Nothing
     * here decides anything: `isEngaging` is the rule, the server owns the clock,
     * and this only asks the question again at the moments it can have changed.
     */
    const settle = (): void => {
      for (const timer of timers) clearTimeout(timer);
      timers.length = 0;
      setEngaging(isEngaging(arriveAt, serverNow()));
      arm(arriveAt, true);
      arm(engagementEndsAt(arriveAt), false);
    };

    settle();
    const wake = (): void => {
      if (document.visibilityState === 'visible') settle();
    };
    document.addEventListener('visibilitychange', wake);

    return () => {
      document.removeEventListener('visibilitychange', wake);
      for (const timer of timers) clearTimeout(timer);
    };
  }, [arriveAt]);

  return engaging;
}
