import {
  ENGAGEMENT_STANDOFF,
  GALAXY,
  VIEW,
  interpolatePosition,
  orbitStandoff,
  surfaceStandoff,
  toGame,
  toWorld,
  visualLeg,
  worldRadius,
  worldWeight,
  type SatelliteId,
  type Vec3Tuple,
} from '@astera/rules';
import type { Contact, GalaxyPlanet, MiningRun, PendingThread } from '../api/schemas.js';

/**
 * The galaxy, as the 3D surface needs it.
 *
 * WORLD UNITS. The design's coordinates fill a radius-2,000 sphere. Three.js is
 * happiest with a camera near the single-digit range, so
 * everything is divided by `SCALE` on the way in and nothing downstream ever
 * thinks about game units again.
 *
 * Nothing here fetches. Authoritative world coordinates and caller-earned
 * asteroid trajectories arrive through the API; this module only converts and
 * animates those facts. The private asteroid schedule is never reconstructed from
 * the public season seed.
 */

/**
 * Game units per world unit.
 *
 * It converts authoritative game coordinates into Three.js world units. Travel
 * times, ranges and the tier band all read the game's own coordinates and are
 * unaffected by it.
 *
 * KEEP THIS AT 50 WHEN THE GAMEPLAY RADIUS CHANGES. The galaxy was widened from
 * radius 1,000 to 2,000 so 200 commanders plus neutral worlds have readable space.
 * Raising this divisor with the radius would cancel that expansion in the picture and
 * piled 351 full-size map markers into the old 50-player footprint. The widest
 * camera view derives from `DISC_RADIUS`, so the larger scene still has a complete
 * overview; ordinary play sees a neighbourhood instead of a wall of worlds.
 */
export const SCALE = VIEW.scale;

export const DISC_RADIUS = GALAXY.radius / SCALE;

/**
 * HOW BIG A CRAFT IS DRAWN, AS ONE MULTIPLIER. Owner decision: half again.
 *
 * Every hull, probe and drill in the galaxy — your own and everybody else's — is
 * declared at a base size in `Fleets.tsx` and `MiningFlights.tsx`, and every one
 * of those numbers is multiplied by this. That is why it is a factor rather than
 * seven edited constants: the RELATIVE sizes are a design statement (a Wasp reads
 * smaller than a Bulwark, a probe smaller than either) and a bulk change must not
 * quietly flatten them.
 *
 * IT MOVES THREE THINGS THAT ARE NOT THE MODEL, and all three should move with it.
 * Formation spacing is `largest hull scale × 1.8`, so mixed squadrons make room
 * for their largest craft and do not intersect. The tap sphere is
 * `max(0.45, scale × 1.6)`, so a bigger craft is a bigger target — at 1.0 the
 * lightest hull's sphere was pinned to the 0.45 floor and
 * at 1.5 it clears it, which is a real gain on a phone. The wake and the exhaust
 * are both stated in units of `scale` already.
 *
 * WHAT IT DOES NOT TOUCH is anything the game computes. Craft sizes are pure
 * presentation — no distance, no range, no hit-test against another object and no
 * travel time reads them — so this is the same kind of number as
 * `VERTICAL_EXAGGERATION` below and carries the same guarantee.
 */
export const CRAFT_SCALE = 0.8;

/**
 * THE CONVERSION AND THE HEIGHT EXAGGERATION NOW LIVE IN `@astera/rules`. D106.
 *
 * Both are re-exported here so the hundred call sites in this folder read exactly
 * as they did, and neither is defined here any more. The reason is the whole of
 * D106: the SERVER has to be able to publish a point that this client will draw in
 * the same place it draws the owner's own craft, and a conversion with a stretched
 * height axis cannot be re-derived on the other side — it has to be the same
 * numbers. See `packages/rules/src/view.ts`.
 *
 * The exaggeration is still relief exaggeration and still changes nothing the game
 * computes: travel times, ranges and the rank floor all read game coordinates and
 * none of them can tell the difference.
 */
export { toWorld };
export type { Vec3Tuple };

/** Camera HOME follows the selected controlled world; capital is only a fallback. */
export function activeWorldPosition(
  planets: readonly GalaxyPlanet[],
  activePlanetId: string | null | undefined,
  fallback: { x: number; y: number; z: number } | undefined,
): Vec3Tuple {
  const active = planets.find((planet) => planet.id === activePlanetId);
  if (active) return toWorld(active.position);
  if (fallback) return toWorld(fallback);
  const capital = planets.find((planet) => planet.isSelf);
  return capital ? toWorld(capital.position) : [0, 0, 0];
}

/** Any controlled world opens management; `isSelf` identifies only the capital. */
export const controlledWorldId = (
  planets: readonly GalaxyPlanet[],
  planetId: string,
): string | null => planets.find(
  (planet) => planet.id === planetId && (planet.isOwned ?? planet.isSelf),
)?.id ?? null;

/**
 * What the player is allowed to know about a planet, as one word.
 *
 * The fog becomes the art: an unwatched world is a dark sphere, a watched one is
 * lit, and one whose fleet is away is the only thing on screen wearing the
 * opportunity colour. This is the telescope reading, rendered spatially.
 */
export type Stance = 'self' | 'window' | 'watched' | 'veiled' | 'dark';

export function stanceOf(planet: GalaxyPlanet): Stance {
  if (planet.isOwned) return 'self';
  if (!planet.fleet) return 'dark';
  if (planet.fleet.status === 'AWAY') return 'window';
  if (planet.fleet.status === 'UNKNOWN') return 'veiled';
  return 'watched';
}

