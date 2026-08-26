import { and, eq, gte, inArray, ne, or } from 'drizzle-orm';
import {
  DEATH_STAR,
  coreTier,
  engagementEndsAt,
  orbitStandoff,
  surfaceStandoff,
  visualLeg,
  worldRadius,
  type Fleet,
  type Vec3,
} from '@astera/rules';
import type { Db } from '../db/client.js';
import { buildings, miningRuns, missions, planets } from '../db/schema.js';
import { legBelongsTo } from './flight.js';

/**
 * TRAFFIC — the galaxy is busy, and now you can see it.
 *
 * REWRITTEN ON THE OWNER'S DECISION (D24). The first version showed other people's
 * craft as anonymous motes: offset by more than the planets are spaced, visible
 * only through the middle 60% of a flight, carrying no kind and no direction. It
 * protected the fog completely and it made the disc feel empty — the one thing a
 * galaxy of two hundred real people should never feel.
 *
 * The owner's instruction is exact: everything moving out there is visible to
 * everybody, in real time, with its neon, going and coming back — and the only
 * thing that stays private is the ROUTE LINE, the thread that says where a craft
 * came from and where it is going. Drills are the stated exception: a mining run
 * is public in full, line and clock included, because it is a race for a rock
 * everyone can already see.
 *
 * SO THE RULE IS NOW: POSITION IS PUBLIC, INTENT IS NOT.
 *
 * What that means in the payload, and every line of it is deliberate:
 *
 *   · A BEARING WINDOW, NOT A ROUTE. A contact carries where it is now and where
 *     it will be a few minutes from now — enough for the client to animate it
 *     smoothly between polls, and nothing more. The endpoints never leave the
 *     server, so there is no field a modified client could read to find out which
 *     world a fleet left or which one it is about to land on. The window is also
 *     clamped short of arrival, so watching one to the end never marks the target.
 *   · KIND AND CONTENT, BOTH — INCLUDING TO THE WORLD IT IS AIMED AT. Whether it is
 *     a warship, a scout or a mining craft is public — that is what the neon colours
 *     say — and so is what is in it: eight Wasps and a Hauler reads as eight Wasps
 *     and a Hauler to anybody who focuses it, the defender included. That is a
 *     second owner decision on top of the first, and it is a real concession by the
 *     Radar ladder, whose L4 sold a size estimate.
 *     RE-CONFIRMED ON REVIEW, because it looks like a leak and is not one. What the
 *     Radar sells is ATTRIBUTION: a contact is a craft moving out there, and knowing
 *     that it is coming for YOU, and how long you have, is the thing being bought. A
 *     defender may piece it together from a short hop and cannot from a long one,
 *     and that asymmetry is the game. `pendingThreads` is the ATTRIBUTED payload and
 *     still carries no composition — see the note on its `fleet` field for why the
 *     two rules are consistent rather than contradictory.
 *   · CARGO IS NEVER PUBLIC. What a Prospector is bringing home, and what a raider
 *     took, belong to the owner alone. A contact carries no ore, no loot and no
 *     resource figure of any kind — those live on `/api/mining` and the battle
 *     report, both of which answer only to the player they belong to.
 *   · NO OWNER AND NO WORLD. There is no planet id, no player id and no name in
 *     here. You can see what is flying; you cannot see whose it is.
 *
 * WHAT IT COSTS, STATED RATHER THAN DISCOVERED LATER.
 *
 * A departure is visible now and was not before, and a composition is readable
 * where it used to cost Radar L4. Both are real concessions by the intel ladder.
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
 * How far ahead a contact's motion is published, in minutes.
 *
 * Long enough that a missed read does not freeze a craft mid-flight — the client
 * wakes on `endAt` to ask for the next window, with a sixty-second net under it —
 * and short enough that the window is a heading rather than a route. The value is
 * not sensitive: extending it reveals nothing an observer could not get by
 * watching the same craft for the same length of time.
 */
const BEARING_MINUTES = 4;

