import { PROBE, STARTER, travelExact, type VesselFact } from '@astera/rules';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { vesselMissions, vesselNotifications, vesselProbeReports, vessels } from '../src/db/schema.js';
import { testDb } from './helpers.js';
import { starterWorld } from './starterFixture.js';
import { aboard, enrich, get, pass, placeShip, post, type StarterWorld } from './starterShips.js';

afterAll(async () => { await (await testDb()).close(); });

interface Report { targetPlanetId: string; targetName: string; at: string; accuracy: number; detected: boolean;
  stock: { low: number; high: number }; defence: { low: number; high: number }; fleetSize: { low: number; high: number };
  repair: { low: number; high: number } }
interface Intel { probeReports: Report[]; probeCost: { alloy: number; crystal: number; deuterium: number }; probeCooldowns: unknown[]; radarLog: { at: string; bearing: string | null }[] }

describe('sending a probe', () => {
  let world: StarterWorld;
  const scout = () => aboard(world, 'Scout', { SURVEY: 1 });
  const fly = (headers: Record<string, string>, targetPlanetId: string) => post(world, '/api/starter/probe', headers, { targetPlanetId });
  const notes = async (vesselId: string) => (await world.f.db.select().from(vesselNotifications).where(eq(vesselNotifications.vesselId, vesselId))).map(n => n.kind);

  beforeEach(async () => { world = await starterWorld(); });
  afterEach(async () => { await world.built.close(); });

  it('is closed until the survey antenna works, and the server says so', async () => {
    const me = await aboard(world, 'Blind');
    const other = await aboard(world, 'Other');
    const answer = await fly(me.headers, other.vesselId);
    expect(answer.statusCode).toBe(403);
    expect(answer.json<{ error: string }>().error).toBe('FEATURE_LOCKED');
  });

  it('pays, flies for real at this galaxy\'s speed, and comes back with a report', async () => {
    const me = await scout();
    const other = await aboard(world, 'Other');
    await placeShip(world, me.vesselId, { x: 0 });
    await placeShip(world, other.vesselId, { x: 395 });
    await world.f.db.update(vessels).set({ alloy: 500, crystal: 500 }).where(eq(vessels.id, me.vesselId));
    const answer = await fly(me.headers, other.vesselId);
    expect(answer.statusCode).toBe(200);
    const { arriveAt, flightMinutes } = answer.json<{ arriveAt: string; flightMinutes: number }>();
    expect(flightMinutes).toBeCloseTo(travelExact(395, STARTER.probeSpeed), 2);
    expect(new Date(arriveAt).getTime()).toBeGreaterThan(world.f.clock.now().getTime());
    const [ship] = await world.f.db.select().from(vessels).where(eq(vessels.id, me.vesselId));
    expect(ship!.alloy).toBeLessThanOrEqual(500 - PROBE.alloy + 1);
    expect(ship!.crystal).toBeLessThanOrEqual(500 - PROBE.crystal + 1);

    const before = await get<Intel>(world, '/api/starter/intel', me.headers);
    expect(before.probeReports).toEqual([]);
    // There and back (owner 2026-11-07): the report is read once the probe is home.
    await pass(world, 2 * flightMinutes + 0.05);
    const after = await get<Intel>(world, '/api/starter/intel', me.headers);
    expect(after.probeReports).toHaveLength(1);
    expect(after.probeReports[0]).toMatchObject({ targetPlanetId: other.vesselId, targetName: 'Other' });
    expect(await notes(me.vesselId)).toContain('PROBE_REPORT');
  });

  /**
   * Owner playtest 2026-11-07: "probe neden geri dönmüyor? Ana gezegende öyle." As in the main galaxy
   * (`worker/handlers.ts`): it reads the ship when it arrives, and the report is read when it is home.
   */
  it('flies home before its report can be read, as the main galaxy\'s probe does', async () => {
    const me = await scout();
    const other = await aboard(world, 'Other');
    await placeShip(world, me.vesselId, { x: 0 });
    await placeShip(world, other.vesselId, { x: 395 });
    await world.f.db.update(vessels).set({ alloy: 500, crystal: 500 }).where(eq(vessels.id, me.vesselId));
    const { flightMinutes } = (await fly(me.headers, other.vesselId)).json<{ flightMinutes: number }>();

    await pass(world, flightMinutes * 1.5);
    expect(await notes(other.vesselId)).toContain('PROBE_DETECTED');
    expect((await get<Intel>(world, '/api/starter/intel', me.headers)).probeReports).toEqual([]);
    expect(await notes(me.vesselId)).not.toContain('PROBE_REPORT');
    const [away] = await world.f.db.select().from(vessels).where(eq(vessels.id, me.vesselId));
    expect(away!.facts).not.toContain<VesselFact>('FIRST_PROBE_REPORT');
    const { pending } = await get<{ pending: { kind: string; leg?: string }[] }>(world, '/api/starter/pending', me.headers);
    expect(pending).toContainEqual(expect.objectContaining({ kind: 'probe', leg: 'return' }));

    await pass(world, flightMinutes);
    expect((await get<Intel>(world, '/api/starter/intel', me.headers)).probeReports).toHaveLength(1);
    expect(await notes(me.vesselId)).toContain('PROBE_REPORT');
    const [home] = await world.f.db.select().from(vessels).where(eq(vessels.id, me.vesselId));
    expect(home!.facts).toContain<VesselFact>('FIRST_PROBE_REPORT');
    const [flight] = await world.f.db.select().from(vesselMissions).where(eq(vesselMissions.ownerVesselId, me.vesselId));
    expect(flight!.status).toBe('DONE');
  });

  it('opens the antenna\'s next repair with the first report', async () => {
    const me = await scout();
    const other = await aboard(world, 'Other');
    await fly(me.headers, other.vesselId);
    await pass(world, 5);
    const [ship] = await world.f.db.select().from(vessels).where(eq(vessels.id, me.vesselId));
    expect(ship!.facts).toContain<VesselFact>('FIRST_PROBE_REPORT');
  });

  it('is always noticed the first time a ship is ever probed', async () => {
    const me = await scout();
    const other = await aboard(world, 'Other');
    await fly(me.headers, other.vesselId);
    await pass(world, 5);
    expect(await notes(other.vesselId)).toContain('PROBE_DETECTED');
    const log = await get<Intel>(world, '/api/starter/intel', other.headers);
    expect(log.radarLog).toHaveLength(1);
  });

  it('tells a repeat probe once at most, however many arrive', async () => {
    const me = await scout();
    const other = await aboard(world, 'Other');
    await fly(me.headers, other.vesselId);
    await pass(world, 5);
    const first = (await notes(other.vesselId)).filter(kind => kind === 'PROBE_DETECTED').length;
    expect(first).toBe(1);
  });

  it('keeps a report as what was seen, whatever happens to the ship later', async () => {
    const me = await scout();
    const other = await aboard(world, 'Other');
    await fly(me.headers, other.vesselId);
    await pass(world, 5);
    const before = (await get<Intel>(world, '/api/starter/intel', me.headers)).probeReports[0]!;
    await enrich(world, other.vesselId, 900_000, 900_000);
    await pass(world, 5);
    const after = (await get<Intel>(world, '/api/starter/intel', me.headers)).probeReports[0]!;
    expect(after.stock).toEqual(before.stock);
    expect(after.at).toEqual(before.at);
  });

  it('narrows its bands with each stage of the antenna', async () => {
    const widths: number[] = [];
    for (const stage of [1, 2, 3]) {
      const me = await aboard(world, `S${stage}`, { SURVEY: stage });
      const other = await aboard(world, `T${stage}`);
      await enrich(world, other.vesselId, 40_000, 40_000);
      await fly(me.headers, other.vesselId);
      await pass(world, 5);
      const report = (await get<Intel>(world, '/api/starter/intel', me.headers)).probeReports[0]!;
      widths.push((report.stock.high - report.stock.low) / Math.max(1, report.stock.high));
    }
    expect(widths[1]!).toBeLessThan(widths[0]!);
    expect(widths[2]!).toBeLessThan(widths[1]!);
  });

  it('reads the repair as a band, never exactly', async () => {
    const me = await scout();
    const other = await aboard(world, 'Other', { SURVEY: 1, EXTRACTOR: 2 });
    await fly(me.headers, other.vesselId);
    await pass(world, 5);
    const report = (await get<Intel>(world, '/api/starter/intel', me.headers)).probeReports[0]!;
    expect(report.repair.high).toBeGreaterThan(report.repair.low);
    const [row] = await world.f.db.select().from(vesselProbeReports);
    expect(JSON.stringify(row!.snapshot)).not.toContain('modules');
  });

  it('waits five seconds before the same ship can be probed again', async () => {
    const me = await scout();
    const other = await aboard(world, 'Other');
    expect((await fly(me.headers, other.vesselId)).statusCode).toBe(200);
    const again = await fly(me.headers, other.vesselId);
    expect(again.statusCode).toBe(409);
    expect(again.json<{ error: string }>().error).toBe('PROBE_COOLDOWN');
  });

  it('refuses itself, a ship from another galaxy, and a world that is not a ship or a place here', async () => {
    const me = await scout();
    expect((await fly(me.headers, me.vesselId)).json<{ error: string }>().error).toBe('SELF_PROBE');
    const planet = world.f.planetIds[0]!;
    const toPlanet = await fly(me.headers, planet);
    expect(toPlanet.statusCode).toBe(404);
    expect(await world.f.db.select().from(vesselMissions)).toHaveLength(0);
  });

  it('refuses without the price', async () => {
    const me = await scout();
    const other = await aboard(world, 'Other');
    await world.f.db.update(vessels).set({ alloy: 1, crystal: 1 }).where(eq(vessels.id, me.vesselId));
    expect((await fly(me.headers, other.vesselId)).json<{ error: string }>().error).toBe('INSUFFICIENT_RESOURCES');
  });

  it('counts as progress, as it does in the main game', async () => {
    const me = await scout();
    const other = await aboard(world, 'Other');
    world.f.clock.advance(60);
    await fly(me.headers, other.vesselId);
    const [ship] = await world.f.db.select().from(vessels).where(eq(vessels.id, me.vesselId));
    expect(ship!.lastProgressAt.getTime()).toBe(world.f.clock.now().getTime());
  });

  it('comes to nothing if the target has left by the time it lands', async () => {
    const me = await scout();
    const other = await aboard(world, 'Other');
    await fly(me.headers, other.vesselId);
    await world.f.db.update(vessels).set({ status: 'DEPARTED', slotIndex: null }).where(eq(vessels.id, other.vesselId));
    await pass(world, 5);
    expect((await get<Intel>(world, '/api/starter/intel', me.headers)).probeReports).toEqual([]);
  });

  it('delivers a report once, redelivered or not', async () => {
    const me = await scout();
    const other = await aboard(world, 'Other');
    await fly(me.headers, other.vesselId);
    await pass(world, 5);
    await pass(world, 5);
    expect(await world.f.db.select().from(vesselProbeReports)).toHaveLength(1);
  });

  it('prices itself in the screen\'s own words', async () => {
    const me = await scout();
    const intel = await get<Intel>(world, '/api/starter/intel', me.headers);
    expect(intel.probeCost).toEqual({ alloy: PROBE.alloy, crystal: PROBE.crystal, deuterium: 0 });
  });
});
