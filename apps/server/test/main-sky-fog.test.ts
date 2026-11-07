import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MONUMENT_MOTION_RULESET, motionPositionAt, type MonumentMotion } from '@astera/rules';
import { hpRadiationSources, monuments, planets, seasons, shards, vessels } from '../src/db/schema.js';
import { testDb } from './helpers.js';
import { bearer, freshAccount, starterWorld } from './starterFixture.js';

afterAll(async () => { await (await testDb()).close(); });

interface MainSky {
  points: number[]; worlds: number; server: string; seasonEndsAt: string | null;
  monuments: { position: { x: number; y: number; z: number }; difficulty: string; ordinal: number; motion?: MonumentMotion }[];
  clouds: { mode: string; center: { x: number; y: number; z: number }; radius: number; intensityHpPerMinute: number; level?: number; motion?: MonumentMotion }[];
}

/**
 * THE MAIN GALAXY IS A PICTURE FROM HERE. Plan K1: nothing crosses but the jump, and a client that
 * never received an id, a name or a movement cannot point at a world over there.
 */
describe('the main galaxy, seen from a ship', () => {
  let world: Awaited<ReturnType<typeof starterWorld>>;
  const read = async (token: string, headers: Record<string, string> = {}) =>
    world.app.inject({ url: '/api/starter/main-sky', headers: { ...bearer(token), ...headers } });
  const aboard = async () => {
    const person = await freshAccount(world.f);
    await world.app.inject({ method: 'POST', url: '/api/starter/enlist', headers: bearer(person.token) });
    return person;
  };

  beforeEach(async () => { world = await starterWorld(); });
  afterEach(async () => { await world.built.close(); });

  it('gives whole-number positions and a count, and the name of the place', async () => {
    const person = await aboard();
    const rows = await world.f.db.select().from(planets).where(eq(planets.seasonId, world.f.seasonId));
    const [season] = await world.f.db.select().from(seasons).where(eq(seasons.id, world.f.seasonId));
    const [shard] = await world.f.db.select().from(shards).where(eq(shards.id, season!.shardId));
    const body = (await read(person.token)).json<MainSky>();
    expect(body.worlds).toBe(rows.length);
    expect(body.points).toHaveLength(rows.length * 3);
    expect(body.points.every(value => Number.isInteger(value))).toBe(true);
    expect(body.server).toBe(shard!.name);
    expect(body.seasonEndsAt).toBe(season!.endsAt.toISOString());
  });

  it('sends no identity of any kind', async () => {
    const person = await aboard();
    const rows = await world.f.db.select().from(planets).where(eq(planets.seasonId, world.f.seasonId));
    const body = (await read(person.token)).json<MainSky & Record<string, unknown>>();
    expect(Object.keys(body).sort()).toEqual(['clouds', 'monuments', 'points', 'seasonEndsAt', 'server', 'worlds']);
    const text = JSON.stringify(body);
    for (const row of rows) {
      expect(text).not.toContain(row.id);
      expect(text).not.toContain(row.name);
    }
  });

  describe('its landmarks', () => {
    const monument = async () => {
      await world.f.db.update(seasons).set({ rulesetVersion: 19 }).where(eq(seasons.id, world.f.seasonId));
      const [row] = await world.f.db.insert(monuments).values({
        seasonId: world.f.seasonId, ordinal: 1, x: 6000.4, y: 0, z: 0, capacity: 1000, productionPerMinute: 60,
        garrison: { DART: 1 }, settledAt: world.f.clock.now(),
      }).returning();
      return row!;
    };

    it('shows where the monuments stand, as whole numbers', async () => {
      const person = await aboard();
      await monument();
      const body = (await read(person.token)).json<MainSky>();
      expect(body.monuments).toHaveLength(1);
      expect(Number.isInteger(body.monuments[0]!.position.x)).toBe(true);
      expect(body.monuments[0]!.position.x).toBeGreaterThan(5000);
    });

    it('says nothing of who holds a monument, or how it is armed', async () => {
      const person = await aboard();
      const row = await monument();
      const body = (await read(person.token)).json<MainSky>();
      expect(Object.keys(body.monuments[0]!).filter(key => key !== 'motion').sort()).toEqual(['difficulty', 'ordinal', 'position']);
      expect(JSON.stringify(body)).not.toContain(row.id);
    });

    it('draws a monument\'s cloud around the monument, where it has moved to by now', async () => {
      const person = await aboard();
      const row = await monument();
      await world.f.db.update(seasons).set({ rulesetVersion: MONUMENT_MOTION_RULESET, startsAt: new Date(world.f.clock.now().getTime() - 3_600_000) })
        .where(eq(seasons.id, world.f.seasonId));
      await world.f.db.insert(hpRadiationSources).values({ seasonId: world.f.seasonId, anchorKind: 'MONUMENT', anchorId: row.id,
        x: row.x, y: row.y, z: row.z, radius: 900, intensityHpPerMinute: 2, mode: 'EMIT', activeFrom: world.f.clock.now() });
      world.f.clock.advance(180);
      const body = (await read(person.token)).json<MainSky>();
      const [cloud] = body.clouds, [standing] = body.monuments;
      expect(Math.abs(cloud!.center.x - standing!.position.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(cloud!.center.y - standing!.position.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(cloud!.center.z - standing!.position.z)).toBeLessThanOrEqual(1);
    });

    it('sends the path a monument and its cloud move on, so a picture read once keeps moving', async () => {
      const person = await aboard();
      const row = await monument();
      await world.f.db.update(seasons).set({ rulesetVersion: MONUMENT_MOTION_RULESET, startsAt: new Date(world.f.clock.now().getTime() - 3_600_000) })
        .where(eq(seasons.id, world.f.seasonId));
      await world.f.db.insert(hpRadiationSources).values({ seasonId: world.f.seasonId, anchorKind: 'MONUMENT', anchorId: row.id,
        x: row.x, y: row.y, z: row.z, radius: 900, intensityHpPerMinute: 2, mode: 'EMIT', activeFrom: world.f.clock.now() });
      const body = (await read(person.token)).json<MainSky>();
      const later = world.f.clock.now().getTime() + 86_400_000;
      expect(motionPositionAt(body.monuments[0]!.motion!, later)).toEqual(motionPositionAt(body.clouds[0]!.motion!, later));
      expect(motionPositionAt(body.monuments[0]!.motion!, later)).not.toEqual(body.monuments[0]!.position);
    });

    it('sends no id or target with a cloud', async () => {
      const person = await aboard();
      const row = await monument();
      await world.f.db.insert(hpRadiationSources).values({ seasonId: world.f.seasonId, anchorKind: 'MONUMENT', anchorId: row.id,
        x: row.x, y: row.y, z: row.z, radius: 900, intensityHpPerMinute: 2, mode: 'EMIT', activeFrom: world.f.clock.now() });
      const body = (await read(person.token)).json<MainSky>();
      expect(Object.keys(body.clouds[0]!).sort()).toEqual(expect.not.arrayContaining(['id', 'target']));
      expect(JSON.stringify(body)).not.toContain(row.id);
    });

    it('has none to show between seasons', async () => {
      const person = await aboard();
      await monument();
      await world.f.db.update(seasons).set({ status: 'frozen' }).where(eq(seasons.id, world.f.seasonId));
      const body = (await read(person.token)).json<MainSky>();
      expect(body.monuments).toEqual([]);
      expect(body.clouds).toEqual([]);
    });
  });

  it('never includes the ships around you', async () => {
    const person = await aboard();
    const [ship] = await world.f.db.select().from(vessels);
    const body = (await read(person.token)).json<MainSky>();
    const triples = Array.from({ length: body.worlds }, (_, i) => body.points.slice(i * 3, i * 3 + 3).join());
    expect(triples).not.toContain([ship!.x, ship!.y, ship!.z].map(Math.round).join());
  });

  it('answers 304 to a client already holding this picture', async () => {
    const person = await aboard();
    const first = await read(person.token);
    const etag = first.headers.etag;
    expect(typeof etag).toBe('string');
    const again = await read(person.token, { 'if-none-match': String(etag) });
    expect(again.statusCode).toBe(304);
    expect(again.body).toBe('');
  });

  it('is read from the database once in ten minutes, however many ask', async () => {
    const person = await aboard();
    const before = (await read(person.token)).json<MainSky>();
    await world.f.db.update(planets).set({ x: 987_654 }).where(eq(planets.id, world.f.planetIds[0]!));
    world.f.clock.advance(9);
    expect((await read(person.token)).json<MainSky>().points).toEqual(before.points);
    world.f.clock.advance(2);
    expect((await read(person.token)).json<MainSky>().points).toContain(987_654);
  });

  it('still answers between seasons: the plate needs no points', async () => {
    const person = await aboard();
    await world.f.db.update(seasons).set({ status: 'frozen' }).where(eq(seasons.id, world.f.seasonId));
    const response = await read(person.token);
    expect(response.statusCode).toBe(200);
    expect(response.json<MainSky>()).toMatchObject({ points: [], worlds: 0, seasonEndsAt: null });
  });

  it('is for ships: an account without one is refused', async () => {
    const person = await freshAccount(world.f);
    const response = await read(person.token);
    expect(response.statusCode).toBe(404);
    expect(response.json<{ error: string }>().error).toBe('VESSEL_NOT_FOUND');
  });
});
