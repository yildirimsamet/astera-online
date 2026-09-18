import { readFileSync } from 'node:fs';
import { and, eq, sql } from 'drizzle-orm';
import { afterAll, expect, it } from 'vitest';
import { hangarSeedLevel } from '@astera/rules';
import { buildings } from '../src/db/schema.js';
import { seedWorld, setLevel, testDb } from './helpers.js';

afterAll(async () => { await (await testDb()).close(); });

/**
 * THE HANGAR RETURNS TO LIVE WORLDS AT THE RUNG THEIR CORE OPENED. Owner decision,
 * 2026-09-18: nobody is punished overnight for a building that did not exist, and
 * the commander who held their Core low meets their ceiling at once.
 */
it('seeds every world with the Hangar its Core opens, and overwrites no Hangar already there', async () => {
  const f = await seedWorld(6);
  const cores = [1, 5, 11, 16, 22];
  const worlds = f.planetIds.slice(0, cores.length);
  for (const [i, id] of worlds.entries()) {
    await setLevel(f.db, id, 'CORE', cores[i]!);
    await f.db.delete(buildings).where(and(eq(buildings.planetId, id), eq(buildings.type, 'HANGAR')));
  }
  const kept = f.planetIds[5]!;
  await setLevel(f.db, kept, 'CORE', 16);
  await setLevel(f.db, kept, 'HANGAR', 8);

  const migration = readFileSync(new URL('../drizzle/0096_restore_hangar.sql', import.meta.url), 'utf8');
  for (const statement of migration.split('--> statement-breakpoint')) {
    if (statement.trim()) await f.db.execute(sql.raw(statement));
  }

  const rows = await f.db.select().from(buildings).where(eq(buildings.type, 'HANGAR'));
  const level = (id: string) => rows.find((row) => row.planetId === id)?.level;
  for (const [i, id] of worlds.entries()) expect(level(id)).toBe(hangarSeedLevel(cores[i]!));
  expect(level(kept)).toBe(8);
});
