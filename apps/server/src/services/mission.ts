import { and, eq, gt, sql } from 'drizzle-orm';
import {
  canAttack,
  distance,
  engagementEndsAt,
  fleetCount,
  fleetSpeed,
  fleetSpeedMult,
  fleetTravelMinutes,
  maxRadarRange,
  radarLead,
  type Fleet,
  type HullId,
  HULLS,
} from '@blindspace/rules';
import { ABUSE } from '@blindspace/rules';
import { addMinutes, type Clock } from '../clock.js';
import type { Db, Tx } from '../db/client.js';
import {
  battleReports,
  buildings,
  missions,
  planets,
  players,
  units,
} from '../db/schema.js';
import { assertFreeBay } from './flight.js';
import { GameError, loadLocked, setUnits } from './planet.js';
import { schedule } from '../worker/queue.js';

export interface LaunchResult {
  missionId: string;
  arriveAt: Date;
  /** Minutes the origin planet is left weakened — the line the UI leads with. */
  exposureMinutes: number;
  homeDefenceAfter: number;
}

/**
 * Launch an attack. IRREVERSIBLE — there is no recall.
 *
 * Units move from `home` to a row keyed by the mission id, so they are still
 * owned by the planet (and still counted in Wealth) but are demonstrably not
 * defending it. The mission's `fleet` jsonb is a snapshot for the battle report;
 * the `units` rows remain the single source of truth for ownership.
 */
