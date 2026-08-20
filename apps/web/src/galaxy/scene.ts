import { GALAXY, interpolatePosition, type SatelliteId } from '@blindspace/rules';
import type { Contact, GalaxyPlanet, MiningRun, PendingThread } from '../api/schemas.js';

/**
 * The galaxy, as the 3D surface needs it.
 *
 * WORLD UNITS. The design's coordinates run to radius 1000 with a ±120 disc
 * thickness. Three.js is happiest with a camera near the single-digit range, so
 * everything is divided by `SCALE` on the way in and nothing downstream ever
 * thinks about game units again.
 *
 * Nothing here fetches. `generateGalaxy` and `asteroidPosition` are pure functions
 * in the rules package, so the client rebuilds the static layout and every
 * asteroid orbit from the season seed rather than downloading them — which is
 * exactly what A5 meant and why the seed is now on `/api/season`.
 */

/**
 * Game units per world unit.
 *
 * Halved from 100, which doubles how far apart the worlds sit on screen without
 * touching a single gameplay number: travel times, ranges and the rank floor all
 * read the game's own coordinates and are unaffected. If the DESIGN distances
 * should grow too — every flight taking twice as long — that is `GALAXY.radius` in
 * the rules package, and it moves the balance simulation with it.
 */
export const SCALE = 50;

export const DISC_RADIUS = GALAXY.radius / SCALE;
export const DISC_THICKNESS = GALAXY.thickness / SCALE;

export type Vec3Tuple = [number, number, number];

/**
 * Height, exaggerated.
 *
 * The design's disc is deliberately thin — radius 1000, thickness ±120 — because
 * that reads as a galaxy and stays legible on a portrait phone. Rendered
 * faithfully it also reads as a single horizontal line of planets.
 *
 * This is relief exaggeration, the same trick a physical globe uses for mountains:
 * the PICTURE is stretched vertically while every distance the game computes stays
 * exactly as it was. Travel times, ranges and the rank floor all read the game's
 * own coordinates and none of them can tell the difference.
 */
const VERTICAL_EXAGGERATION = 3.5;

export const toWorld = (p: { x: number; y: number; z: number }): Vec3Tuple => [
  p.x / SCALE,
  (p.y * VERTICAL_EXAGGERATION) / SCALE,
  p.z / SCALE,
];

/**
 * What the player is allowed to know about a planet, as one word.
 *
 * The fog becomes the art: an unwatched world is a dark sphere, a watched one is
 * lit, and one whose fleet is away is the only thing on screen wearing the
 * opportunity colour. This is the telescope reading, rendered spatially.
 */
export type Stance = 'self' | 'window' | 'watched' | 'veiled' | 'dark';

export function stanceOf(planet: GalaxyPlanet): Stance {
  if (planet.isSelf) return 'self';
  if (!planet.fleet) return 'dark';
  if (planet.fleet.status === 'AWAY') return 'window';
  if (planet.fleet.status === 'UNKNOWN') return 'veiled';
  return 'watched';
}

export interface PlanetNode {
  id: string;
  name: string;
  owner: string;
  position: Vec3Tuple;
  /** Bigger worlds for more developed players — the only free public signal. */
  radius: number;
  /** 1, 2 or 3. What the size means, for anything that needs to say it in words. */
  weight: 1 | 2 | 3;
  /** The satellites in orbit. Public hardware, and a satellite has no level — D15/D25. */
  satellites: readonly SatelliteId[];
  /** Is there a dome. The one ground instrument anyone else can see, as a boolean. */
  shielded: boolean;
  stance: Stance;
}

/**
 * THREE SIZES, NOT A RAMP.
 *
 * The server publishes a coarse core TIER — never the exact level, because that is
 * what a probe is for — and the disc turns it into one of three silhouettes. A
 * continuous ramp encoded five sizes that no eye could separate at a glance, which
 * is the same as encoding nothing: the point of putting development into the
 * picture is that a player sweeping the galaxy can tell a soft target from a hard
 * one without opening anything.
 *
 * It is a silhouette, not a readout. "Bigger than me" is the whole message; how
 * much bigger, what it is defended with and whether its fleet is home all still
 * cost a telescope slot or a probe.
 *
 * THE THREE ARE HELD APART DELIBERATELY. The middle is the anchor and does not
 * move; the outer two were pushed outward (owner call) because the gap is the
 * whole signal. 0.5 against 1.24 was a 2.5× spread, which reads as "somewhat
 * bigger" at the distances this map is actually flown at; 0.44 against 1.40 is
 * 3.2×, and a heavyweight now looks like one from across the disc without a label.
 */
const WEIGHT_RADIUS: Record<1 | 2 | 3, number> = { 1: 0.44, 2: 0.82, 3: 1.4 };

export const weightOf = (coreTier: number): 1 | 2 | 3 =>
  coreTier >= 4 ? 3 : coreTier >= 2 ? 2 : 1;