/**
 * One world's eyes: where they are, and how far they reach. D125/D126.
 *
 * Used to DRAW the boundary and to solve for the instant a contact crosses it.
 * It is deliberately NOT used to decide what a world shows — the server settles
 * that and publishes it as `intel`, and a client that recomputed the same rule
 * would be a second answer waiting to disagree with the first.
 */
export interface SensorReach {
  at: { x: number; y: number; z: number };
  /** Always finite since D126: the fog never fully lifts. */
  reach: number;
}

export interface PlanetNode {
  id: string;
  name: string;
  owner: string;
  /** Active public clan identity, if this commander currently has one. D114. */
  clan?: NonNullable<GalaxyPlanet['clan']>;
  /** A current clanmate, derived from the same bulk galaxy payload. */
  isClanmate: boolean;
  /**
   * HOW MUCH OF THIS WORLD THE CALLER HAS EARNED. D127.
   *
   * `RESOLVED` is a live reading, `REMEMBERED` is a frozen probe record and
   * `UNKNOWN` is a point with nothing behind it. Renderers that draw a READING —
   * a name, rings, orbit, a dome — check this; the ones that draw the world's
   * body and position do not, because those two facts are true in every state.
   */
  intel: 'RESOLVED' | 'REMEMBERED' | 'UNKNOWN';
  /** When the probe observed it. `REMEMBERED` only. */
  seenAt?: Date;
  /** Only the public podium. Lower exact ranks belong on the leaderboard. */
  dominionRank?: 1 | 2 | 3;
  position: Vec3Tuple;
  /** Bigger worlds for more developed players — the only free public signal. */
  radius: number;
  /** 1, 2 or 3. What the size means, for anything that needs to say it in words. */
  weight: 1 | 2 | 3;
  /** The public core tier. The `weight` word and D49's ±2 attack band read this. */
  coreTier: number;
  /**
   * The exact Command Core level, which the tier is a lossy read of.
   *
   * The dyson rings need it: the ring count steps every three levels and the
   * colour every one, so a tier — which spans three levels — cannot express
   * either. Since D153 the world's own DRAWN SIZE needs it too. See `SHELL_STAGE`
   * in `DysonShells`, `worldRadius` in the shared rules, and `publicGalaxy` on the
   * server for why this is public at all.
   */
  coreLevel: number;
  /** The satellites in orbit. Public hardware, and a satellite has no level — D15/D25. */
  satellites: readonly SatelliteId[];
  /** Is there a dome. The one ground instrument anyone else can see, as a boolean. */
  shielded: boolean;
  stance: Stance;
  /** Public strategic condition; recovery is visible damage, not private intel. */
  state: GalaxyPlanet['state'];
  /**
   * CAPITAL, COLONY, NEUTRAL — OR NOT KNOWN. D127.
   *
   * It used to default to `'CAPITAL'` when the payload omitted it, which was
   * harmless while the only worlds missing a kind were legacy ones and became a
   * live falsehood the moment D127 stopped publishing it: nine tenths of the disc
   * claimed to be a capital, and the galaxy label printed it in capital blue.
   *
   * Optional now so the compiler asks every reader the question rather than
   * answering it for them. Whether a world is a capital is exactly the kind of
   * fact D127 made you go and find.
   */
  kind?: GalaxyPlanet['kind'];
  isOwned: boolean;
  isCapital: boolean;
  /** Public controller identity; used only for owned/rival visual grouping. */
  controllerPlayerId?: string;
  neutralTier?: 1 | 2 | 3;
  claimUntil?: Date | null;
}

/**
 * THREE WEIGHTS — THE WORD, NOT THE SIZE. D153.
 *
 * One of three, off the coarse tier, for anything that has to SAY how developed a
 * world is. The drawn size is a separate question and reads the exact Core level:
 * see `worldRadius` in `packages/rules/src/view.ts` for why the three authored
 * sizes became the anchors of a per-level ramp rather than the whole table.
 *
 * It is a silhouette, not a readout. "Bigger than me" is the whole message; how
 * much bigger, what it is defended with and whether its fleet is home all still
 * cost a telescope slot or a probe.
 */
export const weightOf = worldWeight;

/**
 * HAS A ROCKET LANDED ON THIS WORLD AND NOT YET FINISHED DOING ITS DAMAGE? D121a.
 *
 * `state` is optional on the payload, so a server that predates it reads as a
 * world in one piece — which is the safe way round: a live structure drawn on a
 * wreck is a cosmetic miss, and a dead one drawn on a healthy world would say a
 * commander had been hit when they had not.
 *
 * It lives here, on the node itself, because TWO renderers read it: the dyson
 * rings stop and go cold (D121a), and since the owner's call the satellites over
 * the same crater do too. It was in `DysonShells`, and `Satellites` cannot import
 * that file — the dependency already runs the other way (`resolvedOnly`).
 */
export const isWrecked = (node: PlanetNode): boolean => node.state.kind === 'RECOVERY';

