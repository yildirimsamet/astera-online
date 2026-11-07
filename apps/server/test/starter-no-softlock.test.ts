import { HULLS, REPAIR_LADDER, STARTER } from '@astera/rules';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { vesselUnits, vessels } from '../src/db/schema.js';
import { testDb } from './helpers.js';
import { starterWorld } from './starterFixture.js';
import { aboard, enrich, post } from './starterShips.js';

afterAll(async () => { await (await testDb()).close(); });

/** A whole fleet gone is a setback here, never the end. Plan §3.6, rule 11. */
describe('with every ship lost', () => {
  let world: Awaited<ReturnType<typeof starterWorld>>;
  beforeEach(async () => { world = await starterWorld(); });
  afterEach(async () => { await world.built.close(); });

  it('no repair anywhere asks for a warship', () => {
    for (const step of REPAIR_LADDER) expect(JSON.stringify(step.requires)).not.toMatch(/fleet|DART|PIKE|WARDEN/);
  });

  it('can still build a Prospector, which is all the parts and the income need', async () => {
    const me = await aboard(world, 'Me', { SHIPYARD: 1, SURVEY: 1, REFINERY: 3 });
    await world.f.db.delete(vesselUnits).where(eq(vesselUnits.vesselId, me.vesselId));
    await enrich(world, me.vesselId);
    const [ship] = await world.f.db.select().from(vessels).where(eq(vessels.id, me.vesselId));
    expect(ship!.status).toBe('ACTIVE');
    expect(STARTER.hulls).toContain('PROSPECTOR');
    expect(HULLS.PROSPECTOR).toBeDefined();
    expect((await post(world, '/api/starter/build', me.headers, { hull: 'PROSPECTOR', count: 1 })).statusCode).toBe(200);
  });
});
