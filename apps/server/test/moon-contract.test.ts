import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MOON, fleetEntries, scanRange, type Fleet } from '@astera/rules';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import { moons, planets, seasons, units } from '../src/db/schema.js';
import { launchProbe } from '../src/services/intel.js';
import { launchAttack } from '../src/services/mission.js';
import { MOON_LOCATION } from '../src/services/unitLocation.js';
import { EventWorker } from '../src/worker/loop.js';
import {
  galaxySchema, intelSchema, moonBuildSchema, moonHopSchema, moonJumpSchema, moonRetargetSchema, moonScanSchema,
  moonScansSchema, planetSchema, reportsSchema,
} from '../../web/src/api/schemas.js';
import {
  fuelUp, giveResearch, giveUnits, grant, levelWorld, placeAt, seedWorld, setLevel, testDb, testEnv, type Fixture,
} from './helpers.js';

/*
  OTA F4 (canlı güncelleme planı §5.1): every moon payload, read by the web's own schema.
  The moon tests checked the fields they cared about with hand-written shapes, so on 2026-11-24 the probe's
  moon reading (`fleet`) and the client's (`fleetSize`) disagreed on a green build and Intel stopped parsing
  for every commander who probed a world with a moon. contract.test.ts says why the client's parser runs here.
*/
const silent = pino({ level: 'silent' });

