import { STARTER, vesselAegisHp } from '@astera/rules';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { starterSites, vesselMissions, vessels } from '../src/db/schema.js';
import { testDb } from './helpers.js';
import { starterWorld } from './starterFixture.js';
import { aboard, arm, pass, placeShip, post, siteOf } from './starterShips.js';

afterAll(async () => { await (await testDb()).close(); });
void vesselAegisHp;
const HUNTER = { REFINERY: 4, EXTRACTOR: 3, SURVEY: 2, HANGAR: 2, SHIPYARD: 1 };
const FACTS = ['FIRST_MINING_RETURN', 'FIRST_BATTLE_REPORT', 'FIRST_PROBE_REPORT'] as const;

describe('the race for a part', () => {
  let world: Awaited<ReturnType<typeof starterWorld>>;
  beforeEach(async () => { world = await starterWorld(); await aboard(world, 'Keeper'); });
  afterEach(async () => { await world.built.close(); });

  const hunter = async (name: string, at: { x: number; y: number; z: number }) => {
    const me = await aboard(world, name, HUNTER);
    await world.f.db.update(vessels).set({ facts: [...FACTS] }).where(eq(vessels.id, me.vesselId));
    await arm(world, me.vesselId, { PROSPECTOR: 2 });
    await placeShip(world, me.vesselId, at);
    return me;
  };
  const shipOf = async (id: string) => (await world.f.db.select().from(vessels).where(eq(vessels.id, id)))[0]!;

  it('goes to one of two craft landing together', async () => {
    const wreck = await siteOf(world, 'WRECK');
    await world.f.db.update(starterSites).set({ hasPart: true }).where(eq(starterSites.id, wreck.id));
    const one = await hunter('One', { x: wreck.x - 150, y: wreck.y, z: wreck.z });
    const two = await hunter('Two', { x: wreck.x + 150, y: wreck.y, z: wreck.z });
    for (const person of [one, two]) await post(world, '/api/starter/mining/harvest', person.headers, { fieldId: wreck.id, craft: 1 });
    await pass(world, 30);
    const parts = (await shipOf(one.vesselId)).parts + (await shipOf(two.vesselId)).parts;
    expect(parts).toBe(1);
    const [after] = await world.f.db.select().from(starterSites).where(eq(starterSites.id, wreck.id));
    expect(after!.hasPart).toBe(false);
  });

  it('is never taken by someone with no room for it', async () => {
    const wreck = await siteOf(world, 'WRECK');
    await world.f.db.update(starterSites).set({ hasPart: true }).where(eq(starterSites.id, wreck.id));
    const full = await hunter('Full', { x: wreck.x - 150, y: wreck.y, z: wreck.z });
    await world.f.db.update(vessels).set({ parts: STARTER.parts.needed }).where(eq(vessels.id, full.vesselId));
    await post(world, '/api/starter/mining/harvest', full.headers, { fieldId: wreck.id, craft: 1 });
    await pass(world, 30);
    expect((await shipOf(full.vesselId)).parts).toBe(STARTER.parts.needed);
    const [after] = await world.f.db.select().from(starterSites).where(eq(starterSites.id, wreck.id));
    expect(after!.hasPart).toBe(true);
  });

  it('is not taken by a ship whose drive panel is shut', async () => {
    const wreck = await siteOf(world, 'WRECK');
    await world.f.db.update(starterSites).set({ hasPart: true }).where(eq(starterSites.id, wreck.id));
    const early = await aboard(world, 'Early', { REFINERY: 3, SURVEY: 1, SHIPYARD: 1 });
    await world.f.db.update(vessels).set({ facts: ['FIRST_MINING_RETURN'] }).where(eq(vessels.id, early.vesselId));
    await arm(world, early.vesselId, { PROSPECTOR: 1 });
    await post(world, '/api/starter/mining/harvest', early.headers, { fieldId: wreck.id, craft: 1 });
    await pass(world, 60);
    expect((await shipOf(early.vesselId)).parts).toBe(0);
  });

  it('counts when the craft lands home, and survives nothing being able to take it from you', async () => {
    const wreck = await siteOf(world, 'WRECK');
    await world.f.db.update(starterSites).set({ hasPart: true }).where(eq(starterSites.id, wreck.id));
    const one = await hunter('One', { x: wreck.x - 150, y: wreck.y, z: wreck.z });
    await post(world, '/api/starter/mining/harvest', one.headers, { fieldId: wreck.id, craft: 1 });
    await pass(world, 60);
    const [mission] = await world.f.db.select().from(vesselMissions).where(eq(vesselMissions.ownerVesselId, one.vesselId));
    expect(mission!.carriesPart).toBe(true);
    expect((await shipOf(one.vesselId)).parts).toBe(1);
  });
});
