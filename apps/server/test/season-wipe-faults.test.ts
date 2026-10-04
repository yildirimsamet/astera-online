import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, expect, it } from 'vitest';
import {
  accounts, planetFaults, planets, players, scheduledEvents,
  seasonResults, seasonRewardEntitlements, seasons,
} from '../src/db/schema.js';
import { wipeAllServers } from '../src/services/servers.js';
import { forceSeasonEnd } from '../src/worker/handlers.js';
import { seedWorld, testDb } from './helpers.js';

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

it.each([false, true])('wipes a sealed colony with a fault (repairing: %s) and preserves its commander record and reward', async (repairing) => {
  const f = await seedWorld(1);
  const [capital] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!));
  if (!capital) throw new Error('fixture has no capital');
  const colonyId = randomUUID();
  await f.db.insert(planets).values({
    ...capital, id: colonyId, name: 'Fault colony', kind: 'COLONY', slotIndex: 61,
  });
  const faultId = randomUUID();
  const repairReadyAt = new Date(f.clock.now().getTime() + 60_000);
  await f.db.insert(planetFaults).values({
    id: faultId, planetId: colonyId, kind: 'REFINERY_OUTAGE', startedAt: f.clock.now(),
    ...(repairing ? {
      repairSlot: 0, repairStartedAt: f.clock.now(), repairReadyAt,
      repairCost: { alloy: 100, crystal: 50, deuterium: 0 },
    } : {}),
  });
  if (repairing) {
    await f.db.insert(scheduledEvents).values({
      seasonId: f.seasonId, kind: 'fault_repair_complete', refId: faultId,
      resolveAt: repairReadyAt,
    });
  }
  await f.db.update(players).set({ dominionTaken: 1_000 }).where(eq(players.id, f.playerIds[0]!));
  await forceSeasonEnd({ db: f.db, clock: f.clock }, f.seasonId);
  const resultsBefore = await f.db.select().from(seasonResults);
  expect(resultsBefore).toHaveLength(1);
  expect(await f.db.select().from(planetFaults)).toHaveLength(1);

  await expect(wipeAllServers(f.db, f.clock, { count: 1, capacity: 2, seedBase: 7719 }))
    .resolves.toMatchObject({ seasonsWiped: 1, playersCleared: 1, serversOpened: ['EU-1'] });

  expect(await f.db.select().from(planetFaults)).toEqual([]);
  expect(await f.db.select().from(planets).where(eq(planets.id, colonyId))).toEqual([]);
  expect(await f.db.select().from(scheduledEvents).where(eq(scheduledEvents.refId, faultId))).toEqual([]);
  expect(await f.db.select().from(accounts).where(eq(accounts.id, f.accountIds[0]!))).toHaveLength(1);
  expect(await f.db.select().from(seasonResults)).toEqual(resultsBefore);
  const [old] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
  expect(old).toMatchObject({ status: 'wiped', endReason: 'FORCED_WIPE' });
  const [reward] = await f.db.select().from(seasonRewardEntitlements);
  expect(reward).toMatchObject({ accountId: f.accountIds[0], status: 'PENDING', displayRank: 1 });
  expect(reward?.targetCycleId).toBeTruthy();
});
