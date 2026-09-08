import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, expect, it } from 'vitest';
import { galaxyEventOccurrences, players, scheduledEvents, seasons, shards } from '../src/db/schema.js';
import { ensureWaitingSeason } from '../src/services/waitingServers.js';
import { ensureSeasonActs } from '../src/services/season.js';
import { ensureGalaxyEventLifecycleEvents } from '../src/services/galaxyEvents.js';
import { seedWorld, testDb, type Fixture } from './helpers.js';

let f: Fixture;
beforeEach(async () => { f = await seedWorld(1); });
afterAll(async () => { await (await testDb()).close(); });

it('provisions once under two concurrent requests and preserves the source period', async () => {
  const [a, b] = await Promise.all([
    ensureWaitingSeason(f.db, f.seasonId, f.clock),
    ensureWaitingSeason(f.db, f.seasonId, f.clock),
  ]);
  expect(a?.id).toBe(b?.id);
  const [source] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
  expect(a).toMatchObject({ cycleId: source!.cycleId, startsAt: source!.startsAt, endsAt: source!.endsAt });
  expect(await f.db.select().from(shards).where(eq(shards.role, 'WAITING'))).toHaveLength(1);
});

it('opens another waiting shard when the first has no commander seats', async () => {
  const first = await ensureWaitingSeason(f.db, f.seasonId, f.clock);
  await f.db.update(shards).set({ playerCap: 1 }).where(eq(shards.id, first!.shardId));
  await f.db.update(players).set({ seasonId: first!.id });
  const second = await ensureWaitingSeason(f.db, f.seasonId, f.clock);
  expect(second?.id).not.toBe(first!.id);
  expect(await f.db.select().from(shards).where(eq(shards.role, 'WAITING'))).toHaveLength(2);
});

it('does not replay old calendar events when provisioned mid-period', async () => {
  await f.db.update(seasons).set({ rulesetVersion: 6 }).where(eq(seasons.id, f.seasonId));
  f.clock.advance(7 * 24 * 60);
  const waiting = await ensureWaitingSeason(f.db, f.seasonId, f.clock);
  // Restart repair must not recreate a backlog that provisioning deliberately omitted.
  await ensureSeasonActs(f.db);
  await ensureGalaxyEventLifecycleEvents(f.db);
  const events = await f.db.select().from(scheduledEvents).where(and(
    eq(scheduledEvents.seasonId, waiting!.id), eq(scheduledEvents.status, 'pending'),
  ));
  expect(events.length).toBeGreaterThan(0);
  expect(events.every((event) => event.resolveAt >= f.clock.now())).toBe(true);
  const past = (await f.db.select().from(galaxyEventOccurrences)
    .where(eq(galaxyEventOccurrences.seasonId, waiting!.id))).filter((event) => event.endsAt <= f.clock.now());
  expect(past.length).toBeGreaterThan(0);
  expect(past.every((event) => event.startProcessedAt !== null && event.endProcessedAt !== null)).toBe(true);
});

it('does not create a waiting season after the source deadline or operational limit', async () => {
  expect(await ensureWaitingSeason(f.db, f.seasonId, f.clock, { maxShards: 0 })).toBeNull();
  const [source] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
  f.clock.set(source!.endsAt);
  expect(await ensureWaitingSeason(f.db, f.seasonId, f.clock)).toBeNull();
  expect(await f.db.select().from(shards).where(eq(shards.role, 'WAITING'))).toHaveLength(0);
});
