import { joinSeason } from '../src/services/player.js';
import { and, eq } from 'drizzle-orm';
import { afterAll, expect, it } from 'vitest';
import { seedWorld, testDb, giveUnits, makeAccount } from './helpers.js';
import { players, planets, playerRivals, units, commanderTransfers, mainVacancies, scheduledEvents, seasons, shards } from '../src/db/schema.js';
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
/**
 * A RIVAL MARK DOES NOT SURVIVE A CHANGE OF GALAXY. D183.
 *
 * A mark names a commander, and a commander who is not in this galaxy is not on
 * this disc — `rivalSlotOf` matches by controller id, so nothing is ever drawn for
 * one. Left standing it would be worse than useless: invisible, and still counted
 * against `RIVAL.max`, so a commander coming back from Silent Space would find
 * their bookmarks gone AND their slots spent.
 *
 * Both directions again, exactly as the reclaim does it: the marks this commander
 * was keeping, and the marks other commanders were keeping on them. The second set
 * belongs to people still in the old galaxy, and what they were watching has left
 * it.
 */
it('drops the rival marks on both sides when a commander changes galaxy', async () => {
  const f = await idleFixture();
  await f.db.insert(playerRivals).values([
    // What the mover was watching.
    { playerId: f.playerIds[0]!, planetId: f.planetIds[1]!, targetPlayerId: f.playerIds[1]!, slot: 0 },
    // What somebody staying behind was watching about the mover.
    { playerId: f.playerIds[1]!, planetId: f.planetIds[0]!, targetPlayerId: f.playerIds[0]!, slot: 2 },
  ]);

  const target = await ensureWaitingSeason(f.db, f.seasonId, f.clock);
  expect((await transferCommander(f.db, f.playerIds[0]!, target!.id, f.clock)).status).toBe('MOVED');

  expect(await f.db.select().from(playerRivals)).toHaveLength(0);
});

/** A mark between two commanders who both stayed is none of the move's business. */
it('leaves the marks of commanders who did not move', async () => {
  const f = await seedWorld(3);
  f.clock.advance(48 * 60);
  await f.db.update(players).set({ lastActiveAt: f.clock.now() })
    .where(eq(players.id, f.playerIds[1]!));
  await f.db.update(players).set({ lastActiveAt: f.clock.now() })
    .where(eq(players.id, f.playerIds[2]!));
  await f.db.insert(playerRivals).values({
    playerId: f.playerIds[1]!, planetId: f.planetIds[2]!, targetPlayerId: f.playerIds[2]!, slot: 0,
  });

  const target = await ensureWaitingSeason(f.db, f.seasonId, f.clock);
  expect((await transferCommander(f.db, f.playerIds[0]!, target!.id, f.clock)).status).toBe('MOVED');

  expect(await f.db.select().from(playerRivals)).toHaveLength(1);
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

it('reserves departed addresses for queued returns while keeping unused seats open', async () => {
  const f = await idleFixture();
  const [before] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!));
  const target = await ensureWaitingSeason(f.db, f.seasonId, f.clock);
  await transferCommander(f.db, f.playerIds[0]!, target!.id, f.clock);
  await f.db.update(players).set({ lastActiveAt: new Date(f.clock.now().getTime() - 48 * 60 * 60_000) }).where(eq(players.id, f.playerIds[1]!));
  await transferCommander(f.db, f.playerIds[1]!, target!.id, f.clock);
  const app = await enqueueReturn(f.db, f.accountIds[0]!, f.clock, 1);
  const newcomer = await makeAccount(f.db, 'new-seat');
  const joined = await joinSeason(f.db, newcomer.id, f.seasonId, f.clock);
  expect(joined.slotIndex).not.toBe(before!.slotIndex);
  expect((await transferCommander(f.db, f.playerIds[0]!, f.seasonId, f.clock, app.id)).status).toBe('MOVED');
});
it('closes a vacancy consumed by a new player when no return is queued', async () => {
  const f = await idleFixture();
  const target = await ensureWaitingSeason(f.db, f.seasonId, f.clock);
  await transferCommander(f.db, f.playerIds[0]!, target!.id, f.clock);
  await f.db.update(players).set({ lastActiveAt: new Date(f.clock.now().getTime() - 48 * 60 * 60_000) }).where(eq(players.id, f.playerIds[1]!));
  await transferCommander(f.db, f.playerIds[1]!, target!.id, f.clock);
  const [source] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
  await f.db.update(shards).set({ playerCap: 1 }).where(eq(shards.id, source!.shardId));
  const newcomer = await makeAccount(f.db, 'new-seat');
  const joined = await joinSeason(f.db, newcomer.id, f.seasonId, f.clock);
  const [vacancy] = await f.db.select().from(mainVacancies).where(eq(mainVacancies.slotIndex, joined.slotIndex));
  expect(joined.slotIndex).toBe(vacancy!.slotIndex);
  expect(vacancy!.consumedReason).toBe('NEW_JOIN');
});