describe('every moon payload the client parses', () => {
  let f: Fixture;
  let home: string;
  let colony: string;
  let enemy: string;
  let app: FastifyInstance;
  let close: () => Promise<void>;
  let mine: string;
  let theirs: string;

  const tokens = new TokenService(testEnv().JWT_SECRET, 15, 30);
  const get = async (url: string, authorization = mine): Promise<unknown> => {
    const res = await app.inject({ url, headers: { authorization } });
    expect(res.statusCode, res.body).toBe(200);
    return res.json();
  };
  const post = async (url: string, payload: unknown, authorization = mine): Promise<unknown> => {
    const res = await app.inject({ method: 'POST', url, headers: { authorization }, payload: payload as Record<string, unknown> });
    expect(res.statusCode, res.body).toBe(200);
    return res.json();
  };
  const putOnMoon = async (planetId: string, fleet: Fleet, owner: string) => {
    for (const [hull, count] of fleetEntries(fleet)) {
      await f.db.insert(units).values({ planetId, ownerPlayerId: owner, hull, location: MOON_LOCATION, count });
    }
  };
  const settle = async (at: Date) => {
    const worker = new EventWorker(f.db, f.clock, { pollMs: 1, batch: 100, staleMinutes: 5 }, silent);
    f.clock.set(new Date(at.getTime() + 60_000));
    await worker.tick();
    f.clock.advance(60);
    await worker.tick();
  };

  beforeEach(async () => {
    f = await seedWorld(3, 21_240);
    [home, enemy, colony] = f.planetIds as [string, string, string];
    await f.db.update(seasons).set({ rulesetVersion: MOON.rulesetVersion }).where(eq(seasons.id, f.seasonId));
    await placeAt(f.db, home, { x: 0 });
    await placeAt(f.db, enemy, { x: scanRange('EPIC') * 0.5 });
    await placeAt(f.db, colony, { x: 900 });
    for (const id of f.planetIds) {
      await setLevel(f.db, id, 'CORE', 12);
      await setLevel(f.db, id, 'SHIPYARD', 4);
    }
    await f.db.update(planets).set({
      controllerPlayerId: f.playerIds[0]!, kind: 'COLONY', statsOwnerPlayerId: f.playerIds[0]!,
      seasonTelemetry: { produced: { alloy: 0, crystal: 0, deuterium: 0 }, productiveSeconds: 0, shipsBuilt: {} },
    }).where(eq(planets.id, colony));
    await f.db.insert(moons).values([
      { planetId: home, rarity: 'EPIC', origin: 'BUILT', visualSeed: 1, bornAt: f.clock.now() },
      { planetId: colony, rarity: 'COMMON', origin: 'BUILT', visualSeed: 2, bornAt: f.clock.now() },
      { planetId: enemy, rarity: 'RARE', origin: 'BATTLE', cracks: 1, lastHitAt: f.clock.now(), visualSeed: 3, bornAt: f.clock.now() },
    ]);
    await levelWorld(f.db, f.planetIds);
    for (const id of f.planetIds) {
      await setLevel(f.db, id, 'HANGAR', 10);
      await grant(f.db, id, 200_000, 200_000);
    }
    f.clock.advance(250);
    for (const id of f.planetIds) await fuelUp(f.db, id);
    await putOnMoon(enemy, { PIKE: 2 }, f.playerIds[1]!);
    const built = buildApp({ env: testEnv(), logger: silent, db: f.db, clock: f.clock });
    app = built.app;
    close = built.close;
    await app.ready();
    mine = `Bearer ${await tokens.issueAccess(f.accountIds[0]!)}`;
    theirs = `Bearer ${await tokens.issueAccess(f.accountIds[1]!)}`;
  });
  afterEach(async () => { await close(); });
  afterAll(async () => { await (await testDb()).close(); });

  it('a world with a moon, its moon fleet and a hop on its way: /api/planet and the hop parse', async () => {
    await putOnMoon(home, { DART: 5 }, f.playerIds[0]!);
    await giveUnits(f.db, home, { DART: 4 });
    moonHopSchema.parse(await post(`/api/planets/${home}/moon/hop`, { direction: 'UP', fleet: { DART: 4 } }));
    const view = planetSchema.parse(await get('/api/planet'));
    expect(view.moon).toMatchObject({ rarity: 'EPIC', fleet: { DART: 5 } });
    expect(view.moon?.moves).toHaveLength(1);
    expect(planetSchema.parse(await get(`/api/planets/${colony}`)).moon?.rarity).toBe('COMMON');
  });

  it('the Moon Gate jump parses', async () => {
    await putOnMoon(home, { DART: 10 }, f.playerIds[0]!);
    expect(moonJumpSchema.parse(await post(`/api/planets/${home}/moon/jump`, { toPlanetId: colony, fleet: { DART: 10 } })))
      .toMatchObject({ kind: 'JUMP' });
  });

  it('a Gözcü scan and the scan list parse, with a route on them', async () => {
    await giveUnits(f.db, enemy, { DART: 10 });
    await launchAttack(f.db, enemy, colony, { DART: 10 }, f.clock);
    const scan = moonScanSchema.parse(await post(`/api/planets/${home}/moon/scan`, { targetPlanetId: enemy }));
    expect(scan.rows.length).toBeGreaterThan(0);
    expect(moonScansSchema.parse(await get('/api/intel/moon-scans')).scans).toHaveLength(1);
  });

  it('a raid switched to the moon parses, and so does the battle report it writes', async () => {
    await giveUnits(f.db, home, { DART: 40 });
    const raid = await launchAttack(f.db, home, enemy, { DART: 40 }, f.clock);
    expect(moonRetargetSchema.parse(await post(`/api/missions/${raid.missionId}/target-body`, { body: 'MOON' })))
      .toMatchObject({ targetBody: 'MOON' });
    await settle(raid.arriveAt);
    const mineReports = reportsSchema.parse(await get('/api/reports'));
    const theirReports = reportsSchema.parse(await get('/api/reports', theirs));
    expect(JSON.stringify(mineReports)).toContain('"MOON"');
    expect(JSON.stringify(theirReports)).toContain('"MOON"');
  });

  it('a probe report with a moon reading parses on /api/intel', async () => {
    const probe = await launchProbe(f.db, home, enemy, f.clock, f.playerIds[0]);
    await settle(probe.arriveAt);
    const intel = intelSchema.parse(await get('/api/intel'));
    expect(JSON.stringify(intel)).toContain('"RARE"');
  });

  it('the galaxy with moons parses for the owner and for a stranger', async () => {
    expect(galaxySchema.parse(await get('/api/galaxy')).moons).toBeDefined();
    expect(galaxySchema.parse(await get('/api/galaxy', theirs)).moons).toBeDefined();
  });

  it('ordering a Common moon parses', async () => {
    await f.db.delete(moons).where(and(eq(moons.planetId, colony)));
    await giveResearch(f.db, colony, 'LUNAR_CAPTURE');
    moonBuildSchema.parse(await post(`/api/planets/${colony}/moon/build`, {}));
  });
});
