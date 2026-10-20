import Fastify, { type FastifyInstance } from 'fastify';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { buildApp } from '../src/app.js';
import { registerArena } from '../src/arena/server.js';
import { TokenService } from '../src/auth/tokens.js';
import { accounts, arenaPilots } from '../src/db/schema.js';
import { loadEnv } from '../src/env.js';
import { seedWorld, testDb, testEnv, type Fixture } from './helpers.js';

/** Komutan Gemisi playtest seats: the owner adds commanders by name in the admin desk. */
const listed = z.object({ pilots: z.array(z.object({ accountId: z.string(), username: z.string(), name: z.string(), grantedAt: z.string() })) });

describe('arena pilot list', () => {
  let f: Fixture;
  let app: FastifyInstance;
  let close: () => Promise<void>;
  let auth: { authorization: string }[];
  let names: string[];
  const tokens = new TokenService('test-secret-that-is-long-enough', 15, 30);

  beforeEach(async () => {
    f = await seedWorld(3, 8410);
    const rows = await f.db.select().from(accounts);
    names = f.accountIds.map(id => rows.find(row => row.id === id)!.username);
    const built = buildApp({ db: f.db, clock: f.clock, logger: pino({ level: 'silent' }), env: testEnv({ ADMIN_USERNAMES: names[0]! }) });
    app = built.app;
    close = built.close;
    await app.ready();
    auth = await Promise.all(f.accountIds.map(async id => ({ authorization: `Bearer ${await tokens.issueAccess(id)}` })));
  });
  afterEach(async () => { await close(); });
  afterAll(async () => { const { close: closeDb } = await testDb(); await closeDb(); });

  const set = (username: string, pilot: boolean) => app.inject({ method: 'POST', url: '/api/admin/arena-pilots', headers: auth[0], payload: { username, pilot } });
  const list = async () => listed.parse((await app.inject({ method: 'GET', url: '/api/admin/arena-pilots', headers: auth[0] })).json()).pilots;

  it('is an admin-only desk with a strict body', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/admin/arena-pilots' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/api/admin/arena-pilots', headers: auth[1] })).statusCode).toBe(403);
    expect((await app.inject({ method: 'POST', url: '/api/admin/arena-pilots', headers: auth[1], payload: { username: names[1], pilot: true } })).statusCode).toBe(403);
    for (const invalid of [{ username: names[1] }, { username: '', pilot: true }, { username: names[1], pilot: 'yes' }, { username: names[1], pilot: true, extra: 1 }]) {
      expect((await app.inject({ method: 'POST', url: '/api/admin/arena-pilots', headers: auth[0], payload: invalid })).statusCode).toBe(400);
    }
    expect(await f.db.select().from(arenaPilots)).toHaveLength(0);
  });

  it('names an unknown commander instead of seating nobody', async () => {
    const response = await set('NobodyFliesHere', true);
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: 'ACCOUNT_NOT_FOUND' });
  });

  it('adds by case-folded name, ignores a repeat, lists the newest first and removes', async () => {
    const first = await set(names[1]!.toUpperCase(), true);
    expect(first.statusCode, first.body).toBe(200);
    expect(first.json()).toMatchObject({ accountId: f.accountIds[1], pilot: true });
    expect((await set(names[1]!, true)).statusCode).toBe(200);
    f.clock.advance(1);
    expect((await set(names[2]!, true)).statusCode).toBe(200);
    expect((await list()).map(p => p.accountId)).toEqual([f.accountIds[2], f.accountIds[1]]);
    const rows = await f.db.select().from(arenaPilots);
    expect(rows).toHaveLength(2);
    expect(rows.every(row => row.grantedByAccountId === f.accountIds[0])).toBe(true);

    expect((await set(names[1]!, false)).json()).toMatchObject({ accountId: f.accountIds[1], pilot: false });
    expect((await set(names[1]!, false)).statusCode).toBe(200);
    expect((await list()).map(p => p.accountId)).toEqual([f.accountIds[2]]);
  });

  it('opens the arena door only for listed commanders', async () => {
    const env = loadEnv({ DATABASE_URL: 'postgres://test/arena_test', JWT_SECRET: 'test-secret-that-is-long-enough',
      ROLE: 'arena', ARENA_ENABLED: 'true', ARENA_ALLOWED_ORIGINS: 'https://asteraonline.space' });
    const arena = Fastify();
    arena.decorate('db', f.db);
    arena.decorate('clock', f.clock);
    arena.decorate('tokens', tokens);
    registerArena(arena, env);
    await arena.ready();
    try {
      const door = async (i: number) => (await arena.inject({ method: 'GET', url: '/arena/access', headers: auth[i] })).json<{ allowed: boolean }>().allowed;
      expect(await door(1)).toBe(false);
      await set(names[1]!, true);
      expect(await door(1)).toBe(true);
      expect(await door(2)).toBe(false);
      await set(names[1]!, false);
      expect(await door(1)).toBe(false);
    } finally { await arena.close(); }
  });
});
