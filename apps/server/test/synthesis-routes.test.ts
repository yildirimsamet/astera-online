import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MOON, SYNTHESIS } from '@astera/rules';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import { planets, playerAsterium, seasons, synthesisJobs } from '../src/db/schema.js';
import { seedWorld, setLevel, testDb, testEnv, type Fixture } from './helpers.js';

/** The laboratory's HTTP surface (plan §4.3): one read, two writes, the feature flag. */
describe('synthesis routes', () => {
  let f: Fixture;
  let app: FastifyInstance;
  let close: () => Promise<void>;
  let authorization: string;

  beforeEach(async () => {
    f = await seedWorld(1, 21_021);
    await f.db.update(seasons).set({ rulesetVersion: MOON.rulesetVersion, synthesisStartsAt: f.clock.now() }).where(eq(seasons.id, f.seasonId));
    await setLevel(f.db, f.planetIds[0]!, 'CORE', SYNTHESIS.requiredCore);
    await f.db.update(planets).set({ alloy: 50_000, crystal: 50_000, deuterium: 5_000 }).where(eq(planets.id, f.planetIds[0]!));
    await f.db.insert(playerAsterium).values({ playerId: f.playerIds[0]!, balance: 30, updatedAt: f.clock.now() });
    const built = buildApp({ env: testEnv(), logger: pino({ level: 'silent' }), db: f.db, clock: f.clock });
    app = built.app;
    close = built.close;
    await app.ready();
    const tokens = new TokenService('test-secret-that-is-long-enough', 15, 30);
    authorization = `Bearer ${await tokens.issueAccess(f.accountIds[0]!)}`;
  });
  afterEach(async () => { await close(); });
  afterAll(async () => { const { close: closeDb } = await testDb(); await closeDb(); });

  it('needs a session', async () => {
    expect((await app.inject({ url: '/api/synthesis' })).statusCode).toBe(401);
  });

  it('reads the laboratory and names the feature on the season', async () => {
    const res = await app.inject({ url: '/api/synthesis', headers: { authorization } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ enabled: true, unlocked: true, asterium: 30, job: null });
    const season = await app.inject({ url: '/api/season', headers: { authorization } });
    expect(season.json<{ features: unknown }>().features).toEqual({ moons: true, synthesis: true });
  });

  it('starts and cancels a batch, answering with the laboratory and the capital', async () => {
    const started = await app.inject({
      method: 'POST', url: '/api/synthesis/start', headers: { authorization, 'idempotency-key': 'synth-start-1' },
      payload: { capsuleId: 'OPTIC_VEIL', quantity: 2 },
    });
    expect(started.statusCode).toBe(200);
    expect(started.json()).toMatchObject({ synthesis: { job: { capsuleId: 'OPTIC_VEIL', quantity: 2 }, asterium: 22 }, planet: { buildings: { CORE: SYNTHESIS.requiredCore } } });
    // The same key again is the same answer, not a second batch.
    const again = await app.inject({
      method: 'POST', url: '/api/synthesis/start', headers: { authorization, 'idempotency-key': 'synth-start-1' },
      payload: { capsuleId: 'OPTIC_VEIL', quantity: 2 },
    });
    expect(again.statusCode).toBe(200);
    expect(await f.db.select().from(synthesisJobs)).toHaveLength(1);
    const cancelled = await app.inject({ method: 'POST', url: '/api/synthesis/cancel', headers: { authorization }, payload: {} });
    expect(cancelled.statusCode).toBe(200);
    expect(cancelled.json()).toMatchObject({ synthesis: { job: null, asterium: 26 } });
  });

  it('refuses a malformed body', async () => {
    for (const payload of [{ capsuleId: 'CLOAK', quantity: 1 }, { capsuleId: 'OPTIC_VEIL', quantity: 0 }, { capsuleId: 'OPTIC_VEIL', quantity: 1.5 }, { capsuleId: 'OPTIC_VEIL' }]) {
      const res = await app.inject({ method: 'POST', url: '/api/synthesis/start', headers: { authorization }, payload });
      expect(res.statusCode).toBe(400);
    }
  });
});
