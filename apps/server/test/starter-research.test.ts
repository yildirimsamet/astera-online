import { RESEARCH_PROJECTS, STARTER } from '@astera/rules';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { vessels } from '../src/db/schema.js';
import { testDb } from './helpers.js';
import { starterWorld } from './starterFixture.js';
import { aboard, enrich, pass, post } from './starterShips.js';

afterAll(async () => { await (await testDb()).close(); });
const LAB = { SHIPYARD: 1, SURVEY: 1, REFINERY: 3, HANGAR: 2 };

describe('research aboard', () => {
  let world: Awaited<ReturnType<typeof starterWorld>>;
  beforeEach(async () => { world = await starterWorld(); });
  afterEach(async () => { await world.built.close(); });

  const ask = (headers: Record<string, string>, projectId: string) => post(world, '/api/starter/research', headers, { projectId });
  const ship = async (id: string) => (await world.f.db.select().from(vessels).where(eq(vessels.id, id)))[0]!;

  it('opens with Hangar 2', async () => {
    const me = await aboard(world, 'Me', { SHIPYARD: 1 });
    await enrich(world, me.vesselId);
    expect((await ask(me.headers, 'SHIP_POWER')).statusCode).toBe(403);
  });

  it('charges the main price and stays with the ship', async () => {
    const me = await aboard(world, 'Me', LAB);
    await enrich(world, me.vesselId, 50_000, 50_000, 5000);
    const cost = RESEARCH_PROJECTS.SHIP_POWER.costAt(1);
    expect((await ask(me.headers, 'SHIP_POWER')).statusCode).toBe(200);
    expect((await ship(me.vesselId)).alloy).toBeCloseTo(50_000 - cost.alloy, 0);
    await pass(world, 60 * 72);
    expect((await ship(me.vesselId)).research.SHIP_POWER).toBe(1);
  });

  it('knows nothing outside this galaxy\'s list', async () => {
    const me = await aboard(world, 'Me', LAB);
    await enrich(world, me.vesselId);
    const outside = Object.keys(RESEARCH_PROJECTS).find(id => !(STARTER.research.projects as readonly string[]).includes(id))!;
    expect((await ask(me.headers, outside)).statusCode).toBe(403);
  });

  it('works one project at a time and stops at the ceiling', async () => {
    const me = await aboard(world, 'Me', LAB);
    await enrich(world, me.vesselId);
    expect((await ask(me.headers, 'SHIP_ARMOR')).statusCode).toBe(200);
    expect((await ask(me.headers, 'SHIP_POWER')).json()).toMatchObject({ error: 'QUEUE_FULL', params: { context: 'research' } });
    await world.f.db.update(vessels).set({ research: { SHIP_POWER: STARTER.research.maxLevel } }).where(eq(vessels.id, me.vesselId));
    await pass(world, 60 * 72);
    expect((await ask(me.headers, 'SHIP_POWER')).json<{ error: string }>().error).toBe('RESEARCH_MAXED');
  });
});
