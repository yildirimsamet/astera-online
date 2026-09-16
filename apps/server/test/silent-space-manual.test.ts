/**
 * THE OWNER MOVING ONE NAMED PERSON, BECAUSE THAT PERSON ASKED.
 *
 * Silent Space is otherwise entered by absence alone: the sweep reads
 * `inactivityEligible` and nothing else decides. This file covers the one door
 * that absence does not open — a commander who is playing right now and has
 * asked, in words the server cannot see, to be taken out of the main galaxy.
 *
 * The thing worth testing is how NARROW that door is. `ownerRequested` waives
 * the activity clock and not one other fence: a fleet in the air, a live wreck,
 * an event mid-flight all still refuse, and refusing writes nothing. And the
 * move is not a trapdoor — the ordinary return application brings the commander
 * home to the address they left.
 */
import { afterAll, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { giveUnits, makeAccount, seedWorld, testDb } from './helpers.js';
import { commanderTransfers, mainVacancies, planets, players, seasons, shards, units } from '../src/db/schema.js';
import { departToSilentSpace, describeSilentSpaceDeparture, runSilentSpaceSweep } from '../src/services/silentSpace.js';
import { transferCommander } from '../src/services/commanderTransfer.js';
import { ensureWaitingSeason } from '../src/services/waitingServers.js';
import { enqueueReturn } from '../src/services/returnQueue.js';
import { joinSeason } from '../src/services/player.js';
import { launchAttack } from '../src/services/mission.js';

afterAll(async () => { await (await testDb()).close(); });

it('names the commander, the worlds they hold and the galaxy they would leave', async () => {
  const f = await seedWorld(2);
  const found = await describeSilentSpaceDeparture(f.db, f.clock, 'Tester0');
  expect(found).toMatchObject({ commander: 'Tester0', playerId: f.playerIds[0]!, seasonId: f.seasonId, inactive: false });
  expect(found.worlds).toEqual([expect.objectContaining({ id: f.planetIds[0]!, kind: 'CAPITAL' })]);
});

/** The operator is typing a name read in a message, not a uuid. Two matches is a stop. */
it('refuses a name that is not exactly one commander', async () => {
  const f = await seedWorld(2);
  await expect(describeSilentSpaceDeparture(f.db, f.clock, 'Nobody')).rejects.toThrow(/No commander named Nobody/);
  const twin = await makeAccount(f.db, 'Tester0');
  await joinSeason(f.db, twin.id, f.seasonId, f.clock);
  await expect(describeSilentSpaceDeparture(f.db, f.clock, 'Tester0')).rejects.toThrow(/more than one commander/);
  expect(await f.db.select().from(commanderTransfers)).toHaveLength(0);
});

it('refuses a commander who is already out of the main galaxy', async () => {
  const f = await seedWorld(2);
  expect((await departToSilentSpace(f.db, f.clock, 'Tester0')).status).toBe('MOVED');
  await expect(describeSilentSpaceDeparture(f.db, f.clock, 'Tester0')).rejects.toThrow(/already/);
});

it('moves an active commander who asked, with worlds, fleet and a return address intact', async () => {
  const f = await seedWorld(2);
  await giveUnits(f.db, f.planetIds[0]!, { DART: 4 });
  const [before] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!));
  const fleet = await f.db.select().from(units).where(eq(units.planetId, f.planetIds[0]!));

  const result = await departToSilentSpace(f.db, f.clock, 'Tester0');

  expect(result.status).toBe('MOVED');
  const [target] = await f.db.select({ role: shards.role }).from(seasons)
    .innerJoin(shards, eq(shards.id, seasons.shardId)).where(eq(seasons.id, result.targetSeasonId!));
  expect(target?.role).toBe('WAITING');
  const [after] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!));
  expect(after).toMatchObject({ id: before!.id, name: before!.name, controllerPlayerId: f.playerIds[0]!,
    seasonId: result.targetSeasonId!, alloy: before!.alloy, crystal: before!.crystal });
  expect(await f.db.select().from(units).where(eq(units.planetId, f.planetIds[0]!))).toEqual(fleet);
  const [moved] = await f.db.select().from(players).where(eq(players.id, f.playerIds[0]!));
  expect(moved).toMatchObject({ placementVersion: 1, seasonId: result.targetSeasonId! });
  const audit = await f.db.select().from(commanderTransfers);
  expect(audit).toHaveLength(1);
  expect(audit[0]).toMatchObject({ playerId: f.playerIds[0]!, direction: 'OUT', applicationId: null,
    sourceSeasonId: f.seasonId, targetSeasonId: result.targetSeasonId! });
  expect(audit[0]?.emittedAt).not.toBeNull();
  const vacancies = await f.db.select().from(mainVacancies);
  expect(vacancies).toEqual([expect.objectContaining({ seasonId: f.seasonId, kind: 'CAPITAL', slotIndex: before!.slotIndex, consumedAt: null })]);
});

/** The waiver is the activity clock and nothing else. */
it('still refuses an owner-requested move while a fleet is in the air, and writes nothing', async () => {
  const f = await seedWorld(2);
  await giveUnits(f.db, f.planetIds[1]!, { DART: 2 });
  await launchAttack(f.db, f.planetIds[1]!, f.planetIds[0]!, { DART: 1 }, f.clock);

  const result = await departToSilentSpace(f.db, f.clock, 'Tester0');

  expect(result.status).toBe('FLIGHT');
  expect(await f.db.select().from(commanderTransfers)).toHaveLength(0);
  expect(await f.db.select().from(mainVacancies)).toHaveLength(0);
  const [stayed] = await f.db.select().from(players).where(eq(players.id, f.playerIds[0]!));
  expect(stayed).toMatchObject({ seasonId: f.seasonId, placementVersion: 0 });
});

/** Absence remains the only automatic reason to leave. */
it('does not waive the activity clock for the sweep or for an ordinary transfer', async () => {
  const f = await seedWorld(2);
  const target = await ensureWaitingSeason(f.db, f.seasonId, f.clock);
  expect((await transferCommander(f.db, f.playerIds[0]!, target!.id, f.clock)).status).toBe('ACTIVE');
  expect((await runSilentSpaceSweep(f.db, f.clock)).movedOut).toBe(0);
  expect(await f.db.select().from(commanderTransfers)).toHaveLength(0);
});

/** Not a trapdoor: the ordinary application brings them home to the address they left. */
it('leaves a return address the ordinary application can bring the commander home to', async () => {
  const f = await seedWorld(2);
  const [before] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!));
  expect((await departToSilentSpace(f.db, f.clock, 'Tester0')).status).toBe('MOVED');

  await enqueueReturn(f.db, f.accountIds[0]!, f.clock, 1);
  expect((await runSilentSpaceSweep(f.db, f.clock)).returned).toBe(1);

  const [home] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!));
  expect(home).toMatchObject({ seasonId: f.seasonId, slotIndex: before!.slotIndex, x: before!.x, y: before!.y, z: before!.z });
  const [player] = await f.db.select().from(players).where(eq(players.id, f.playerIds[0]!));
  expect(player).toMatchObject({ seasonId: f.seasonId, placementVersion: 2 });
});
