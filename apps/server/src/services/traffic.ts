import { and, eq, gte, inArray, ne, or } from 'drizzle-orm';
import {
  DEATH_STAR,
  TRAFFIC,
  coreTier,
  distance,
  radarRange,
  radarRevealsComposition,
  radarRevealsSize,
  radarSensesIntent,
  engagementEndsAt,
  massClass,
  orbitStandoff,
  sensorSphere,
  sensorZone,
  surfaceStandoff,
  visualLeg,
  worldRadius,
  type MassClass,
  type Fleet,
  type SensorSphere,
  type SensorZone,
  type Vec3,
} from '@astera/rules';
import type { Db } from '../db/client.js';
import {
  buildings,
  miningRuns,
  missions,
  planets,
  strategicImpacts,
  strategicInterceptions,
} from '../db/schema.js';
import { legBelongsTo } from './flight.js';
import { instrumentLevels, levelOf } from './intel.js';
import { loadMiningSnapshot } from './mining.js';
import { discoveredAsteroidIndexes } from './asteroidField.js';
import { sensorHistoryForPlayer } from './sensorHistory.js';

/**
 * TRAFFIC — the galaxy is busy, and now you can see it.
 *
 * REWRITTEN ON THE OWNER'S DECISION (D24). The first version showed other people's
 * craft as anonymous motes: offset by more than the planets are spaced, visible
 * only through the middle 60% of a flight, carrying no kind and no direction. It
 * protected the fog completely and it made the disc feel empty — the one thing a
 * galaxy of two hundred real people should never feel.
 *
 * The current owner instruction is the three-zone model in `@astera/rules/sight`:
 * outside every owned sphere the craft is absent, Radar makes it an anonymous
 * moving contact, and Telescope sight resolves the craft itself — including an
 * exact fleet manifest — without exposing its route. A discovered mining target
 * is the narrow route exception.
 *
 * What that means in the payload, and every line of it is deliberate:
 *
 *   · A BEARING WINDOW, NOT A ROUTE. A contact carries where it is now and where
 *     it will be a few minutes from now — enough for the client to animate it
 *     smoothly between polls, and nothing more. The endpoints never leave the
 *     server, so there is no field a modified client could read to find out which
 *     world a fleet left or which one it is about to land on. The window is also
 *     clamped short of arrival, so watching one to the end never marks the target.
 *   · THREE ZONES. Outside reach there is no payload row. Radar publishes a moving
 *     question mark and earns size/kind on its upper rungs. Telescope identifies
 *     the craft and, for a fleet, its exact hulls and counts.
 *   · CARGO IS NEVER PUBLIC. What a Prospector is bringing home, and what a raider
 *     took, belong to the owner alone. A contact carries no ore, no loot and no
 *     resource figure of any kind — those live on `/api/mining` and the battle
 *     report, both of which answer only to the player they belong to.
 *   · NO OWNER AND NO WORLD. There is no planet id, no player id and no name in
 *     here. You can see what is flying; you cannot see whose it is.
 *
 * WHAT IT COSTS, STATED RATHER THAN DISCOVERED LATER.
 *
 * A departure covered by a sensor is visible now and was not before. This is a real
 * concession by the intel ladder, while origin and destination remain withheld.
 * The Telescope still sells something the disc does not — it answers "is their
 * COMBAT FLEET home", where a craft leaving a world could be a probe, a
 * Prospector, or three Wasps out of forty — but the gap is narrower than it was.
 *
 * This is the first thing to re-read if a playtest says scouting stopped mattering
 * (`KNOWN RISKS`: "nobody scouts" is the third-highest risk in the project). The
 * dial is this file: narrow `BEARING_MINUTES`, drop `fleet` from the payload, or
 * put the old visible band back. See D24 for what was traded for what.
 */

/**
 * THE THREE FIGURES THAT SHAPE A PUBLISHED WINDOW LIVE IN `@astera/rules`.
 *
 * They were private to this file, and the floor among them referred to a number
 * that lives on the CLIENT — how often the contact list is asked for. When that
 * interval moved, the floor did not, and every probe in the game began publishing
 * the world it was flying to. See `TRAFFIC` for the whole account.
 *
 * `MIN_COAST_MS` IS THE REFETCH CADENCE, not a constant of its own. A window
 * shorter than the gap between reads is a craft that stops dead and waits; a
 * window exactly that long is the shortest one that cannot. Reading the cadence
 * itself means the two can never disagree again.
 */
const BEARING_MINUTES = TRAFFIC.bearingMinutes;
const BEARING_SHARE = TRAFFIC.bearingShare;
const MIN_COAST_MS = TRAFFIC.refreshMs;

/**
 * How much of the final approach an engaging contact publishes.
 *
 * Only after Radar/Telescope has actually seen the craft: the squadron is held off
 * the world along the line it came in on, and two points are the cheapest way to
 * say which line that is. An `effectOnly` observer never receives either point.
 */
const APPROACH_MS = 60_000;

/**
 * THERE IS NO ARRIVAL MARGIN ANY MORE, AND THAT IS THE POINT. D52.
 *
 * The window used to stop short of arrival — four fifths of the leg, then a fixed
 * 45 seconds (D50) — so that "the published window never points AT the
 * destination". Both were a freeze: the client interpolates along the window, and
 * a window whose end is in the past collapses to a point, so every craft in the
 * galaxy stood still for the last stretch of its flight and then blinked out.
 *
 * D50 already recorded that the margin cost the fog nothing, because the NEAR end
 * of the window has always been the craft's true position, refreshed on every read
 * until it lands. It withheld a few hundred metres of a flight anyone could
 * already watch, and charged a dead stop for it.
 *
 * What replaced it is the opposite decision, and the owner's: a raid landing is
 * the most watchable thing in the galaxy, so its BOMBARDMENT is public. The craft
 * window still answers to D123; outside every circle the event carries only its
 * public target and clock and never this final approach.
 */

/**
 * `harvest` is a craft flying to a wreck field. D32.
 *
 * The craft still obeys D123. Once Telescope identifies it, its route/clock may be
 * shown because the wreck field is already public; Radar sees only its own rung and
 * a commander outside every circle sees no Prospector at all.
 */