export function planetNodes(planets: readonly GalaxyPlanet[]): PlanetNode[] {
  return planets.map((planet) => ({
    id: planet.id,
    name: planet.name,
    owner: planet.owner,
    position: toWorld(planet.position),
    // Map markers, not scale models. A planet at true scale in a disc 2000 units
    // across would be invisible, so these are sized to be READ.
    radius: WEIGHT_RADIUS[weightOf(planet.coreTier)],
    weight: weightOf(planet.coreTier),
    satellites: planet.satellites,
    shielded: planet.shielded,
    stance: stanceOf(planet),
  }));
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
  if (standoff.start <= 0 && standoff.end <= 0) {
    return toWorld(
      interpolatePosition(
        path.from,
        path.to,
        path.departAt.getTime(),
        path.arriveAt.getTime(),
        now,
      ),
    );
  }

  /**
   * A leg that begins or ends in ORBIT rather than at the middle of a world.
   *
   * Solved in world units rather than in game units, because a standoff is a
   * drawing distance — it has to clear a sphere whose radius is a world figure,
   * and the height axis is exaggerated on the way in (`toWorld`), so the same
   * number means two different things on either side of that conversion.
   */
  const start = legStart(path, standoff.start);
  const end = legEnd(path, standoff.end);
  const span = path.arriveAt.getTime() - path.departAt.getTime();
  const t =
    span <= 0 ? 1 : Math.max(0, Math.min(1, (now - path.departAt.getTime()) / span));
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
 * Scaled by the world rather than fixed, because worlds are drawn at 0.44, 0.82
 * and 1.40 and one number would either bury a squadron in a heavyweight or park it
 * a long way off a small one. The half-radius of clearance on top is what keeps a
 * twelve-model formation — which is nearly two spacings across — outside the
 * silhouette rather than half-embedded in it.
 */
export const orbitStandoff = (radius: number): number => radius * 1.5 + radius * 0.5;

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
 * ZERO AT HOME, at whichever end home is, and that is not an oversight: a fleet
 * leaving its own world is emerging from it and one coming back LANDS — it is
 * absorbed into the garrison and stops existing, so holding it in orbit would leave
 * a squadron parked over your own planet with nothing left to happen to it.
 */
export interface LegStandoff {
  /** Held off the world the leg departs from. Only ever a return leg. */
  start: number;
  /** Held off the world the leg arrives at. Only ever an outbound leg. */
  end: number;
}

export const NO_STANDOFF: LegStandoff = { start: 0, end: 0 };

export function legStandoff(
  thread: PendingThread,
  nodes: readonly PlanetNode[],
): LegStandoff {
  if (!thread.path) return NO_STANDOFF;
  const returning = thread.leg === 'return';
  // The world being held off is the FOREIGN one, which swaps ends with the leg:
  // a return mission row is stored with its origin and target reversed (D28), so
  // the raided world is `path.from` on the way home and `path.to` on the way out.
  const node = targetNodeOf(nodes, returning ? thread.path.from : thread.path.to);
  if (!node) return NO_STANDOFF;
  const gap = orbitStandoff(node.radius);
  return returning ? { start: gap, end: 0 } : { start: 0, end: gap };
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
  const from = toWorld(path.from);
  if (standoff <= 0) return from;
  const to = toWorld(path.to);

  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const dz = to[2] - from[2];
  const len = Math.hypot(dx, dy, dz);
  if (len <= 0) return from;

  const push = Math.min(standoff, len * 0.5) / len;
  return [from[0] + dx * push, from[1] + dy * push, from[2] + dz * push];
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
  const from = toWorld(path.from);
  const to = toWorld(path.to);
  if (standoff <= 0) return to;

  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const dz = to[2] - from[2];
  const len = Math.hypot(dx, dy, dz);
  if (len <= 0) return to;

  const pull = Math.min(standoff, len * 0.5) / len;
  return [to[0] - dx * pull, to[1] - dy * pull, to[2] - dz * pull];
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
): Vec3Tuple {
  const returning = run.status === 'returning';
  const [from, to, departAt, arriveAt] = returning
    ? ([run.intercept, home, run.arriveAt, run.homeAt ?? run.arriveAt] as const)
    : ([home, run.intercept, run.departAt, run.arriveAt] as const);

  return toWorld(
    interpolatePosition(from, to, departAt.getTime(), arriveAt.getTime(), now),
  );
}

/**
 * NOTHING IS EVER DRAWN INSIDE A WORLD.
 *
 * D44 gave your OWN craft a standoff, because a leg's endpoint is the target
 * planet's centre and a squadron parked in the middle of the thing it is attacking
 * is not a picture of a raid. Everybody else's craft never got one, and could not:
 * a contact carries a bearing window and no destination, so the renderer has no
 * endpoint to stop short of. What it published instead was the craft's true
 * position, which on final approach IS the target's centre — so every player in the
 * galaxy watched other people's raids fly into a planet and disappear, while the
 * attacker watched their own hold in orbit. The same disc, two different pictures.
 *
 * This is the rule stated as geometry rather than as a route, which is the only
 * form a contact can obey: a craft that would be drawn inside a world is pushed out
 * to just clear of its surface, along the line from the world's centre. It needs no
 * destination, so it discloses nothing — the planet is public, the craft's position
 * is already public, and the correction only ever moves a craft to somewhere the
 * player could already see it was.
 *
 * IT IS DELIBERATELY TIGHT. The standoff a raid holds is two planet radii; this is
 * a sixth of one, because it is not a holding position — it is the surface of the
 * sphere. Any looser and a craft passing an unrelated world on its way somewhere
 * else would visibly swerve around it, which is a worse lie than the one being
 * fixed.
 */
const HULL_CLEARANCE = 1.15;

export function clearOfWorlds(
  nodes: readonly PlanetNode[],
  at: Vec3Tuple,
): Vec3Tuple {
  for (const node of nodes) {
    const clear = node.radius * HULL_CLEARANCE;
    const dx = at[0] - node.position[0];
    const dy = at[1] - node.position[1];
    const dz = at[2] - node.position[2];
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 >= clear * clear) continue;

    const d = Math.sqrt(d2);
    // Dead centre has no direction to push along. Straight up is as good as any,
    // and it cannot happen for a craft that is actually moving.
    if (d < 1e-6) return [node.position[0], node.position[1] + clear, node.position[2]];
    const k = clear / d;
    return [
      node.position[0] + dx * k,
      node.position[1] + dy * k,
      node.position[2] + dz * k,
    ];
  }
  return at;
}

