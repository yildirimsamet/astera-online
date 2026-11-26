import { pino } from 'pino';
import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { seedWorld, testDb, testEnv } from './helpers.js';

afterAll(async () => { await (await testDb()).close(); });

/**
 * THE YARIK PILOT SEAT IS GONE (owner, 2026-11-24: "Silelim"). The `ARENA_PILOTS` gate came out the same
 * day and every signed-in account may fly, so the table that listed who could, and the two admin routes
 * that edited it, had nobody left to serve.
 */
describe('the retired Yarık pilot seat', () => {
  it('has no table in the database', async () => {
    const f = await seedWorld(1);
    const rows = await f.db.execute<{ found: string | null }>(sql`select to_regclass('public.arena_pilots')::text as found`);
    expect(rows[0]?.found).toBeNull();
  });

  it('has no admin routes any more', async () => {
    const f = await seedWorld(1);
    const { app, close } = buildApp({ db: f.db, clock: f.clock, env: testEnv(), logger: pino({ level: 'silent' }) });
    try {
      await app.ready();
      expect((await app.inject({ method: 'GET', url: '/api/admin/arena-pilots' })).statusCode).toBe(404);
      expect((await app.inject({ method: 'POST', url: '/api/admin/arena-pilots', payload: { username: 'x', pilot: true } })).statusCode).toBe(404);
    } finally { await close(); }
  });
});
