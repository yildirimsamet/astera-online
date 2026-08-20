import { and, eq, inArray, ne } from 'drizzle-orm';
import { engagementEndsAt, type Fleet, type Vec3 } from '@astera/rules';
import type { Db } from '../db/client.js';
import { miningRuns, missions, planets } from '../db/schema.js';

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
 * Long enough that a missed poll does not freeze a craft mid-flight — traffic
 * refetches every twenty seconds — and short enough that the window is a heading
 * rather than a route. The value is not sensitive: extending it reveals nothing an
 * observer could not get by watching the same craft for the same length of time.
 */
const BEARING_MINUTES = 4;

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
 * of the window has always been the craft's true position, refreshed every twenty
 * seconds until it lands. It withheld a few hundred metres of a flight anyone
 * could already watch, and charged a dead stop for it.
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
export type ContactKind = 'fleet' | 'probe' | 'mining' | 'harvest';

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
 */
function windowOf(
  from: Vec3,
  to: Vec3,
  departAt: Date,
  arriveAt: Date,
  now: Date,
): { from: Vec3; to: Vec3; startAt: Date; endAt: Date } | null {
  const depart = departAt.getTime();
  const arrive = arriveAt.getTime();
  if (arrive <= depart) return null;
  if (now.getTime() < depart || now.getTime() >= arrive) return null;

  const startAt = now;
  // Never past the landing itself, so the client's coast cannot carry a craft
  // through the world it is arriving at.
  const end = Math.min(now.getTime() + BEARING_MINUTES * 60_000, arrive);

  return {
    from: lerp(from, to, progress(depart, arrive, startAt.getTime())),
    to: lerp(from, to, progress(depart, arrive, end)),
    startAt,
    endAt: new Date(end),
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
 */
const ownsLeg = (m: typeof missions.$inferSelect, planetId: string): boolean =>
  m.kind === 'return' || m.parentMissionId !== null
    ? m.targetPlanetId === planetId
    : m.originPlanetId === planetId;

/**
 * Everything in the air in this season, at the fidelity the galaxy is entitled to.
 *
 * The caller's OWN craft are excluded: those are drawn from the player's own
 * payload at full fidelity, complete with their route, and a second anonymous copy
 * beside the real one would be both confusing and a free calibration sample. What
 * counts as "own" is `ownsLeg`, and the distinction matters — see above.
 */
export async function galaxyTraffic(
  db: Db,
  seasonId: string,
  ownPlanetId: string,
  now: Date,
): Promise<Contact[]> {
  const [missionRows, miningRows] = await Promise.all([
    db
      .select({ mission: missions })
      .from(missions)
      .where(and(eq(missions.seasonId, seasonId), eq(missions.status, 'in_flight'))),
    db
      .select({ run: miningRuns })
      .from(miningRuns)
      .where(
        and(
          eq(miningRuns.seasonId, seasonId),
          ne(miningRuns.status, 'done'),
          ne(miningRuns.planetId, ownPlanetId),
        ),
      ),
  ]);

  const ids = new Set<string>();
  for (const { mission } of missionRows) {
    ids.add(mission.originPlanetId);
    ids.add(mission.targetPlanetId);
  }
  for (const { run } of miningRows) ids.add(run.planetId);
  if (ids.size === 0) return [];

  const planetRows = await db
    .select({ id: planets.id, x: planets.x, y: planets.y, z: planets.z })
    .from(planets)
    .where(inArray(planets.id, [...ids]));
  const positions = new Map<string, Vec3>(
    planetRows.map((p) => [p.id, { x: p.x, y: p.y, z: p.z }]),
  );

  const out: Contact[] = [];

  for (const { mission } of missionRows) {
    if (ownsLeg(mission, ownPlanetId)) continue;
    const origin = positions.get(mission.originPlanetId);
    const target = positions.get(mission.targetPlanetId);
    if (!origin || !target) continue;

    /**
     * A RAID DOES NOT VANISH THE INSTANT IT LANDS. D52.
     *
     * `windowOf` gives up once the arrival has passed, which is right for every
     * other leg and was wrong for this one: an attack stays `in_flight` for the
     * whole engagement, and that is exactly the ten seconds worth watching. It
     * used to blink out at `arriveAt` for everybody except the attacker.
     */
    const arrive = mission.arriveAt.getTime();
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
          target,
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
      kind: mission.kind === 'probe' ? 'probe' : 'fleet',
      ...slice,
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
    const home = positions.get(run.planetId);
    if (!home) continue;
    const meet = { x: run.interceptX, y: run.interceptY, z: run.interceptZ };
    const returning = run.status === 'returning';

    const from = returning ? meet : home;
    const to = returning ? home : meet;
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