/**
 * How far past its window a contact may be carried before it stops.
 *
 * Traffic refetches every sixty seconds against a four-minute window, so this is
 * only ever reached when a poll has failed — a tab that was backgrounded, a phone
 * that lost signal. Coasting on the last known bearing for a while is much better
 * than a craft stopping dead in open space, which reads as a broken game rather
 * than as a missed request. It reveals nothing: the heading is already public, and
 * extrapolating it is exactly what a player's eye does anyway.
 *
 * It does stop eventually. A craft coasting for ever would sail off the disc and
 * out past the rim, which is a worse lie than standing still.
 */
const COAST = 1.5;

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
   * A RAID THAT HAS LANDED HOLDS IN ORBIT, FOR EVERYONE. D52.
   *
   * The attacker's own client works this out from its `path` and the target's drawn
   * radius (D44); a bystander has no path, so the payload names the target for the
   * ten seconds the fleet is over it and the standoff is solved here from exactly
   * the same figures. Both clients therefore put the same squadron in the same
   * place — which is the whole point of publishing the engagement at all.
   */
  const fight = contact.engagement;
  if (fight && now >= fight.arriveAt.getTime()) {
    return engagementHold(fight.target, contact.from, nodes);
  }

  const span = contact.endAt.getTime() - contact.startAt.getTime();
  const t =
    span <= 0 ? 1 : Math.max(0, Math.min(COAST, (now - contact.startAt.getTime()) / span));
  return toWorld({
    x: contact.from.x + (contact.to.x - contact.from.x) * t,
    y: contact.from.y + (contact.to.y - contact.from.y) * t,
    z: contact.from.z + (contact.to.z - contact.from.z) * t,
  });
}

/**
 * Where a squadron sits while it bombards a world it does not own.
 *
 * `approach` is a point on the line it came in on, a minute back — the payload
 * carries it for no other purpose. The hold is the same `orbitStandoff` the
 * attacker's own leg stops at, so the two views agree to the metre.
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
 * What it sends is still a TRAJECTORY, not a position: entry point, exit point,
 * speed and lifetime. So the client animates fifty moving rocks from its own clock
 * exactly as it animates fleets, and one small request every ninety seconds
 * replaces a stream. A5's principle survives intact; only the source of the ore
 * count moved.
 */

export interface OrbitLike {
  radius: number;
  period: number;
  phase: number;
  y: number;
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
  const minutes = (now - seasonStart.getTime()) / 60_000;
  const theta = rock.phase + (2 * Math.PI * minutes) / rock.period;
  return toWorld({
    x: rock.radius * Math.cos(theta),
    y: rock.y,
    z: rock.radius * Math.sin(theta),
  });
}

/**
 * How big a rock is drawn, by level.
 *
 * THE ONE PIECE OF FREE INFORMATION IN THE FIELD. Ore comes from level and nothing
 * else, so size IS value — a player sweeping the disc can tell a rock worth
 * diverting a squadron for from one that is not, without opening anything. Sized
 * generously apart for the same reason planets use three silhouettes rather than a
 * ramp: five steps nobody can distinguish encode nothing.
 *
 * KEPT WELL UNDER THE PLANETS, and taken down another quarter (owner call). Worlds
 * are 0.44, 0.82 and 1.40, so the richest rock in the galaxy is well under two
 * thirds of the smallest world and the two can never be confused at a glance. The
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
