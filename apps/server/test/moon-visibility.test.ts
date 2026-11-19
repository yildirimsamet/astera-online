import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { MOON, SENSOR } from '@astera/rules';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import { moons, probeReports, satellites, seasons, units } from '../src/db/schema.js';
import { assignWatch, launchProbe, readTelescopes } from '../src/services/intel.js';
import { hopFleet } from '../src/services/moonMovement.js';
import { MOON_LOCATION } from '../src/services/unitLocation.js';
import { EventWorker } from '../src/worker/loop.js';
import { fuelUp, giveSatellite, grant, levelWorld, placeAt, seedWorld, setLevel, testDb, testEnv, type Fixture } from './helpers.js';

/*
  F3a (S53, plan §8, §9.1): a moon's existence, cracks and last hit are public; its rarity is shown only to
  its owner and to an observer whose sensors identify the world right now. Below ruleset 20 the galaxy
  payload carries no moon field at all (E13).
*/
describe('who sees which moon', () => {
  let f: Fixture;
  let app: FastifyInstance;
  let close: () => Promise<void>;
  let authorization: string;
  let mine: string;
  let near: string;
  let far: string;
  const hitAt = new Date('2026-01-01T00:00:00.000Z');

  beforeEach(async () => {
    f = await seedWorld(3, 20_050);
    [mine, near, far] = f.planetIds as [string, string, string];
    await placeAt(f.db, mine, { x: 0 });
    await placeAt(f.db, near, { x: SENSOR.baseRadius * 0.5 });
    await placeAt(f.db, far, { x: SENSOR.maxRadius * 1.4 });
    for (const id of f.planetIds) await setLevel(f.db, id, 'CORE', 8);
    await f.db.insert(moons).values([
      { planetId: mine, rarity: 'RARE', origin: 'BUILT', visualSeed: 11, bornAt: hitAt },
      { planetId: near, rarity: 'EPIC', origin: 'BATTLE', visualSeed: 12, bornAt: hitAt },
      { planetId: far, rarity: 'LEGENDARY', origin: 'SEED', cracks: 4, lastHitAt: hitAt, visualSeed: 13, bornAt: hitAt },
    ]);
    const built = buildApp({ env: testEnv({ PROJECTION_CACHE_ENABLED: 'false' }), logger: pino({ level: 'silent' }), db: f.db, clock: f.clock });
    app = built.app;
    close = built.close;
    await app.ready();
    authorization = `Bearer ${await new TokenService('test-secret-that-is-long-enough', 15, 30).issueAccess(f.accountIds[0]!)}`;
  });
  afterEach(async () => { await close(); });
  afterAll(async () => { const { close: closeDb } = await testDb(); await closeDb(); });

  const galaxy = async (): Promise<Record<string, unknown>> => {
    const res = await app.inject({ url: '/api/galaxy', headers: { authorization } });
    expect(res.statusCode).toBe(200);
    const body: Record<string, unknown> = res.json();
    return body;
  };

  it('says nothing about moons in a galaxy without them', async () => {
    const body = await galaxy();
    expect(body).not.toHaveProperty('moons');
    expect(JSON.stringify(body)).not.toMatch(/LEGENDARY|visualSeed/u);
  });

  it('lists every moon publicly, and names the rarity only where the observer can see it', async () => {
    await f.db.update(seasons).set({ rulesetVersion: MOON.rulesetVersion }).where(eq(seasons.id, f.seasonId));
    const body = await galaxy();
    const view = z.object({
      list: z.array(z.object({ planetId: z.string(), cracks: z.number(), lastHitAt: z.string().nullable(), visualSeed: z.number() }).strict()),
      rarity: z.record(z.string(), z.string()),
    }).strict().parse(body.moons);
    expect(view.list.toSorted((a, b) => a.visualSeed - b.visualSeed)).toEqual([
      { planetId: mine, cracks: 0, lastHitAt: null, visualSeed: 11 },
      { planetId: near, cracks: 0, lastHitAt: null, visualSeed: 12 },
      { planetId: far, cracks: 4, lastHitAt: hitAt.toISOString(), visualSeed: 13 },
    ]);
    expect(view.rarity).toEqual({ [mine]: 'RARE', [near]: 'EPIC' });
    // Origin is the owner's alone, and an unseen world's rarity is nowhere in the payload.
    expect(JSON.stringify(body)).not.toMatch(/LEGENDARY|"origin":"(?:SEED|BUILT|BATTLE)"/u);
  });

  it('a probe brings home the moon’s rarity, cracks and a fleet band, and the rarity stays remembered', async () => {
    await f.db.update(seasons).set({ rulesetVersion: MOON.rulesetVersion }).where(eq(seasons.id, f.seasonId));
    for (const id of f.planetIds) {
      await grant(f.db, id, 40_000, 8_000);
      await fuelUp(f.db, id);
    }
    await setLevel(f.db, mine, 'SHIPYARD', 3);
    await levelWorld(f.db, f.planetIds);
    await f.db.insert(units).values({ planetId: far, ownerPlayerId: f.playerIds[2]!, hull: 'PIKE', location: MOON_LOCATION, count: 9 });
    const worker = new EventWorker(f.db, f.clock, { pollMs: 1000, batch: 100, staleMinutes: 5 }, pino({ level: 'silent' }));
    const launch = await launchProbe(f.db, mine, far, f.clock);
    f.clock.set(launch.arriveAt);
    await worker.tick();
    f.clock.advance(launch.flightMinutes + 1);
    await worker.tick();

    const [report] = await f.db.select().from(probeReports).where(eq(probeReports.targetPlanetId, far));
    const moon = report?.silhouette?.moon;
    expect(moon).toMatchObject({ rarity: 'LEGENDARY', cracks: 4, lastHitAt: hitAt.toISOString(), hopping: false });
    expect(moon!.fleet.low).toBeLessThanOrEqual(9);
    expect(moon!.fleet.high).toBeGreaterThanOrEqual(9);
    const body = await galaxy();
    expect(z.object({ rarity: z.record(z.string(), z.string()) }).passthrough().parse(body.moons).rarity[far]).toBe('LEGENDARY');
  });

  it('a telescope reads the moon as a second row: ships there, empty, a hop under way, or no moon (S40)', async () => {
    await f.db.update(seasons).set({ rulesetVersion: MOON.rulesetVersion }).where(eq(seasons.id, f.seasonId));
    await giveSatellite(f.db, mine, 'UPLINK');
    await f.db.insert(satellites).values({ planetId: mine, slot: 0, type: 'TELESCOPE', level: 5 });
    await assignWatch(f.db, mine, near, 0, f.clock);
    const moonRow = async () => (await readTelescopes(f.db, f.playerIds[0]!, f.clock))[0]?.moon;
    expect(await moonRow()).toBe('EMPTY');
    await f.db.insert(units).values({ planetId: near, ownerPlayerId: f.playerIds[1]!, hull: 'PIKE', location: MOON_LOCATION, count: 2 });
    expect(await moonRow()).toBe('HOME');
    await f.db.insert(units).values({ planetId: near, ownerPlayerId: f.playerIds[1]!, hull: 'DART', count: 3 })
      .onConflictDoUpdate({ target: [units.planetId, units.hull, units.location], set: { count: 3 } });
    await hopFleet(f.db, f.playerIds[1]!, near, 'DOWN', { PIKE: 2 }, f.clock);
    expect(await moonRow()).toBe('HOP');
    await f.db.delete(moons).where(eq(moons.planetId, near));
    expect(await moonRow()).toBe('NONE');
  });
});
