import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { testDb } from './helpers.js';
import { starterWorld } from './starterFixture.js';
import { aboard, post } from './starterShips.js';

afterAll(async () => { await (await testDb()).close(); });

const source = readFileSync(join(__dirname, '../src/routes/starter.ts'), 'utf8');
const routes = [...source.matchAll(/app\.(get|post)\('([^']+)', \{ preHandler: requireAuth/g)].map(match => [match[1] === 'get' ? 'GET' as const : 'POST' as const, match[2]!] as const);
const open = [...source.matchAll(/app\.(get|post)\('([^']+)', (?!\{ preHandler: requireAuth)/g)].map(match => match[2]!);
const fill = (path: string) => path.replace(/:\w+/g, '00000000-0000-4000-8000-000000000000');

describe('the ship API, without a pass', () => {
  let world: Awaited<ReturnType<typeof starterWorld>>;
  beforeEach(async () => { world = await starterWorld(); });
  afterEach(async () => { await world.built.close(); });

  it('has no route that forgot to ask', () => {
    expect(routes.length).toBeGreaterThan(30);
    expect(open.filter(path => path !== '/api/universe')).toEqual([]);
  });

  it.each(routes)('%s %s answers 401 to a stranger', async (method, path) => {
    const answer = await world.app.inject({ method, url: fill(path), ...(method === 'POST' ? { payload: {} } : {}) });
    expect(answer.statusCode).toBe(401);
  });

  it('turns away a forged token', async () => {
    const answer = await world.app.inject({ url: '/api/starter/vessel', headers: { authorization: 'Bearer not.a.token' } });
    expect(answer.statusCode).toBe(401);
  });

  it('does not act on another commander\'s ship, flight or order by naming it', async () => {
    const me = await aboard(world, 'Me', { SHIPYARD: 1 });
    const them = await aboard(world, 'Them', { SHIPYARD: 1 });
    const stranger = them.vesselId;
    expect((await post(world, `/api/starter/orders/${stranger}/cancel`, me.headers)).statusCode).toBe(404);
    expect((await post(world, `/api/starter/fleet/${stranger}/recall`, me.headers)).statusCode).toBe(404);
    expect((await post(world, `/api/starter/mining/runs/${stranger}/recall`, me.headers)).statusCode).toBe(404);
  });

  it.each([
    ['/api/starter/repair', { module: 'REFINERY; drop table vessels', stage: 2 }],
    ['/api/starter/repair', { module: 'REFINERY', stage: 1e9 }],
    ['/api/starter/build', { hull: 'DEATH_STAR', count: 1 }],
    ['/api/starter/build', { hull: 'DART', count: -5 }],
    ['/api/starter/fuel', { amount: -90 }],
    ['/api/starter/fuel', { amount: Number.MAX_VALUE }],
    ['/api/starter/migrate', { slot: 1, force: true }],
    ['/api/starter/chat/messages', { content: 'x'.repeat(10_000), language: 'en' }],
    ['/api/starter/return/seen', { asOf: 'yesterday-ish' }],
  ])('refuses %s with %j', async (path, payload) => {
    const me = await aboard(world, 'Me', { SHIPYARD: 1, SURVEY: 2 });
    const answer = await post(world, path, me.headers, payload);
    expect(answer.statusCode).toBeGreaterThanOrEqual(400);
    expect(answer.statusCode).toBeLessThan(500);
  });
});
