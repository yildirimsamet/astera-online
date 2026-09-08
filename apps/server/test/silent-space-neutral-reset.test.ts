import { transferPlanetControl } from '../src/services/ownership.js';
import { afterAll, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { generateGalaxy, MULTI_WORLD, selectNeutralSlots } from '@astera/rules';
import { seedWorld, testDb, giveUnits } from './helpers.js';
import { buildings, neutralPlanetState, planets, units, mainVacancies, commanderTransfers } from '../src/db/schema.js';
import { transferCommander } from '../src/services/commanderTransfer.js';
import { ensureWaitingSeason } from '../src/services/waitingServers.js';

afterAll(async () => { await (await testDb()).close(); });
it.each([1, 2, 3] as const)('leaves an original T%s neutral while the developed colony travels with its commander', async tier => {
  const f = await seedWorld(1);
  const original = selectNeutralSlots(4242, generateGalaxy(4242, MULTI_WORLD.neutralSlotPool).slots).find(slot => slot.tier === tier)!;
  const [colony] = await f.db.insert(planets).values({ controllerPlayerId: f.playerIds[0]!, seasonId: f.seasonId, kind: 'COLONY', name: 'My developed colony',
    slotIndex: original.slot.index, x: original.slot.x, y: original.slot.y, z: original.slot.z, lastTickAt: f.clock.now(), builtEver: { DART: 17 } }).returning();
  await f.db.insert(buildings).values({ planetId: colony!.id, type: 'CORE', level: 12 });
  await giveUnits(f.db, colony!.id, { DART: 17 });
  const fleet = await f.db.select().from(units).where(eq(units.planetId, colony!.id));
  f.clock.advance(48 * 60);
  const waiting = await ensureWaitingSeason(f.db, f.seasonId, f.clock);
  expect((await transferCommander(f.db, f.playerIds[0]!, waiting!.id, f.clock)).status).toBe('MOVED');
  const [moved] = await f.db.select().from(planets).where(eq(planets.id, colony!.id));
  expect(moved).toMatchObject({ seasonId: waiting!.id, controllerPlayerId: f.playerIds[0], name: 'My developed colony', builtEver: { DART: 17 } });
  expect(await f.db.select().from(units).where(eq(units.planetId, colony!.id))).toEqual(fleet);
  const [replacement] = await f.db.select().from(planets).where(and(eq(planets.seasonId, f.seasonId), eq(planets.slotIndex, original.slot.index)));
  expect(replacement).toMatchObject({ controllerPlayerId: null, kind: 'NEUTRAL', x: colony!.x, y: colony!.y, z: colony!.z, builtEver: {} });
  expect(replacement!.id).not.toBe(colony!.id);
  const [state] = await f.db.select().from(neutralPlanetState).where(eq(neutralPlanetState.planetId, replacement!.id));
  expect(state).toMatchObject({ tier, claimUntil: null, profileSeed: original.profileSeed });
  const levels = await f.db.select().from(buildings).where(eq(buildings.planetId, replacement!.id));
  expect(Object.fromEntries(levels.map(row => [row.type, row.level]))).toEqual(MULTI_WORLD.neutral[tier].buildings);
});

it('can reset the same address again after somebody captures the replacement', async () => {
  const f = await seedWorld(2);
  const [colony] = await f.db.insert(planets).values({ controllerPlayerId: f.playerIds[0]!, seasonId: f.seasonId, kind: 'COLONY', name: 'Colony', slotIndex: 700, x: 1500, y: 0, z: 0, lastTickAt: f.clock.now() }).returning();
  f.clock.advance(48 * 60);
  const waiting = await ensureWaitingSeason(f.db, f.seasonId, f.clock);
  expect((await transferCommander(f.db, f.playerIds[0]!, waiting!.id, f.clock)).status).toBe('MOVED');
  const [neutral] = await f.db.select().from(planets).where(and(eq(planets.seasonId, f.seasonId), eq(planets.slotIndex, colony!.slotIndex)));
  await f.db.transaction(tx => transferPlanetControl(tx, { targetPlanetId: neutral!.id, newPlayerId: f.playerIds[1]!, expectedControllerPlayerId: null, protectedUntil: f.clock.now(), now: f.clock.now() }));
  expect((await transferCommander(f.db, f.playerIds[1]!, waiting!.id, f.clock)).status).toBe('MOVED');
  const addresses = await f.db.select().from(mainVacancies).where(eq(mainVacancies.slotIndex, 700));
  expect(addresses).toHaveLength(2);
  expect(addresses.filter(row => row.consumedAt === null)).toHaveLength(1);
});

it('returns above capacity using the neutral address and preserves the developed colony', async () => {
  const f = await seedWorld(1);
  const [colony] = await f.db.insert(planets).values({ controllerPlayerId: f.playerIds[0]!, seasonId: f.seasonId, kind: 'COLONY', name: 'Kept', slotIndex: 700, x: 1500, y: 0, z: 0, lastTickAt: f.clock.now() }).returning();
  f.clock.advance(48 * 60);
  const waiting = await ensureWaitingSeason(f.db, f.seasonId, f.clock);
  await transferCommander(f.db, f.playerIds[0]!, waiting!.id, f.clock);
  const { enqueueReturn } = await import('../src/services/returnQueue.js');
  const { mainVacancies, shards, seasons } = await import('../src/db/schema.js');
  await f.db.update(mainVacancies).set({ consumedAt: f.clock.now(), consumedReason: 'NEW_JOIN' }).where(eq(mainVacancies.kind, 'CAPITAL'));
  const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
  await f.db.update(shards).set({ playerCap: 1 }).where(eq(shards.id, season!.shardId));
  const { makeAccount } = await import('./helpers.js');
  const { joinSeason } = await import('../src/services/player.js');
  const account = await makeAccount(f.db, 'occupant');
  await joinSeason(f.db, account.id, f.seasonId, f.clock);
  const app = await enqueueReturn(f.db, f.accountIds[0]!, f.clock, 1);
  expect((await transferCommander(f.db, f.playerIds[0]!, f.seasonId, f.clock, app.id)).status).toBe('MOVED');
  const [returned] = await f.db.select().from(planets).where(eq(planets.id, colony!.id));
  expect(returned).toMatchObject({ seasonId: f.seasonId, slotIndex: 700, name: 'Kept' });
  const [audit] = await f.db.select().from(commanderTransfers).where(eq(commanderTransfers.direction, 'RETURN'));
  expect(audit!.worlds.some(world => world.kind === 'NEUTRAL')).toBe(true);
});

it('shares three departure colony sites between two applicants and refuses a captured site', async () => {
  const f = await seedWorld(3);
  const colonyIds: string[][] = [[], [], []];
  for (let player = 0; player < 3; player++) for (let j = 0; j < 3 - player; j++) {
    const [colony] = await f.db.insert(planets).values({ controllerPlayerId: f.playerIds[player]!, seasonId: f.seasonId, kind: 'COLONY', name: `C${player}-${j}`, slotIndex: 700 + player * 10 + j, x: 1300 + player * 100, y: j * 100, z: 0, lastTickAt: f.clock.now() }).returning();
    colonyIds[player]!.push(colony!.id);
  }
  f.clock.advance(48 * 60);
  const waiting = await ensureWaitingSeason(f.db, f.seasonId, f.clock);
  for (const player of f.playerIds) expect((await transferCommander(f.db, player, waiting!.id, f.clock)).status).toBe('MOVED');
  const { enqueueReturn } = await import('../src/services/returnQueue.js');
  const { gt } = await import('drizzle-orm');
  await f.db.update(mainVacancies).set({ consumedAt: f.clock.now(), consumedReason: 'TEST_UNAVAILABLE' }).where(and(eq(mainVacancies.kind, 'COLONY'), gt(mainVacancies.slotIndex, 702)));
  const y = await enqueueReturn(f.db, f.accountIds[1]!, f.clock, 1);
  expect((await transferCommander(f.db, f.playerIds[1]!, f.seasonId, f.clock, y.id)).status).toBe('MOVED');
  const remaining = await f.db.select().from(planets).where(and(eq(planets.seasonId, f.seasonId), eq(planets.kind, 'NEUTRAL')));
  const free = remaining.find(world => world.slotIndex >= 700 && world.slotIndex <= 702)!;
  expect(free).toBeDefined();
  const z = await enqueueReturn(f.db, f.accountIds[2]!, f.clock, 1);
  await f.db.transaction(tx => transferPlanetControl(tx, { targetPlanetId: free.id, newPlayerId: f.playerIds[1]!, expectedControllerPlayerId: null, protectedUntil: f.clock.now(), now: f.clock.now() }));
  expect((await transferCommander(f.db, f.playerIds[2]!, f.seasonId, f.clock, z.id)).status).toBe('CAPACITY');
  await f.db.update(planets).set({ kind: 'NEUTRAL', controllerPlayerId: null }).where(eq(planets.id, free.id));
  expect((await transferCommander(f.db, f.playerIds[2]!, f.seasonId, f.clock, z.id)).status).toBe('MOVED');
  const [zColony] = await f.db.select().from(planets).where(eq(planets.id, colonyIds[2]![0]!));
  expect(zColony).toMatchObject({ slotIndex: free.slotIndex, name: 'C2-0', controllerPlayerId: f.playerIds[2] });
});

it('uses another available neutral site when one has an incoming fleet', async () => {
  const f = await seedWorld(2);
  const { missions } = await import('../src/db/schema.js');
  const { enqueueReturn } = await import('../src/services/returnQueue.js');
  const [colony] = await f.db.insert(planets).values({ controllerPlayerId: f.playerIds[0]!, seasonId: f.seasonId, kind: 'COLONY', name: 'Kept', slotIndex: 700, x: 1500, y: 0, z: 0, lastTickAt: f.clock.now() }).returning();
  f.clock.advance(48 * 60);
  const waiting = await ensureWaitingSeason(f.db, f.seasonId, f.clock);
  await transferCommander(f.db, f.playerIds[0]!, waiting!.id, f.clock);
  const [neutral] = await f.db.select().from(planets).where(and(eq(planets.seasonId, f.seasonId), eq(planets.slotIndex, 700)));
  const [vacancy] = await f.db.select().from(mainVacancies).where(eq(mainVacancies.kind, 'COLONY'));
  await f.db.insert(planets).values({ seasonId: f.seasonId, kind: 'NEUTRAL', name: 'Other site', slotIndex: 701, x: 1600, y: 0, z: 0, lastTickAt: f.clock.now() });
  await f.db.insert(mainVacancies).values({ cycleId: vacancy!.cycleId, seasonId: f.seasonId, departureTransferId: vacancy!.departureTransferId, kind: 'COLONY', slotIndex: 701, x: 1600, y: 0, z: 0, createdAt: new Date(f.clock.now().getTime() + 1) });
  await f.db.insert(missions).values({ seasonId: f.seasonId, kind: 'probe', ownerPlayerId: f.playerIds[1]!, originPlanetId: f.planetIds[1]!, targetPlanetId: neutral!.id, fleet: {}, distance: 10, departAt: f.clock.now(), arriveAt: new Date(f.clock.now().getTime() + 60_000) });
  const application = await enqueueReturn(f.db, f.accountIds[0]!, f.clock, 1);
  expect((await transferCommander(f.db, f.playerIds[0]!, f.seasonId, f.clock, application.id)).status).toBe('MOVED');
  const [returned] = await f.db.select().from(planets).where(eq(planets.id, colony!.id));
  expect(returned!.slotIndex).toBe(701);
});

it('leaves live wreckage at its source until it expires before moving its world', async () => {
  const f = await seedWorld(1);
  const { debrisFields } = await import('../src/db/schema.js');
  const { DEBRIS } = await import('@astera/rules');
  f.clock.advance(48 * 60);
  const [world] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!));
  await f.db.insert(debrisFields).values({ seasonId: f.seasonId, planetId: world!.id, x: world!.x, y: world!.y, z: world!.z, alloy: 40, crystal: 20, createdAt: f.clock.now() });
  const waiting = await ensureWaitingSeason(f.db, f.seasonId, f.clock);
  expect((await transferCommander(f.db, f.playerIds[0]!, waiting!.id, f.clock)).status).toBe('EFFECT');
  f.clock.advance(DEBRIS.decayMinutes + 1);
  expect((await transferCommander(f.db, f.playerIds[0]!, waiting!.id, f.clock)).status).toBe('MOVED');
});
