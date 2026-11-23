import { and, eq } from 'drizzle-orm';
import { afterAll, expect, it } from 'vitest';
import { MULTI_WORLD, generateGalaxy, selectNeutralSlots } from '@astera/rules';
import { mainVacancies, moons, planets, players, seasons, shards, units } from '../src/db/schema.js';
import { transferCommander } from '../src/services/commanderTransfer.js';
import { MOON_LOCATION, PLANET_LOCATION } from '../src/services/unitLocation.js';
import { ensureWaitingSeason } from '../src/services/waitingServers.js';
import { giveUnits, makeAccount, seedWorld, testDb } from './helpers.js';

/*
  F2c (plan §6.17, S56, V19, V20): a commander transfer moves the capital and the colonies, never a
  colony's moon. The moon belongs to its slot in the MAIN galaxy; the capital's moon goes with it.
*/
afterAll(async () => { await (await testDb()).close(); });

const moonRow = (planetId: string, at: Date, overrides: Partial<typeof moons.$inferInsert> = {}) => ({
  planetId, rarity: 'RARE' as const, origin: 'BATTLE' as const, cracks: 1, lastHitAt: at, visualSeed: 5, bornAt: at,
  gateReadyAt: new Date(at.getTime() + 600_000), ...overrides,
});

it('leaves a departing colony’s moon in its slot, takes the capital’s along, and lands moon ships first', async () => {
  const f = await seedWorld(1);
  const original = selectNeutralSlots(4242, generateGalaxy(4242, MULTI_WORLD.neutralSlotPool).slots).find((slot) => slot.tier === 2)!;
  const [colony] = await f.db.insert(planets).values({ controllerPlayerId: f.playerIds[0]!, seasonId: f.seasonId, kind: 'COLONY',
    name: 'Moon colony', slotIndex: original.slot.index, x: original.slot.x, y: original.slot.y, z: original.slot.z,
    lastTickAt: f.clock.now() }).returning();
  const capital = f.planetIds[0]!;
  const at = f.clock.now();
  await f.db.insert(moons).values([moonRow(colony!.id, at), moonRow(capital, at, { rarity: 'COMMON', origin: 'BUILT' })]);
  await giveUnits(f.db, capital, { DART: 4 });
  await f.db.insert(units).values({ planetId: capital, ownerPlayerId: f.playerIds[0]!, hull: 'DART', location: MOON_LOCATION, count: 6 });

  f.clock.advance(48 * 60);
  const waiting = await ensureWaitingSeason(f.db, f.seasonId, f.clock);
  expect((await transferCommander(f.db, f.playerIds[0]!, waiting!.id, f.clock)).status).toBe('MOVED');

  const [replacement] = await f.db.select({ id: planets.id }).from(planets)
    .where(and(eq(planets.seasonId, f.seasonId), eq(planets.slotIndex, original.slot.index)));
  const [left] = await f.db.select().from(moons).where(eq(moons.planetId, replacement!.id));
  expect(left).toMatchObject({ rarity: 'RARE', origin: 'BATTLE', cracks: 1, lastHitAt: at, gateReadyAt: null });
  expect(await f.db.select().from(moons).where(eq(moons.planetId, colony!.id))).toEqual([]);
  // The capital's moon rides with the capital row; dormant in Silent Space (§6.2).
  const [capitalMoon] = await f.db.select().from(moons).where(eq(moons.planetId, capital));
  expect(capitalMoon).toMatchObject({ rarity: 'COMMON', origin: 'BUILT' });
  // Nobody is left standing on a moon in a galaxy where moons sleep (V20).
  const fleet = await f.db.select({ location: units.location, count: units.count }).from(units)
    .where(and(eq(units.planetId, capital), eq(units.hull, 'DART')));
  expect(fleet).toEqual([{ location: PLANET_LOCATION, count: 10 }]);
});

it('a returning colony that takes back its old address takes back the moon standing in that slot', async () => {
  const f = await seedWorld(1);
  const [colony] = await f.db.insert(planets).values({ controllerPlayerId: f.playerIds[0]!, seasonId: f.seasonId, kind: 'COLONY',
    name: 'Kept', slotIndex: 700, x: 1500, y: 0, z: 0, lastTickAt: f.clock.now() }).returning();
  await f.db.insert(moons).values(moonRow(colony!.id, f.clock.now(), { rarity: 'EPIC' }));
  f.clock.advance(48 * 60);
  const waiting = await ensureWaitingSeason(f.db, f.seasonId, f.clock);
  await transferCommander(f.db, f.playerIds[0]!, waiting!.id, f.clock);
  const [neutral] = await f.db.select({ id: planets.id }).from(planets).where(and(eq(planets.seasonId, f.seasonId), eq(planets.slotIndex, 700)));
  expect(await f.db.select({ id: moons.planetId }).from(moons).where(eq(moons.planetId, neutral!.id))).toHaveLength(1);

  const { enqueueReturn } = await import('../src/services/returnQueue.js');
  const { joinSeason } = await import('../src/services/player.js');
  await f.db.update(mainVacancies).set({ consumedAt: f.clock.now(), consumedReason: 'NEW_JOIN' }).where(eq(mainVacancies.kind, 'CAPITAL'));
  const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
  await f.db.update(shards).set({ playerCap: 1 }).where(eq(shards.id, season!.shardId));
  await joinSeason(f.db, (await makeAccount(f.db, 'occupant')).id, f.seasonId, f.clock);
  const application = await enqueueReturn(f.db, f.accountIds[0]!, f.clock, 1);
  expect((await transferCommander(f.db, f.playerIds[0]!, f.seasonId, f.clock, application.id)).status).toBe('MOVED');

  const [back] = await f.db.select().from(moons).where(eq(moons.planetId, colony!.id));
  expect(back).toMatchObject({ rarity: 'EPIC', gateReadyAt: null });
  expect(await f.db.select().from(moons).where(eq(moons.planetId, neutral!.id))).toEqual([]);
});

it('holds a transfer and an account deletion back while a hop is under way (E16)', async () => {
  const f = await seedWorld(1);
  const { MOON } = await import('@astera/rules');
  const { hopFleet } = await import('../src/services/moonMovement.js');
  const { deleteAccount } = await import('../src/services/accountDeletion.js');
  const { accounts } = await import('../src/db/schema.js');
  await f.db.update(seasons).set({ rulesetVersion: MOON.rulesetVersion }).where(eq(seasons.id, f.seasonId));
  const capital = f.planetIds[0]!;
  await f.db.insert(moons).values(moonRow(capital, f.clock.now(), { gateReadyAt: null }));
  await giveUnits(f.db, capital, { DART: 3 });
  f.clock.advance(48 * 60);
  await hopFleet(f.db, f.playerIds[0]!, capital, 'UP', { DART: 3 }, f.clock);
  // V55: the hop itself restarts the Silent Space clock, so a commander due to move cannot hop on their own.
  // The guard still holds for any other road into a transfer: the clock is put back to reach it.
  await f.db.update(players).set({ lastProgressAt: new Date(f.clock.now().getTime() - 48 * 3_600_000) })
    .where(eq(players.id, f.playerIds[0]!));
  const waiting = await ensureWaitingSeason(f.db, f.seasonId, f.clock);
  expect((await transferCommander(f.db, f.playerIds[0]!, waiting!.id, f.clock)).status).toBe('FLIGHT');
  const [account] = await f.db.select().from(accounts).where(eq(accounts.id, f.accountIds[0]!));
  await expect(deleteAccount(f.db, f.clock, account!.username)).rejects.toMatchObject({ code: 'WORLD_BUSY' });
});
