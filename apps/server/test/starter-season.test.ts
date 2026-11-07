import { MULTI_WORLD, STARTER, type Vec3 } from '@astera/rules';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { shards, starterGalaxies, vessels } from '../src/db/schema.js';
import { testDb } from './helpers.js';
import { bearer, freshAccount, starterWorld } from './starterFixture.js';

afterAll(async () => { await (await testDb()).close(); });

interface SeasonBody {
  seasonId: string; shard: string; shardName: string; seed: number; status: string; startsAt: string; endsAt: string;
  playerCap: number; players: number; rulesetVersion: number; rivals: unknown[]; result: null;
  shieldUntil: null; shieldKind: null;
}

interface GalaxyPlanet {
  id: string; intel: string; isSelf: boolean; position: Vec3; body?: string; name?: string; owner?: string;
  coreLevel?: number; coreTier?: number; shielded?: boolean;
}

interface GalaxyBody {
  you: { planetId: string; playerId: string; capitalPlanetId: string; planetIds: string[] };
  sensors: { planetId: string; at: Vec3; identify: number; detect: number; telescope: boolean }[];
  planets: GalaxyPlanet[];
  rivals: unknown[];
  result: null;
}

describe('the galaxy a ship lives in', () => {
  let world: Awaited<ReturnType<typeof starterWorld>>;
  const get = (url: string, token: string) => world.app.inject({ url, headers: bearer(token) });
  const enlist = async (name?: string) => {
    const person = await freshAccount(world.f, name);
    const response = await world.app.inject({ method: 'POST', url: '/api/starter/enlist', headers: bearer(person.token) });
    return { ...person, vessel: response.json<{ vessel: { id: string; position: Vec3 } }>().vessel };
  };

  const antenna = (id: string) => world.f.db.update(vessels).set({ modules: { REFINERY: 1, SURVEY: 1 } }).where(eq(vessels.id, id));

  beforeEach(async () => { world = await starterWorld(); });
  afterEach(async () => { await world.built.close(); });

  describe('its season payload', () => {
    it("answers with this galaxy's own clock and seed, not the main season's", async () => {
      const person = await enlist();
      const [galaxy] = await world.f.db.select().from(starterGalaxies);
      const [shard] = await world.f.db.select().from(shards).where(eq(shards.id, galaxy!.shardId));
      const body = (await get('/api/starter/season', person.token)).json<SeasonBody>();
      expect(body).toMatchObject({
        seasonId: galaxy!.id, seed: galaxy!.seed, startsAt: galaxy!.epoch.toISOString(), status: 'live',
        shard: shard!.code, shardName: shard!.name, playerCap: galaxy!.capacity, players: 1,
        rulesetVersion: MULTI_WORLD.rulesetVersion, rivals: [], result: null, shieldUntil: null, shieldKind: null,
      });
      expect(body.seasonId).not.toBe(world.f.seasonId);
    });

    it('never reports an end in reach: a clock at zero would send the player to the galaxy list', async () => {
      const person = await enlist();
      const body = (await get('/api/starter/season', person.token)).json<SeasonBody>();
      const days = (new Date(body.endsAt).getTime() - world.f.clock.now().getTime()) / 86_400_000;
      expect(days).toBeGreaterThan(300);
    });

    it('counts the ships still here, not the ones that left', async () => {
      const first = await enlist();
      const second = await enlist('Second');
      await world.f.db.update(vessels).set({ status: 'DEPARTED' }).where(eq(vessels.id, second.vessel.id));
      expect((await get('/api/starter/season', first.token)).json<SeasonBody>().players).toBe(1);
    });

    it('refuses an account with no ship', async () => {
      const person = await freshAccount(world.f);
      const response = await get('/api/starter/season', person.token);
      expect(response.statusCode).toBe(404);
      expect(response.json<{ error: string }>().error).toBe('VESSEL_NOT_FOUND');
    });
  });

  describe('its map', () => {
    it('names your own ship as your only world, and says it is a ship', async () => {
      const person = await enlist('Me');
      const body = (await get('/api/starter/galaxy', person.token)).json<GalaxyBody>();
      expect(body.you).toEqual({
        planetId: person.vessel.id, playerId: person.vessel.id, capitalPlanetId: person.vessel.id, planetIds: [person.vessel.id],
      });
      const self = body.planets.find(planet => planet.isSelf)!;
      expect(self).toMatchObject({ id: person.vessel.id, intel: 'RESOLVED', body: 'VESSEL', name: 'Me', position: person.vessel.position });
    });

    it('holds every ship at Core 1, which is what keeps the band rule shut without touching it', async () => {
      const person = await enlist('Me');
      const body = (await get('/api/starter/galaxy', person.token)).json<GalaxyBody>();
      expect(body.planets.find(planet => planet.isSelf)).toMatchObject({ coreLevel: 1, coreTier: 1 });
    });

    it('shows no neighbour before the survey antenna works: the server locks it, not the menu', async () => {
      const person = await enlist('Me');
      await enlist('Other');
      const body = (await get('/api/starter/galaxy', person.token)).json<GalaxyBody>();
      expect(body.planets.map(planet => planet.id)).toEqual([person.vessel.id]);
    });

    it('draws a neighbour as a point with nothing to read: the fog is omission', async () => {
      const person = await enlist('Me');
      const other = await enlist('Other');
      await antenna(person.vessel.id);
      const body = (await get('/api/starter/galaxy', person.token)).json<GalaxyBody>();
      const seen = body.planets.find(planet => planet.id === other.vessel.id)!;
      expect(seen).toEqual({ id: other.vessel.id, body: 'VESSEL', position: other.vessel.position, intel: 'UNKNOWN', isSelf: false, isOwned: false, state: { kind: 'NORMAL' } });
      expect(JSON.stringify(body)).not.toContain('Other');
    });

    it('shows ships in the same galaxy only: a left ship has gone from the sky', async () => {
      const person = await enlist('Me');
      const other = await enlist('Other');
      await antenna(person.vessel.id);
      await world.f.db.update(vessels).set({ status: 'DEPARTED' }).where(eq(vessels.id, other.vessel.id));
      const body = (await get('/api/starter/galaxy', person.token)).json<GalaxyBody>();
      expect(body.planets.map(planet => planet.id)).toEqual([person.vessel.id]);
    });

    it('carries nothing of the main galaxy', async () => {
      const person = await enlist('Me');
      const body = (await get('/api/starter/galaxy', person.token)).json<GalaxyBody>();
      expect(body.planets.some(planet => planet.id === world.f.planetIds[0])).toBe(false);
      expect(JSON.stringify(body)).not.toContain(world.f.seasonId);
    });

    it('publishes the eyes the fog was applied with: naked eye and no radar on a new ship', async () => {
      const person = await enlist('Me');
      const body = (await get('/api/starter/galaxy', person.token)).json<GalaxyBody>();
      expect(body.sensors).toEqual([{
        planetId: person.vessel.id, at: person.vessel.position, identify: STARTER.nakedEye, detect: 0, telescope: false,
      }]);
    });

    it('resolves nobody a new ship cannot see, since no berth is that close', async () => {
      const person = await enlist('Me');
      await enlist('Other');
      await antenna(person.vessel.id);
      const body = (await get('/api/starter/galaxy', person.token)).json<GalaxyBody>();
      expect(body.planets.filter(planet => !planet.isSelf).every(planet => planet.intel === 'UNKNOWN')).toBe(true);
    });
  });
});