/**
 * `unknown` IS A CRAFT YOU CAN SEE AND CANNOT IDENTIFY. D125.
 *
 * D123 dropped out-of-reach craft from the payload entirely, and the owner found
 * the hole in it within the hour: a player cannot tell the difference between "the
 * galaxy is quiet" and "the galaxy is busy and my instruments are too weak", so
 * the Telescope ladder was invisible in a second, quieter way. Nothing on the disc
 * ever said there was something to buy.
 *
 * So the far contact comes back, stripped of everything the instrument sells. It
 * carries a bearing window and nothing else — no kind, so the neon cannot say
 * whether it is a warship, a scout or a drill; no mass, so its weight is unknown;
 * no origin and no destination. What it says, and all it says, is THERE IS
 * SOMETHING OUT THERE AND YOU CANNOT SEE WHAT IT IS. That is an advertisement for
 * the Telescope written in the only language this game trusts, the picture (D124).
 *
 * WHAT IT DOES GIVE AWAY, STATED RATHER THAN GLOSSED: its SPEED. A window is two
 * points and two instants, so `|to − from| / (endAt − startAt)` is exact, and a
 * probe flies thirty-six times faster than a fleet (D121). A patient observer can
 * therefore separate a scout from a raid out there without owning a Telescope.
 *
 * IT IS NOT FIXABLE AND IT IS NOT A DEFECT. Speed is what MOVEMENT IS: anything
 * drawn crossing the disc is drawn at the rate it crosses, and the only ways to
 * hide that are to publish a false position — which the fog may never do, it hides
 * and never lies — or to stop drawing the craft at all, which is the D123 version
 * the owner rejected for making the galaxy look dead. The disclosure is a rate,
 * never a roster: it cannot separate a Wasp swarm from a Bulwark wall, cannot say
 * how many, and cannot say where from or where to. Those are what the ladder
 * sells and none of them are here.
 */
export type ContactKind = 'unknown' | 'fleet' | 'probe' | 'death_star' | 'mining' | 'harvest';

export interface Contact {
  /**
   * Stable for the life of the flight, and meaningless on its own.
   *
   * Focus needs a key that survives a refetch — the player has selected THAT
   * squadron and the panel has to stay on it. The mission's own id serves, and
   * discloses nothing: it is a UUID that maps to no world, no player and no name
   * anywhere else in the payload.
   */
  id: string;
  /** What sort of craft it is — the neon colour, and the panel's heading. */
  kind: ContactKind;
  /** Where it is at `startAt`. A sample of the path, never its origin. */
  from: Vec3;
  /** Where it will be at `endAt`. A heading, never its destination. */
  to: Vec3;
  startAt: Date;
  endAt: Date;
  /** Exact hull composition, present only for a fleet inside Telescope sight. */
  fleet?: Fleet;
  /**
   * THIS WINDOW ENDS WHERE THE CRAFT DOES, RATHER THAN PART OF THE WAY ALONG.
   *
   * The client interpolates inside the window and, if a read is late, COASTS a
   * little past it on the published heading — because a craft that stops dead in
   * open space reads as a broken game, while one that carries on for a few more
   * seconds reads as exactly what an eye would guess.
   *
   * That is right for a heading and wrong for an arrival: coasting past `endAt`
   * when `endAt` IS the destination flies the craft straight through the world it
   * was landing on and out the other side. The client cannot tell the two apart —
   * a window is four numbers and none of them says which kind it is — so the server
   * says.
   *
   * IT DISCLOSES NOTHING. `windowOf` clamps to the arrival only inside the last
   * `MIN_COAST_MS` of a flight, and in that case the window's END POINT already IS
   * the destination, published in full. This names a property of a payload the
   * caller is already holding; it is the same concession D52 makes for a raid that
   * has landed, stated so the renderer can act on it instead of guessing.
   */
  landing?: boolean;
  /**
   * The whole leg, and the clock on it. MINING ONLY.
   *
   * A Prospector's run becomes a public race after this caller discovers the rock,
   * so hiding where it is going would withhold half of a contest the design wants
   * people to feel. Present for no other kind — this is the field that would give
   * away a raid, and only an authorised mining branch ever sets it.
   */
  route?: { from: Vec3; to: Vec3; departAt: Date; arriveAt: Date };
  /** Minutes until it gets there. Mining only, for the same reason. */
  minutesRemaining?: number;
  /**
   * THE BATTLE IS PUBLIC; THE CRAFT IS NOT. D52/D123.
   *
   * Present only when an engagement is outside every sensor sphere. The contact
   * then exists solely to carry the public moment below: `from` and `to` are both
   * the public target centre, and no mass, silhouette, bearing or craft geometry
   * may be inferred from it. The client draws the bombardment and nothing else.
   *
   * Inside Radar/Telescope reach this flag is absent and the ordinary disclosure
   * ladder applies to the squadron itself. The attacker never receives this
   * projection; their own pending thread already draws the exact fleet.
   */
  effectOnly?: true;
  /**
   * THIS RAID IS LANDING RIGHT NOW, AND EVERYBODY WATCHES IT. D52.
   *
   * The owner's decision, and a reversal of what D44 shipped: the ten-second
   * engagement was drawn for the attacker alone, because a contact carries a
   * bearing and no destination and there was nothing here for a bystander's client
   * to fire at. A battle that only one of the two people in it can see is not a
   * living galaxy — so the target is published, but ONLY for the seconds the fleet
   * is actually over it.
   *
   * WHAT IT DISCLOSES. `target` is a planet's coordinates, which are public on
   * `/api/galaxy` for every world in the disc. The moment says that world is under
   * fire and when the ten-second window ends. It does NOT itself disclose the
   * squadron: outside every sensor sphere `effectOnly` strips its position,
   * bearing and mass; Radar/Telescope earn those through the normal zone ladder.
   * There is still no owner, origin, name or outcome in this payload.
   *
   * It appears only on an attack, only between `arriveAt` and `endsAt`, and the
   * mission is genuinely `in_flight` throughout — this names a state of the world,
   * not an animation.
   */
  engagement?: { arriveAt: Date; endsAt: Date; target: Vec3 };
  /**
   * A STRIKE LANDED HERE, AT THIS INSTANT, AND EVERYBODY WATCHES IT. D106.
   *
   * The same decision as `engagement`, for the weapon that had no equivalent. A
   * raid publishes its ten seconds over the target, so every screen in the galaxy
   * fires the same bombardment at the same moment; a Death Star published nothing,
   * so its detonation existed only on the attacker's own client — which had the
   * mission and could work the moment out for itself. The one genuinely
   * spectacular thing in the game was visible to exactly one person, including the
   * commander it happened to.
   *
   * IT IS A MOMENT AND A PLACE, NOT A LEG. That is the whole point of the field:
   * an effect that is INFERRED from a flight has to be re-derived by every
   * renderer that draws it, and the two derivations drift. Published, there is one
   * instant and one point, and any client that has this payload draws the same
   * explosion at the same time whether it is the attacker's, the defender's or a
   * stranger's.
   *
   * `target` is the world's own centre rather than the orbit the craft held at:
   * the explosion happens AT the planet. It is public on `/api/galaxy` already.
   */
  impact?: { at: Date; target: Vec3 };
  /**
   * HOW BIG IT LOOKS BEFORE SIGHT RESOLVES IT. D123.
   *
   * This field used to be the whole fleet, hulls and counts, and that was the
   * single largest hole in the intel layer. `docs/game-design.md` sells a size
   * estimate at Radar L4 and an exact composition at Radar L5; both were on every
   * contact, for everybody, at every radar level including none — so the top two
   * rungs of that ladder bought nothing, and the first real play session found
   * exactly that. Scouting cannot matter while the disc answers the question for
   * free.
   *
   * Three steps, off `fleetValue`, for the same reason `worldWeight` has three: a
   * continuous size is a number no eye can separate. A stranger learns that
   * something big is crossing the disc, which is what makes the galaxy feel
   * inhabited, and learns nothing they could pack a counter-fleet against.
   *
   * Telescope sight separately adds `fleet`, while an attributed inbound warning
   * may also earn it through the private Radar ladder. `mass` itself never implies
   * an exact roster.
   */
  mass?: MassClass;
  /**
   * WHAT KIND OF CRAFT A QUESTION MARK IS, WHEN RADAR L5 HAS EARNED IT.
   *
   * Present ONLY on an `unknown` contact — inside telescope reach `kind` already
   * says it and this would be a second, redundant answer. It is the top of the
   * radar ladder made visible on ordinary traffic rather than only on a raid aimed
   * at you: a maxed Radar tells a fleet from a scout from a drill out at the edge
   * of its circle, hours before the eye could.
   *
   * It is a KIND and never a roster. Composition stays behind the Telescope for a
   * craft crossing the disc, and behind the timed warning for one coming at you.
   */
  silhouette?: ContactKind;
  /**
   * THIS ONE IS COMING FOR YOU, AND THAT IS ALL IT SAYS. D126.
   *
   * Present only on a hostile leg aimed at a world the caller controls, and only
   * once it is inside `radarContactRange` of that world. Detection and timed
   * warning are provisionally the same radius under D126.
   *
   * IT CARRIES NO CLOCK ON PURPOSE. This is the public moving-contact payload;
   * the clock, bearing and earned roster belong to the addressed defender's
   * private pending/notification surfaces. Sharing a radius does not merge those
   * disclosure channels.
   *
   * It may sit on an `unknown` contact, which is the intended picture: something
   * you cannot identify, bearing down on a world you own.
   */
  inbound?: true;
  /** How many craft are on a mining run. Public in full, like the rest of the run. */
  craft?: number;
}