export function planetNodes(planets: readonly GalaxyPlanet[]): PlanetNode[] {
  const selfClanId = planets.find(
    (planet) => (planet.isOwned ?? planet.isSelf) && planet.clan,
  )?.clan?.id;
  return planets.map((planet) => ({
    id: planet.id,
    /**
     * THE ONE PLACE THE PAYLOAD'S GAPS ARE FILLED IN. D127.
     *
     * `/api/galaxy` omits everything about an UNKNOWN world — by omission, so a
     * modified client has no field to read. Every renderer downstream would then
     * need its own opinion about a missing name, a missing tier, a missing orbit,
     * and the first one to forget draws a hole in the galaxy.
     *
     * So the gaps are filled at the SCHEMA — an unknown world parses to the
     * smallest silhouette, no hardware and no name — and `intel` carries the
     * reason so the few renderers that must care can ask. Everything below keeps
     * the types it always had, and nothing downstream has an opinion about a
     * missing field because none ever reaches it.
     */
    intel: planet.intel,
    ...(planet.seenAt ? { seenAt: planet.seenAt } : {}),
    name: planet.name,
    owner: planet.owner,
    ...(planet.clan ? { clan: planet.clan } : {}),
    ...(!planet.dominionRank ? {} : { dominionRank: planet.dominionRank }),
    position: toWorld(planet.position),
    // Map markers, not scale models. A planet at true scale in a disc 2000 units
    // across would be invisible, so these are sized to be READ. One step per Core
    // level since D153 — the exact level, not the tier the WORD below reads.
    radius: worldRadius(planet.coreLevel),
    weight: weightOf(planet.coreTier),
    coreTier: planet.coreTier,
    coreLevel: planet.coreLevel,
    satellites: planet.satellites,
    shielded: planet.shielded,
    stance: stanceOf(planet),
    state: planet.state,
    ...(planet.kind ? { kind: planet.kind } : {}),
    isOwned: planet.isOwned ?? planet.isSelf,
    // `clanmate` comes only from the current private clan-presence projection.
    // A remembered tag stays historical; UNKNOWN stays fogged even while this
    // separate identity bit earns the live friendly ring.
    isClanmate: planet.clanmate ?? Boolean(
      planet.intel === 'RESOLVED'
      && !(planet.isOwned ?? planet.isSelf)
      && selfClanId
      && planet.clan?.id === selfClanId,
    ),
    isCapital: planet.isCapital ?? planet.kind === 'CAPITAL',
    ...(planet.controller?.kind === 'PLAYER'
      ? { controllerPlayerId: planet.controller.playerId }
      : {}),
    // The tier is a READING and D127 keeps it behind the fog, so a `neutral` block
    // that arrived carrying only its claim clock has no tier to copy.
    ...(planet.neutral?.tier ? { neutralTier: planet.neutral.tier } : {}),
    ...(planet.neutral ? { claimUntil: planet.neutral.claimUntil } : {}),
  }));
}

/** A Rival is a commander; the chosen planet is only the backwards-compatible anchor. */
export function isRivalNode(
  node: PlanetNode,
  rivalPlanetId: string | null,
  rivalPlayerId: string | null,
): boolean {
  /**
   * A WORLD YOU CANNOT SEE NEVER WEARS THE RETICLE. D127, owner's instruction.
   *
   * The player branch is safe on its own — an unresolved world carries no
   * `controllerPlayerId`, so it cannot match. The PLANET branch is not: it matches
   * on id, which is published in every state, so a Rival pinned by world would
   * have been marked across the fog. That is a live answer to "where do they
   * live", which is exactly what D127 made something you have to go and find.
   */
  if (node.intel === 'UNKNOWN') return false;
  return rivalPlayerId !== null
    ? node.controllerPlayerId === rivalPlayerId
    : node.id === rivalPlanetId;
}

/* ── things in flight ───────────────────────────────────────── */

/**
 * WHERE A CRAFT IS, THIS INSTANT — and the only place that answer is computed.
 *
 * Both the renderer and the camera need it, and they must not each work it out.
 * They already diverged once: the rig tracked asteroids from `asteroidWorldPosition`
 * while the models were placed from their own copy of the same arithmetic, and
 * every such pair is a bug waiting for one side to be edited. A focused squadron
 * that drifts a few pixels off centre over a forty-minute leg is precisely the kind
 * of fault nobody can reproduce on demand.
 *
 * Nothing here fetches or stores a position: a leg is two endpoints and two
 * timestamps, and the clock does the rest. That is what lets the galaxy animate
 * every craft in the air for the cost of one small payload.
 */
export function threadPosition(
  path: NonNullable<PendingThread['path']>,
  now: number,
  standoff: LegStandoff = NO_STANDOFF,
): Vec3Tuple {
  /**
   * A leg that begins or ends clear of a world rather than at its centre.
   *
   * Solved in world units rather than in game units, because a standoff is a
   * drawing distance — it has to clear a sphere whose radius is a world figure,
   * and the height axis is exaggerated on the way in (`toWorld`), so the same
   * number means two different things on either side of that conversion.
   */
  const leg = visualLeg(path.from, path.to, standoff.start, standoff.end);
  const start = toWorld(leg.from);
  const end = toWorld(leg.to);
  const span = path.arriveAt.getTime() - path.departAt.getTime();
  const t =
    span <= 0 ? 1 : Math.max(0, Math.min(1, (now - path.departAt.getTime()) / span));
  /**
   * CLEARANCE IS AN ENDPOINT, NEVER A PER-FRAME CORRECTION. D120.
   *
   * Projecting every interpolated point back to a world's surface maps an entire
   * interval to one coordinate. That was the reported spawn pause, and it could
   * happen again when a route crossed an unrelated marker. Both clearances are
   * baked into `start` and `end` once, so every change in time changes position.
   */
  return [
    start[0] + (end[0] - start[0]) * t,
    start[1] + (end[1] - start[1]) * t,
    start[2] + (end[2] - start[2]) * t,
  ];
}

/* ── stopping short of a world ──────────────────────────────── */