/**
 * AND NEVER MORE THAN THIS SHARE OF WHAT IS LEFT TO FLY. D63.
 *
 * The ceiling above is an absolute duration, and an absolute duration stops being
 * a heading the moment flights get shorter than it. At D63's hull speeds a mean
 * leg is four minutes — exactly `BEARING_MINUTES` — so the published window
 * covered the whole remaining flight and its end point WAS the destination. That
 * is a route, and "a contact carries a bearing window, never a route" is the fog
 * rule this file exists to enforce.
 *
 * Expressed as a share so it holds at any speed: whatever the tempo, an observer
 * is shown where a craft will be part of the way from here, never where it stops.
 */
const BEARING_SHARE = 0.5;

/**
 * AND NEVER SHORTER THAN ONE REFETCH, WHATEVER THE SHARE WORKS OUT TO.
 *
 * The client draws a craft by interpolating inside the published window and CLAMPS
 * at its end, so a window shorter than the gap between reads is a craft that stops
 * dead and waits — the exact failure D52 was written to delete, arriving at the
 * most dramatic moment there is, the seconds before a raid lands.
 *
 * `useTraffic` refetches on a sixty-second net, so that is the floor. Its effect is
 * that a craft inside its last minute has its window clamped to the arrival — the
 * final approach IS given away, and that is the same concession D52 already makes
 * by publishing a raid that has landed. A craft a minute out is visibly landing
 * somewhere; the fog rule is about the flight, not the last few seconds of it.
 */
const MIN_COAST_MS = 60_000;

/**
 * How much of the final approach an engaging contact publishes.
 *
 * Only so the client has a DIRECTION: the squadron is held off the world along the
 * line it came in on, and two points are the cheapest way to say which line that
 * is. A minute of a flight everyone could already watch.
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
 * the most watchable thing in the galaxy, so it is PUBLIC. The window runs to the
 * instant of arrival, and then the contact keeps being published through the
 * engagement with the world it is hitting named, so everybody sees the battle. A
 * margin protecting the destination for the last forty-five seconds of a flight
 * that ends in a public bombardment protects nothing at all.
 */

/**
 * `harvest` is a craft flying to a wreck field. D32.
 *
 * Public in full, exactly like a mining run: both are unarmed craft going to a
 * place everybody can already see, so hiding the route would conceal nothing and
 * cost the disc a visible race.
 */
export type ContactKind = 'fleet' | 'probe' | 'death_star' | 'mining' | 'harvest';

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
   * A Prospector's run is a public race for a rock everybody can see, so hiding
   * where it is going would withhold half of a contest the design wants people to
   * feel. Present for no other kind — this is the field that would give away a
   * raid, and `kind === 'mining'` is the only branch that ever sets it.
   */
  route?: { from: Vec3; to: Vec3; departAt: Date; arriveAt: Date };
  /** Minutes until it gets there. Mining only, for the same reason. */
  minutesRemaining?: number;
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
   * WHAT IT DISCLOSES, AND WHY THAT IS NOTHING NEW. `target` is a planet's
   * coordinates, which are public on `/api/galaxy` for every world in the disc.
   * The craft is standing on top of it, so its position already said so. The
   * bearing it came in on was visible for the whole flight. There is still no
   * owner, no origin and no name in this payload, and the raid is ten seconds from
   * resolving into a battle report and a debris field that are public anyway (D32).
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
   * What is in it. Public since D24.
   *
   * Hulls and counts, and nothing else — never the cargo. A fleet coming home from
   * a raid looks exactly like one going out, because what it is carrying is the
   * owner's business.
   */
  fleet?: Fleet;
  /** How many craft are on a mining run. The public half of `fleet`. */
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
  const [missionRows, miningRows] = await Promise.all([
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
  ]);

  const ids = new Set<string>();
  for (const { mission } of missionRows) {
    ids.add(mission.originPlanetId);
    ids.add(mission.targetPlanetId);
  }
  for (const { run } of miningRows) ids.add(run.planetId);
  if (ids.size === 0) return { missionRows, miningRows, positions: new Map(), tiers: new Map() };

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
  return { missionRows, miningRows, positions, tiers };
}