const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  z: a.z + (b.z - a.z) * t,
});

/** Progress along a leg at `at`, clamped to its own ends. */
const progress = (depart: number, arrive: number, at: number): number => {
  const span = arrive - depart;
  if (span <= 0) return 1;
  return Math.max(0, Math.min(1, (at - depart) / span));
};

/**
 * One leg, as the slice of it the galaxy may see.
 *
 * Returns null when the craft is not in the air at `now`, so a caller never has to
 * reason about whether a mission has landed.
 *
 * THE WINDOW NO LONGER RUNS TO THE ARRIVAL, EXCEPT ON FINAL APPROACH. D63.
 *
 * D52 removed an arrival margin here because a margin PARKED a craft short of its
 * target, and that reasoning is intact — it is why `MIN_COAST_MS` exists. What
 * changed is that `BEARING_MINUTES` is an absolute duration and a mean leg became
 * exactly it, so the window covered the whole remaining flight and its end point
 * WAS the destination. That is a route, which is the one thing the fog rule here
 * forbids.
 *
 * So the window is capped at a SHARE of what is left, and floored at one refetch
 * so nothing ever freezes. The two together mean a craft with real flight ahead of
 * it publishes a heading, and a craft inside its last minute publishes its arrival
 * — the same concession D52 already makes for a raid that has landed.
 */
function windowOf(
  from: Vec3,
  to: Vec3,
  departAt: Date,
  arriveAt: Date,
  now: Date,
): { from: Vec3; to: Vec3; startAt: Date; endAt: Date; landing?: boolean } | null {
  const depart = departAt.getTime();
  const arrive = arriveAt.getTime();
  if (arrive <= depart) return null;
  if (now.getTime() < depart || now.getTime() >= arrive) return null;

  const startAt = now;
  /**
   * Never past the landing itself, so the client's coast cannot carry a craft
   * through the world it is arriving at — and never as far as the landing either,
   * which is what keeps the window a heading rather than a route at any speed.
   */
  const remaining = arrive - now.getTime();
  const windowMs = Math.max(
    MIN_COAST_MS,
    Math.min(BEARING_MINUTES * 60_000, remaining * BEARING_SHARE),
  );
  const end = Math.min(now.getTime() + windowMs, arrive);

  return {
    from: lerp(from, to, progress(depart, arrive, startAt.getTime())),
    to: lerp(from, to, progress(depart, arrive, end)),
    startAt,
    endAt: new Date(end),
    // Only when the window's far end is the craft's actual stopping point, which
    // is only ever inside the last `MIN_COAST_MS`. See `Contact.landing`.
    ...(end >= arrive ? { landing: true } : {}),
  };
}