/**
 * HOW FAR SHORT OF A WORLD A CRAFT STOPS. D44.
 *
 * A leg's endpoint is the target planet's coordinates, which are its CENTRE — so
 * an arriving squadron was drawn inside the world it had come to attack. Nobody
 * complained, because for three phases the moment lasted zero seconds: the battle
 * resolved on the instant of arrival and the fleet was gone before the next frame.
 * The ten-second engagement makes it a moment somebody watches, and a fleet
 * standing in the middle of a planet is not a picture of a raid.
 *
 * It is also what the bombardment is fired ACROSS. Missiles need somewhere to come
 * from, and "the point the squadron actually holds" is the only honest answer.
 *
 * Scaled by the world rather than fixed, because worlds are drawn anywhere from
 * 0.44 to 1.40 across (D153) and one number would either bury a squadron in a
 * heavyweight or park it a long way off a small one. The half-radius of clearance on top is what keeps a
 * twelve-model formation — which is nearly two spacings across — outside the
 * silhouette rather than half-embedded in it.
 */
export { orbitStandoff };

/**
 * The planet a leg is aimed at, if the disc is drawing one there.
 *
 * Matched by POSITION rather than by id, because `path` carries coordinates and
 * no id — a thread names the planet only in prose. Both sides come from the same
 * database row through the same conversion, so the match is exact in practice;
 * the tolerance is there so a float that has been through JSON cannot silently
 * turn a raid into a leg with no target.
 */
export function targetNodeOf(
  nodes: readonly PlanetNode[],
  to: { x: number; y: number; z: number },
): PlanetNode | undefined {
  const at = toWorld(to);
  let best: PlanetNode | undefined;
  let nearest = 0.01;
  for (const node of nodes) {
    const gap = Math.hypot(
      node.position[0] - at[0],
      node.position[1] - at[1],
      node.position[2] - at[2],
    );
    if (gap <= nearest) {
      nearest = gap;
      best = node;
    }
  }
  return best;
}

/**
 * How far a leg holds off each of its two ends, in world units.
 *
 * BOTH ENDS, BECAUSE A ROUND TRIP IS TWO LEGS DRAWN BY THE SAME RULE. The outbound
 * leg stops short of the world it is attacking (D44); the return leg is the same
 * line flown backwards, so it has to START from the point the outbound leg stopped
 * at. Only the far end was offset for a while, and the seam showed: at the instant
 * the mission flipped from outbound to return the craft jumped a standoff forward —
 * INTO the middle of the world it had just been holding off — and set out for home
 * from there. The owner watched a raid teleport into its target and reverse out.
 *
 * HOME USES SURFACE CLEARANCE, not the wider orbital hold. A fleet still emerges
 * from and lands on its own world, but starting at the centre plus a per-frame
 * surface projection made it sit still for seconds. Starting/ending on the near
 * surface preserves that picture while keeping the interpolation continuous.
 */
export interface LegStandoff {
  /** Clearance from the world the leg departs from. */
  start: number;
  /** Clearance from the world the leg arrives at. */
  end: number;
}

export const NO_STANDOFF: LegStandoff = { start: 0, end: 0 };

/**
 * WHAT THIS LEG BOMBARDS, AND HOW BIG IT IS — OR NOTHING.
 *
 * The one statement of it, because there are two answers and three refusals and
 * they were previously spread across a memo in `Fleets.tsx` where nothing could
 * assert them. A probe takes a photograph, a Death Star IS the explosion, and a
 * leg coming home is landing rather than arriving; only an outbound fleet or an
 * outbound pirate raid fires.
 *
 * `radius: null` MEANS "THERE IS NO WORLD HERE", NOT "NO SIZE". The radius is not
 * decoration: `volleyFor` scatters every round's aim across a disc of exactly that
 * size, and both it and `Bombardment` refuse a zero — so a missing size is not a
 * point target, it is NO BOMBARDMENT AT ALL, which is how the attacker's own ten
 * seconds over a rendezvous once drew nothing.
 *
 * This used to answer a pirate with a stated constant instead, and it was wrong
 * twice. It was wrong in SCALE — three world units, more than twice the largest
 * world in the game and several times the formation actually being shot at, so
 * the rounds scattered over a disc nothing was standing in. And it was wrong in
 * KIND: the public path in `Fleets.tsx` had always sized the identical volley
 * against the formation's own footprint, so one battle was drawn two ways
 * depending on who was watching. The caller is the only code that knows how big
 * the squadron is drawn, so the caller supplies it — and now both callers do.
 */
export function bombardmentTarget(
  thread: PendingThread,
  nodes: readonly PlanetNode[],
): { radius: number | null } | undefined {
  if (!thread.path || thread.leg === 'return') return undefined;
  if (thread.kind === 'pirate') return { radius: null };
  if (thread.kind !== 'fleet') return undefined;
  return targetNodeOf(nodes, thread.path.to);
}

export function legStandoff(
  thread: PendingThread,
  nodes: readonly PlanetNode[],
): LegStandoff {
  if (!thread.path) return NO_STANDOFF;
  const returning = thread.leg === 'return';
  if (thread.kind === 'pirate') {
    /*
      Home takes the ordinary surface clearance; the far end is empty space, and
      the clearance there is `ENGAGEMENT_STANDOFF` — the SHARED one, out of the
      rules package, which is the same figure `traffic.ts` publishes this hold at.
      This file used to keep its own `PIRATE_STANDOFF` of six world units against
      the server's 1.6, so the owner watched their own squadron hold nearly four
      times further out than everyone else saw it hold. See D106 and the constant.
    */
    const homeNode = targetNodeOf(nodes, returning ? thread.path.to : thread.path.from);
    const home = homeNode ? surfaceStandoff(homeNode.radius) : 0;
    return returning
      ? { start: ENGAGEMENT_STANDOFF, end: home }
      : { start: home, end: ENGAGEMENT_STANDOFF };
  }
  // A return mission row is stored with the two worlds swapped (D28), so the
  // foreign orbit is the start on the way home and the end on the way out. Home
  // is the other endpoint and takes only the tight surface clearance (D120).
  const startNode = targetNodeOf(nodes, thread.path.from);
  const endNode = targetNodeOf(nodes, thread.path.to);
  return returning
    ? {
        start: startNode ? orbitStandoff(startNode.radius) : 0,
        end: endNode ? surfaceStandoff(endNode.radius) : 0,
      }
    : {
        start: startNode ? surfaceStandoff(startNode.radius) : 0,
        end: endNode ? orbitStandoff(endNode.radius) : 0,
      };
}

