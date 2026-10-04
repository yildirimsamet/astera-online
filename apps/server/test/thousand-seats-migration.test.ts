import { readFileSync } from 'node:fs';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { afterAll, expect, it } from 'vitest';
import { sensorEpochs } from '../src/db/schema.js';
import { seedWorld, testDb } from './helpers.js';

afterAll(async () => { await (await testDb()).close(); });

const MIGRATION = new URL('../drizzle/0097_thousand_seat_galaxy.sql', import.meta.url);

async function runMigration(db: Awaited<ReturnType<typeof seedWorld>>['db']): Promise<void> {
  const migration = readFileSync(MIGRATION, 'utf8');
  for (const statement of migration.split('--> statement-breakpoint')) {
    if (statement.trim()) await db.execute(sql.raw(statement));
  }
}

/**
 * THE ×1.5 SENSOR LADDER REACHES DURABLE HISTORY TOO. 2026-09-18.
 *
 * An open epoch keeps the reach stored when it began (0045's lesson), so the
 * deploy closes every open one and reopens it at the same place on the new
 * ladder. Every telescope rung on the old ladder is exactly two thirds of its new
 * value and the naked-eye floor did not move, which is what lets the migration
 * rescale the stored reach instead of re-deriving every world's instruments.
 * These are the values of 0097's day, independent of later runtime ladders.
 */
it('reopens every open sensor epoch on the ×1.5 ladder and keeps the old interval', async () => {
  const f = await seedWorld(3);
  const [a, b, c] = f.planetIds as [string, string, string];
  const setReach = async (planetId: string, reach: number): Promise<void> => {
    await f.db.update(sensorEpochs).set({ reach })
      .where(and(eq(sensorEpochs.planetId, planetId), isNull(sensorEpochs.endsAt)));
  };
  await setReach(a, 950);
  await setReach(b, 750);
  await setReach(c, 4400);

  await runMigration(f.db);

  const rows = await f.db.select().from(sensorEpochs);
  const open = (planetId: string) => rows.filter((r) => r.planetId === planetId && r.endsAt === null);
  const closed = (planetId: string) => rows.filter((r) => r.planetId === planetId && r.endsAt !== null);

  expect(open(a).map((r) => r.reach)).toEqual([950 * 1.5]);
  expect(open(b).map((r) => r.reach)).toEqual([750]);
  expect(open(c).map((r) => r.reach)).toEqual([4400 * 1.5]);
  expect(closed(a).map((r) => r.reach)).toContain(950);
  expect(closed(c).map((r) => r.reach)).toContain(4400);

  // Same post, same commander: only the reach moved.
  const [before] = closed(a);
  const [after] = open(a);
  expect({ x: after!.x, y: after!.y, z: after!.z, playerId: after!.playerId })
    .toEqual({ x: before!.x, y: before!.y, z: before!.z, playerId: before!.playerId });
});
