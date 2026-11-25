import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MOON } from '@astera/rules';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import { seasons, shards } from '../src/db/schema.js';
import { seedWorld, testDb, testEnv, type Fixture } from './helpers.js';

/*
  F2b (plan §6.2): every moon surface on the client hangs off `features.moons`, read from
  the season the galaxy was dealt and the galaxy's role. Moons stay dark on master until a
  ruleset-20 season opens in a MAIN galaxy.
*/
describe('the moon feature gate', () => {
  let f: Fixture;
  let app: FastifyInstance;
  let close: () => Promise<void>;
  let authorization: string;

  beforeEach(async () => {
    f = await seedWorld(1, 20_020);
    const built = buildApp({ env: testEnv(), logger: pino({ level: 'silent' }), db: f.db, clock: f.clock });
    app = built.app;
    close = built.close;
    await app.ready();
    const tokens = new TokenService('test-secret-that-is-long-enough', 15, 30);
    authorization = `Bearer ${await tokens.issueAccess(f.accountIds[0]!)}`;
  });
  afterEach(async () => { await close(); });
  afterAll(async () => { const { close: closeDb } = await testDb(); await closeDb(); });

  const featuresOf = async (): Promise<unknown> => {
    const res = await app.inject({ url: '/api/season', headers: { authorization } });
    expect(res.statusCode).toBe(200);
    const body: { features?: unknown } = res.json();
    return body.features;
  };

  it('stays closed in a season dealt an older ruleset', async () => {
    await f.db.update(seasons).set({ rulesetVersion: MOON.rulesetVersion - 1 }).where(eq(seasons.id, f.seasonId));
    expect(await featuresOf()).toEqual({ moons: false, synthesis: false });
  });

  it('opens in a MAIN galaxy dealt the moon ruleset', async () => {
    await f.db.update(seasons).set({ rulesetVersion: MOON.rulesetVersion }).where(eq(seasons.id, f.seasonId));
    expect(await featuresOf()).toEqual({ moons: true, synthesis: false });
  });

  it('stays closed in Silent Space even on the moon ruleset', async () => {
    await f.db.update(seasons).set({ rulesetVersion: MOON.rulesetVersion }).where(eq(seasons.id, f.seasonId));
    await f.db.update(shards).set({ role: 'WAITING' });
    expect(await featuresOf()).toEqual({ moons: false, synthesis: false });
  });
});