/**
 * Where a leg begins on screen: clear of the world it is leaving by `standoff`.
 *
 * Never past the halfway mark of the leg itself, for the same reason `legEnd` is
 * not — a hop between close neighbours must not start beyond where it finishes.
 */
export function legStart(
  path: NonNullable<PendingThread['path']>,
  standoff: number,
): Vec3Tuple {
  return toWorld(visualLeg(path.from, path.to, standoff, 0).from);
}

/**
 * Where a leg ends on screen: short of the world by `standoff`.
 *
 * Never past the halfway mark of the leg itself, so a raid on a very near
 * neighbour cannot end behind where it started — which would draw a fleet flying
 * backwards out of its own planet.
 */
export function legEnd(
  path: NonNullable<PendingThread['path']>,
  standoff: number,
): Vec3Tuple {
  return toWorld(visualLeg(path.from, path.to, 0, standoff).to);
}

/**
 * Where a mining run is, this instant. D19.
 *
 * The outbound leg flies the planet to the INTERCEPTION POINT — not to the rock,
 * which has moved on by the time anyone arrives — and the return leg flies that
 * same line backwards. Kept identical to `MiningFlights`, for the reason above.
 */
export function runPosition(
  run: MiningRun,
  home: { x: number; y: number; z: number },
  now: number,
  nodes: readonly PlanetNode[] = [],
): Vec3Tuple {
  const returning = run.status === 'returning';
  const [from, to, departAt, arriveAt] = returning
    ? ([run.intercept, home, run.arriveAt, run.homeAt ?? run.arriveAt] as const)
    : ([home, run.intercept, run.departAt, run.arriveAt] as const);

  const homeNode = targetNodeOf(nodes, home);
  const clearance = homeNode ? surfaceStandoff(homeNode.radius) : 0;
  const leg = returning
    ? visualLeg(from, to, 0, clearance)
    : visualLeg(from, to, clearance, 0);
  return toWorld(
    interpolatePosition(leg.from, leg.to, departAt.getTime(), arriveAt.getTime(), now),
  );
}

/**
 * EVERY POINT IN OPEN SPACE A CRAFT OF YOURS IS CURRENTLY AIMED AT. D40 · D155.
 *
 * One list, because an interception is the least obvious thing in the game — a
 * craft heading for empty space looks like a bug until the thing it is meeting
 * arrives there — and the mark is the whole explanation. It was wired to mining
 * runs alone, so the rock lane explained itself and the pirate lane, whose target
 * moves faster and therefore leads FURTHER, did not: a raid left at an angle to
 * the pirate drawn on the disc with nothing on screen saying why. D124.
 *
 * OUTBOUND ONLY, AND ONLY AT SOMETHING THAT MOVES. A return leg is aimed at a
 * world that is already drawn with a label under it, and so is a raid, a probe or
 * a transfer — a ring there says nothing and clutters the busiest part of the
 * scene. What earns a mark is a coordinate the player would otherwise read as
 * empty.
 *
 * Structural parameter types rather than the payload's, exactly as `runPosition`
 * takes them: this is geometry, and it must be testable without a wire fixture.
 */
export function rendezvousMarks(
  runs: readonly { intercept: { x: number; y: number; z: number }; status: string }[],
  pending: readonly {
    kind: string;
    leg?: 'outbound' | 'return' | undefined;
    path?: { to: { x: number; y: number; z: number } } | undefined;
  }[],
): Vec3Tuple[] {
  const marks: Vec3Tuple[] = [];
  for (const run of runs) {
    if (run.status === 'outbound') marks.push(toWorld(run.intercept));
  }
  for (const thread of pending) {
    // `leg` is optional on the wire for rolling deploys; a pirate thread without
    // one is outbound by the same default the renderer uses.
    if (thread.kind !== 'pirate' || thread.leg === 'return') continue;
    if (thread.path) marks.push(toWorld(thread.path.to));
  }
  return marks;
}

/** Resolve a run against its own colony, never whichever world is active now. */
export function runHomePosition(
  run: MiningRun,
  nodes: readonly PlanetNode[],
  fallback: { x: number; y: number; z: number },
): { x: number; y: number; z: number } {
  const origin = run.planetId
    ? nodes.find((node) => node.id === run.planetId)
    : undefined;
  return origin ? toGame(origin.position) : fallback;
}

/** The active world's own commitment to one target, if it has one. */
export function runForPlanetTarget(
  runs: readonly MiningRun[],
  planetId: string | undefined,
  target: { kind: 'asteroid' | 'debris'; id: string },
): MiningRun | undefined {
  return runs.find((run) => {
    if (run.status === 'done') return false;
    // Missing only while rolling from an older server whose status contained one
    // selected world's runs, so it is necessarily the active world's run.
    if (run.planetId !== undefined && run.planetId !== planetId) return false;
    return target.kind === 'asteroid'
      ? run.asteroidId === target.id
      : run.debrisFieldId === target.id;
  });
}

