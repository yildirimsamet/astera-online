import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { galaxySchema, intelSchema, notificationsSchema, pendingSchema, probeSchema, trafficSchema, watchSchema } from '../../web/src/api/schemas.js';
import { vesselNotifications, vessels } from '../src/db/schema.js';
import { testDb } from './helpers.js';
import { starterWorld } from './starterFixture.js';
import { aboard, enrich, get, pass, placeShip, post } from './starterShips.js';

afterAll(async () => { await (await testDb()).close(); });

/**
 * WHAT THE SCREENS WILL ACTUALLY PARSE. Aboard, the client's own schemas read these answers through
 * the transport, so a field that drifted here is a page that fails quietly on a ship and nowhere else.
 */
describe('the answers aboard, read with the client schemas', () => {
  let world: Awaited<ReturnType<typeof starterWorld>>;
  beforeEach(async () => { world = await starterWorld(); });
  afterEach(async () => { await world.built.close(); });

  it('holds through a probe out and back', async () => {
    const me = await aboard(world, 'Me', { SURVEY: 1, TELESCOPE: 2, RADAR: 2 });
    const other = await aboard(world, 'Other', { SURVEY: 1, TELESCOPE: 2, RADAR: 2 });
    await placeShip(world, me.vesselId, { x: 0 });
    await placeShip(world, other.vesselId, { x: 300 });
    await enrich(world, me.vesselId);

    const sent = await post(world, '/api/starter/probe', me.headers, { targetPlanetId: other.vesselId });
    expect(probeSchema.safeParse(sent.json()).success).toBe(true);
    expect(watchSchema.safeParse((await post(world, '/api/starter/watch', me.headers, { targetPlanetId: other.vesselId, slot: 0 })).json()).success).toBe(true);

    expect(pendingSchema.parse(await get(world, '/api/starter/pending', me.headers)).pending[0]).toMatchObject({ kind: 'probe', targetName: 'Other' });
    expect(trafficSchema.parse(await get(world, '/api/starter/traffic', other.headers)).contacts).toHaveLength(1);
    expect(galaxySchema.safeParse(await get(world, '/api/starter/galaxy', me.headers)).success).toBe(true);

    await pass(world, 10);
    const intel = intelSchema.parse(await get(world, '/api/starter/intel', me.headers));
    expect(intel.probeReports[0]).toMatchObject({ targetName: 'Other', targetPlanetId: other.vesselId });
    expect(intel.probeReports[0]!.repair).toBeDefined();
    expect(intel.watching[0]).toMatchObject({ targetName: 'Other' });
    expect(intelSchema.parse(await get(world, '/api/starter/intel', other.headers)).radarLog).toHaveLength(1);
    expect(notificationsSchema.parse(await get(world, '/api/starter/notifications', other.headers)).notifications[0]).toMatchObject({ kind: 'PROBE_DETECTED' });

    // A radar this size also hears the scout that follows a first launch: the report is what is read here.
    const rows = await world.f.db.select().from(vesselNotifications).where(eq(vesselNotifications.vesselId, me.vesselId));
    expect(rows.map(row => row.kind)).toContain('PROBE_REPORT');
    const [ship] = await world.f.db.select().from(vessels).where(eq(vessels.id, me.vesselId));
    expect(ship?.facts).toContain('FIRST_PROBE_REPORT');
  });

  it('marks a neighbour as a ship, with the hull state a look at it left', async () => {
    const me = await aboard(world, 'Me', { SURVEY: 1 });
    const other = await aboard(world, 'Other', { REFINERY: 5, SURVEY: 3, EXTRACTOR: 5 });
    await enrich(world, me.vesselId);
    await post(world, '/api/starter/probe', me.headers, { targetPlanetId: other.vesselId });
    await pass(world, 30);
    const map = galaxySchema.parse(await get(world, '/api/starter/galaxy', me.headers));
    const seen = map.planets.find(planet => planet.id === other.vesselId)!;
    expect(seen.body).toBe('VESSEL');
    expect(seen.look).toMatch(/WRECKED|PATCHED|RENEWED/);
  });
});
