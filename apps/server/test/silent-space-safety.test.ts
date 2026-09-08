import { joinSeason } from '../src/services/player.js';
import { setTimeout as delay } from 'node:timers/promises';
import { runSilentSpaceSweep } from '../src/services/silentSpace.js';
import { buildUnits } from '../src/services/build.js';
import { onBuildComplete } from '../src/worker/handlers.js';
import { readProbeReports } from '../src/services/intel.js';
import { readBattleReports } from '../src/services/reports.js';
import { afterAll, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { seedWorld, testDb, makeAccount } from './helpers.js';
import { loadEnv } from '../src/env.js';
import { clans, clanMemberships, clanCeasefires, players, seasons, scheduledEvents, researchOrders, pirateRaids, missions, strategicImpacts, seasonResults, returnApplications, probeReports, battleReports, units, silentSpaceMaintenance, planets, shards, missionKind } from '../src/db/schema.js';
import { transferCommander } from '../src/services/commanderTransfer.js';
import { ensureWaitingSeason } from '../src/services/waitingServers.js';
import { enqueueReturn } from '../src/services/returnQueue.js';
import { onSeasonEnd, onSeasonRollover } from '../src/worker/handlers.js';
afterAll(async () => { await (await testDb()).close(); });

it('rejects a single-connection worker pool before its maintenance lease can deadlock', () => {
  expect(() => loadEnv({ DATABASE_URL: 'postgres://test', SILENT_SPACE_ENABLED: 'true', DB_POOL_MAX: '1' })).toThrow(/DB_POOL_MAX/);
});
it.each(['MEMBER', 'LEADER'] as const)('keeps ordinary exit ceasefires when a %s moves', async role => {
  const f = await seedWorld(2);
  const [clan] = await f.db.insert(clans).values({ seasonId: f.seasonId, name: 'Test clan', nameKey: 'test clan', tag: 'TC', createdAt: f.clock.now() }).returning();
  await f.db.insert(clanMemberships).values(f.playerIds.map((playerId, slot) => ({ seasonId: f.seasonId, clanId: clan!.id, playerId, slot,
    role: slot === 0 ? role : role === 'LEADER' ? 'MEMBER' as const : 'LEADER' as const,
    joinedAt: f.clock.now(), matureAt: f.clock.now(), aidPolicyChangedAt: f.clock.now() })));
  f.clock.advance(48 * 60);
  await f.db.update(players).set({ lastActiveAt: f.clock.now() }).where(eq(players.id, f.playerIds[1]!));
  const target = await ensureWaitingSeason(f.db, f.seasonId, f.clock);
  expect((await transferCommander(f.db, f.playerIds[0]!, target!.id, f.clock)).status).toBe('MOVED');
  expect(await f.db.select().from(clanCeasefires)).toHaveLength(1);
  const [membership] = await f.db.select().from(clanMemberships).where(eq(clanMemberships.playerId, f.playerIds[0]!));
  expect(membership!.leftAt).toEqual(f.clock.now());
});
it.each(['research', 'pirate'] as const)('waits for committed %s before freezing', async kind => {
  const f = await seedWorld(1);
  if (kind === 'research') await f.db.insert(researchOrders).values({ playerId: f.playerIds[0]!, fundingPlanetId: f.planetIds[0]!, slot: 0, projectId: 'SHIP_POWER', level: 1,
    startedAt: f.clock.now(), readyAt: f.clock.now(), remainingSeconds: 0, cost: { alloy: 0, crystal: 0, deuterium: 0 } });
  else await f.db.insert(pirateRaids).values({ seasonId: f.seasonId, planetId: f.planetIds[0]!, ownerPlayerId: f.playerIds[0]!, pirateIndex: 0, fleet: {}, tech: {},
    interceptX: 1, interceptY: 1, interceptZ: 1, departAt: f.clock.now(), arriveAt: f.clock.now() });
  const [event] = await f.db.select().from(scheduledEvents).where(eq(scheduledEvents.kind, 'season_end'));
  f.clock.set(event!.resolveAt);
  await onSeasonEnd({ db: f.db, clock: f.clock }, event!);
  const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
  expect(season!.status).toBe('live');
  expect(await f.db.select().from(seasonResults)).toHaveLength(0);
});
it('folds the whole cycle story once and rolls over waiting worlds and return applications', async () => {
  const f = await seedWorld(2);
  const [mission] = await f.db.insert(missions).values({ seasonId: f.seasonId, kind: 'death_star', status: 'resolved', ownerPlayerId: f.playerIds[0]!, originPlanetId: f.planetIds[0]!, targetPlanetId: f.planetIds[1]!, fleet: {}, distance: 10, departAt: f.clock.now(), arriveAt: f.clock.now() }).returning();
  await f.db.insert(strategicImpacts).values({ seasonId: f.seasonId, missionId: mission!.id, attackerPlayerId: f.playerIds[0]!, defenderPlayerId: f.playerIds[1]!, targetPlanetId: f.planetIds[1]!, outcome: 'FIRST_STRIKE', damage: 12345, destroyedFleet: {}, createdAt: f.clock.now() });
  f.clock.advance(48 * 60);
  const waiting = await ensureWaitingSeason(f.db, f.seasonId, f.clock);
  expect((await transferCommander(f.db, f.playerIds[0]!, waiting!.id, f.clock)).status).toBe('MOVED');
  await enqueueReturn(f.db, f.accountIds[0]!, f.clock, 1);
  f.clock.set(waiting!.endsAt);
  const ends = await f.db.select().from(scheduledEvents).where(eq(scheduledEvents.kind, 'season_end'));
  for (const event of ends) await onSeasonEnd({ db: f.db, clock: f.clock }, event);
  const results = await f.db.select().from(seasonResults).where(eq(seasonResults.accountId, f.accountIds[0]!));
  expect(results).toHaveLength(1);
  expect(results[0]!.damageDealt).toBe(12345);
  const [rollover] = await f.db.select().from(scheduledEvents).where(and(eq(scheduledEvents.kind, 'season_rollover'), eq(scheduledEvents.seasonId, waiting!.id)));
  f.clock.set(rollover!.resolveAt);
  await onSeasonRollover({ db: f.db, clock: f.clock }, rollover!);
  const [application] = await f.db.select().from(returnApplications);
  expect(application!.status).toBe('SEASON_ENDED');
  expect(application!.playerId).toBeNull();
  expect(await f.db.select().from(players)).toHaveLength(0);
});

it('preserves reports but detaches their spatial evidence after a round trip', async () => {
  const f = await seedWorld(2);
  const [mission] = await f.db.insert(missions).values({ seasonId: f.seasonId, kind: 'probe', status: 'resolved', ownerPlayerId: f.playerIds[0]!, originPlanetId: f.planetIds[0]!, targetPlanetId: f.planetIds[1]!, fleet: {}, distance: 10, departAt: f.clock.now(), arriveAt: f.clock.now() }).returning();
  await f.db.insert(probeReports).values({ missionId: mission!.id, observerPlayerId: f.playerIds[0]!, targetPlanetId: f.planetIds[1]!, accuracy: 1, stock: { low: 1, high: 1 }, defence: { low: 0, high: 0 }, fleetSize: { low: 1, high: 1 }, fleetHome: true, detected: false, createdAt: f.clock.now(), deliveredAt: f.clock.now() });
  await f.db.insert(battleReports).values({ missionId: mission!.id, seasonId: f.seasonId, attackerPlayerId: f.playerIds[0]!, defenderPlayerId: f.playerIds[1]!, targetPlanetId: f.planetIds[1]!, grade: 'REPELLED', rounds: [], loot: { alloy: 0, crystal: 0, deuterium: 0 }, attackerLosses: {}, defenderLosses: { DART: 1 }, createdAt: f.clock.now() });
  f.clock.advance(48 * 60);
  const target = await ensureWaitingSeason(f.db, f.seasonId, f.clock);
  expect((await transferCommander(f.db, f.playerIds[1]!, target!.id, f.clock)).status).toBe('MOVED');
  const application = await enqueueReturn(f.db, f.accountIds[1]!, f.clock, 1);
  expect((await transferCommander(f.db, f.playerIds[1]!, f.seasonId, f.clock, application.id)).status).toBe('MOVED');
  const probes = await readProbeReports(f.db, f.playerIds[0]!);
  expect(probes).toHaveLength(1);
  expect(probes[0]).toMatchObject({ spatiallyCurrent: false });
  const reports = await readBattleReports(f.db, f.playerIds[0]!);
  expect(reports.reports).toHaveLength(1);
  expect(reports.reports[0]!.opponentPlanetId).toBeNull();
  expect(reports.rivals).toHaveLength(0);
});
it('enforces one result per account and cycle across different galaxies', async () => {
  const f = await seedWorld(1);
  f.clock.advance(48 * 60);
  const waiting = await ensureWaitingSeason(f.db, f.seasonId, f.clock);
  const [end] = await f.db.select().from(scheduledEvents).where(and(eq(scheduledEvents.kind, 'season_end'), eq(scheduledEvents.seasonId, f.seasonId)));
  f.clock.set(end!.resolveAt);
  await onSeasonEnd({ db: f.db, clock: f.clock }, end!);
  const [result] = await f.db.select().from(seasonResults);
  await expect(f.db.insert(seasonResults).values({ ...result!, seasonId: waiting!.id })).rejects.toThrow();
});

it('retargets an unclaimed build and delivers its hull once after moving', async () => {
  const f = await seedWorld(1);
  f.clock.advance(48 * 60);
  await buildUnits(f.db, f.planetIds[0]!, 'DART', 1, f.clock);
  const waiting = await ensureWaitingSeason(f.db, f.seasonId, f.clock);
  expect((await transferCommander(f.db, f.playerIds[0]!, waiting!.id, f.clock)).status).toBe('MOVED');
  const [event] = await f.db.select().from(scheduledEvents).where(eq(scheduledEvents.kind, 'build_complete'));
  expect(event!.seasonId).toBe(waiting!.id);
  f.clock.set(event!.resolveAt);
  await onBuildComplete({ db: f.db, clock: f.clock }, event!);
  await onBuildComplete({ db: f.db, clock: f.clock }, event!);
  const [fleet] = await f.db.select().from(units).where(eq(units.planetId, f.planetIds[0]!));
  expect(fleet!.count).toBe(1);
});
it.each(['pending', 'processing', 'failed'] as const)('defers previously claimed %s events without moving assets', async status => {
  const f = await seedWorld(1);
  f.clock.advance(48 * 60);
  await buildUnits(f.db, f.planetIds[0]!, 'DART', 1, f.clock);
  await f.db.update(scheduledEvents).set({ status, attempts: 1 }).where(eq(scheduledEvents.kind, 'build_complete'));
  const waiting = await ensureWaitingSeason(f.db, f.seasonId, f.clock);
  expect((await transferCommander(f.db, f.playerIds[0]!, waiting!.id, f.clock)).status).toBe('EVENT');
  const [player] = await f.db.select().from(players);
  expect(player!.seasonId).toBe(f.seasonId);
});
it('preserves the departure cursor when returns consume the whole batch', async () => {
  const f = await seedWorld(2);
  f.clock.advance(48 * 60);
  const waiting = await ensureWaitingSeason(f.db, f.seasonId, f.clock);
  await transferCommander(f.db, f.playerIds[0]!, waiting!.id, f.clock);
  await enqueueReturn(f.db, f.accountIds[0]!, f.clock, 1);
  await f.db.insert(silentSpaceMaintenance).values({ id: 1, nextRunAt: new Date(0), cursorPlayerId: f.playerIds[1]! });
  expect((await runSilentSpaceSweep(f.db, f.clock, { batchSize: 1 })).returned).toBe(1);
  const [state] = await f.db.select().from(silentSpaceMaintenance);
  expect(state!.cursorPlayerId).toBe(f.playerIds[1]);
});

it('does not wait on a busy commander while expiring return applications', async () => {
  const f = await seedWorld(1);
  f.clock.advance(48 * 60);
  const waiting = await ensureWaitingSeason(f.db, f.seasonId, f.clock);
  await transferCommander(f.db, f.playerIds[0]!, waiting!.id, f.clock);
  await enqueueReturn(f.db, f.accountIds[0]!, f.clock, 1);
  f.clock.advance(49 * 60);
  let completed = false;
  let sweep: ReturnType<typeof runSilentSpaceSweep> | undefined;
  await f.db.transaction(async tx => {
    await tx.select().from(players).where(eq(players.id, f.playerIds[0]!)).for('update');
    sweep = runSilentSpaceSweep(f.db, f.clock);
    completed = await Promise.race([sweep.then(() => true), delay(400).then(() => false)]);
  });
  await sweep;
  expect(completed).toBe(true);
});

it('returns B past blocked A, then remembers A ahead of C in the next tour', async () => {
  const f = await seedWorld(3);
  f.clock.advance(48 * 60);
  const waiting = await ensureWaitingSeason(f.db, f.seasonId, f.clock);
  for (const player of f.playerIds) expect((await transferCommander(f.db, player, waiting!.id, f.clock)).status).toBe('MOVED');
  const applications = [];
  for (const account of f.accountIds) applications.push(await enqueueReturn(f.db, account, f.clock, 1));
  await f.db.update(planets).set({ recoveryUntil: new Date(f.clock.now().getTime() + 60_000) }).where(eq(planets.id, f.planetIds[0]!));
  expect((await runSilentSpaceSweep(f.db, f.clock, { batchSize: 1 })).returned).toBe(1);
  const [b] = await f.db.select().from(players).where(eq(players.id, f.playerIds[1]!));
  expect(b!.seasonId).toBe(f.seasonId);
  const [a] = await f.db.select().from(returnApplications).where(eq(returnApplications.id, applications[0]!.id));
  expect(a).toMatchObject({ status: 'QUEUED', sequence: applications[0]!.sequence });
  await f.db.update(planets).set({ recoveryUntil: null }).where(eq(planets.id, f.planetIds[0]!));
  f.clock.advance(5);
  const tours = await Promise.all([runSilentSpaceSweep(f.db, f.clock, { batchSize: 1 }), runSilentSpaceSweep(f.db, f.clock, { batchSize: 1 })]);
  expect(tours.reduce((n, tour) => n + tour.returned, 0)).toBe(1);
  const [returned] = await f.db.select().from(players).where(eq(players.id, f.playerIds[0]!));
  expect(returned!.seasonId).toBe(f.seasonId);
  const [c] = await f.db.select().from(returnApplications).where(eq(returnApplications.id, applications[2]!.id));
  expect(c!.status).toBe('QUEUED');
});
it('serializes return and new admission at the last reserved seat', async () => {
  const f = await seedWorld(1);
  f.clock.advance(48 * 60);
  const waiting = await ensureWaitingSeason(f.db, f.seasonId, f.clock);
  await transferCommander(f.db, f.playerIds[0]!, waiting!.id, f.clock);
  const application = await enqueueReturn(f.db, f.accountIds[0]!, f.clock, 1);
  const [source] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
  await f.db.update(shards).set({ playerCap: 1 }).where(eq(shards.id, source!.shardId));
  const account = await makeAccount(f.db, 'last-seat');
  const [returned, joined] = await Promise.allSettled([
    transferCommander(f.db, f.playerIds[0]!, f.seasonId, f.clock, application.id),
    joinSeason(f.db, account.id, f.seasonId, f.clock),
  ]);
  expect(joined.status).toBe('rejected');
  expect(returned).toMatchObject({ status: 'fulfilled', value: { status: 'MOVED' } });
  expect(await f.db.select().from(players).where(eq(players.seasonId, f.seasonId))).toHaveLength(1);
});
it.each(missionKind.enumValues)('keeps an incoming %s flight in its original galaxy', async kind => {
  const f = await seedWorld(2);
  f.clock.advance(48 * 60);
  await f.db.insert(missions).values({ seasonId: f.seasonId, kind, ownerPlayerId: f.playerIds[1]!, originPlanetId: f.planetIds[1]!, targetPlanetId: f.planetIds[0]!, fleet: {}, distance: 10, departAt: f.clock.now(), arriveAt: new Date(f.clock.now().getTime() + 60_000) });
  const waiting = await ensureWaitingSeason(f.db, f.seasonId, f.clock);
  expect((await transferCommander(f.db, f.playerIds[0]!, waiting!.id, f.clock)).status).toBe('FLIGHT');
});