/**
 * How long past its window a contact may be carried before it stops.
 *
 * The client WAKES ON `endAt` and asks for the next window (`useContactWindows`),
 * with a sixty-second net under that — so this is only ever reached when a read
 * has actually failed: a tab that was backgrounded, a phone that lost signal.
 * Coasting on the last known bearing for a moment is much better than a craft
 * stopping dead in open space, which reads as a broken game rather than as a
 * missed request. It reveals nothing: the heading is already public, and
 * extrapolating it is exactly what a player's eye does anyway.
 *
 * A DURATION, NOT A SHARE OF THE WINDOW. D106. It was half the window again, and a
 * window is at least a minute — so a failed read could carry a craft up to THIRTY
 * SECONDS of flight past where it really was. While the craft is still flying that
 * costs nothing, because a coast runs at the true speed; the damage is all on the
 * other side of the arrival, where the real craft has stopped and the guess sails
 * on through the world it just landed on, during the ten seconds the whole galaxy
 * is watching a bombardment. Three seconds is a bridge over a slow request, which
 * is all a coast was ever for. Past that, holding is the honest picture — and a tab
 * that comes back to the front resyncs immediately (`useEventStream`), so the hold
 * lasts exactly as long as the failure does.
 *
 * AND IT DOES NOT APPLY TO AN ARRIVAL AT ALL. D72. A window clamped to the landing
 * has no more flight to coast into, so extrapolating it flies the craft through
 * the world it is arriving at. `contact.landing` is what tells the two apart.
 */
const COAST_MS = 3_000;

/**
 * THE SMALLEST SEPARATION THAT IS STILL A DIRECTION, in world units.
 *
 * Comfortably below anything the disc draws — the tightest formation slots are
 * about 0.59 apart and the closest standoff in the game is 0.5 — and comfortably
 * above the float noise two interpolated positions differ by. It is the line
 * between "these are two places" and "these are one place twice".
 */
export const HEADING_EPSILON = 1e-4;

/**
 * IS THERE A DIRECTION HERE AT ALL?
 *
 * Asked before pointing anything at anything, because three.js DOES NOT REFUSE.
 * `Matrix4.lookAt` answers a zero-length direction by substituting world +Z, so a
 * craft told to look at the coordinate it is standing on does not keep its
 * heading — it silently snaps to a compass bearing, and every effect mounted
 * inside it (the wake, the exhaust, the whole bombardment, which fires straight
 * down local +Z) goes with it. That is how a pirate formation ended up turning
 * away mid-fight and putting its volley into empty space.
 *
 * A PREDICATE RATHER THAN A CLAMP. There is no sensible heading to invent for two
 * identical points, and inventing one is the bug. The caller keeps whatever
 * heading it already had, which for a craft that has just stopped is exactly the
 * direction it was travelling in.
 *
 * It lives here, beside the code that decides where craft ARE, so the one rule is
 * available to every renderer and can be asserted without mounting a scene.
 */
export const isHeading = (from: Vec3Tuple, to: Vec3Tuple): boolean =>
  Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]) > HEADING_EPSILON;

/**
 * Where somebody else's craft is, this instant. D24.
 *
 * A contact carries a BEARING WINDOW — where it is and where it will be shortly —
 * rather than a route, so this interpolates across that window and coasts a little
 * past it. That is the honest rendering of "we know this much, and a little further
 * is a fair guess, and beyond that nothing".
 */
export function contactPosition(
  contact: Contact,
  now: number,
  nodes: readonly PlanetNode[] = [],
): Vec3Tuple {
  /**
   * A SENSED RAID THAT HAS LANDED HOLDS IN ORBIT. D52/D123.
   *
   * The attacker's own client works this out from its `path` and the target's drawn
   * radius (D44); a bystander who can see the craft has no path, so its contact
   * carries only the final sensed bearing and the target. An out-of-range
   * `effectOnly` engagement never reaches this helper: it has no authoritative
   * squadron point to solve and draws only the public volley.
   */
  const fight = contact.engagement;
  if (fight && now >= fight.arriveAt.getTime()) {
    return engagementPosition(contact, fight.target, nodes);
  }


  /**
   * THE WINDOW IS ALREADY ON THE DRAWN LEG. D106.
   *
   * There is no correction to apply here any more, and that is the point: the
   * server publishes a window whose endpoints sit on the same standoff-adjusted
   * line the owner's own client flies (`visualLeg` in `@astera/rules`), so a
   * stranger interpolating this payload lands on the same coordinates the owner
   * does. This used to end at the world's CENTRE while the owner stopped in orbit,
   * and the gap grew along the leg — a raid's last minutes had the owner still
   * closing while everybody else watched it sit on the target.
   */
  const visualTo = toWorld(contact.to);

  /**
   * COAST ONLY WHERE THERE IS MORE FLIGHT TO COAST INTO.
   *
   * `COAST` exists so a craft whose next read is late keeps moving instead of
   * stopping dead in open space. It is the wrong instinct at the END of a leg: a
   * window whose far point is the craft's actual destination, extrapolated by half
   * as much again, draws the craft straight through the world it is landing on and
   * out the far side — which is what "a craft went backwards / ended up in the
   * wrong place" looks like when a refetch is a second late.
   *
   * The payload says which kind of window this is (`landing`), because four
   * coordinates and two instants cannot. A heading coasts; an arrival holds.
   */
  const span = contact.endAt.getTime() - contact.startAt.getTime();
  const ceiling = contact.landing === true || span <= 0 ? 1 : 1 + COAST_MS / span;
  const t =
    span <= 0 ? 1 : Math.max(0, Math.min(ceiling, (now - contact.startAt.getTime()) / span));
  const visualFrom = toWorld(contact.from);
  return [
    visualFrom[0] + (visualTo[0] - visualFrom[0]) * t,
    visualFrom[1] + (visualTo[1] - visualFrom[1]) * t,
    visualFrom[2] + (visualTo[2] - visualFrom[2]) * t,
  ];
}

