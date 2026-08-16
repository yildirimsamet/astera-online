import { and, eq, gt, sql } from 'drizzle-orm';
import {
  canAttack,
  distance,
  fleetCount,
  fleetSpeed,
  fleetTravelMinutes,
  radarDetectsFleets,
  radarLeadMinutes,
  type Fleet,
  type HullId,
  type SatelliteId,
} from '@blindspace/rules';
import { ABUSE } from '@blindspace/rules';
import { addMinutes, type Clock } from '../clock.js';
import type { Db, Tx } from '../db/client.js';
import {
  battleReports,
  missions,
  planets,
  players,
  satellites as satellitesTable,
  units,
} from '../db/schema.js';
import { GameError, loadLocked, setUnits } from './planet.js';
import { schedule } from '../worker/queue.js';

export interface LaunchResult {
  missionId: string;
  arriveAt: Date;
  /** Minutes the origin planet is left weakened — the line the UI leads with. */
  exposureMinutes: number;
  homeDefenceAfter: number;
}

async function satelliteLevel(tx: Tx, planetId: string, type: SatelliteId): Promise<number> {
  const [row] = await tx
    .select()
    .from(satellitesTable)
    .where(and(eq(satellitesTable.planetId, planetId), eq(satellitesTable.type, type)));
  return row?.level ?? 0;
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
      if (hull === 'BASTION') throw new GameError('GROUND_UNIT', 'Bastions cannot travel');
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

    const gate = canAttack(
      { playerId: me.id, wealth: me.wealth },
      { playerId: them.id, wealth: them.wealth },
      recent[0]?.n ?? 0,
    );
    if (!gate.ok) {
      throw new GameError(gate.reason ?? 'FORBIDDEN', describeRefusal(gate.reason), 403);
    }

    const dist = distance(origin, target);
    const oneWay = fleetTravelMinutes(dist, requested);
    const arriveAt = addMinutes(origin.now, oneWay);

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
      resolveAt: arriveAt,
    });

    // Radar warning fires at arriveAt − lead, not at launch: a 40-minute flight
    // should not give 40 minutes of notice.
    const radar = await satelliteLevel(tx, targetPlanetId, 'RADAR');
    if (radarDetectsFleets(radar)) {
      const lead = radarLeadMinutes(radar);
      const warnAt = addMinutes(arriveAt, -lead);
      await schedule(tx, {
        seasonId: origin.seasonId,
        kind: 'radar_warning',
        refId: mission!.id,
        payload: { radarLevel: radar },
        resolveAt: warnAt > origin.now ? warnAt : origin.now,
      });
    }

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
    case 'RANK_FLOOR':
      return 'That planet is too far below you to be worth attacking';
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
