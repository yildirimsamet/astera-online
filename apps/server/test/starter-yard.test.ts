import { HULLS, STARTER } from '@astera/rules';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { vesselOrders, vessels } from '../src/db/schema.js';
import { testDb } from './helpers.js';
import { starterWorld } from './starterFixture.js';
import { aboard, enrich, get, pass, post } from './starterShips.js';

afterAll(async () => { await (await testDb()).close(); });
const YARD = { SHIPYARD: 1, SURVEY: 1, REFINERY: 3 };

interface Ship { alloy: number; crystal: number; fleet: Record<string, number>; queue: { queue: string; subject: string; count: number; readyAt: string }[] }

describe('the shipyard aboard', () => {
  let world: Awaited<ReturnType<typeof starterWorld>>;
  beforeEach(async () => { world = await starterWorld(); });
  afterEach(async () => { await world.built.close(); });

  const ship = async (headers: Record<string, string>) => (await get<{ vessel: Ship }>(world, '/api/starter/vessel', headers)).vessel;

  it('is closed until the yard is repaired', async () => {
    const me = await aboard(world, 'Me');
    await enrich(world, me.vesselId);
    const answer = await post(world, '/api/starter/build', me.headers, { hull: 'DART', count: 1 });
    expect(answer.statusCode).toBe(403);
    expect(answer.json<{ error: string }>().error).toBe('FEATURE_LOCKED');
  });

  it('charges the main price and delivers on time', async () => {
    const me = await aboard(world, 'Me', YARD);
    await enrich(world, me.vesselId);
    const before = await ship(me.headers);
    const answer = await post(world, '/api/starter/build', me.headers, { hull: 'DART', count: 2 });
    expect(answer.statusCode).toBe(200);
    const body = answer.json<{ vessel: Ship; hull: string; built: number }>();
    expect(body).toMatchObject({ hull: 'DART', built: 2 });
    expect(body.vessel.alloy).toBeCloseTo(before.alloy - HULLS.DART.alloy * 2, 0);
    expect(body.vessel.fleet.DART ?? 0).toBe(before.fleet.DART ?? 0);
    const left = (new Date(body.vessel.queue[0]!.readyAt).getTime() - world.f.clock.now().getTime()) / 60_000;
    await pass(world, Math.ceil(left) + 1);
    expect((await ship(me.headers)).fleet.DART).toBe((before.fleet.DART ?? 0) + 2);
  });

  it('builds nothing outside the list of this galaxy', async () => {
    const me = await aboard(world, 'Me', YARD);
    await enrich(world, me.vesselId);
    for (const hull of ['DEATH_STAR', 'NOT_A_HULL']) expect((await post(world, '/api/starter/build', me.headers, { hull, count: 1 })).statusCode).toBeGreaterThanOrEqual(400);
    const outside = Object.keys(HULLS).find(hull => !(STARTER.hulls as readonly string[]).includes(hull))!;
    const answer = await post(world, '/api/starter/build', me.headers, { hull: outside, count: 1 });
    expect(answer.statusCode).toBe(403);
    expect(answer.json<{ error: string }>().error).toBe('HULL_LOCKED');
  });

  it('keeps its own queue beside the repair queue', async () => {
    const me = await aboard(world, 'Me', YARD);
    await enrich(world, me.vesselId);
    expect((await post(world, '/api/starter/repair', me.headers, { module: 'EXTRACTOR', stage: 1 })).statusCode).toBe(200);
    expect((await post(world, '/api/starter/build', me.headers, { hull: 'DART', count: 1 })).statusCode).toBe(200);
    const rows = await world.f.db.select().from(vesselOrders).where(eq(vesselOrders.vesselId, me.vesselId));
    expect(rows.map(row => [row.queue, row.slot]).sort()).toEqual([['CONSTRUCTION', 0], ['YARD', 0]]);
  });

  it('holds three orders at most', async () => {
    const me = await aboard(world, 'Me', YARD);
    await enrich(world, me.vesselId);
    for (let i = 0; i < STARTER.queues.yard; i++) expect((await post(world, '/api/starter/build', me.headers, { hull: 'DART', count: 1 })).statusCode).toBe(200);
    const full = await post(world, '/api/starter/build', me.headers, { hull: 'DART', count: 1 });
    expect(full.json()).toMatchObject({ error: 'QUEUE_FULL', params: { context: 'yard' } });
  });

  it('never builds past the hangar', async () => {
    const me = await aboard(world, 'Me', YARD);
    await enrich(world, me.vesselId);
    const answer = await post(world, '/api/starter/build', me.headers, { hull: 'DART', count: 40 });
    expect(answer.statusCode).toBe(409);
    expect(answer.json()).toMatchObject({ error: 'HANGAR_FULL', params: { context: 'ship' } });
  });

  it('names the Prospector limit when it refuses', async () => {
    const me = await aboard(world, 'Me', YARD);
    await enrich(world, me.vesselId);
    const answer = await post(world, '/api/starter/build', me.headers, { hull: 'PROSPECTOR', count: 40 });
    expect(answer.json()).toMatchObject({ error: 'PROSPECTOR_CAP', params: { max: expect.any(Number) as number, have: 0 } });
  });

  it('gives half back on a cancel, as everywhere', async () => {
    const me = await aboard(world, 'Me', YARD);
    await enrich(world, me.vesselId);
    const before = await ship(me.headers);
    await post(world, '/api/starter/build', me.headers, { hull: 'DART', count: 1 });
    const [order] = await world.f.db.select().from(vesselOrders).where(eq(vesselOrders.vesselId, me.vesselId));
    expect((await post(world, `/api/starter/orders/${order!.id}/cancel`, me.headers)).statusCode).toBe(200);
    expect((await ship(me.headers)).alloy).toBeCloseTo(before.alloy - HULLS.DART.alloy / 2, 0);
  });

  it('counts as moving the ship on', async () => {
    const me = await aboard(world, 'Me', YARD);
    await enrich(world, me.vesselId);
    world.f.clock.advance(60);
    await post(world, '/api/starter/build', me.headers, { hull: 'DART', count: 1 });
    const [row] = await world.f.db.select().from(vessels).where(eq(vessels.id, me.vesselId));
    expect(row!.lastProgressAt.getTime()).toBe(world.f.clock.now().getTime());
  });
});