/**
 * THE TWO FIGURES A CONCEALED VOLLEY NEEDS. D52 · D150.
 *
 * A battle outside every sensor circle publishes its bombardment and nothing else,
 * and the renderer draws it from a synthetic source in a direction invented from
 * the event id — the spectacle without the bearing. To place that it needs how far
 * back the fire comes from and how wide it scatters, and both used to be read off
 * the target's planet node.
 *
 * A RENDEZVOUS HAS NO NODE, so `ConcealedEngagement` bailed and a pirate battle out
 * of range drew nothing at all. The fallbacks are the same two the sensed path
 * already uses: the shared `ENGAGEMENT_STANDOFF` for the gap, and the firing
 * formation's own footprint for the scatter.
 *
 * NEITHER MAY EVER BE ZERO. `volleyFor` and `Bombardment` both refuse a zero
 * radius, so zero does not mean "a point target", it means NO BOMBARDMENT — which
 * is the failure this whole helper exists to end.
 */
export function concealedVolley(
  target: { x: number; y: number; z: number },
  nodes: readonly PlanetNode[],
  /** How big the firing battery is drawn — the stand-in where there is no world. */
  craftScale: number,
): { standoff: number; radius: number } {
  const node = targetNodeOf(nodes, target);
  return node
    ? { standoff: orbitStandoff(node.radius), radius: node.radius }
    : { standoff: ENGAGEMENT_STANDOFF, radius: craftScale };
}

/**
 * WHERE A CRAFT IN A LIVE ENGAGEMENT IS DRAWN — the one answer, for every caller.
 *
 * THERE ARE TWO KINDS OF ENGAGEMENT PAYLOAD AND THEY ARE NOT INTERCHANGEABLE.
 *
 *   · A raid on a WORLD publishes a real bearing window plus the world it is
 *     firing on. The craft's hold has to be SOLVED — pushed back out to orbit off
 *     the target's drawn radius — because the window's endpoint is the world's
 *     centre and nothing may be drawn inside a planet (D44).
 *
 *   · A PIRATE FIGHT publishes a window with NO LENGTH. Both holds were already
 *     computed by the server, on the shared visual leg, and a degenerate window is
 *     the payload saying "I am standing exactly here". There is nothing to solve
 *     and nothing that may be recomputed.
 *
 * TELLING THEM APART IS THE WHOLE BUG. Sent through the solve unconditionally, a
 * pirate fight resolved `engagementHold(target)` against a target with no world
 * under it — open space always — which falls through to the target ITSELF. So the
 * pirate was drawn standing on its attacker's hold point and the attacker on the
 * rendezvous: the two swapped places, each was then asked to look at the exact
 * coordinate it was standing on, and three.js answers a zero-length `lookAt` with
 * world +Z. Both formations snapped to a compass bearing mid-fight and fired their
 * volleys off the side of the battle.
 *
 * `Fleets.tsx` already carried this distinction, correctly, in a memo that fed the
 * volley's LENGTH — while the helper that placed the craft did not. Two answers to
 * one question, which is the fault this whole module exists to prevent, so the
 * answer lives here now and both of them read it.
 */
export function engagementPosition(
  contact: Contact,
  target: { x: number; y: number; z: number },
  nodes: readonly PlanetNode[],
): Vec3Tuple {
  const held = contact.from.x === contact.to.x
    && contact.from.y === contact.to.y
    && contact.from.z === contact.to.z;
  return held ? toWorld(contact.from) : engagementHold(target, contact.from, nodes);
}

/**
 * Where a squadron sits while it bombards a world it does not own.
 *
 * `approach` is a point on the line it came in on, a minute back — the payload
 * carries it for no other purpose. The hold is the same `orbitStandoff` the
 * attacker's own leg stops at, so the two views agree to the metre.
 *
 * FOR A TARGET WITH A WORLD UNDER IT. A rendezvous has none and must never reach
 * here — see `engagementPosition`, which is what every caller should be using.
 */
export function engagementHold(
  target: { x: number; y: number; z: number },
  approach: { x: number; y: number; z: number },
  nodes: readonly PlanetNode[],
): Vec3Tuple {
  const centre = toWorld(target);
  const node = targetNodeOf(nodes, target);
  const standoff = node ? orbitStandoff(node.radius) : 0;
  if (standoff <= 0) return centre;

  const back = toWorld(approach);
  const dx = back[0] - centre[0];
  const dy = back[1] - centre[1];
  const dz = back[2] - centre[2];
  const len = Math.hypot(dx, dy, dz);
  // A degenerate approach cannot happen for a craft that flew here, but a NaN in a
  // position buffer takes the whole scene down.
  if (len <= 1e-6) return [centre[0], centre[1] + standoff, centre[2]];
  const k = standoff / len;
  return [centre[0] + dx * k, centre[1] + dy * k, centre[2] + dz * k];
}

/* ── asteroids ──────────────────────────────────────────────── */

