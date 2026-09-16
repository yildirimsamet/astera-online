import { afterAll, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { planets, scheduledEvents } from '../src/db/schema.js';
import { runMigrations } from '../src/db/migrate.js';
import { armFaults } from '../src/services/faults.js';
import { seedWorld, setLevel, testDb } from './helpers.js';

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

it('arms every established live colony past the Core gate exactly once', async () => {
  const f = await seedWorld(3);
  const [eligible, belowGate, capital] = f.planetIds as [string, string, string];
  await f.db.update(planets).set({ kind: 'COLONY' })
    .where(eq(planets.id, eligible));
  await f.db.update(planets).set({ kind: 'COLONY' })
    .where(eq(planets.id, belowGate));
  await setLevel(f.db, eligible, 'CORE', 6);
  await setLevel(f.db, belowGate, 'CORE', 5);
  await setLevel(f.db, capital, 'CORE', 6);

  const before = new Date();
  await runMigrations(f.db);
  const after = new Date();

  const armed = await f.db.select().from(scheduledEvents).where(and(
    eq(scheduledEvents.seasonId, f.seasonId),
    eq(scheduledEvents.kind, 'fault_spawn'),
  ));
  expect(armed).toHaveLength(1);
  expect(armed[0]).toMatchObject({
    refId: eligible,
    dedupeKey: `fault-spawn:arm:${eligible}`,
    status: 'pending',
  });
  expect(armed[0]!.resolveAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
  expect(armed[0]!.resolveAt.getTime())
    .toBeLessThanOrEqual(after.getTime() + 6 * 60 * 60_000);

  await runMigrations(f.db);
  const repeated = await f.db.select().from(scheduledEvents).where(and(
    eq(scheduledEvents.seasonId, f.seasonId),
    eq(scheduledEvents.kind, 'fault_spawn'),
  ));
  expect(repeated).toHaveLength(1);
});

it('does not backfill a second timer onto a colony already armed at runtime', async () => {
  const f = await seedWorld(2);
  const colony = f.planetIds[0]!;
  await f.db.update(planets).set({ kind: 'COLONY' }).where(eq(planets.id, colony));
  await setLevel(f.db, colony, 'CORE', 6);
  await f.db.transaction((tx) => armFaults(tx, {
    seasonId: f.seasonId,
    planetId: colony,
    kind: 'COLONY',
    coreLevel: 6,
    now: f.clock.now(),
  }));

  await runMigrations(f.db);

  const armed = await f.db.select().from(scheduledEvents).where(and(
    eq(scheduledEvents.seasonId, f.seasonId),
    eq(scheduledEvents.kind, 'fault_spawn'),
    eq(scheduledEvents.refId, colony),
  ));
  expect(armed).toHaveLength(1);
});
