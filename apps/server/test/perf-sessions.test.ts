import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import { accounts, perfSessions } from '../src/db/schema.js';
import { PERF_MAX_SAMPLES } from '../src/services/perfSessions.js';
import { seedWorld, testDb, testEnv, type Fixture } from './helpers.js';

/**
 * A PERFORMANCE RECORDING, SENT HOME FROM THE OWNER'S PHONE. Owner request,
 * 2026-09-19: play for a while, then read what rose, what peaked and what the
 * average was. Admin only — it is a developer instrument, not a player feature.
 */

const silent = pino({ level: 'silent' });
afterAll(async () => { await (await testDb()).close(); });

const sample = (t: number) => ({
  t,
  fps: 30,
  jankMaxMs: 20,
  jank50: 0,
  jank250: 0,
  longTaskMs: 0,
  longTasks: 0,
  renderMs: 4,
  renderMaxMs: 6,
  calls: 140,
  triangles: 90_000,
  geometries: 60,
  textures: 40,
  programs: 25,
  heapMb: 80,
  requests: 1,
  kb: 3,
  galaxy: true,
  hidden: false,
  ctx: { planets: 1230, contacts: 12, flights: 3 },
});

const session = (samples = [sample(0), sample(1)]) => ({
  startedAt: '2026-09-19T10:00:00.000Z',
  endedAt: '2026-09-19T10:00:02.000Z',
  device: {
    userAgent: 'Mozilla/5.0 (Linux; Android 14)',
    dpr: 2.75,
    width: 393,
    height: 852,
    quality: 'balanced',
    refreshHz: 120,
    cores: 8,
    memoryGb: 8,
  },
  summary: { fpsAvg: 30, fpsP5: 28, freezes: 0 },
  samples,
});

describe('recording a performance session', () => {
  let fixture: Fixture;
  let app: FastifyInstance;
  let close: () => Promise<void>;
  let adminAuth: { authorization: string };
  let playerAuth: { authorization: string };

  beforeEach(async () => {
    fixture = await seedWorld(2);
    const [admin] = await fixture.db.select({ username: accounts.username }).from(accounts)
      .where(eq(accounts.id, fixture.accountIds[0]!));
    const built = buildApp({
      env: testEnv({ ADMIN_USERNAMES: admin!.username }),
      logger: silent,
      db: fixture.db,
      clock: fixture.clock,
    });
    app = built.app;
    close = built.close;
    await app.ready();
    const tokens = new TokenService('test-secret-that-is-long-enough', 15, 30);
    adminAuth = { authorization: `Bearer ${await tokens.issueAccess(fixture.accountIds[0]!)}` };
    playerAuth = { authorization: `Bearer ${await tokens.issueAccess(fixture.accountIds[1]!)}` };
  });
  afterEach(async () => { await close(); });

  const post = (headers: Record<string, string>, payload: unknown) =>
    app.inject({ method: 'POST', url: '/api/admin/perf', headers, payload: payload as object });

  it('stores the admin’s recording whole, against their account', async () => {
    const res = await post(adminAuth, session());
    expect(res.statusCode, res.body).toBe(200);
    const [row] = await fixture.db.select().from(perfSessions);
    expect(row?.accountId).toBe(fixture.accountIds[0]);
    expect(row?.samples).toHaveLength(2);
    expect(row?.device).toMatchObject({ dpr: 2.75, quality: 'balanced' });
    expect(row?.summary).toMatchObject({ fpsAvg: 30 });
  });

  it('refuses anybody who is not an admin', async () => {
    expect((await post(playerAuth, session())).statusCode).toBe(403);
    expect((await app.inject({ method: 'POST', url: '/api/admin/perf', payload: session() })).statusCode)
      .toBe(401);
    expect(await fixture.db.select().from(perfSessions)).toHaveLength(0);
  });

  it('refuses a malformed recording', async () => {
    expect((await post(adminAuth, { ...session(), samples: [{ t: 'soon' }] })).statusCode).toBe(400);
    expect((await post(adminAuth, { ...session(), extra: true })).statusCode).toBe(400);
  });

  it('takes two hours of seconds and refuses more', async () => {
    expect(PERF_MAX_SAMPLES).toBe(7200);
    const long = Array.from({ length: PERF_MAX_SAMPLES + 1 }, (_, i) => sample(i));
    expect((await post(adminAuth, session(long))).statusCode).toBe(400);
  });

  it('carries a full two hours in one request', async () => {
    const full = Array.from({ length: PERF_MAX_SAMPLES }, (_, i) => sample(i));
    expect((await post(adminAuth, session(full))).statusCode).toBe(200);
  });
});