/**
 * WHERE THE FIELD COMES FROM, AND WHY IT CHANGED.
 *
 * It used to be regenerated locally from the season seed, which was right while a
 * rock was scenery. It is now mined (D19), so a rock has one fact that no formula
 * can produce — how much ore somebody else has already taken out of it — and the
 * server is the only place that knows. `/api/mining` therefore sends the field.
 *
 * What it sends is still a TRAJECTORY, not a position: orbital plane, phase,
 * speed and lifetime. So the client animates the caller's discovered rocks from
 * the shared server clock exactly as it animates fleets. The server names the next
 * discovery/expiry wake-up; no orbit tick or rapid poll is needed.
 */

export interface OrbitLike {
  radius: number;
  period: number;
  phase: number;
  inclination: number;
  ascendingNode: number;
}

/** Stable unsigned seed for model/tumble variety from a server-opaque identity. */
export function asteroidVisualSeed(id: string): number {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** How far through its life a rock is, 0 to 1. */
export function asteroidProgress(
  rock: { appearsAt: number; expiresAt: number },
  seasonStart: Date,
  now: number,
): number {
  const minutes = (now - seasonStart.getTime()) / 60_000;
  const span = rock.expiresAt - rock.appearsAt;
  if (span <= 0) return 1;
  return (minutes - rock.appearsAt) / span;
}

/**
 * THE SHARED ORBIT TRIG, ONCE. Both a rock and the trade ship ride one of these
 * (`OrbitLike`), and each has its own rules-package counterpart to agree with —
 * `asteroidPosition` and `tradeShipPosition`. They must never become two
 * hand-copied blocks of the same rotation that drift apart one edit at a time;
 * see `asteroidWorldPosition`'s docblock for what that drift costs a player.
 */
function orbitWorldPosition(orbit: OrbitLike, seasonStart: Date, now: number): Vec3Tuple {
  const minutes = (now - seasonStart.getTime()) / 60_000;
  const theta = orbit.phase + (2 * Math.PI * minutes) / orbit.period;
  const cosTheta = Math.cos(theta);
  const sinTheta = Math.sin(theta);
  const cosNode = Math.cos(orbit.ascendingNode);
  const sinNode = Math.sin(orbit.ascendingNode);
  const cosInclination = Math.cos(orbit.inclination);
  const sinInclination = Math.sin(orbit.inclination);
  return toWorld({
    x: orbit.radius * (cosNode * cosTheta - sinNode * sinTheta * cosInclination),
    y: orbit.radius * sinTheta * sinInclination,
    z: orbit.radius * (sinNode * cosTheta + cosNode * sinTheta * cosInclination),
  });
}

/**
 * Its world position this instant, from the orbit and the clock.
 *
 * Must stay identical to `asteroidPosition` in the rules package: the server
 * resolves mining against that one, and if the two ever disagreed a player would
 * be aiming at a rock that is somewhere else.
 */
export function asteroidWorldPosition(
  rock: OrbitLike,
  seasonStart: Date,
  now: number,
): Vec3Tuple {
  return orbitWorldPosition(rock, seasonStart, now);
}

/**
 * Where the merchant is, this instant, from its orbit and the clock. D156.
 *
 * Must stay identical to `tradeShipPosition` in the rules package, and here the
 * stakes are sharper than for a rock: the launch screen solves a rendezvous
 * against this merchant and the server solves the same rendezvous again, so a
 * client drawn a few pixels off `tradeShipPosition` is a client aiming a convoy
 * at empty space. Unlike a rock or a pirate, the trade ship's orbit is public by
 * owner decision (D156), so this reads it straight off the wire payload rather
 * than off a caller-earned discovery.
 */
export function tradeShipWorldPosition(
  orbit: OrbitLike,
  seasonStart: Date,
  now: number,
): Vec3Tuple {
  return orbitWorldPosition(orbit, seasonStart, now);
}

/**
 * How big a rock is drawn, by level.
 *
 * THE ONE PIECE OF FREE INFORMATION IN THE FIELD. Ore comes from level and nothing
 * else, so size IS value — a player sweeping the disc can tell a rock worth
 * diverting a squadron for from one that is not, without opening anything. Sized
 * generously apart because five steps nobody can distinguish encode nothing — the
 * rocks keep a three-step ladder even though worlds took a per-level ramp at D153,
 * for the same reason: a rock's grade is a category, not a gradient.
 *
 * KEPT WELL UNDER THE PLANETS, and taken down another quarter (owner call). No world
 * is drawn under 0.44, so the richest rock in the galaxy is well under two thirds of
 * the smallest world and the two can never be confused at a glance. The
 * first version topped out at 0.68 against an unnormalised model — see `model.ts`
 * — and produced rocks bigger than worlds.
 *
 * Scaled UNIFORMLY by 0.75 rather than compressed. The ladder is the information:
 * shaving more off the top than the bottom would flatten the very ratios that let
 * a player rank rocks by eye, which is the only thing this scale is for.
 */
export const ASTEROID_RADIUS: Record<number, number> = {
  1: 0.075,
  2: 0.105,
  3: 0.143,
  4: 0.195,
  5: 0.255,
};

export const asteroidRadius = (level: number): number => ASTEROID_RADIUS[level] ?? 0.2;

/* ── colour, by what you know ───────────────────────────────── */

export const STANCE_COLOUR: Record<Stance, string> = {
  self: '#8fd6ea',
  window: '#5ad39b',
  watched: '#aecbe6',
  veiled: '#7c8ca3',
  dark: '#39404f',
};

/** How brightly a world is rendered. Ignorance is literally dark. */
export const STANCE_LIGHT: Record<Stance, number> = {
  self: 1,
  window: 1,
  watched: 0.92,
  veiled: 0.62,
  dark: 0.42,
};