export async function galaxyTraffic(
  db: Db,
  seasonId: string,
  ownPlanetId: string | null,
  now: Date,
  ownPlayerId: string | null = null,
  ownPlanetIds: string[] = ownPlanetId === null ? [] : [ownPlanetId],
): Promise<Contact[]> {
  const snapshot = await loadTrafficSnapshot(db, seasonId, now);
  return projectGalaxyTraffic(snapshot, ownPlanetId, now, ownPlayerId, ownPlanetIds);
}

/** Apply the authoritative caller filter and current clock to one shared snapshot. */
export function projectGalaxyTraffic(
  snapshot: TrafficSnapshot,
  ownPlanetId: string | null,
  now: Date,
  ownPlayerId: string | null = null,
  ownPlanetIds: string[] = ownPlanetId === null ? [] : [ownPlanetId],
): Contact[] {
  const { missionRows, miningRows, positions, tiers } = snapshot;
  const ownedPlanets = new Set(ownPlanetIds);

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
      && now.getTime() >= arrive
      && now.getTime() < arrive + DEATH_STAR.impactSeconds * 1000;
    if (recentDeathStarImpact) {
      out.push({
        id: mission.id,
        kind: 'death_star',
        from: lerp(
          origin,
          target,
          progress(mission.departAt.getTime(), arrive, arrive - APPROACH_MS),
        ),
        to: target,
        startAt: new Date(arrive - APPROACH_MS),
        endAt: mission.arriveAt,
        landing: true,
        impact: { at: mission.arriveAt, target: centres.target },
        fleet: mission.fleet,
      });
      continue;
    }

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
      // The final approach, so the client has the bearing the fleet came in on and
      // can hold it off the world exactly as the attacker's own client does.
      const approach = lerp(origin, target, progress(mission.departAt.getTime(), arrive, arrive - APPROACH_MS));
      out.push({
        id: mission.id,
        kind: 'fleet',
        from: approach,
        to: target,
        startAt: new Date(arrive - APPROACH_MS),
        endAt: mission.arriveAt,
        engagement: {
          arriveAt: mission.arriveAt,
          endsAt: new Date(engagementEndsAt(arrive)),
          target: centres.target,
        },
        fleet: mission.fleet,
      });
      continue;
    }

    const slice = windowOf(origin, target, mission.departAt, mission.arriveAt, now);
    if (!slice) continue;

    out.push({
      id: mission.id,
      // A return leg is still a fleet: the hull is what the neon names, and a
      // squadron flying home is exactly as much of a fact as one flying out.
      kind: mission.kind === 'probe'
        ? 'probe'
        : mission.kind === 'death_star'
          ? 'death_star'
          : 'fleet',
      ...slice,
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
      // Composition, and never the loot it may be carrying home.
      fleet: mission.fleet,
    });
  }

  /**
   * MINING RUNS, IN FULL. The owner's stated exception.
   *
   * The rock is public, the ore left in it is public, and the whole point of D19
   * is that two players race for it and both know they were raced. Hiding where a
   * Prospector is heading would hide the race itself.
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

    out.push({
      id: run.id,
      /**
       * A SALVAGE RUN IS NOT A MINING RUN, AND THIS SAID IT WAS. D32.
       *
       * `harvest` has been in `ContactKind` since D32 and nothing ever produced
       * one: every row in this table went out as `mining`, so a craft flying to a
       * wreck field was drawn in the miner's amber and its panel said "Somebody is
       * mining" over the line "the rock, the route and the clock" — pointing at a
       * rock that was not its target. The client has carried the paler amber, the
       * `Salvage run` title and the schema branch for it the whole time.
       *
       * Read off the COLUMN rather than off `targetKind`, for the same reason
       * `resolveRun` does: the column is what the CHECK constraint guarantees, and
       * the text field beside it is a denormalisation.
       */
      kind: run.debrisFieldId === null ? 'mining' : 'harvest',
      ...slice,
      route: { from, to, departAt, arriveAt },
      minutesRemaining: Math.max(0, (arriveAt.getTime() - now.getTime()) / 60_000),
      craft: run.craft,
      // `minedAlloy` and `minedCrystal` are deliberately absent. What a run is
      // bringing back is the owner's, and it is on `/api/mining` for them alone.
    });
  }

  return out;
}
