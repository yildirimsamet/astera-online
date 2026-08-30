import { and, eq, gt, sql } from 'drizzle-orm';
import {
  ABUSE,
  MULTI_WORLD,
  canAttack,
  distance,
  engagementEndsAt,
  fleetCount,
  fleetSpeed,
  fleetSpeedMult,
  fleetTravelExact,
  maxRadarRange,
  missionFuel,
  type Fleet,
  type HullId,
  HULLS,
} from '@astera/rules';
import { addMinutes, type Clock } from '../clock.js';
import type { Db, Tx } from '../db/client.js';
import {
  battleReports,
  buildings,
  missions,
  planets,
  players,
  seasons,
  units,
} from '../db/schema.js';
import { assertFreeBay } from './flight.js';
import { assertFuel } from './fuel.js';
import {
  assertSeasonOpenThrough,
  assertWorldOperational,
  GameError,
  loadLocked,
  saveResources,
  setUnits,
} from './planet.js';
import { techOf } from './researchState.js';
import { schedule } from '../worker/queue.js';
import { publishShard } from '../stream/bus.js';
import { pendingThreads, type PendingThread } from './session.js';
import { inboundRadarLead } from './radar.js';
import { planetView, type PlanetView } from './planetView.js';
import { lockWorlds } from './ownership.js';
import { prepareClanAttack, recordClanAttack } from './clanCombat.js';
import { fleetChangesWatch, publishWatchChanges } from './watchEvents.js';

