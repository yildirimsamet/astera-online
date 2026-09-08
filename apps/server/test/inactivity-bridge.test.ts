import { eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, expect, it } from 'vitest';
import { planets, players } from '../src/db/schema.js';
import { EventWorker } from '../src/worker/loop.js';
import { seedWorld, testDb } from './helpers.js';

afterAll(async () => { await (await testDb()).close(); });

it('keeps an inactive commander and world after the old destructive maintenance interval', async () => {
  const f = await seedWorld(1);
  const before = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!));
  const worker = new EventWorker(f.db, f.clock,
    { pollMs: 1000, batch: 100, staleMinutes: 5 }, pino({ level: 'silent' }));
  f.clock.advance(4 * 24 * 60);
  await worker.tick();
  f.clock.advance(11);
  const result = await worker.tick();
  expect(result.reclaimed).toBe(0);
  expect(await f.db.select().from(players).where(eq(players.id, f.playerIds[0]!))).toHaveLength(1);
  expect(await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!))).toEqual(before);
});
