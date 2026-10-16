import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { pino } from 'pino';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeEach, expect, it } from 'vitest';
import { HULLS, RADIATION_LEVEL_HP_PER_MINUTE } from '@astera/rules';
import { planetSchema } from '../../web/src/api/schemas.js';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import { planets, players, radiationBombFlights, seasons, strategicAssets } from '../src/db/schema.js';
import { EventWorker } from '../src/worker/loop.js';
import { grant, giveUnits, seedWorld, setLevel, testDb, testEnv, type Fixture } from './helpers.js';

let f: Fixture;
let app: FastifyInstance;
let closeApp: () => Promise<void>;
let headers: { authorization: string; 'content-type': string; 'idempotency-key': string };
beforeEach(async () => {
  f = await seedWorld(2);
  await f.db.update(seasons).set({ rulesetVersion: 18, radiationBombStartsAt: f.clock.now() }).where(eq(seasons.id, f.seasonId));
  await f.db.update(players).set({ newcomerShieldUntil: null, recoveryShieldUntil: null });
  for (const id of f.planetIds) {
    await setLevel(f.db, id, 'CORE', 13);
    await setLevel(f.db, id, 'SHIPYARD', 5);
    await grant(f.db, id, 500000, 500000);
    await f.db.update(planets).set({ deuterium: 500000 }).where(eq(planets.id, id));
  }
  const built = buildApp({ env: testEnv(), logger: pino({ level: 'silent' }), db: f.db, clock: f.clock });
  app = built.app;
  closeApp = built.close;
  await app.ready();
  headers = { authorization: `Bearer ${await new TokenService('test-secret-that-is-long-enough', 15, 30).issueAccess(f.accountIds[0]!)}`,
    'content-type': 'application/json', 'idempotency-key': randomUUID() };
});
afterEach(async () => { await closeApp(); });
afterAll(async () => { await (await testDb()).close(); });
const build = (payload: unknown, planet = f.planetIds[0]!) => app.inject({ method: 'POST',
  url: `/api/planets/${planet}/radiation-bombs/build`, headers, payload: JSON.stringify(payload) });

it.each([1, 2, 3] as const)('completes the real L%i production, launch, impact, damage, expiry and restock cycle', async level => {
  await giveUnits(f.db, f.planetIds[1]!, { CITADEL: 1, PROSPECTOR: 1, THORN: 1 });
  const response = await build({ level });
  expect(response.statusCode).toBe(200);
  const made = response.json<{ assetId: string; readyAt: string }>();
  const worker = new EventWorker(f.db, f.clock, { pollMs: 1, batch: 100, staleMinutes: 5 }, pino({ level: 'silent' }));
  f.clock.set(new Date(made.readyAt));
  expect((await worker.tick()).failed).toBe(0);
  const readOrigin = async () => planetSchema.parse((await app.inject({ method: 'GET',
    url: `/api/planets/${f.planetIds[0]!}`, headers })).json());
  expect((await readOrigin()).radiationBombs).toMatchObject([{ id: made.assetId, level, status: 'READY' }]);

  const launched = await app.inject({ method: 'POST', url: '/api/radiation-bombs/launch', headers,
    payload: { originPlanetId: f.planetIds[0], level, target: { kind: 'PLANET', id: f.planetIds[1] } } });
  expect(launched.statusCode).toBe(200);
  const sent = launched.json<{ flightId: string; arriveAt: string }>();
  f.clock.set(new Date(sent.arriveAt));
  expect((await worker.tick()).failed).toBe(0);
  expect((await f.db.select().from(radiationBombFlights).where(eq(radiationBombFlights.id, sent.flightId)))[0]!.status).toBe('HIT');
  expect((await readOrigin()).radiationBombs).toEqual([]);

  const defenderHeaders = { authorization: `Bearer ${await new TokenService('test-secret-that-is-long-enough', 15, 30).issueAccess(f.accountIds[1]!)}` };
  const readTarget = async () => planetSchema.parse((await app.inject({ method: 'GET',
    url: `/api/planets/${f.planetIds[1]!}`, headers: defenderHeaders })).json());
  f.clock.advance(1);
  const wounded = await readTarget();
  expect(wounded.workshopRadiation).toBe(true);
  expect(wounded.fleetDamage).toHaveLength(1);
  const wound = wounded.fleetDamage?.[0];
  if (!wound) throw new Error('Expected a wounded Citadel in the planet response');
  expect(wound.damageBp + (wound.remainderBp ?? 0)).toBeCloseTo(RADIATION_LEVEL_HP_PER_MINUTE[level] / HULLS.CITADEL.hp * 10000);
  f.clock.set(new Date(new Date(sent.arriveAt).getTime() + 1800000));
  expect((await worker.tick()).failed).toBe(0);
  const ended = await readTarget();
  expect(ended.workshopRadiation).toBe(false);
  expect(ended.fleetDamage).toHaveLength(1);
  expect((await build({ level })).statusCode).toBe(200);
});

it('builds a selected level and exposes its own stock state through the client planet contract', async () => {
  const response = await build({ level: 2 });
  expect(response.statusCode).toBe(200);
  const body = response.json<{ assetId: string; planet: unknown }>();
  const view = planetSchema.parse(body.planet);
  expect(view.radiationBombsAvailable).toBe(true);
  expect(view.radiationBombs).toMatchObject([{ id: body.assetId, level: 2, status: 'BUILDING' }]);
});

it('rejects malformed levels, extra quantity, unauthorized ownership and unauthenticated production', async () => {
  for (const payload of [{ level: 0 }, { level: 4 }, { level: '1' }, { level: 1, count: 2 }, {}]) {
    expect((await build(payload)).statusCode).toBe(400);
  }
  expect((await build({ level: 1 }, f.planetIds[1])).statusCode).toBe(403);
  expect((await app.inject({ method: 'POST', url: `/api/planets/${f.planetIds[0]!}/radiation-bombs/build`,
    payload: { level: 1 } })).statusCode).toBe(401);
  expect(await f.db.select().from(strategicAssets)).toHaveLength(0);
});

it('launches once with a retry key and shows LAUNCHED in the occupied per-level stock', async () => {
  const built = await build({ level: 1 });
  expect(built.statusCode).toBe(200);
  const { assetId } = built.json<{ assetId: string }>();
  await f.db.update(strategicAssets).set({ status: 'READY' }).where(eq(strategicAssets.id, assetId));
  const request = { originPlanetId: f.planetIds[0], level: 1, target: { kind: 'PLANET', id: f.planetIds[1] } };
  const send = () => app.inject({ method: 'POST', url: '/api/radiation-bombs/launch', headers, payload: JSON.stringify(request) });
  const first = await send();
  expect(first.statusCode).toBe(200);
  expect((await send()).json()).toEqual(first.json());
  const response = await app.inject({ method: 'GET', url: `/api/planets/${f.planetIds[0]!}`, headers });
  const view = planetSchema.parse(response.json());
  expect(view.radiationBombs).toMatchObject([{ id: assetId, level: 1, status: 'LAUNCHED' }]);
  expect((await build({ level: 1 })).statusCode).toBe(409);
});
