import { and, asc, eq, inArray, or, sql } from 'drizzle-orm';
import {
  CLAN,
  alloyRate,
  clanPurseRemaining,
  crystalRate,
  deuteriumRate,
  deuteriumStorageCap,
  productionMult,
  splitClanRaidLoot,
  storageCap,
  vaultProtects,
  type Resources,
} from '@astera/rules';
import type { Clock } from '../clock.js';
import type { Db, Queryable, Tx } from '../db/client.js';
import type { missions } from '../db/schema.js';
import {
  attackCommitments,
  buildings,
  clanLootShares,
  clanRaidRoster,
  clanScoreEvents,
  clans,
  planets,
  players,
  satellites,
} from '../db/schema.js';
import { publishPrivate, publishShard } from '../stream/bus.js';
import { capitalPlanet } from './ownership.js';
import { GameError, loadLocked, recomputePlayerWealth } from './planet.js';
import { orbitFromRows } from './planet.js';
import { planetView } from './planetView.js';

const ZERO: Resources = { alloy: 0, crystal: 0, deuterium: 0 };

interface EconomyEnvelope {
  alloyPerHour: number;
  crystalPerHour: number;
  deuteriumCapacity: number;
  storageCapacity: Resources;
  vaultProtection: Resources;
  unclaimed: Resources;
}

const emptyEconomyEnvelope = (unclaimed: Resources = ZERO): EconomyEnvelope => ({
  alloyPerHour: 0,
  crystalPerHour: 0,
  deuteriumCapacity: 0,
  storageCapacity: { ...ZERO },
  vaultProtection: { ...ZERO },
  unclaimed,
});

/**
 * Aggregate nominal economies for a bounded roster in a fixed number of queries.
 * Foundry applies; disruption and current stock do not.
 */
async function clanEconomyEnvelopes(
  db: Queryable,
  playerIds: readonly string[],
): Promise<Map<string, EconomyEnvelope>> {
  const uniquePlayerIds = [...new Set(playerIds)];
  if (uniquePlayerIds.length === 0) return new Map();
  const worlds = await db.select().from(planets)
    .where(inArray(planets.controllerPlayerId, uniquePlayerIds));
  if (worlds.length === 0) return new Map();
  const worldIds = worlds.map((world) => world.id);
  const [buildingRows, satelliteRows, shareRows] = await Promise.all([
    db.select().from(buildings).where(inArray(buildings.planetId, worldIds)),
    db.select().from(satellites).where(inArray(satellites.planetId, worldIds)),
    db.select({
      playerId: clanLootShares.playerId,
      alloy: sql<number>`coalesce(sum(${clanLootShares.remainingAlloy}), 0)`,
      crystal: sql<number>`coalesce(sum(${clanLootShares.remainingCrystal}), 0)`,
      deuterium: sql<number>`coalesce(sum(${clanLootShares.remainingDeuterium}), 0)`,
    }).from(clanLootShares)
      .where(inArray(clanLootShares.playerId, uniquePlayerIds))
      .groupBy(clanLootShares.playerId),
  ]);

  const buildingsByWorld = new Map<string, Map<string, number>>();
  for (const row of buildingRows) {
    const levels = buildingsByWorld.get(row.planetId) ?? new Map<string, number>();
    levels.set(row.type, row.level);
    buildingsByWorld.set(row.planetId, levels);
  }
  const satellitesByWorld = new Map<string, typeof satelliteRows>();
  for (const row of satelliteRows) {
    const installed = satellitesByWorld.get(row.planetId) ?? [];
    installed.push(row);
    satellitesByWorld.set(row.planetId, installed);
  }
  // `sum` over a `real` column is `double precision`, which the driver decodes as
  // a number. Only the `numeric` aggregates in `clanAid` come back as strings.
  const unclaimedByPlayer = new Map(shareRows.map((row) => [row.playerId, {
    alloy: row.alloy,
    crystal: row.crystal,
    deuterium: row.deuterium,
  }]));
  const result = new Map<string, EconomyEnvelope>();
  for (const world of worlds) {
    if (!world.controllerPlayerId) continue;
    const economy = result.get(world.controllerPlayerId)
      ?? emptyEconomyEnvelope(unclaimedByPlayer.get(world.controllerPlayerId));
    const levels = buildingsByWorld.get(world.id);
    const level = (type: string): number => levels?.get(type) ?? 0;
    const core = level('CORE');
    const refinery = level('REFINERY');
    const extractor = level('EXTRACTOR');
    const vault = level('VAULT');
    const plant = level('DEUTERIUM_PLANT');
    const orbit = orbitFromRows(
      satellitesByWorld.get(world.id) ?? [],
      core,
    );
    const boost = productionMult(orbit);
    const alloy = alloyRate(refinery) * boost;
    const crystal = crystalRate(extractor) * boost;
    const deuterium = deuteriumRate(plant) * boost;
    const protectedByVault = vaultProtects(vault, refinery, extractor, plant);
    economy.alloyPerHour += alloy;
    economy.crystalPerHour += crystal;
    economy.storageCapacity.alloy += storageCap(alloy, vault);
    economy.storageCapacity.crystal += storageCap(crystal, vault);
    // Off deuterium's own production now that it has some. T5.
    economy.storageCapacity.deuterium += deuteriumStorageCap(deuterium, crystal, vault);
    economy.deuteriumCapacity += deuteriumStorageCap(deuterium, crystal, vault);
    economy.vaultProtection.alloy += protectedByVault.alloy;
    economy.vaultProtection.crystal += protectedByVault.crystal;
    economy.vaultProtection.deuterium += protectedByVault.deuterium;
    result.set(world.controllerPlayerId, economy);
  }
  return result;
}

