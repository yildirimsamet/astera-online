import { STARTER, openPartTarget, outpostName } from '@astera/rules';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { galaxySchema } from '../../web/src/api/schemas.js';
import { starterSites, vesselProbeReports, vessels } from '../src/db/schema.js';
import { sweepStarterWorld } from '../src/services/starter/sites.js';
import { testDb } from './helpers.js';
import { starterWorld } from './starterFixture.js';
import { aboard, get, pass, post } from './starterShips.js';

afterAll(async () => { await (await testDb()).close(); });
// The drive panel open: the gate's modules, the radar among them (owner 2026-11-08, N3).
const HUNTER = { REFINERY: 4, EXTRACTOR: 3, SURVEY: 2, HANGAR: 2, SHIPYARD: 1, TELESCOPE: 1, RADAR: 1 };

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

  it('keep the open part target, whatever else happens', async () => {
    const me = await aboard(world, 'Hunter', HUNTER);
    await world.f.db.update(vessels).set({ facts: ['FIRST_MINING_RETURN', 'FIRST_BATTLE_REPORT', 'FIRST_PROBE_REPORT'] }).where(eq(vessels.id, me.vesselId));
    await sweep();
    const open = async () => [...await all('WRECK'), ...await all('OUTPOST')].filter(site => site.hasPart);
    expect(await open()).toHaveLength(openPartTarget(1));
    const [taken] = await open();
    await world.f.db.update(starterSites).set({ hasPart: false }).where(eq(starterSites.id, taken!.id));
    await sweep();
    expect(await open()).toHaveLength(openPartTarget(1));
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

  it('never say where a part is to someone not hunting it', async () => {
    const hunter = await aboard(world, 'Hunter', HUNTER);
    await world.f.db.update(vessels).set({ facts: ['FIRST_MINING_RETURN', 'FIRST_BATTLE_REPORT', 'FIRST_PROBE_REPORT'] }).where(eq(vessels.id, hunter.vesselId));
    const other = await aboard(world, 'Other', { SURVEY: 1, SHIPYARD: 1 });
    await sweep();
    const body = JSON.stringify(await get(world, '/api/starter/galaxy', other.headers));
    expect(body).not.toContain('hasPart');
    expect(JSON.stringify(await get(world, '/api/starter/mining', other.headers))).not.toContain('hasPart');
  });

  describe('a part, to someone hunting one', () => {
    const FACTS = ['FIRST_MINING_RETURN', 'FIRST_BATTLE_REPORT', 'FIRST_PROBE_REPORT'] as const;
    interface Map { planets: { id: string; hasPart?: boolean }[] }
    interface Mining { debris: { id: string; hasPart?: boolean }[] }

    const hunting = async () => {
      const me = await aboard(world, 'Hunter', HUNTER);
      await world.f.db.update(vessels).set({ facts: [...FACTS] }).where(eq(vessels.id, me.vesselId));
      await sweep();
      await world.f.db.update(starterSites).set({ hasPart: false });
      return me;
    };
    const nearAndFar = async (kind: 'OUTPOST' | 'WRECK', me: { position: { x: number; y: number; z: number } }) => {
      const [near, far] = await all(kind);
      await world.f.db.update(starterSites).set({ hasPart: true, x: me.position.x + 20, y: me.position.y, z: me.position.z }).where(eq(starterSites.id, near!.id));
      await world.f.db.update(starterSites).set({ hasPart: true, x: me.position.x + 2000, y: me.position.y, z: me.position.z }).where(eq(starterSites.id, far!.id));
      return { near: near!.id, far: far!.id };
    };

    it('marks an outpost in sight, and only in sight', async () => {
      const me = await hunting();
      const { near, far } = await nearAndFar('OUTPOST', me);
      const map = await get<Map>(world, '/api/starter/galaxy', me.headers);
      expect(map.planets.find(planet => planet.id === near)?.hasPart).toBe(true);
      expect(map.planets.find(planet => planet.id === far)).not.toHaveProperty('hasPart');
    });

    it('marks a wreck field the same way', async () => {
      const me = await hunting();
      const { near, far } = await nearAndFar('WRECK', me);
      const mining = await get<Mining>(world, '/api/starter/mining', me.headers);
      expect(mining.debris.find(field => field.id === near)?.hasPart).toBe(true);
      expect(mining.debris.find(field => field.id === far)).not.toHaveProperty('hasPart');
    });

    it('keeps the mark a probe found past the reach of the telescope, until the part has gone', async () => {
      const me = await hunting();
      const { far } = await nearAndFar('OUTPOST', me);
      await world.f.db.insert(vesselProbeReports).values({
        observerVesselId: me.vesselId, targetSiteId: far, missionId: crypto.randomUUID(), targetName: 'OP', at: world.f.clock.now(), accuracy: 1, snapshot: { hasPart: true }, detected: false, deliveredAt: world.f.clock.now(),
      });
      const seen = async () => (await get<Map>(world, '/api/starter/galaxy', me.headers)).planets.find(planet => planet.id === far);
      expect((await seen())?.hasPart).toBe(true);
      await world.f.db.update(starterSites).set({ hasPart: false }).where(eq(starterSites.id, far));
      expect(await seen()).not.toHaveProperty('hasPart');
    });

    it('stops marking once the ship holds all it can carry', async () => {
      const me = await hunting();
      const { near } = await nearAndFar('OUTPOST', me);
      await world.f.db.update(vessels).set({ parts: STARTER.parts.needed }).where(eq(vessels.id, me.vesselId));
      const map = await get<Map>(world, '/api/starter/galaxy', me.headers);
      expect(map.planets.find(planet => planet.id === near)).not.toHaveProperty('hasPart');
    });

    it('reads through the real schemas', async () => {
      const me = await hunting();
      const { near } = await nearAndFar('OUTPOST', me);
      const map = galaxySchema.parse(await get(world, '/api/starter/galaxy', me.headers));
      expect(map.planets.find(planet => planet.id === near)?.hasPart).toBe(true);
    });

    it('is not in a probe report for a ship that is not hunting', async () => {
      const other = await aboard(world, 'Other', { SURVEY: 1, SHIPYARD: 1 });
      await sweep();
      const [site] = await all('OUTPOST');
      await world.f.db.update(starterSites).set({ hasPart: true }).where(eq(starterSites.id, site!.id));
      await post(world, '/api/starter/probe', other.headers, { targetPlanetId: site!.id });
      await pass(world, 600);
      const [report] = await world.f.db.select().from(vesselProbeReports).where(eq(vesselProbeReports.observerVesselId, other.vesselId));
      expect(report).toBeDefined();
      expect(report!.snapshot).not.toHaveProperty('hasPart');
      expect(report!.targetName).toBe(outpostName(site!.id));
    });
  });
});