/**
 * WHOSE CRAFT IS THIS? D28's rule, applied where it was being approximated. D47.
 *
 * "An outbound leg belongs to its origin; a return leg belongs to its target" —
 * because a return leg is stored with the two SWAPPED, so a fleet coming home has
 * its owner in `targetPlanetId`. A probe's homeward leg is the same shape and is
 * marked by `parentMissionId`.
 *
 * THIS WAS `origin === me || target === me`, AND THAT IS A DIFFERENT QUESTION.
 * It was reached for because it happens to catch both legs of your own craft, and
 * it does — but it also catches every enemy fleet flying AT you. The effect was
 * that the one player who most needed to see a raid was the only player in the
 * galaxy who could not: strangers got the anonymous contact, the target got
 * nothing. The exclusion's own reason ("drawn from the player's own payload at
 * full fidelity") never covered that case, because an inbound attack is not yours
 * and is not drawn at full fidelity anywhere — it reaches you radar-gated, with no
 * path, and the disc cannot draw a thread that has no path.
 *
 * WHAT THIS DOES NOT DO IS GIVE AWAY THE RAID. A contact is a bearing window with
 * no origin, no destination, no owner and no name. Seeing one tells you a craft is
 * moving out there — the same thing it tells everybody else. Knowing that it is
 * coming for YOU, and how long you have, is still exactly what the Radar sells
 * (D9), and that ladder is untouched.
 *
 * IT IS NO LONGER SPELT OUT HERE. `legBelongsTo` in `flight.ts` is the one
 * statement of the rule for code holding a row, and this file, `pendingThreads`
 * and the bay count all read it — because the moment two of them disagreed, a
 * craft was either drawn twice on one disc or not at all. It was, and it is why
 * this import exists.
 */

/**
 * Everything in the air in this season, at the fidelity the galaxy is entitled to.
 *
 * The caller's OWN craft are excluded: those are drawn from the player's own
 * payload at full fidelity, complete with their route, and a second anonymous copy
 * beside the real one would be both confusing and a free calibration sample. What
 * counts as "own" is `legBelongsTo`, and the distinction matters — see above.
 *
 * `ownPlanetId` IS NULL FOR A CALLER WHO OWNS NOTHING. D56: `/api/preview` shows a
 * visitor the disc before they have an account, so there is no leg of theirs to
 * leave out and every contact is somebody else's by definition. Expressed as null
 * rather than as an id that matches no row, because the id has to reach a `uuid`
 * column — a sentinel string is a 500 from the driver, which is how this was found.
 */
export interface TrafficSnapshot {
  missionRows: { mission: typeof missions.$inferSelect }[];
  miningRows: { run: typeof miningRuns.$inferSelect }[];
  interceptionRows: { interception: typeof strategicInterceptions.$inferSelect }[];
  landedDeathStarMissionIds: ReadonlySet<string>;
  positions: ReadonlyMap<string, Vec3>;
  /**
   * THE PUBLIC CORE TIER OF EVERY WORLD A LEG TOUCHES. D106.
   *
   * It is here for one reason: how big a world is DRAWN decides where a craft
   * stops short of it, and a published window has to end where the owner's own
   * client ends the same leg or the two screens disagree by more than a planet.
   * See `packages/rules/src/view.ts`.
   *
   * It discloses nothing — `coreTier` is on `/api/galaxy` for every world in the
   * disc (D49), which is exactly why the correction can be computed on both sides.
   */
  tiers: ReadonlyMap<string, number>;
}

/**
 * The common row set behind every caller's traffic view.
 *
 * It deliberately stops before ownership exclusion and before any time-derived
 * bearing window. Those are evaluated for the current caller and current instant
 * by `projectGalaxyTraffic`, so sharing this work cannot freeze motion or turn one
 * commander's filter into another's.
 */
export async function loadTrafficSnapshot(
  db: Db,
  seasonId: string,
  now: Date = new Date(),
): Promise<TrafficSnapshot> {
  const impactCutoff = new Date(now.getTime() - DEATH_STAR.impactSeconds * 1000);
  const [missionRows, miningRows, interceptionRows, impactRows] = await Promise.all([
    db
      .select({ mission: missions })
      .from(missions)
      .where(and(
        eq(missions.seasonId, seasonId),
        or(
          eq(missions.status, 'in_flight'),
          and(
            eq(missions.kind, 'death_star'),
            eq(missions.status, 'resolved'),
            gte(missions.arriveAt, impactCutoff),
          ),
        ),
      )),
    db
      .select({ run: miningRuns })
      .from(miningRuns)
      .where(and(eq(miningRuns.seasonId, seasonId), ne(miningRuns.status, 'done'))),
    db
      .select({ interception: strategicInterceptions })
      .from(strategicInterceptions)
      .where(and(
        eq(strategicInterceptions.seasonId, seasonId),
        gte(strategicInterceptions.impactAt, impactCutoff),
      )),
    db
      .select({ missionId: strategicImpacts.missionId })
      .from(strategicImpacts)
      .where(and(
        eq(strategicImpacts.seasonId, seasonId),
        ne(strategicImpacts.outcome, 'INTERCEPTED'),
        gte(strategicImpacts.createdAt, impactCutoff),
      )),
  ]);

  const ids = new Set<string>();
  for (const { mission } of missionRows) {
    ids.add(mission.originPlanetId);
    ids.add(mission.targetPlanetId);
  }
  for (const { run } of miningRows) ids.add(run.planetId);
  const landedDeathStarMissionIds = new Set(impactRows.map((row) => row.missionId));
  if (ids.size === 0) {
    return {
      missionRows,
      miningRows,
      interceptionRows,
      landedDeathStarMissionIds,
      positions: new Map(),
      tiers: new Map(),
    };
  }

  const [planetRows, coreRows] = await Promise.all([
    db
      .select({ id: planets.id, x: planets.x, y: planets.y, z: planets.z })
      .from(planets)
      .where(inArray(planets.id, [...ids])),
    db
      .select({ planetId: buildings.planetId, level: buildings.level })
      .from(buildings)
      .where(and(inArray(buildings.planetId, [...ids]), eq(buildings.type, 'CORE'))),
  ]);
  const positions = new Map<string, Vec3>(
    planetRows.map((planet) => [
      planet.id,
      { x: planet.x, y: planet.y, z: planet.z },
    ]),
  );
  // The same coarse tier `/api/galaxy` publishes, from the same column.
  const tiers = new Map<string, number>(
    coreRows.map((row) => [row.planetId, coreTier(row.level)]),
  );
  return { missionRows, miningRows, interceptionRows, landedDeathStarMissionIds, positions, tiers };
}

export interface StrategicInterceptionView {
  id: string;
  targetPlanetId: string;
  trigger: 'RADAR' | 'TELESCOPE';
  launchAt: Date;
  impactAt: Date;
  launch: Vec3;
  deathStarFrom: Vec3;
  collision: Vec3;
}

export interface StrategicInterceptionImpactView {
  id: string;
  at: Date;
  collision: Vec3;
  /** True means the viewer earned the public blast but not either craft. */
  effectOnly: boolean;
  /** Only the defending commander may have their camera pulled to this blast. */
  focusEligible: boolean;
}

