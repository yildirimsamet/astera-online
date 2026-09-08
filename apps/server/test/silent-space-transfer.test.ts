import { and, eq } from 'drizzle-orm';
import { afterAll, expect, it } from 'vitest';
import { seedWorld, testDb, giveUnits } from './helpers.js';
import { players, planets, units, commanderTransfers, mainVacancies, scheduledEvents, seasons } from '../src/db/schema.js';
import { transferCommander } from '../src/services/commanderTransfer.js';
import { ensureWaitingSeason } from '../src/services/waitingServers.js';
import { enqueueReturn } from '../src/services/returnQueue.js';
import { runSilentSpaceSweep } from '../src/services/silentSpace.js';
import { launchAttack } from '../src/services/mission.js';

afterAll(async () => { await (await testDb()).close(); });
async function idleFixture() {
  const f = await seedWorld(2);
  f.clock.advance(48 * 60);
  await f.db.update(players).set({ lastActiveAt: f.clock.now() }).where(eq(players.id, f.playerIds[1]!));
  return f;
}
it('moves an existing inactive commander without replacing worlds, fleet, stock or activity', async () => {
  const f = await idleFixture();
  const [before] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!));
  const [player] = await f.db.select().from(players).where(eq(players.id, f.playerIds[0]!));
  const target = await ensureWaitingSeason(f.db, f.seasonId, f.clock);
  expect(target).not.toBeNull();
  const result = await transferCommander(f.db, f.playerIds[0]!, target!.id, f.clock);
  expect(result.status).toBe('MOVED');
  const [after] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!));
  expect(after).toMatchObject({ id: before!.id, controllerPlayerId: player!.id, name: before!.name, seasonId: target!.id, alloy: before!.alloy, crystal: before!.crystal });
  const [moved] = await f.db.select().from(players).where(eq(players.id, player!.id));
  expect(moved).toMatchObject({ placementVersion: 1, homeShardId: player!.homeShardId, lastActiveAt: player!.lastActiveAt });
  expect(await f.db.select().from(commanderTransfers)).toHaveLength(1);
  expect(await f.db.select().from(mainVacancies)).toHaveLength(1);
  expect((await transferCommander(f.db, player!.id, target!.id, f.clock)).status).not.toBe('MOVED');
});
it('returns to the exact vacated address and preserves the commander through both moves', async () => {
  const f = await idleFixture();
  const [before] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!));
  const target = await ensureWaitingSeason(f.db, f.seasonId, f.clock);
  await transferCommander(f.db, f.playerIds[0]!, target!.id, f.clock);
  const app = await enqueueReturn(f.db, f.accountIds[0]!, f.clock, 1);
  expect((await transferCommander(f.db, f.playerIds[0]!, f.seasonId, f.clock, app.id)).status).toBe('MOVED');
  const [after] = await f.db.select().from(planets).where(eq(planets.id, before!.id));
  expect(after).toMatchObject({ slotIndex: before!.slotIndex, x: before!.x, y: before!.y, z: before!.z, seasonId: f.seasonId });
  const [player] = await f.db.select().from(players).where(eq(players.id, f.playerIds[0]!));
  expect(player?.placementVersion).toBe(2);
  expect(player?.mainEnteredAt).toEqual(f.clock.now());
});
it('rechecks activity and refuses ended or incompatible seasons', async () => {
  const f = await idleFixture();
  const target = await ensureWaitingSeason(f.db, f.seasonId, f.clock);
  await f.db.update(players).set({ lastActiveAt: f.clock.now() }).where(eq(players.id, f.playerIds[0]!));
  expect((await transferCommander(f.db, f.playerIds[0]!, target!.id, f.clock)).status).toBe('ACTIVE');
  await f.db.update(seasons).set({ status: 'frozen' }).where(eq(seasons.id, target!.id));
  expect((await transferCommander(f.db, f.playerIds[0]!, target!.id, f.clock)).status).toBe('SEASON');
  expect(await f.db.select().from(commanderTransfers)).toHaveLength(0);
});
it('moves all colonies and preserves their fleet', async () => {
  const f = await idleFixture();
  const [home] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!));
  const [colony] = await f.db.insert(planets).values({ controllerPlayerId: f.playerIds[0]!, seasonId: f.seasonId,
    kind: 'COLONY', name: 'Keep me', slotIndex: 700, x: 1990, y: 0, z: 0, lastTickAt: f.clock.now() }).returning();
  await giveUnits(f.db, colony!.id, { DART: 3 });
  const fleet = await f.db.select().from(units).where(eq(units.planetId, colony!.id));
  const target = await ensureWaitingSeason(f.db, f.seasonId, f.clock);
  expect((await transferCommander(f.db, f.playerIds[0]!, target!.id, f.clock)).status).toBe('MOVED');
  expect(await f.db.select().from(units).where(eq(units.planetId, colony!.id))).toEqual(fleet);
  const worlds = await f.db.select().from(planets).where(eq(planets.controllerPlayerId, home!.controllerPlayerId!));
  expect(worlds.map(w => w.seasonId)).toEqual([target!.id, target!.id]);
  expect(await f.db.select().from(mainVacancies)).toHaveLength(2);
});
it('retains an inactive defender while somebody else is attacking it', async () => {
  const f = await idleFixture();
  await giveUnits(f.db, f.planetIds[1]!, { DART: 2 });
  await launchAttack(f.db, f.planetIds[1]!, f.planetIds[0]!, { DART: 1 }, f.clock);
  const target = await ensureWaitingSeason(f.db, f.seasonId, f.clock);
  expect((await transferCommander(f.db, f.playerIds[0]!, target!.id, f.clock)).status).toBe('FLIGHT');
  expect(await f.db.select().from(commanderTransfers)).toHaveLength(0);
});
it('runs one bounded sweep across replicas per five minutes and picks existing inactive players', async () => {
  const f = await idleFixture();
  const first = await runSilentSpaceSweep(f.db, f.clock, { batchSize: 1 });
  expect(first.movedOut).toBe(1);
  expect((await runSilentSpaceSweep(f.db, f.clock, { batchSize: 1 })).ran).toBe(false);
  f.clock.advance(4.999);
  expect((await runSilentSpaceSweep(f.db, f.clock, { batchSize: 1 })).ran).toBe(false);
  f.clock.advance(0.001);
  expect((await runSilentSpaceSweep(f.db, f.clock, { batchSize: 1 })).ran).toBe(true);
  expect(await f.db.select().from(scheduledEvents).where(and(eq(scheduledEvents.kind, 'season_end'), eq(scheduledEvents.status, 'pending')))).not.toHaveLength(0);
});
it('gives queued returns a turn even while more inactive commanders await departure', async () => {
  const f = await idleFixture();
  const target = await ensureWaitingSeason(f.db, f.seasonId, f.clock);
  expect((await transferCommander(f.db, f.playerIds[0]!, target!.id, f.clock)).status).toBe('MOVED');
  await enqueueReturn(f.db, f.accountIds[0]!, f.clock, 1);
  await f.db.update(players).set({ lastActiveAt: new Date(f.clock.now().getTime() - 48 * 60 * 60_000) })
    .where(eq(players.id, f.playerIds[1]!));
  const sweep = await runSilentSpaceSweep(f.db, f.clock, { batchSize: 1 });
  expect(sweep.returned).toBe(1);
  expect(sweep.movedOut).toBe(0);
});