export async function launchAttack(
  db: Db,
  originPlanetId: string,
  targetPlanetId: string,
  requested: Fleet,
  clock: Clock,
): Promise<LaunchResult> {
  if (originPlanetId === targetPlanetId) {
    throw new GameError('SELF_ATTACK', 'You cannot attack your own planet');
  }
  // Structure first, semantics second: fleetCount() drops non-positive entries,
  // so checking it first would report a malformed request as an empty one.
  for (const [hull, n] of Object.entries(requested) as [HullId, number][]) {
    if (!Number.isInteger(n) || n < 0) {
      throw new GameError('BAD_FLEET', `Bad ship count for ${hull}`);
    }
  }
  if (fleetCount(requested) === 0) {
    throw new GameError('EMPTY_FLEET', 'Send at least one ship');
  }

  return db.transaction(async (tx) => {
    const origin = await loadLocked(tx, originPlanetId, clock);

    for (const [hull, n] of Object.entries(requested) as [HullId, number][]) {
      if (HULLS[hull].ground) throw new GameError('GROUND_UNIT', `${HULLS[hull].name}s cannot travel`);
      // Belt and braces: the route schema cannot name a Prospector either. D19
      // keeps mining craft out of the fog layer, and the cheapest way to be sure is
      // for every path into an attack fleet to refuse them independently.
      if (hull === 'PROSPECTOR') {
        throw new GameError('NOT_A_WARSHIP', 'Prospectors mine; they do not raid');
      }
      if ((origin.homeFleet[hull] ?? 0) < n) {
        throw new GameError('NOT_ENOUGH_SHIPS', `Not enough ${hull} at home`);
      }
    }
    if (fleetSpeed(requested) <= 0) {
      throw new GameError('IMMOBILE_FLEET', 'That fleet cannot travel');
    }

    const [target] = await tx.select().from(planets).where(eq(planets.id, targetPlanetId));
    if (!target) throw new GameError('PLANET_NOT_FOUND', 'No such planet', 404);
    if (target.seasonId !== origin.seasonId) {
      throw new GameError('CROSS_SEASON', 'That planet is in another galaxy');
    }

    /**
     * ONE FLEET PER TARGET AT A TIME. Owner decision.
     *
     * Counted under the origin planet's lock, so two launches racing each other
     * cannot both see a clear board.
     *
     * Both legs count, and that is the point: sending a second wave while the first
     * is still in the air — or still coming home — turns a raid into a stream, which
     * defeats the bash limit (three hits per twelve hours is meaningless if all
     * three land in the same minute) and removes the decision the exposure window
     * exists to create. Commit, then wait to find out. That is the game.
     */
    // Bays first: "you have nothing free" is a truer refusal than "not at that
    // target", and it is the one the player can act on. D28.
    await assertFreeBay(tx, originPlanetId, origin.buildings.CORE);

    const alreadyOut = await tx
      .select({ id: missions.id })
      .from(missions)
      .where(
        and(
          eq(missions.status, 'in_flight'),
          eq(missions.kind, 'attack'),
          eq(missions.originPlanetId, originPlanetId),
          eq(missions.targetPlanetId, targetPlanetId),
        ),
      )
      .limit(1);

    const comingBack = await tx
      .select({ id: missions.id })
      .from(missions)
      .where(
        and(
          eq(missions.status, 'in_flight'),
          eq(missions.kind, 'return'),
          // A return leg flies backwards: its origin is the planet that was raided.
          eq(missions.originPlanetId, targetPlanetId),
          eq(missions.targetPlanetId, originPlanetId),
        ),
      )
      .limit(1);

    if (alreadyOut.length > 0 || comingBack.length > 0) {
      throw new GameError(
        'FLEET_ALREADY_COMMITTED',
        'You already have a fleet committed to that planet',
        409,
      );
    }

    const [me] = await tx.select().from(players).where(eq(players.id, origin.playerId));
    const [them] = await tx.select().from(players).where(eq(players.id, target.playerId));
    if (!me || !them) throw new GameError('PLAYER_NOT_FOUND', 'No such player', 404);

    const since = addMinutes(origin.now, -ABUSE.bashWindowMinutes);
    const recent = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(battleReports)
      .where(
        and(
          eq(battleReports.attackerPlayerId, me.id),
          eq(battleReports.defenderPlayerId, them.id),
          gt(battleReports.createdAt, since),
        ),
      );

    /**
     * THE BAND IS MEASURED IN CORE LEVELS, SO BOTH HAVE TO BE READ. D49.
     *
     * The attacker's is already under the lock `loadLocked` holds. The defender's
     * is one row, and it is read UNLOCKED on purpose: a Core upgrade landing in
     * the same instant as a launch can only move a target one level, the tier is
     * a three-level bucket, and taking a second planet's row lock here would
     * introduce exactly the deadlock ordering the architecture rules forbid for
     * two-planet operations.
     */
    const [targetCore] = await tx
      .select({ level: buildings.level })
      .from(buildings)
      .where(and(eq(buildings.planetId, targetPlanetId), eq(buildings.type, 'CORE')))
      .limit(1);

    const gate = canAttack(
      { playerId: me.id, coreLevel: origin.buildings.CORE },
      { playerId: them.id, coreLevel: targetCore?.level ?? 1 },
      recent[0]?.n ?? 0,
    );
    if (!gate.ok) {
      throw new GameError(gate.reason ?? 'FORBIDDEN', describeRefusal(gate.reason), 403);
    }

    const dist = distance(origin, target);
    // The Beacon in orbit, if there is one. D25.
    const oneWay = fleetTravelMinutes(dist, requested, fleetSpeedMult(origin.orbit));
    const arriveAt = addMinutes(origin.now, oneWay);
    /**
     * THE ENGAGEMENT. D44.
     *
     * The fleet is over the target at `arriveAt`; the battle is settled ten
     * seconds later. Only the RESOLUTION moves — `arriveAt` is what both sides
     * read, what the radar counts down to, and what the client flies the craft
     * against, and moving it would have quietly rewritten the ETA of every raid
     * in the game to pay for a piece of theatre.
     *
     * The mission stays `in_flight` across the window, which is the honest state:
     * the ships are committed, nothing is decided, and every guard that reads
     * `in_flight` — one fleet per target, the flight bay, the reaper — keeps
     * holding for exactly as long as the fleet is actually there.
     */
    const resolveAt = new Date(engagementEndsAt(arriveAt.getTime()));

    const [mission] = await tx
      .insert(missions)
      .values({
        seasonId: origin.seasonId,
        kind: 'attack',
        originPlanetId,
        targetPlanetId,
        fleet: requested,
        distance: dist,
        departAt: origin.now,
        arriveAt,
      })
      .returning();

    // Move the ships off the home stack, in the same transaction.
    const remaining: Fleet = { ...origin.homeFleet };
    for (const [hull, n] of Object.entries(requested) as [HullId, number][]) {
      remaining[hull] = (remaining[hull] ?? 0) - n;
    }
    await setUnits(tx, originPlanetId, remaining, 'home');
    await setUnits(tx, originPlanetId, requested, mission!.id);

    await schedule(tx, {
      seasonId: origin.seasonId,
      kind: 'mission_arrival',
      refId: mission!.id,
      resolveAt,
    });

    /**
     * THE RADAR WARNING IS SCHEDULED FOR EVERY RAID, AND ITS LEVEL IS READ LATER. D45.
     *
     * D9 is unchanged: the warning fires at `arriveAt − lead`, never at launch.
     * What changed is WHOSE LEVEL decides the lead, and when it is read.
     *
     * This used to read the target's radar here and freeze the answer into the
     * event's payload, which was wrong in both directions and measurably so. A
     * defender with no radar got no event at all, so buying one while a fleet was
     * in the air bought nothing — while `pendingThreads`, which reads the live
     * level, put "inbound fleet" on their strip. Two surfaces, one fact, opposite
     * answers. And a defender who raised Radar 3 → 5 mid-flight was warned with an
     * L3 payload: no size estimate, no composition, for a ladder rung they had
     * already paid for.
     *
     * So the event is now scheduled at the earliest instant ANY radar could fire —
     * the moment this fleet crosses inside the WIDEST reach the ladder sells — and
     * `onRadarWarning` reads the level at the moment it runs, hopping down
     * `RADAR_RANGES` if the defender has not earned the reach it is holding. One
     * event per raid instead of one per radar-equipped target; at 50 worlds that
     * is noise.
     *
     * D49 MADE THAT INSTANT DEPEND ON THIS FLEET. A radar is a circle now, so when
     * a raid crosses it is a function of the leg and of the speed the attacker
     * chose — which is the entire point, and why the widest crossing is computed
     * here rather than being one constant subtracted from every arrival.
     */
    const warnAt = addMinutes(arriveAt, -radarLead(maxRadarRange(), dist, oneWay));
    await schedule(tx, {
      seasonId: origin.seasonId,
      kind: 'radar_warning',
      refId: mission!.id,
      resolveAt: warnAt > origin.now ? warnAt : origin.now,
    });

    const homeDefenceAfter =
      fleetCount(remaining) + fleetCount(origin.ground);

    return {
      missionId: mission!.id,
      arriveAt,
      exposureMinutes: oneWay * 2,
      homeDefenceAfter,
    };
  });
}

function describeRefusal(reason?: string): string {
  switch (reason) {
    case 'TIER_BAND':
      return 'That world is more than two development tiers from yours';
    case 'BASH_LIMIT':
      return 'You have hit this planet too many times recently';
    case 'SELF':
      return 'You cannot attack your own planet';
    default:
      return 'You cannot attack that planet';
  }
}

/** Ships belonging to a mission, read from the authoritative units rows. */
export async function fleetOfMission(tx: Tx, planetId: string, missionId: string): Promise<Fleet> {
  const rows = await tx
    .select()
    .from(units)
    .where(and(eq(units.planetId, planetId), eq(units.location, missionId)));
  const fleet: Fleet = {};
  for (const r of rows) if (r.count > 0) fleet[r.hull] = r.count;
  return fleet;
}

export async function clearMissionUnits(tx: Tx, planetId: string, missionId: string): Promise<void> {
  await tx.delete(units).where(and(eq(units.planetId, planetId), eq(units.location, missionId)));
}