const identifiesStrategicCollision = (
  sensors: readonly SensorPost[],
  collision: Vec3,
): boolean => sensors.some(
  (post) => post.telescope && distance(post.at, collision) <= post.identify,
);

/** The collision is private transit until the caller actually identifies its point. */
export function projectStrategicInterceptions(
  snapshot: TrafficSnapshot,
  ownPlayerId: string | null,
  sensors: readonly SensorPost[],
): StrategicInterceptionView[] {
  return snapshot.interceptionRows.flatMap(({ interception }) => {
    const collision = {
      x: interception.collisionX,
      y: interception.collisionY,
      z: interception.collisionZ,
    };
    const participant = ownPlayerId === interception.attackerPlayerId
      || ownPlayerId === interception.defenderPlayerId;
    // D139 grants third-party access through an effective Telescope, not through
    // the naked-eye floor shared by the general traffic model. `sensorZone`
    // deliberately calls that floor IDENTIFIED for nearby ordinary craft, so it
    // is too broad for this one strategic event.
    const telescopeWitness = identifiesStrategicCollision(sensors, collision);
    if (!participant && !telescopeWitness) return [];
    return [{
      id: interception.id,
      targetPlanetId: interception.targetPlanetId,
      trigger: interception.trigger,
      launchAt: interception.launchAt,
      impactAt: interception.impactAt,
      launch: {
        x: interception.launchX,
        y: interception.launchY,
        z: interception.launchZ,
      },
      deathStarFrom: {
        x: interception.deathStarFromX,
        y: interception.deathStarFromY,
        z: interception.deathStarFromZ,
      },
      collision,
    }];
  });
}

/**
 * Public collision fire without public strategic craft.
 *
 * Before `impactAt` the launch remains private to participants and Telescope
 * witnesses. At impact the explosion is a public live moment, just like ordinary
 * bombardment: viewers outside sight receive only this position/time and render it
 * dimly; no launch point, Death Star point, route or asset identity is disclosed.
 */
export function projectStrategicInterceptionImpacts(
  snapshot: TrafficSnapshot,
  ownPlayerId: string | null,
  sensors: readonly SensorPost[],
  now: Date,
): StrategicInterceptionImpactView[] {
  return snapshot.interceptionRows.flatMap(({ interception }) => {
    const age = now.getTime() - interception.impactAt.getTime();
    if (age < 0 || age >= DEATH_STAR.impactSeconds * 1000) return [];
    const collision = {
      x: interception.collisionX,
      y: interception.collisionY,
      z: interception.collisionZ,
    };
    const participant = ownPlayerId === interception.attackerPlayerId
      || ownPlayerId === interception.defenderPlayerId;
    return [{
      id: interception.id,
      at: interception.impactAt,
      collision,
      effectOnly: !participant && !identifiesStrategicCollision(sensors, collision),
      focusEligible: ownPlayerId === interception.defenderPlayerId,
    }];
  });
}

/**
 * ONE WORLD'S EYES: WHERE THEY ARE, AND HOW FAR THEY REACH. D123.
 *
 * Caller-specific by construction, which is why it is a parameter rather than part
 * of `TrafficSnapshot`. The snapshot is shared across every commander in the shard
 * and cached; a reach baked into it would be one player's fog served to another.
 */
export interface SensorPost extends SensorSphere {
  /** Which world's instruments these are — the intent test is per target world. */
  planetId: string;
  /** A working, Uplink-gated Telescope is present; false means naked-eye reach. */
  telescope: boolean;
  /**
   * How far it gets a real warning, with a clock on it.
   *
   * Equal to `detect` while the two radar circles are merged — see
   * `INTEL.radarContactRange`. Kept as its own field because the timed warning and
   * the detection ring are two different products that are temporarily one number,
   * and every caller that means "the clock" already says `warn`.
   */
  warn: number;
  /** Radar L4: a contact's rough size, even while it is only a question mark. */
  revealsSize: boolean;
  /** Radar L5: what KIND of craft it is, without ordinary visual identification. */
  revealsKind: boolean;
}

/**
 * The sensor posts a commander is currently running.
 *
 * `instrumentLevels` already applies the Uplink gate, so a Telescope in orbit with
 * no active Uplink reports level 0 and contributes only the naked-eye floor —
 * which is correct and is the rule D25 already states: the Uplink is the one gate
 * on the two instruments that SEE.
 */
export async function sensorPosts(
  db: Db,
  planetIds: readonly string[],
): Promise<SensorPost[]> {
  if (planetIds.length === 0) return [];
  const [rows, levels] = await Promise.all([
    db
      .select({ id: planets.id, x: planets.x, y: planets.y, z: planets.z })
      .from(planets)
      .where(inArray(planets.id, [...planetIds])),
    instrumentLevels(db, planetIds),
  ]);
  return rows.map((world) => {
    const telescope = levelOf(levels, world.id, 'TELESCOPE');
    const radar = levelOf(levels, world.id, 'RADAR');
    return {
      // `sensorSphere` is the ONE place a level becomes a radius. Everything below
      // is a disclosure flag, which is a different kind of fact and stays here.
      ...sensorSphere(
        { x: world.x, y: world.y, z: world.z },
        telescope,
        radar,
        world.id,
      ),
      planetId: world.id,
      telescope: telescope > 0,
      warn: radarRange(radar),
      revealsSize: radarRevealsSize(radar),
      revealsKind: radarRevealsComposition(radar),
    };
  });
}

export async function galaxyTraffic(
  db: Db,
  seasonId: string,
  ownPlanetId: string | null,
  now: Date,
  ownPlayerId: string | null = null,
  ownPlanetIds: string[] = ownPlanetId === null ? [] : [ownPlanetId],
): Promise<Contact[]> {
  const [snapshot, sensors, mining, epochs] = await Promise.all([
    loadTrafficSnapshot(db, seasonId, now),
    sensorPosts(db, ownPlanetIds),
    ownPlayerId === null ? Promise.resolve(null) : loadMiningSnapshot(db, seasonId, now),
    ownPlayerId === null ? Promise.resolve([]) : sensorHistoryForPlayer(db, ownPlayerId),
  ]);
  const discovered = mining === null
    ? new Set<number>()
    : discoveredAsteroidIndexes(mining, epochs, now);
  return projectGalaxyTraffic(
    snapshot,
    ownPlanetId,
    now,
    ownPlayerId,
    ownPlanetIds,
    sensors,
    discovered,
  );
}

