import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import { planets, players } from '../src/db/schema.js';
import { createSeason } from '../src/services/season.js';
import { seedWorld, testDb, testEnv, type Fixture } from './helpers.js';
import { returnStatusSchema } from '../../web/src/api/schemas.js';
let f: Fixture;
let built: ReturnType<typeof buildApp>;
let authorization: string;
beforeEach(async () => {
  f = await seedWorld(1);
  const env = testEnv();
  built = buildApp({ env, db: f.db, clock: f.clock, logger: pino({ level: 'silent' }) });
  await built.app.ready();
  authorization = `Bearer ${await new TokenService(env.JWT_SECRET, 15, 30).issueAccess(f.accountIds[0]!)}`;
});
afterEach(async () => { await built.close(); });
afterAll(async () => { await (await testDb()).close(); });
async function move() {
  const waiting = await createSeason(f.db, { shardCode: 'WAIT-API', role: 'WAITING', seed: 7, startsAt: f.clock.now(), rulesetVersion: 1 });
  await f.db.update(players).set({ seasonId: waiting.season.id, placementVersion: 1 });
  await f.db.update(planets).set({ seasonId: waiting.season.id });
}
const request = () => built.app.inject({ method: 'POST', url: '/api/return-applications', headers: { authorization }, payload: { placementVersion: 1 } });
it('authenticates status and never offers MAIN a return application', async () => {
  expect((await built.app.inject('/api/return-applications')).statusCode).toBe(401);
  const response = await built.app.inject({ url: '/api/return-applications', headers: { authorization } });
  expect(response.statusCode).toBe(200);
  const status = returnStatusSchema.parse(response.json());
  expect(status.placement?.role).toBe('MAIN');
  expect(status.canApply).toBe(false);
});
it('publishes verified placement and accepts an idempotent application through the client contract', async () => {
  await move();
  const response = await built.app.inject({ url: '/api/return-applications', headers: { authorization } });
  const status = returnStatusSchema.parse(response.json());
  expect(status.placement).toMatchObject({ playerId: f.playerIds[0], version: 1, role: 'WAITING' });
  expect(status.homeShard).toBeTruthy();
  expect(status.canApply).toBe(true);
  const first = await request();
  expect(first.statusCode).toBe(200);
  const a = returnStatusSchema.parse(first.json());
  const b = returnStatusSchema.parse((await request()).json());
  expect(a.application?.position).toBe(1);
  expect(a.application?.id).toBe(b.application?.id);
});
it('rejects stale placement and invalid intent', async () => {
  await move();
  await f.db.update(players).set({ placementVersion: 2 });
  expect((await request()).statusCode).toBe(409);
  expect((await built.app.inject({ method: 'POST', url: '/api/return-applications', headers: { authorization }, payload: { placementVersion: -1 } })).statusCode).toBe(400);
});
