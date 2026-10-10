import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { dockLocation } from '@astera/rules';
import type { Clock } from '../clock.js';
import type { Db, Queryable } from '../db/client.js';
import {
  buildings, clanSupportWaves, clanWarContributions, clanWarOperations,
  intergalacticConvoyRuns, miningRuns, missions, monumentProbes, monumentWaves,
  pirateRaids, planetFaults, planets, strategicAssets, strategicInterceptions, tradeRuns, units,
} from '../db/schema.js';
import { GameError, loadLocked, loyaltyAt, recomputePlayerWealth } from './planet.js';
import { capitalPlanet, lockWorlds } from './ownership.js';
import { monumentOriginCapitals } from './monumentOwnership.js';
import { secedeColony } from './loyalty.js';
import { planetView } from './planetView.js';
import { publishShard } from '../stream/bus.js';

const REASONS = [
  'FLIGHT', 'MINING', 'PIRATE', 'TRADE', 'CONVOY', 'CLAN_WAR', 'CLAN_SUPPORT',
  'MONUMENT', 'STRATEGIC', 'AWAY_SHIPS', 'RECOVERY', 'SECESSION',
] as const;
type AbandonmentReason = typeof REASONS[number];
type World = typeof planets.$inferSelect;

function assertColony(world: World | undefined, playerId: string): asserts world is World {
  if (world?.controllerPlayerId !== playerId) {
    throw new GameError('PLANET_NOT_OWNED', 'You no longer control that world', 403);
  }
  if (world.kind !== 'COLONY') {
    throw new GameError('CAPITAL_CANNOT_BE_ABANDONED', 'Your capital cannot be abandoned', 409);
  }
}

/**
 * Flight state, never Radar's projection or ETA. Only reason categories leave this
 * query: an undetected arrival must block abandonment without leaking its dossier.
 * POST holds the same world locks as launches until the ownership change commits.
 */