/**
 * Apply the authoritative caller filter and current clock to one shared snapshot.
 *
 * `sensors` IS REQUIRED, AND DELIBERATELY HAS NO DEFAULT. D123. An empty array is
 * a commander who can see nothing beyond a public moment, and that is a real state
 * — a visitor before they have a world. A default would make the horizon something
 * a call site could forget, and a fog rule that is off by omission is not a fog
 * rule. Every caller states what the caller can see.
 */
export function projectGalaxyTraffic(
  snapshot: TrafficSnapshot,
  ownPlanetId: string | null,
  now: Date,
  ownPlayerId: string | null,
  ownPlanetIds: string[],
  sensors: readonly SensorPost[],
  discoveredAsteroids: ReadonlySet<number>,
): Contact[] {
  const { missionRows, miningRows, positions, tiers, landedDeathStarMissionIds } = snapshot;
  const ownedPlanets = new Set(ownPlanetIds);

  /**
   * WHAT DOES THIS COMMANDER SEE OF THIS POINT? The whole rule, in one call.
   *
   * Applied to the craft's CURRENT position rather than to its leg, so a fleet
   * crossing into a commander's circles appears when it arrives there and drops
   * out again when it leaves. That is what a sensor horizon is; a per-leg test
   * would publish the whole flight of anything that ever came close.
   *
   * The three-zone model lives in `@astera/rules/sight`, not here — the client
   * draws the same boundaries and solves for the same crossings, and the moment
   * this file held its own opinion the two pictures drifted.
   */
  const zoneAt = (point: Vec3): SensorZone => sensorZone(sensors, point);

  /**
   * WHAT THE RADAR ADDS TO A CONTACT IT CANNOT IDENTIFY.
   *
   * The ladder used to pay out only on a leg aimed AT the caller, so a maxed Radar
   * bought nothing at all about the traffic crossing its own circle. It now reads
   * the best disclosure among the posts that actually DETECT this craft: L4 gives
   * a size class, L5 gives the kind. Both stop where identification begins —
   * inside telescope reach the eye has already answered.
   *
   * Scoped to the posts whose circle the craft is really inside, because a second
   * world's Radar 5 across the disc has not detected anything and may not speak.
   */
  const radarReveal = (point: Vec3): { size: boolean; kind: boolean } => {
    let size = false;
    let kind = false;
    for (const post of sensors) {
      if (distance(post.at, point) > post.detect) continue;
      if (post.revealsSize) size = true;
      if (post.revealsKind) kind = true;
    }
    return { size, kind };
  };

  /**
   * IS THIS LEG AIMED AT ONE OF MINE, AND CLOSE ENOUGH TO KNOW IT? D126.
   *
   * Measured from the TARGET world's own radar, not from wherever the craft
   * happens to be relative to the rest of the caller's holdings — the instrument
   * that senses the intent is the one being flown at. Read at request time, so a
   * defender who raises a radar while a fleet is in the air has bought exactly
   * this, which is the same rule the timed warning already follows.
   *
   * AND IT IS A RADIUS, WHICH IS THE WHOLE POINT AND WAS THE BUG. This tested
   * `mission.distance` — the LENGTH OF THE LEG — so the two errors were opposite
   * and both wrong. A neighbour's raid was flagged from the instant it launched,
   * which hands a defender more than the timed ladder does and is exactly what
   * D9 forbids ("a forty-minute flight must not give forty minutes of warning").
   * A raid from beyond the sense radius was never flagged at all, not even in its
   * last minute, so the tier bought nothing against a distant attacker. A radius
   * is answered by where the craft IS.
   */
  const aimedAtMe = (
    mission: typeof missions.$inferSelect,
    /** Where the craft is RIGHT NOW, which is the only distance a radius means. */
    craft: Vec3,
  ): SensorPost | null => {
    if (mission.kind !== 'attack' && mission.kind !== 'death_star') return null;
    if (mission.parentMissionId !== null) return null;
    const post = sensors.find((sensor) => sensor.planetId === mission.targetPlanetId);
    if (!post) return null;
    return radarSensesIntent(post.detect, distance(post.at, craft)) ? post : null;
  };

  /**
   * THE LEG AS IT IS DRAWN, WHICH IS THE ONLY LEG ANYBODY EVER SEES. D106.
   *
   * A craft stops in ORBIT, not at a world's centre (D44) — the owner's client has
   * drawn it that way since the engagement window made an arrival something people
   * watch. The public window knew nothing about it, so it published the craft's
   * true position while the owner drew it up to two planet radii further back, and
   * the gap grew along the leg: at the end of a raid the owner watched their fleet
   * still closing while the whole galaxy watched it sit on the target and wait.
   *
   * Both sides now derive the same two endpoints from the same public figures
   * through the same function, so the pictures cannot drift apart. An outbound leg
   * starts at its home surface and stops in foreign orbit; a return starts at that
   * orbit and ends at the home surface. Clearance is part of the leg once, never a
   * per-frame projection that can flatten motion (D120).
   */
  const drawnLeg = (
    mission: typeof missions.$inferSelect,
    origin: Vec3,
    target: Vec3,
  ): { from: Vec3; to: Vec3 } => {
    const returning = mission.kind === 'return' || mission.parentMissionId !== null;
    const home = returning ? mission.targetPlanetId : mission.originPlanetId;
    const foreign = returning ? mission.originPlanetId : mission.targetPlanetId;
    const homeTier = tiers.get(home);
    const foreignTier = tiers.get(foreign);
    const surface = homeTier === undefined ? 0 : surfaceStandoff(worldRadius(homeTier));
    const orbit = foreignTier === undefined ? 0 : orbitStandoff(worldRadius(foreignTier));
    return returning
      ? visualLeg(origin, target, orbit, surface)
      : visualLeg(origin, target, surface, orbit);
  };

  const out: Contact[] = [];

  for (const { mission } of missionRows) {
    const centres = {
      origin: positions.get(mission.originPlanetId),
      target: positions.get(mission.targetPlanetId),
    };
    if (!centres.origin || !centres.target) continue;
    // Where the craft is DRAWN flying between. The true centres are still what an
    // effect is anchored to — an explosion happens at the world, not in orbit.
    const { from: origin, to: target } = drawnLeg(mission, centres.origin, centres.target);

    /**
     * A RESOLVED IMPACT IS STILL A LIVE PUBLIC MOMENT FOR ITS EFFECT WINDOW.
     *
     * A tab opened or resumed after the worker committed no longer sees an
     * in-flight mission. Without this small replay window it can never reconstruct
     * the explosion, even though every continuously open tab is watching it. The
     * exact mission id, target and server time are enough; no owner is disclosed.
     */
    const arrive = mission.arriveAt.getTime();
    const recentDeathStarImpact = mission.kind === 'death_star'
      && mission.status === 'resolved'
      && landedDeathStarMissionIds.has(mission.id)
      && now.getTime() >= arrive
      && now.getTime() < arrive + DEATH_STAR.impactSeconds * 1000;
    if (recentDeathStarImpact) {
      const impactZone = zoneAt(centres.target);
      const effectOnly = impactZone === 'NONE';
      const reveal = impactZone === 'CONTACT' ? radarReveal(centres.target) : null;
      out.push({
        id: mission.id,
        kind: impactZone === 'IDENTIFIED' ? 'death_star' : 'unknown',
        from: effectOnly
          ? centres.target
          : lerp(
              origin,
              target,
              progress(mission.departAt.getTime(), arrive, arrive - APPROACH_MS),
            ),
        to: effectOnly ? centres.target : target,
        startAt: new Date(arrive - APPROACH_MS),
        endAt: mission.arriveAt,
        landing: true,
        ...(effectOnly ? { effectOnly: true as const } : {}),
        impact: { at: mission.arriveAt, target: centres.target },
        ...(reveal?.size ? { mass: massClass(mission.fleet) } : {}),
        ...(reveal?.kind ? { silhouette: 'death_star' as const } : {}),
      });
      continue;
    }

    // The snapshot also carries recently resolved Death Stars so a real impact
    // can be replayed. An intercepted mission is resolved BEFORE its original
    // arrival and has no landed-impact ledger; it must not fall through into the
    // ordinary in-flight window or the client draws a second, ghost weapon beside
    // the dedicated interceptor scene.
    if (mission.status !== 'in_flight') continue;

    if (
      (ownPlayerId !== null && mission.ownerPlayerId === ownPlayerId)
      || (ownPlayerId === null && ownPlanetId !== null && legBelongsTo(mission, ownPlanetId))
    ) continue;

    /**
     * A RAID DOES NOT VANISH THE INSTANT IT LANDS. D52.
     *
     * `windowOf` gives up once the arrival has passed, which is right for every
     * other leg and was wrong for this one: an attack stays `in_flight` for the
     * whole engagement, and that is exactly the ten seconds worth watching. It
     * used to blink out at `arriveAt` for everybody except the attacker.
     */
    const engaging =
      mission.kind === 'attack' && now.getTime() >= arrive && now.getTime() < engagementEndsAt(arrive);

    if (engaging) {
      const endsAt = new Date(engagementEndsAt(arrive));
      const engagement = {
        arriveAt: mission.arriveAt,
        endsAt,
        target: centres.target,
      };

      /**
       * THE MOMENT BYPASSES THE HORIZON; THE SQUADRON DOES NOT. D52/D123.
       *
       * `target` is the craft's real held position in foreign orbit. Testing that
       * point — rather than the planet centre or the final minute of its leg — is
       * the same current-position rule every other contact answers to.
       */
      const zone = zoneAt(target);
      if (zone === 'NONE') {
        out.push({
          id: mission.id,
          kind: 'unknown',
          // A public point, deliberately not the orbit point: the latter would
          // reveal the incoming bearing even if the renderer drew no hull.
          from: centres.target,
          to: centres.target,
          startAt: mission.arriveAt,
          endAt: endsAt,
          landing: true,
          effectOnly: true,
          engagement,
        });
        continue;
      }

      // Once a sensor really sees the squadron, its final approach is legitimate
      // position/bearing data and lets the client hold the contact in the same
      // orbit as the attacker's own full-fidelity formation.
      const approach = lerp(
        origin,
        target,
        progress(mission.departAt.getTime(), arrive, arrive - APPROACH_MS),
      );
      const sight = {
        from: approach,
        to: target,
        startAt: new Date(arrive - APPROACH_MS),
        endAt: mission.arriveAt,
        landing: true as const,
      };
      const threatPost = aimedAtMe(mission, target);
      const inbound = threatPost ? ({ inbound: true } as const) : {};

      if (zone === 'CONTACT') {
        const reveal = radarReveal(target);
        out.push({
          id: mission.id,
          kind: 'unknown',
          ...sight,
          ...inbound,
          engagement,
          ...(reveal.size ? { mass: massClass(mission.fleet) } : {}),
          ...(reveal.kind ? { silhouette: 'fleet' as const } : {}),
        });
        continue;
      }

      out.push({
        id: mission.id,
        kind: 'fleet',
        ...sight,
        ...inbound,
        engagement,
        mass: massClass(mission.fleet),
        fleet: mission.fleet,
      });
      continue;
    }

    const slice = windowOf(origin, target, mission.departAt, mission.arriveAt, now);
    if (!slice) continue;

    // A return leg is still a fleet: the hull is what the neon names, and a
    // squadron flying home is exactly as much of a fact as one flying out.
    const kind: ContactKind = mission.kind === 'probe'
      ? 'probe'
      : mission.kind === 'death_star'
        ? 'death_star'
        : 'fleet';

    /**
     * THE FOG COVERS TRANSIT. IT DOES NOT COVER A PUBLIC MOMENT. D52.
     *
     * Every moving craft answers to the zones below. Engagement is handled above
     * only because its public EFFECT must survive `NONE`; that branch performs its
     * own zone check before disclosing any squadron. Impacts and wreck fields are
     * effects/state rather than living craft. D52 keeps the disc alive without
     * turning the public moment into a bypass around D123.
     */
    /**
     * THE THREE ZONES, AND EVERY CRAFT IN THE GALAXY GOES THROUGH THEM.
     *
     * `NONE` is a real answer and it is a DROP: outside every circle a craft does
     * not exist for this commander. That is the owner's model — not a question
     * mark, not a mote, nothing — and it is the half D125 got backwards by
     * publishing every craft in the galaxy to everybody as an anonymous return.
     *
     * There is no departure shroud any more. See `sensorZone` for why a rule that
     * deleted a craft for the first 225 units of its leg, from everybody, at every
     * instrument level, contradicted both this model and D125's own reasoning.
     */
    const zone = zoneAt(slice.from);
    if (zone === 'NONE') continue;

    const threatPost = aimedAtMe(mission, slice.from);
    const inbound = threatPost ? ({ inbound: true } as const) : {};

    if (zone === 'CONTACT') {
      /**
       * A QUESTION MARK THAT MOVES EXACTLY AS THE CRAFT MOVES.
       *
       * It carries a bearing window and whatever the Radar ladder has earned, and
       * nothing else: no kind unless L5 bought one, no origin, no destination. The
       * window is what makes it move; the absence of everything else is what makes
       * the Telescope worth buying.
       */
      const reveal = radarReveal(slice.from);
      out.push({
        id: mission.id,
        kind: 'unknown',
        ...slice,
        ...inbound,
        // L4 buys the size while the contact is still a question mark; L5 buys
        // what kind of craft it is. Both stop where the eye takes over.
        ...(reveal.size ? { mass: massClass(mission.fleet) } : {}),
        ...(reveal.kind ? { silhouette: kind } : {}),
        ...(mission.kind === 'death_star' && slice.landing === true
          ? { impact: { at: mission.arriveAt, target: centres.target } }
          : {}),
      });
      continue;
    }

    out.push({
      id: mission.id,
      kind,
      ...slice,
      ...inbound,
      /**
       * THE DETONATION IS ANNOUNCED BEFORE IT HAPPENS, AND ONLY ONCE THE
       * DESTINATION IS ALREADY CONCEDED. D106.
       *
       * `landing` is true only inside the final coast, where the window's own far
       * end IS the arrival — so the target is public at that point whatever this
       * field does, and D52 makes the same concession for a raid. What it buys is
       * that every watching client ARMS the explosion for an instant it already
       * knows, instead of having to notice afterwards that a mission vanished. A
       * client that misses the moment still gets it: the resolved mission is
       * republished for the length of the effect, above.
       */
      ...(mission.kind === 'death_star' && slice.landing === true
        ? { impact: { at: mission.arriveAt, target: centres.target } }
        : {}),
      // A silhouette, and never the loot it may be carrying home.
      mass: massClass(mission.fleet),
      // Sight resolves the actual hulls and their counts. Radar never reaches
      // this branch, so an exact manifest cannot leak into a CONTACT payload.
      ...(kind === 'fleet' ? { fleet: mission.fleet } : {}),
    });
  }

  /**
   * A DRILL IS A CRAFT, AND IT ANSWERS TO THE SAME THREE ZONES AS EVERY OTHER ONE.
   *
   * TWO GATES, AND THEY ANSWER TWO DIFFERENT QUESTIONS. This used to be one gate
   * doing both jobs badly: an undiscovered rock dropped the whole run, so a
   * Prospector flying past a commander's own capital was invisible to them because
   * of a fact about a rock somewhere else.
   *
   *   · THE ZONE decides whether you can see the CRAFT. Same rule as a fleet or a
   *     probe: nothing outside your circles, a question mark inside the radar, the
   *     drill itself inside the telescope.
   *   · ROCK DISCOVERY decides whether you get the ROUTE. The mining race is meant
   *     to be public (D19) — but only once you have found the rock being raced
   *     for, or the line would hand over a schedule the sensor history gates.
   *
   * So a drill you can see but whose rock you have not found is exactly what it
   * looks like from a window: a craft going somewhere, and you do not know where.
   */
  for (const { run } of miningRows) {
    if (ownedPlanets.has(run.planetId)) continue;
    const home = positions.get(run.planetId);
    if (!home) continue;
    const meet = { x: run.interceptX, y: run.interceptY, z: run.interceptZ };
    const returning = run.status === 'returning';

    const rawFrom = returning ? meet : home;
    const rawTo = returning ? home : meet;
    const homeTier = tiers.get(run.planetId);
    const surface = homeTier === undefined ? 0 : surfaceStandoff(worldRadius(homeTier));
    const { from, to } = returning
      ? visualLeg(rawFrom, rawTo, 0, surface)
      : visualLeg(rawFrom, rawTo, surface, 0);
    const departAt = returning ? run.arriveAt : run.departAt;
    const arriveAt = returning ? (run.homeAt ?? run.arriveAt) : run.arriveAt;

    const slice = windowOf(from, to, departAt, arriveAt, now);
    if (!slice) continue;

    const zone = zoneAt(slice.from);
    if (zone === 'NONE') continue;

    /**
     * A SALVAGE RUN IS NOT A MINING RUN, AND THIS SAID IT WAS. D32.
     *
     * `harvest` has been in `ContactKind` since D32 and nothing ever produced one:
     * every row in this table went out as `mining`, so a craft flying to a wreck
     * field was drawn in the miner's amber and its panel said "Somebody is mining"
     * over the line "the rock, the route and the clock" — pointing at a rock that
     * was not its target.
     *
     * Read off the COLUMN rather than off `targetKind`, for the same reason
     * `resolveRun` does: the column is what the CHECK constraint guarantees, and
     * the text field beside it is a denormalisation.
     */
    const kind: ContactKind = run.debrisFieldId === null ? 'mining' : 'harvest';

    if (zone === 'CONTACT') {
      const reveal = radarReveal(slice.from);
      out.push({
        id: run.id,
        kind: 'unknown',
        ...slice,
        // Mining and salvage craft obey the same Radar ladder as every other
        // contact: L4 reveals rough mass, while L5 identifies the hull family.
        ...(reveal.size ? { mass: massClass({ PROSPECTOR: run.craft }) } : {}),
        ...(reveal.kind ? { silhouette: kind } : {}),
        // No `craft`, no `route`, no clock. A radar return is a position.
      });
      continue;
    }

    const discovered = run.asteroidIndex === null
      || discoveredAsteroids.has(run.asteroidIndex);

    out.push({
      id: run.id,
      kind,
      ...slice,
      // The line and the clock are the RACE, and the race needs the rock found.
      ...(discovered
        ? {
            route: { from, to, departAt, arriveAt },
            minutesRemaining: Math.max(0, (arriveAt.getTime() - now.getTime()) / 60_000),
          }
        : {}),
      craft: run.craft,
      // `minedAlloy` and `minedCrystal` are deliberately absent. What a run is
      // bringing back is the owner's, and it is on `/api/mining` for them alone.
    });
  }

  return out;
}
