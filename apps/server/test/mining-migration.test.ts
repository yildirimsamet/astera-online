import { readFileSync } from 'node:fs';
import { eq, sql } from 'drizzle-orm';
import { afterAll, expect, it } from 'vitest';
import { miningRuns, planets } from '../src/db/schema.js';
import { seedWorld, testDb } from './helpers.js';

afterAll(async () => { await (await testDb()).close(); });

it('backfills legacy mining owners without overwriting launch attribution or inventing a neutral owner', async () => {
  const f = await seedWorld(3);
  const [home, changedHands, neutral] = f.planetIds as [string, string, string];
  const base = {
    seasonId: f.seasonId, asteroidIndex: 3, craft: 1, holdEach: 300,
    interceptX: 0, interceptY: 0, interceptZ: 0,
    departAt: f.clock.now(), arriveAt: new Date(f.clock.now().getTime() + 60_000),
  };
  const runs = await f.db.insert(miningRuns).values([
    { ...base, planetId: home },
    { ...base, planetId: changedHands, ownerPlayerId: f.playerIds[1]! },
    { ...base, planetId: neutral },
  ]).returning();
  // Model a captured colony. Keeping the fixture's original CAPITAL kind would
  // correctly hit the one-capital-per-player index before the migration is run.
  await f.db.update(planets).set({ kind: 'COLONY', controllerPlayerId: f.playerIds[0]! })
    .where(eq(planets.id, changedHands));
  await f.db.update(planets).set({ kind: 'NEUTRAL', controllerPlayerId: null })
    .where(eq(planets.id, neutral));

  const migration = readFileSync(new URL('../drizzle/0087_yellow_dracula.sql', import.meta.url), 'utf8');
  const backfill = migration.split('--> statement-breakpoint')
    .find((statement) => statement.trimStart().startsWith('UPDATE'));
  if (!backfill) throw new Error('The mining recall migration must backfill legacy owners');
  await f.db.execute(sql.raw(backfill));

  const saved = await f.db.select().from(miningRuns);
  expect(saved.find((run) => run.id === runs[0]!.id)?.ownerPlayerId).toBe(f.playerIds[0]);
  expect(saved.find((run) => run.id === runs[1]!.id)?.ownerPlayerId).toBe(f.playerIds[1]);
  expect(saved.find((run) => run.id === runs[2]!.id)?.ownerPlayerId).toBeNull();
});
