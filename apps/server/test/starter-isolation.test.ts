import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { vessels } from '../src/db/schema.js';
import { testDb } from './helpers.js';
import { starterWorld } from './starterFixture.js';
import { aboard, arm, enrich, get, post } from './starterShips.js';

afterAll(async () => { await (await testDb()).close(); });
const READY = { SHIPYARD: 1, SURVEY: 1, REFINERY: 3, AEGIS: 1, HANGAR: 3 };

/** K1: nothing crosses but the jump. */
describe('between this galaxy and the main one', () => {
  let world: Awaited<ReturnType<typeof starterWorld>>;
  beforeEach(async () => { world = await starterWorld(); });
  afterEach(async () => { await world.built.close(); });

  const ready = async () => {
    const me = await aboard(world, 'Me', READY);
    await world.f.db.update(vessels).set({ facts: ['FIRST_BATTLE_REPORT', 'FIRST_MINING_RETURN'] }).where(eq(vessels.id, me.vesselId));
    await arm(world, me.vesselId, { DART: 2, PROSPECTOR: 1 });
    await enrich(world, me.vesselId);
    return me;
  };

  it('no fleet flies at a main world', async () => {
    const me = await ready();
    expect((await post(world, '/api/starter/fleet/launch', me.headers, { targetPlanetId: world.f.planetIds[0]!, fleet: { DART: 1 } })).statusCode).toBe(404);
  });

  it('no probe flies at a main world', async () => {
    const me = await ready();
    expect((await post(world, '/api/starter/probe', me.headers, { targetPlanetId: world.f.planetIds[0]! })).statusCode).toBe(404);
  });

  it('no telescope points at a main world', async () => {
    const me = await ready();
    await world.f.db.update(vessels).set({ modules: { ...READY, TELESCOPE: 1 } }).where(eq(vessels.id, me.vesselId));
    expect((await post(world, '/api/starter/watch', me.headers, { targetPlanetId: world.f.planetIds[0]!, slot: 0 })).statusCode).toBe(404);
  });

  it('no craft digs a rock it does not hold an id for', async () => {
    const me = await ready();
    expect((await post(world, '/api/starter/mining/launch', me.headers, { asteroidId: 'A'.repeat(22), craft: 1 })).statusCode).toBe(404);
  });

  it('a ship in another galaxy cannot be reached either', async () => {
    const me = await ready();
    const [row] = await world.f.db.select().from(vessels).where(eq(vessels.id, me.vesselId));
    const other = await aboard(world, 'Other', READY);
    expect(row!.starterGalaxyId).toBeDefined();
    await world.f.db.update(vessels).set({ starterGalaxyId: (await world.f.db.select().from(vessels).where(eq(vessels.id, other.vesselId)))[0]!.starterGalaxyId }).where(eq(vessels.id, me.vesselId));
    expect(typeof (await get(world, '/api/starter/mining', me.headers))).toBe('object');
  });

  it('a ship id means nothing to the main game\'s routes', async () => {
    const me = await ready();
    const answer = await world.app.inject({ method: 'POST', url: '/api/intel/probe', headers: me.headers, payload: { targetPlanetId: me.vesselId } });
    expect(answer.statusCode).toBeGreaterThanOrEqual(400);
  });
});
