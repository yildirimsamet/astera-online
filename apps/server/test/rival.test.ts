import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { rivalSetSchema, seasonSchema } from '../../web/src/api/schemas.js';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import { seedWorld, testDb, testEnv, type Fixture } from './helpers.js';

const silent = pino({ level: 'silent' });
const errorSchema = z.object({ error: z.string() });

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

describe('seasonal rival marker', () => {
  let f: Fixture;
  let app: FastifyInstance;
  let close: () => Promise<void>;
  let auth: { authorization: string };

  beforeEach(async () => {
    f = await seedWorld(3);
    const built = buildApp({ env: testEnv(), logger: silent, db: f.db, clock: f.clock });
    app = built.app;
    close = built.close;
    await app.ready();
    const tokens = new TokenService('test-secret-that-is-long-enough', 15, 30);
    auth = { authorization: `Bearer ${await tokens.issueAccess(f.accountIds[0]!)}` };
  });

  afterEach(async () => { await close(); });

  const set = (planetId: string | null) => app.inject({
    method: 'POST',
    url: '/api/rival',
    headers: auth,
    payload: { planetId },
  });

  it('stores exactly one marker in the existing season payload and replaces it', async () => {
    const initial = await app.inject({ method: 'GET', url: '/api/season', headers: auth });
    expect(seasonSchema.parse(initial.json()).rivalPlanetId).toBeNull();
    expect(rivalSetSchema.parse((await set(f.planetIds[1]!)).json())).toEqual({
      rivalPlanetId: f.planetIds[1],
      rivalPlayerId: f.playerIds[1],
    });
    expect(rivalSetSchema.parse((await set(f.planetIds[2]!)).json())).toEqual({
      rivalPlanetId: f.planetIds[2],
      rivalPlayerId: f.playerIds[2],
    });
    const changed = await app.inject({ method: 'GET', url: '/api/season', headers: auth });
    expect(seasonSchema.parse(changed.json()).rivalPlanetId).toBe(f.planetIds[2]);
    expect(rivalSetSchema.parse((await set(null)).json())).toEqual({ rivalPlanetId: null, rivalPlayerId: null });
  });

  it('refuses self and a planet outside the caller’s current galaxy', async () => {
    const self = await set(f.planetIds[0]!);
    expect(self.statusCode).toBe(400);
    expect(errorSchema.parse(self.json()).error).toBe('RIVAL_SELF');
    const foreign = await set(randomUUID());
    expect(foreign.statusCode).toBe(404);
    expect(errorSchema.parse(foreign.json()).error).toBe('RIVAL_NOT_VISIBLE');
  });

  it('requires authentication and rejects extra client-authored state', async () => {
    expect((await app.inject({ method: 'POST', url: '/api/rival', payload: { planetId: null } })).statusCode).toBe(401);
    expect((await app.inject({
      method: 'POST', url: '/api/rival', headers: auth,
      payload: { planetId: f.planetIds[1], bonus: 2 },
    })).statusCode).toBe(400);
  });
});