export interface LaunchResult {
  missionId: string;
  arriveAt: Date;
  /** Minutes the origin planet is left weakened — the line the UI leads with. */
  exposureMinutes: number;
  homeDefenceAfter: number;
  /**
   * THE FLEET IS DRAWN ON THE FRAME THE ANSWER LANDS. D53.
   *
   * A launch used to answer with four numbers, and the squadron did not appear on
   * the disc until a second request came back with it — so the most committed act
   * in the game, the one thing that cannot be recalled, was followed by the disc
   * doing nothing for a round trip.
   *
   * Both lists come back instead, built inside the launching transaction and so
   * identical in shape to the payloads they replace in the cache: `pending`
   * because it holds the new flight, `planet` because the ships have left the home
   * stack and a bay is now in use.
   */
  pending: PendingThread[];
  planet: PlanetView;
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
  expectedPlayerId?: string,
): Promise<LaunchResult> {
  if (originPlanetId === targetPlanetId) {
    throw new GameError('SELF_ATTACK', 'You cannot attack your own planet');
  }
  // Structure first, semantics second: fleetCount() drops non-positive entries,
  // so checking it first would report a malformed request as an empty one.
  for (const [hull, n] of Object.entries(requested) as [HullId, number][]) {
    if (!Number.isInteger(n) || n < 0) {
      throw new GameError('BAD_FLEET', `Bad ship count for ${hull}`, 400, { hull });
    }
  }
  if (fleetCount(requested) === 0) {
    throw new GameError('EMPTY_FLEET', 'Send at least one ship');
  }

  return db.transaction(async (tx) => {
    await lockWorlds(tx, [originPlanetId, targetPlanetId]);
    const origin = await loadLocked(tx, originPlanetId, clock, { expectedPlayerId });
    assertWorldOperational(origin);

    for (const [hull, n] of Object.entries(requested) as [HullId, number][]) {
      if (HULLS[hull].ground) {
        // The ID, not the English name: the client holds its own name for every
        // hull and would otherwise print "Bastion" on a Turkish screen.
        throw new GameError('GROUND_UNIT', `${HULLS[hull].name}s cannot travel`, 400, { hull });
      }
      // Belt and braces: the route schema cannot name a Prospector either. D19
      // keeps mining craft out of the fog layer, and the cheapest way to be sure is
      // for every path into an attack fleet to refuse them independently.
      if (hull === 'PROSPECTOR') {
        throw new GameError('NOT_A_WARSHIP', 'Prospectors mine; they do not raid');
      }
      if ((origin.homeFleet[hull] ?? 0) < n) {
        throw new GameError('NOT_ENOUGH_SHIPS', `Not enough ${hull} at home`, 400, { hull });
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
    if (!me) throw new GameError('PLAYER_NOT_FOUND', 'No such player', 404);
    if (target.protectedUntil !== null && target.protectedUntil > origin.now) {
      throw new GameError('OCCUPATION_PROTECTED', 'That world is protected', 409, {
        until: target.protectedUntil.toISOString(),
      });
    }
    if (target.recoveryUntil !== null && target.recoveryUntil > origin.now) {
      throw new GameError('WORLD_RECOVERING', 'That world is recovering', 409, {
        until: target.recoveryUntil.toISOString(),
      });
    }
    const [them] = target.controllerPlayerId
      ? await tx.select().from(players).where(eq(players.id, target.controllerPlayerId))
      : [];
    if (target.kind !== 'NEUTRAL' && !them) {
      throw new GameError('PLAYER_NOT_FOUND', 'No such player', 404);
    }

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
    let preparedClanAttack: Awaited<ReturnType<typeof prepareClanAttack>> | null = null;
    if (target.kind !== 'NEUTRAL' && them) {
      const [ruleset] = await tx.select({ version: seasons.rulesetVersion })
        .from(seasons).where(eq(seasons.id, origin.seasonId));
      let personalRecent: number;
      if ((ruleset?.version ?? 0) >= MULTI_WORLD.clanRulesetVersion) {
        preparedClanAttack = await prepareClanAttack(tx, {
          seasonId: origin.seasonId,
          attackerPlayerId: me.id,
          targetPlayerId: them.id,
          now: origin.now,
        });
        personalRecent = preparedClanAttack.personalRecent;
      } else {
        // Ruleset-v2 seasons retain their report-time bash semantics. D114 is a
        // fresh-season boundary and must not alter fights already under way.
        const since = addMinutes(origin.now, -ABUSE.bashWindowMinutes);
        const [recent] = await tx
          .select({ n: sql<number>`count(*)::int` })
          .from(battleReports)
          .where(and(
            eq(battleReports.attackerPlayerId, me.id),
            eq(battleReports.defenderPlayerId, them.id),
            gt(battleReports.createdAt, since),
          ));
        personalRecent = recent?.n ?? 0;
      }
      const [targetCore] = await tx
        .select({ level: buildings.level })
        .from(buildings)
        .where(and(eq(buildings.planetId, targetPlanetId), eq(buildings.type, 'CORE')))
        .limit(1);
      const gate = canAttack(
        { playerId: me.id, coreLevel: origin.buildings.CORE },
        { playerId: them.id, coreLevel: targetCore?.level ?? 1 },
        personalRecent,
      );
      if (!gate.ok) {
        throw new GameError(gate.reason ?? 'FORBIDDEN', describeRefusal(gate.reason), 403);
      }
    }

    const dist = distance(origin, target);
    /**
     * THE ROUND TRIP, PAID BEFORE IT LEAVES. T6 — owner instruction.
     *
     * Both legs, at launch, because a fleet in the air has no access to a store.
     * A one-way budget is not a cheaper raid, it is a stranded fleet — and P3 says
     * a launched fleet cannot be recalled, so there is no way back out of that.
     *
     * NO SYSTEM PATH EVER ASKS FOR MORE AND NO CANCELLATION EVER GIVES ANY BACK.
     * A rerouted leg may fly further than the one that was paid for, and
     * `abandon()` hands back units without a refund; both are system faults rather
     * than player decisions, and charging or refunding for them would make the
     * quote on this screen a lie. Written here because it is the kind of asymmetry
     * somebody tidies up later without knowing why it was chosen.
     */
    const fuel = missionFuel(requested, dist, 2);
    // A raid carries no hold on the way out, so the whole store is the tank.
    assertFuel(fuel, origin.deuterium);
    // The Beacon in orbit, if there is one. D25.
    const oneWay = fleetTravelExact(dist, requested, fleetSpeedMult(origin.orbit));
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
    assertSeasonOpenThrough(origin, addMinutes(resolveAt, oneWay));

    const [mission] = await tx
      .insert(missions)
      .values({
        seasonId: origin.seasonId,
        kind: 'attack',
        /*
          FROZEN HERE, READ AT THE BATTLE. T9.

          What this commander had researched when they committed, never what they
          finished while the fleet was in the air. The defender's doctrines are
          read at the moment of the fight instead — the same asymmetry the radar
          already has, and the same reason: every figure belongs to the moment its
          own decision was made.
        */
        tech: await techOf(tx, origin.playerId),
        ownerPlayerId: origin.playerId,
        originPlanetId,
        targetPlanetId,
        fleet: requested,
        distance: dist,
        departAt: origin.now,
        arriveAt,
      })
      .returning();

    if (them && preparedClanAttack) {
      await recordClanAttack(tx, {
        ...preparedClanAttack,
        missionId: mission!.id,
        seasonId: origin.seasonId,
        attackerPlayerId: me.id,
        targetPlayerId: them.id,
        now: origin.now,
      });
    }

    // Move the ships off the home stack, in the same transaction.
    const remaining: Fleet = { ...origin.homeFleet };
    for (const [hull, n] of Object.entries(requested) as [HullId, number][]) {
      remaining[hull] = (remaining[hull] ?? 0) - n;
    }
    await setUnits(tx, originPlanetId, remaining, 'home');
    await setUnits(tx, originPlanetId, requested, mission!.id);
    // Burned in the same transaction the ships leave in. T6.
    if (fuel > 0) {
      await saveResources(tx, originPlanetId, {
        alloy: origin.alloy,
        crystal: origin.crystal,
        deuterium: origin.deuterium - fuel,
      });
    }

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
     * the moment the drawn fleet crosses inside the WIDEST reach the ladder sells — and
     * `onRadarWarning` reads the level at the moment it runs, hopping down
     * `RADAR_RANGES` if the defender has not earned the reach it is holding. One
     * event per raid instead of one per radar-equipped target; at 351 worlds that
     * distinction is load-bearing.
     *
     * D49 MADE THAT INSTANT DEPEND ON THIS FLEET. A radar is a circle now, so when
     * a raid crosses it is a function of the leg and of the speed the attacker
     * chose — which is the entire point, and why the widest crossing is computed
     * here rather than being one constant subtracted from every arrival.
     */
    const [radarTargetCore] = await tx
      .select({ level: buildings.level })
      .from(buildings)
      .where(and(eq(buildings.planetId, targetPlanetId), eq(buildings.type, 'CORE')))
      .limit(1);
    const warnAt = addMinutes(arriveAt, -inboundRadarLead(maxRadarRange(), {
      from: origin,
      to: target,
      originCoreLevel: origin.buildings.CORE,
      targetCoreLevel: radarTargetCore?.level ?? 1,
      oneWayMinutes: oneWay,
    }));
    await schedule(tx, {
      seasonId: origin.seasonId,
      kind: 'radar_warning',
      refId: mission!.id,
      resolveAt: warnAt > origin.now ? warnAt : origin.now,
    });

    /**
     * AND THE GALAXY IS TOLD, THE MOMENT IT LEAVES. D53.
     *
     * A departure is public — it has been since D24 — and until now it reached
     * everybody else on a twenty-second poll. A short hop had covered a fifth of
     * its leg before anybody but its owner knew it existed, which is precisely how
     * a galaxy of fifty real people comes to read as empty.
     *
     * The payload names no world, no owner and no heading; it says a launch
     * happened here, and every client goes and reads `/api/traffic` — the same
     * fog-enforced query the poll was going to read anyway, sooner.
     */
    await publishShard(tx, origin.seasonId, 'launch');
    if (fleetChangesWatch(requested)) await publishWatchChanges(tx, [originPlanetId]);

    const homeDefenceAfter =
      fleetCount(remaining) + fleetCount(origin.ground);

    return {
      missionId: mission!.id,
      arriveAt,
      exposureMinutes: oneWay * 2,
      homeDefenceAfter,
      /**
       * Built by the SAME function the GET route uses, deliberately. A hand-rolled
       * thread here would be a second definition of a shape the disc interpolates
       * against, and the first time the two drifted the squadron would jump the
       * moment the next refetch landed.
       */
      pending: await pendingThreads(tx, originPlanetId, origin.now),
      planet: await planetView(tx, originPlanetId, clock),
    };
  });
}

function describeRefusal(reason?: string): string {
  switch (reason) {
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
