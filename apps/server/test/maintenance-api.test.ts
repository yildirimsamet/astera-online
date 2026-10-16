import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { pino } from 'pino';
import type { FastifyInstance } from 'fastify';
import { planetSchema } from '../../web/src/api/schemas.js';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import { landHpShips } from '../src/services/shipDamage.js';
import { seedWorld, testDb, testEnv, type Fixture } from './helpers.js';

let f: Fixture;
let app: FastifyInstance;
let closeApp: () => Promise<void>;
let auth: { authorization: string; 'idempotency-key': string };
beforeEach(async () => {
  f = await seedWorld(2, 131029);
  await f.db.transaction((tx) => landHpShips(tx, { planetId: f.planetIds[0]!, ownerPlayerId: f.playerIds[0]!,
    fleet: { DART: 2 }, damage: [{ hull: 'DART', count: 2, damageBp: 0, remainderBp: 0.25 }], at: f.clock.now() }));
  const built = buildApp({ env: testEnv(), logger: pino({ level: 'silent' }), db: f.db, clock: f.clock });
  app = built.app;
  closeApp = built.close;
  await app.ready();
  const tokens = new TokenService('test-secret-that-is-long-enough', 15, 30);
  auth = { authorization: `Bearer ${await tokens.issueAccess(f.accountIds[0]!)}`, 'idempotency-key': randomUUID() };
});
afterEach(async () => { await closeApp(); });
afterAll(async () => { await (await testDb()).close(); });

describe('maintenance HTTP and client contract', () => {
  const post = (payload: unknown, world = f.planetIds[0]!, headers: Record<string, string> = auth) =>
    app.inject({ method: 'POST', url: `/api/planets/${world}/maintenance`, headers, payload: JSON.stringify(payload) });
  const selection = { source: 'HOME', groups: [{ hull: 'DART', count: 1, damageBp: 0, remainderBp: 0.25 }] };
  it('exposes exact home health through the client schema', async () => {
    const response = await app.inject({ method: 'GET', url: `/api/planets/${f.planetIds[0]!}`, headers: auth });
    const view = planetSchema.parse(response.json());
    expect(view.fleetDamage).toEqual([{ hull: 'DART', count: 2, damageBp: 0, remainderBp: 0.25 }]);
    expect(view.fleetCombatReady?.DART).toBe(2);
  });
  it('docks a partial group and parses the same fractional wound on the response', async () => {
    const response = await post({ action: 'DOCK', selection }, f.planetIds[0], { ...auth, 'content-type': 'application/json' });
    expect(response.statusCode, response.body).toBe(200);
    const result = response.json<{ planet: unknown }>();
    const planet = planetSchema.parse(result.planet);
    expect(planet.dock?.lots[0]).toMatchObject({ count: 1, damageBp: 0, remainderBp: 0.25 });
    expect(planet.fleetDamage?.[0]?.count).toBe(1);
  });
  it('refuses malformed counts, mixed selection shapes and missing retry keys', async () => {
    const jsonHeaders = { ...auth, 'content-type': 'application/json' };
    for (const picked of [{ ...selection, lots: [] }, { ...selection, groups: [] },
      { source: 'HOME', groups: [{ ...selection.groups[0], count: -1 }] },
      { source: 'HOME', groups: [{ ...selection.groups[0], remainderBp: 1 }] }]) {
      const response = await post({ action: 'DOCK', selection: picked }, f.planetIds[0], jsonHeaders);
      expect(response.statusCode, response.body).toBe(400);
    }
    expect((await post({ action: 'DOCK', selection }, f.planetIds[0], { authorization: auth.authorization, 'content-type': 'application/json' })).statusCode).toBe(400);
    expect((await post({ action: 'DOCK', selection }, f.planetIds[1], jsonHeaders)).statusCode).toBe(403);
  });
  it('returns by lot and count without a health quote, while scrapping still requires one', async () => {
    const headers = { ...auth, 'content-type': 'application/json' };
    const docked = await post({ action: 'DOCK', selection }, f.planetIds[0], headers);
    expect(docked.statusCode, docked.body).toBe(200);
    const view = planetSchema.parse(docked.json<{ planet: unknown }>().planet);
    const lot = view.dock?.lots[0];
    if (!lot) throw new Error('Missing docked ship');
    const picked = { source: 'DOCK', lots: [{ id: lot.id, count: 1 }] };
    const scrap = await post({ action: 'SCRAP', selection: picked }, f.planetIds[0], { ...headers, 'idempotency-key': randomUUID() });
    expect(scrap.statusCode, scrap.body).toBe(400);
    const returnHeaders = { ...headers, 'idempotency-key': randomUUID() };
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const returned = await post({ action: 'RETURN', selection: picked }, f.planetIds[0], returnHeaders);
      expect(returned.statusCode, returned.body).toBe(200);
      const planet = planetSchema.parse(returned.json<{ planet: unknown }>().planet);
      expect(planet.dock?.lots).toEqual([]);
      expect(planet.fleetDamage).toEqual([{ hull: 'DART', count: 2, damageBp: 0, remainderBp: 0.25 }]);
    }
  });
});