/** Aggregate nominal economy: Foundry applies, disruption and current stock do not. */
export async function clanEconomyEnvelope(
  db: Queryable,
  playerId: string,
): Promise<EconomyEnvelope | null> {
  return (await clanEconomyEnvelopes(db, [playerId])).get(playerId) ?? null;
}

export async function clanPurseForPlayer(db: Queryable, playerId: string): Promise<Resources> {
  const economy = await clanEconomyEnvelope(db, playerId);
  return economy ? clanPurseRemaining(economy) : { ...ZERO };
}

/**
 * Allocation and claim both take this lock after their planet locks. It closes the
 * read-capacity/write-share race without crossing the worker's global lock order.
 */
async function lockClanLootPurses(tx: Tx, playerIds: readonly string[]): Promise<void> {
  for (const playerId of [...new Set(playerIds)].sort()) {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`clan-loot:${playerId}`}))`);
  }
}

/** Called only on an ordinary raid return after surviving craft safely dock. */
export async function allocateClanLoot(
  tx: Tx,
  returnMission: typeof missions.$inferSelect,
  at: Date,
): Promise<Resources> {
  const returned = returnMission.loot ?? ZERO;
  if (!returnMission.parentMissionId) return returned;
  const roster = await tx
    .select()
    .from(clanRaidRoster)
    .where(eq(clanRaidRoster.missionId, returnMission.parentMissionId))
    .orderBy(asc(clanRaidRoster.slot));
  if (roster.length < CLAN.minimumLootRoster) return returned;

  const existing = await tx.select({ id: players.id }).from(players).where(inArray(
    players.id,
    roster.map((member) => member.playerId),
  ));
  const existingIds = new Set(existing.map((player) => player.id));
  await lockClanLootPurses(tx, [...existingIds]);
  const economies = await clanEconomyEnvelopes(tx, [...existingIds]);
  const recipients = roster.map((member) => ({
    playerId: member.playerId,
    capacityRemaining: economies.has(member.playerId)
      ? clanPurseRemaining(economies.get(member.playerId)!)
      : { ...ZERO },
  }));
  const split = splitClanRaidLoot(returned, recipients);
  const clanId = roster[0]!.clanId;
  const creditedPlayers: string[] = [];
  const credited: Resources = { ...ZERO };
  for (const credit of split.credits) {
    const amount = credit.resources;
    if (amount.alloy + amount.crystal + amount.deuterium <= 0 || !existingIds.has(credit.playerId)) {
      continue;
    }
    const inserted = await tx.insert(clanLootShares).values({
      seasonId: returnMission.seasonId,
      sourceMissionId: returnMission.parentMissionId,
      clanId,
      playerId: credit.playerId,
      alloy: amount.alloy,
      crystal: amount.crystal,
      deuterium: amount.deuterium,
      remainingAlloy: amount.alloy,
      remainingCrystal: amount.crystal,
      remainingDeuterium: amount.deuterium,
      createdAt: at,
    }).onConflictDoNothing({
      target: [clanLootShares.sourceMissionId, clanLootShares.playerId],
    }).returning({ playerId: clanLootShares.playerId });
    if (inserted.length > 0) {
      creditedPlayers.push(credit.playerId);
      credited.alloy += amount.alloy;
      credited.crystal += amount.crystal;
      credited.deuterium += amount.deuterium;
    }
  }
  for (const playerId of creditedPlayers) {
    await recomputePlayerWealth(tx, playerId);
    await publishPrivate(tx, playerId, 'depot');
  }
  return {
    alloy: returned.alloy - credited.alloy,
    crystal: returned.crystal - credited.crystal,
    deuterium: returned.deuterium - credited.deuterium,
  };
}

export async function readClanDepot(db: Db, accountId: string) {
  const [actor] = await db.select({ playerId: players.id }).from(players)
    .where(eq(players.accountId, accountId));
  if (!actor) throw new GameError('NO_PLANET', 'Join a galaxy first', 404);
  const [totals] = await db.select({
    alloy: sql<number>`coalesce(sum(${clanLootShares.remainingAlloy}), 0)`,
    crystal: sql<number>`coalesce(sum(${clanLootShares.remainingCrystal}), 0)`,
    deuterium: sql<number>`coalesce(sum(${clanLootShares.remainingDeuterium}), 0)`,
  }).from(clanLootShares).where(eq(clanLootShares.playerId, actor.playerId));
  return {
    resources: totals ?? { ...ZERO },
    purseRemaining: await clanPurseForPlayer(db, actor.playerId),
  };
}

export async function claimClanLoot(
  tx: Tx,
  input: { playerId: string; clock: Clock },
) {
  const capital = await capitalPlanet(tx, input.playerId);
  const world = await loadLocked(tx, capital.id, input.clock, { expectedPlayerId: input.playerId });
  await lockClanLootPurses(tx, [input.playerId]);
  const rows = await tx.select().from(clanLootShares).where(and(
    eq(clanLootShares.playerId, input.playerId),
    or(
      sql`${clanLootShares.remainingAlloy} > 0`,
      sql`${clanLootShares.remainingCrystal} > 0`,
      sql`${clanLootShares.remainingDeuterium} > 0`,
    ),
  )).orderBy(asc(clanLootShares.createdAt), asc(clanLootShares.id)).for('update');
  const boost = productionMult(world.orbit);
  const alloyCap = storageCap(alloyRate(world.buildings.REFINERY) * boost, world.buildings.VAULT);
  const crystalPerHour = crystalRate(world.buildings.EXTRACTOR) * boost;
  const crystalCap = storageCap(crystalPerHour, world.buildings.VAULT);
  const deuteriumCap = deuteriumStorageCap(
    deuteriumRate(world.buildings.DEUTERIUM_PLANT),
    crystalPerHour,
    world.buildings.VAULT,
  );
  const room: Resources = {
    alloy: Math.max(0, Math.floor(alloyCap - world.alloy)),
    crystal: Math.max(0, Math.floor(crystalCap - world.crystal)),
    deuterium: Math.max(0, Math.floor(deuteriumCap - world.deuterium)),
  };
  const claimed: Resources = { ...ZERO };
  for (const share of rows) {
    const take = {
      alloy: Math.min(share.remainingAlloy, room.alloy - claimed.alloy),
      crystal: Math.min(share.remainingCrystal, room.crystal - claimed.crystal),
      deuterium: Math.min(share.remainingDeuterium, room.deuterium - claimed.deuterium),
    };
    if (take.alloy + take.crystal + take.deuterium <= 0) continue;
    claimed.alloy += take.alloy;
    claimed.crystal += take.crystal;
    claimed.deuterium += take.deuterium;
    await tx.update(clanLootShares).set({
      remainingAlloy: share.remainingAlloy - take.alloy,
      remainingCrystal: share.remainingCrystal - take.crystal,
      remainingDeuterium: share.remainingDeuterium - take.deuterium,
      lastClaimedAt: world.now,
    }).where(eq(clanLootShares.id, share.id));
  }
  if (claimed.alloy + claimed.crystal + claimed.deuterium <= 0) {
    throw new GameError('CLAN_DEPOT_NO_ROOM', 'The capital has no room for these shares', 409);
  }
  await tx.update(planets).set({
    alloy: sql`${planets.alloy} + ${claimed.alloy}`,
    crystal: sql`${planets.crystal} + ${claimed.crystal}`,
    deuterium: sql`${planets.deuterium} + ${claimed.deuterium}`,
  }).where(eq(planets.id, capital.id));
  await recomputePlayerWealth(tx, input.playerId);
  await publishPrivate(tx, input.playerId, 'depot');
  const [remaining] = await tx.select({
    alloy: sql<number>`coalesce(sum(${clanLootShares.remainingAlloy}), 0)`,
    crystal: sql<number>`coalesce(sum(${clanLootShares.remainingCrystal}), 0)`,
    deuterium: sql<number>`coalesce(sum(${clanLootShares.remainingDeuterium}), 0)`,
  }).from(clanLootShares).where(eq(clanLootShares.playerId, input.playerId));
  return {
    claimed,
    remaining: remaining ?? { ...ZERO },
    planet: await planetView(tx, capital.id, input.clock),
  };
}

/** Books the two immutable launch snapshots into the cached clan ladder. */
export async function recordClanBattleScore(
  tx: Tx,
  input: {
    missionId: string;
    seasonId: string;
    attackerDelta: number;
    defenderDelta: number;
    at: Date;
  },
): Promise<void> {
  const [commitment] = await tx.select().from(attackCommitments)
    .where(eq(attackCommitments.missionId, input.missionId));
  if (!commitment) return;
  const entries = [
    commitment.attackerScoreClanId
      ? { clanId: commitment.attackerScoreClanId, side: 'ATTACK' as const, delta: input.attackerDelta }
      : null,
    commitment.defenderScoreClanId
      ? { clanId: commitment.defenderScoreClanId, side: 'DEFENCE' as const, delta: input.defenderDelta }
      : null,
  ].filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  let changed = false;
  for (const entry of entries) {
    const inserted = await tx.insert(clanScoreEvents).values({
      seasonId: input.seasonId,
      missionId: input.missionId,
      clanId: entry.clanId,
      side: entry.side,
      dominionDelta: entry.delta,
      createdAt: input.at,
    }).onConflictDoNothing({
      target: [clanScoreEvents.missionId, clanScoreEvents.clanId, clanScoreEvents.side],
    }).returning({ id: clanScoreEvents.id });
    if (inserted.length === 0) continue;
    changed = true;
    await tx.update(clans).set(entry.delta >= 0
      ? { dominionTaken: sql`${clans.dominionTaken} + ${entry.delta}` }
      : { dominionLost: sql`${clans.dominionLost} + ${-entry.delta}` })
      .where(eq(clans.id, entry.clanId));
  }
  if (changed) {
    await publishShard(tx, input.seasonId, 'clan');
  }
}
