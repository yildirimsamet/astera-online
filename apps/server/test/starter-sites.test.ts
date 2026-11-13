import { STARTER, outpostName } from '@astera/rules';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { galaxySchema } from '../../web/src/api/schemas.js';
import { starterSites, vesselProbeReports, vessels } from '../src/db/schema.js';
import { sweepStarterWorld } from '../src/services/starter/sites.js';
import { testDb } from './helpers.js';
import { starterWorld } from './starterFixture.js';
import { aboard, get, pass, post } from './starterShips.js';

afterAll(async () => { await (await testDb()).close(); });
// The first loop's repairs (plan 2026-11-13 §5.1).
const LOOP = { REFINERY: 2, EXTRACTOR: 1, TELESCOPE: 1, RADAR: 1, SURVEY: 1, SHIPYARD: 1 };

describe('the shared places of a galaxy', () => {
  let world: Awaited<ReturnType<typeof starterWorld>>;
  beforeEach(async () => { world = await starterWorld(); });
  afterEach(async () => { await world.built.close(); });

  const sweep = () => sweepStarterWorld(world.f.db, world.f.clock);
  const all = (kind: 'WRECK' | 'OUTPOST') => world.f.db.select().from(starterSites).where(eq(starterSites.kind, kind));

  it('are laid out once, by the plan', async () => {
    await aboard(world, 'One');
    await sweep();
    await sweep();
    expect(await all('WRECK')).toHaveLength(STARTER.sites.wrecks.count);
    expect(await all('OUTPOST')).toHaveLength(STARTER.sites.outposts.count);
  });

  it('show an outpost on the map as a place, once fleets exist', async () => {
    const me = await aboard(world, 'One', { SURVEY: 1, SHIPYARD: 1 });
    await sweep();
    const map = galaxySchema.parse(await get(world, '/api/starter/galaxy', me.headers));
    const outposts = map.planets.filter(planet => planet.kind === 'NEUTRAL');
    expect(outposts).toHaveLength(STARTER.sites.outposts.count);
  });

  it('hide them from a ship with no yard', async () => {
    const me = await aboard(world, 'One', { SURVEY: 1 });
    await sweep();
    const map = galaxySchema.parse(await get(world, '/api/starter/galaxy', me.headers));
    expect(map.planets.filter(planet => planet.kind === 'NEUTRAL')).toEqual([]);
  });

  // Plan 2026-11-13 §5.6 (S2): the jump asks for no part, so nothing hands one out or marks one.
  it('hands out no part and names none, even where an old one was left', async () => {
    const me = await aboard(world, 'Pilot', LOOP);
    await world.f.db.update(vessels).set({ facts: ['FIRST_MINING_SENT', 'FIRST_MINING_RETURN', 'FIRST_PROBE_REPORT'] }).where(eq(vessels.id, me.vesselId));
    await sweep();
    const places = async () => [...await all('WRECK'), ...await all('OUTPOST')];
    expect((await places()).filter(site => site.hasPart)).toEqual([]);

    const [outpost] = await all('OUTPOST');
    await world.f.db.update(starterSites).set({ hasPart: true });
    await sweep();
    expect(JSON.stringify(await get(world, '/api/starter/galaxy', me.headers))).not.toContain('hasPart');
    expect(JSON.stringify(await get(world, '/api/starter/mining', me.headers))).not.toContain('hasPart');
    await post(world, '/api/starter/probe', me.headers, { targetPlanetId: outpost!.id });
    await pass(world, 600);
    const [report] = await world.f.db.select().from(vesselProbeReports).where(eq(vesselProbeReports.observerVesselId, me.vesselId));
    expect(report).toBeDefined();
    expect(report!.snapshot).not.toHaveProperty('hasPart');
    expect(report!.targetName).toBe(outpostName(outpost!.id));
  });
});
