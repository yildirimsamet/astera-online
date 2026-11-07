import { STARTER } from '@astera/rules';
import { and, eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { vesselUnits, vessels } from '../src/db/schema.js';
import { testDb } from './helpers.js';
import { starterWorld } from './starterFixture.js';
import { aboard, arm, enrich, pass, post, siteOf } from './starterShips.js';

afterAll(async () => { await (await testDb()).close(); });
const READY = { SHIPYARD: 1, SURVEY: 1, REFINERY: 3, AEGIS: 1, HANGAR: 3 };

describe('the Repair Station', () => {
  let world: Awaited<ReturnType<typeof starterWorld>>;
  beforeEach(async () => { world = await starterWorld(); });
  afterEach(async () => { await world.built.close(); });

  const wound = (id: string, count: number, damageBp: number) =>
    world.f.db.update(vesselUnits).set({ damage: [{ hull: 'DART', count, damageBp }] })
      .where(and(eq(vesselUnits.vesselId, id), eq(vesselUnits.hull, 'DART')));
  const ready = async () => {
    const me = await aboard(world, 'Me', READY);
    await world.f.db.update(vessels).set({ facts: ['FIRST_BATTLE_REPORT'] }).where(eq(vessels.id, me.vesselId));
    await arm(world, me.vesselId, { DART: 6 });
    await enrich(world, me.vesselId, 1000, 1000, 0);
    return me;
  };
  const unitsOf = async (id: string) => (await world.f.db.select().from(vesselUnits).where(and(eq(vesselUnits.vesselId, id), eq(vesselUnits.hull, 'DART'))))[0]!;

  it('bills a quarter of the main price over twelve times the time', async () => {
    const me = await ready();
    await wound(me.vesselId, 6, 4000);
    const answer = await post(world, '/api/starter/dock', me.headers);
    expect(answer.statusCode).toBe(200);
    const [ship] = await world.f.db.select().from(vessels).where(eq(vessels.id, me.vesselId));
    expect(1000 - ship!.alloy).toBeCloseTo(183, 0);
    expect(1000 - ship!.crystal).toBeCloseTo(73, 0);
    await pass(world, 30);
    expect((await unitsOf(me.vesselId)).damage).toEqual([]);
  });

  it('is shut before the first battle report', async () => {
    const me = await ready();
    await world.f.db.update(vessels).set({ facts: [] }).where(eq(vessels.id, me.vesselId));
    await wound(me.vesselId, 6, 4000);
    expect((await post(world, '/api/starter/dock', me.headers)).statusCode).toBe(403);
  });

  it('has nothing to do when nothing is hurt', async () => {
    const me = await ready();
    const answer = await post(world, '/api/starter/dock', me.headers);
    expect(answer.statusCode).toBe(409);
    expect(answer.json<{ error: string }>().error).toBe('NOTHING_TO_REPAIR');
  });

  it('works one job at a time', async () => {
    const me = await ready();
    await wound(me.vesselId, 6, 4000);
    expect((await post(world, '/api/starter/dock', me.headers)).statusCode).toBe(200);
    expect((await post(world, '/api/starter/dock', me.headers)).json()).toMatchObject({ error: 'QUEUE_FULL', params: { context: 'dock' } });
  });

  it('never flies a ship past the point of firing', async () => {
    const me = await ready();
    await wound(me.vesselId, 6, 9600);
    const site = await siteOf(world, 'OUTPOST');
    const answer = await post(world, '/api/starter/fleet/launch', me.headers, { targetPlanetId: site.id, fleet: { DART: 1 } });
    expect(answer.statusCode).toBe(409);
    expect(answer.json<{ error: string }>().error).toBe('NOT_ENOUGH_SHIPS');
  });

  // Owner 2026-11-06: as in the main game (`maintenanceLanding`), landing heals nothing; every
  // wound waits for the Repair Station, so the rule learned aboard holds after the jump.
  it('keeps every wound, however light, when a fleet lands', async () => {
    const me = await ready();
    await wound(me.vesselId, 6, 1500);
    const site = await siteOf(world, 'OUTPOST');
    const { missionId } = (await post(world, '/api/starter/fleet/launch', me.headers, { targetPlanetId: site.id, fleet: { DART: 6 } })).json<{ missionId: string }>();
    await post(world, `/api/starter/fleet/${missionId}/recall`, me.headers);
    await pass(world, 2);
    expect((await unitsOf(me.vesselId)).damage).toEqual([expect.objectContaining({ hull: 'DART', count: 6, damageBp: 1500 })]);
  });

  it('bills the station at a quarter of the main price', () => {
    expect(STARTER.repair).toEqual({ pct: 25, dockTimeMult: 12 });
  });
});