async function blockers(db: Queryable, world: World, now: Date): Promise<AbandonmentReason[]> {
  const id = world.id;
  const [state] = await db.select({
    FLIGHT: sql<boolean>`exists (select 1 from ${missions} where ${missions.status} = 'in_flight'
      and (${missions.originPlanetId} = ${id} or ${missions.targetPlanetId} = ${id}))
      or exists (select 1 from ${clanWarOperations} where ${clanWarOperations.targetPlanetId} = ${id}
      and ${clanWarOperations.status} = 'ATTACKING')`,
    MINING: sql<boolean>`exists (select 1 from ${miningRuns} where ${miningRuns.planetId} = ${id} and ${miningRuns.status} <> 'done')`,
    PIRATE: sql<boolean>`exists (select 1 from ${pirateRaids} where ${pirateRaids.planetId} = ${id} and ${pirateRaids.status} <> 'done')`,
    TRADE: sql<boolean>`exists (select 1 from ${tradeRuns} where ${tradeRuns.planetId} = ${id} and ${tradeRuns.status} <> 'done')`,
    CONVOY: sql<boolean>`exists (select 1 from ${intergalacticConvoyRuns} where ${intergalacticConvoyRuns.planetId} = ${id} and ${intergalacticConvoyRuns.status} <> 'done')`,
    CLAN_WAR: sql<boolean>`exists (select 1 from ${clanWarContributions}
      where ${clanWarContributions.originPlanetId} = ${id}
      and ${clanWarContributions.status} in ('OUTBOUND', 'STAGED', 'RECALL_ORDERED', 'IN_BATTLE', 'RETURNING'))`,
    CLAN_SUPPORT: sql<boolean>`exists (select 1 from ${clanSupportWaves}
      where (${clanSupportWaves.originPlanetId} = ${id} or ${clanSupportWaves.hostPlanetId} = ${id})
      and ${clanSupportWaves.status} in ('OUTBOUND', 'STATIONED', 'RETURNING'))`,
    MONUMENT: sql<boolean>`exists (select 1 from ${monumentWaves} where ${monumentWaves.originPlanetId} = ${id}
      and ${monumentWaves.status} in ('OUTBOUND', 'HOLD', 'RETURNING'))
      or exists (select 1 from ${monumentProbes} where ${monumentProbes.originPlanetId} = ${id}
      and ${monumentProbes.status} in ('OUTBOUND', 'RETURNING'))`,
    STRATEGIC: sql<boolean>`exists (select 1 from ${strategicAssets} where ${strategicAssets.planetId} = ${id}
      and ${strategicAssets.status} in ('BUILDING', 'PAUSED', 'LAUNCHED'))
      or exists (select 1 from ${strategicInterceptions}
      where ${strategicInterceptions.resolvedAt} is null
      and (${strategicInterceptions.targetPlanetId} = ${id} or ${strategicInterceptions.missionId}
        in (select ${missions.id} from ${missions} where ${missions.originPlanetId} = ${id})))`,
    // Docked ships are here, damaged, and move with the fleet; other locations owe a landing.
    AWAY_SHIPS: sql<boolean>`exists (select 1 from ${units} where ${units.planetId} = ${id}
      and ${units.count} > 0 and ${units.location} <> 'home' and ${units.location} not like ${dockLocation('%')})`,
    core: sql<number>`coalesce((select ${buildings.level} from ${buildings}
      where ${buildings.planetId} = ${id} and ${buildings.type} = 'CORE'), 0)`,
    plant: sql<number>`coalesce((select ${buildings.level} from ${buildings}
      where ${buildings.planetId} = ${id} and ${buildings.type} = 'DEUTERIUM_PLANT'), 0)`,
    faults: sql<number>`(select count(*)::int from ${planetFaults} where ${planetFaults.planetId} = ${id})`,
  }).from(planets).where(eq(planets.id, id));
  if (!state) throw new GameError('PLANET_NOT_OWNED', 'You no longer control that world', 403);
  const flags = {
    ...state,
    RECOVERY: (world.recoveryUntil !== null && world.recoveryUntil > now)
      || (world.protectedUntil !== null && world.protectedUntil > now),
    SECESSION: loyaltyAt(world, { CORE: state.core, DEUTERIUM_PLANT: state.plant }, state.faults, now) <= 0,
  };
  return REASONS.filter(reason => flags[reason]);
}

export async function colonyAbandonment(db: Queryable, planetId: string, playerId: string, clock: Clock) {
  const [world] = await db.select().from(planets).where(eq(planets.id, planetId));
  assertColony(world, playerId);
  const reasons = await blockers(db, world, clock.now());
  return { planetId, allowed: reasons.length === 0, reasons };
}

export async function abandonColony(db: Db, planetId: string, playerId: string, clock: Clock) {
  return db.transaction(async tx => {
    const home = await capitalPlanet(tx, playerId);
    // Secession also revisits monument history. Discover every capital it could
    // lock up front, so reacquiring those rows cannot invert the global order.
    const historyCapitals = await monumentOriginCapitals(tx, planetId);
    const worlds = await lockWorlds(tx, [home.id, planetId, ...historyCapitals]);
    const world = worlds.get(planetId);
    assertColony(world, playerId);
    const reasons = await blockers(tx, world, clock.now());
    if (reasons.length > 0) {
      throw new GameError('COLONY_ABANDON_BLOCKED', 'This colony has active missions or an ownership transition; finish them before abandoning it',
        409, { reason: reasons[0]! });
    }
    // Settle the world's production and loyalty before leaving its stock behind.
    await loadLocked(tx, planetId, clock, { expectedPlayerId: playerId });
    if (!await secedeColony(tx, planetId, clock.now(), randomUUID(), 'ABANDONED')) {
      throw new GameError('PLANET_NOT_OWNED', 'You no longer control that world', 403);
    }
    // The returned capital also advances production; include that tick in Wealth.
    const capital = await planetView(tx, home.id, clock);
    const wealth = await recomputePlayerWealth(tx, playerId);
    await publishShard(tx, world.seasonId, 'control');
    return { abandonedPlanetId: planetId, capital: { ...capital, score: { ...capital.score, wealth } } };
  });
}
