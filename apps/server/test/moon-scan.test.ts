import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { MOON, scanRange } from '@astera/rules';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import { missions, moons, notifications, planets, probeWorldMemories, seasons } from '../src/db/schema.js';
import { launchProbe } from '../src/services/intel.js';
import { launchAttack } from '../src/services/mission.js';
import { scanFromMoon } from '../src/services/moonScan.js';
import { launchTransfer } from '../src/services/movement.js';
import { fuelUp, giveUnits, grant, levelWorld, placeAt, seedWorld, setLevel, testDb, testEnv, type Fixture } from './helpers.js';

/*
  F5 — GÖZCÜ (S14, S15, S20, S33, S53; plan §6.12): a moon photographs the routes into and out of a world in
  its range: direction, the other world, the arrival time and a rough size — never what kind of flight it
  is. Probes, mining and strategic strikes do not show; a flight that touches a moon shows only to a
  Legendary. Each scan costs 30 deuterium from the planet and is silent. Worlds on the routes are learnt.
*/
const silent = pino({ level: 'silent' });

describe('Gözcü, the moon’s route scan', () => {
  let f: Fixture;
  let mine: string;
  let target: string;
  let raider: string;
  let colony: string;
  let app: FastifyInstance;
  let close: () => Promise<void>;
  const EMPTY = { alloy: 0, crystal: 0, deuterium: 0 };

  beforeEach(async () => {
    f = await seedWorld(4, 20_150);
    [mine, target, raider, colony] = f.planetIds as [string, string, string, string];
    await f.db.update(seasons).set({ rulesetVersion: MOON.rulesetVersion }).where(eq(seasons.id, f.seasonId));
    await placeAt(f.db, mine, { x: 0 });
    await placeAt(f.db, target, { x: scanRange('COMMON') * 0.6 });
    await placeAt(f.db, raider, { x: scanRange('COMMON') * 1.2 });
    await placeAt(f.db, colony, { x: scanRange('COMMON') * 3 });
    for (const id of f.planetIds) {
      await setLevel(f.db, id, 'CORE', 8);
      await setLevel(f.db, id, 'SHIPYARD', 4);
    }
    // The target's commander also holds the far colony, and sends a squadron there.
    await f.db.update(planets).set({
      controllerPlayerId: f.playerIds[1]!, kind: 'COLONY', statsOwnerPlayerId: f.playerIds[1]!,
      seasonTelemetry: { produced: { alloy: 0, crystal: 0, deuterium: 0 }, productiveSeconds: 0, shipsBuilt: {} },
    }).where(eq(planets.id, colony));
    await f.db.insert(moons).values([
      { planetId: mine, rarity: 'COMMON', origin: 'BUILT', visualSeed: 1, bornAt: f.clock.now() },
      { planetId: target, rarity: 'RARE', origin: 'BUILT', visualSeed: 2, bornAt: f.clock.now() },
      { planetId: raider, rarity: 'EPIC', origin: 'BUILT', visualSeed: 3, bornAt: f.clock.now() },
    ]);
    await levelWorld(f.db, f.planetIds);
    f.clock.advance(250);
    for (const id of f.planetIds) await fuelUp(f.db, id);
    const built = buildApp({ env: testEnv(), logger: silent, db: f.db, clock: f.clock });
    app = built.app;
    close = built.close;
    await app.ready();
  });
  afterEach(async () => { await close(); });
  afterAll(async () => { const { close: closeDb } = await testDb(); await closeDb(); });

  const scan = () => scanFromMoon(f.db, f.playerIds[0]!, mine, target, f.clock);
  const tank = async () => (await f.db.select({ d: planets.deuterium }).from(planets).where(eq(planets.id, mine)))[0]!.d;
  const raid = async (body: 'PLANET' | 'MOON' = 'PLANET') => {
    await giveUnits(f.db, raider, { DART: 30 });
    return launchAttack(f.db, raider, target, { DART: 30 }, f.clock, undefined, false, undefined, false, new Set(), false, body);
  };

  it('photographs the routes: direction, other world, arrival and size, never the kind; silent; 30 D from the planet', async () => {
    const incoming = await raid();
    await giveUnits(f.db, target, { DART: 20 });
    const outgoing = await launchTransfer(f.db, f.playerIds[1]!, target, colony, { DART: 20 }, EMPTY, f.clock);
    await grant(f.db, raider, 20_000, 10_000);
    await launchProbe(f.db, raider, target, f.clock);
    const told = (await f.db.select().from(notifications)).length;
    const before = await tank();

    const report = await scan();
    expect(await tank()).toBeCloseTo(before - MOON.scanCost.deuterium, 6);
    expect(report.rows.toSorted((a, b) => a.direction.localeCompare(b.direction))).toEqual([
      { direction: 'IN', otherPlanetId: raider, arriveAt: incoming.arriveAt.toISOString(), size: 'LIGHT' },
      { direction: 'OUT', otherPlanetId: colony, arriveAt: outgoing.arriveAt.toISOString(), size: 'LIGHT' },
    ]);
    expect(report.pierced).toBe(false);
    expect((await f.db.select().from(notifications)).length).toBe(told);
  });

  it('does not see a flight that touches a moon, unless the scanning moon is Legendary (S15, S20)', async () => {
    await raid('MOON');
    expect((await scan()).rows).toEqual([]);
    await f.db.update(moons).set({ rarity: 'LEGENDARY' }).where(eq(moons.planetId, mine));
    f.clock.advance(1);
    const pierced = await scan();
    expect(pierced.pierced).toBe(true);
    expect(pierced.rows.map((row) => row.otherPlanetId)).toEqual([raider]);
  });

  it('S9 never sees an Optik Örtü flight, not even from a Legendary moon, and learns nothing from it', async () => {
    const veiled = await raid();
    await f.db.update(missions).set({ appliedCapsules: [{ id: 'OPTIC_VEIL', count: 1 }] }).where(eq(missions.id, veiled.missionId));
    await f.db.update(moons).set({ rarity: 'LEGENDARY' }).where(eq(moons.planetId, mine));
    const report = await scan();
    expect(report.rows).toEqual([]);
    const learnt = await f.db.select().from(probeWorldMemories)
      .where(and(eq(probeWorldMemories.observerPlayerId, f.playerIds[0]!), eq(probeWorldMemories.targetPlanetId, raider)));
    expect(learnt).toEqual([]);
  });

  it('refuses a world out of range, a shut moon, no moon, and a second scan within three seconds', async () => {
    await expect(scanFromMoon(f.db, f.playerIds[0]!, mine, colony, f.clock)).rejects.toMatchObject({ code: 'OUT_OF_RANGE', params: { context: 'gozcu' } });
    await scan();
    await expect(scan()).rejects.toMatchObject({ code: 'SCAN_TOO_SOON' });
    f.clock.advance(MOON.scanSpacingSeconds / 60);
    await f.db.update(moons).set({ closedUntil: new Date(f.clock.now().getTime() + 60_000) }).where(eq(moons.planetId, mine));
    await expect(scan()).rejects.toMatchObject({ code: 'MOON_CLOSED' });
    await f.db.delete(moons).where(eq(moons.planetId, mine));
    await expect(scan()).rejects.toMatchObject({ code: 'NO_MOON' });
  });

  // Owner 2026-11-26: "gözcü ile taramada kendi gezegenlerimi de mi tarıyorum? Bu ne saçmalık." The Gözcü
  // watches rivals: your own world is no target, and your own fleet is not a row in the photograph.
  it('photographs only other commanders: never your own world, never your own fleet', async () => {
    await giveUnits(f.db, mine, { DART: 10 });
    await launchAttack(f.db, mine, target, { DART: 10 }, f.clock, undefined, false, undefined, false, new Set(), false, 'PLANET');
    await raid();
    const { rows } = await scan();
    expect(rows).toEqual([expect.objectContaining({ direction: 'IN', otherPlanetId: raider })]);
    f.clock.advance(MOON.scanSpacingSeconds / 60);
    await f.db.update(planets).set({ controllerPlayerId: f.playerIds[0]!, kind: 'COLONY' }).where(eq(planets.id, target));
    const paid = await tank();
    await expect(scan()).rejects.toMatchObject({ code: 'SCAN_OWN_WORLD' });
    expect(await tank()).toBe(paid);
  });

  it('teaches the scanner the worlds on the routes, with their moon’s rarity (S53)', async () => {
    await raid();
    await scan();
    const [learnt] = await f.db.select().from(probeWorldMemories)
      .where(and(eq(probeWorldMemories.observerPlayerId, f.playerIds[0]!), eq(probeWorldMemories.targetPlanetId, raider)));
    expect(learnt?.source).toBe('SCAN');
    expect(learnt?.silhouette.moonRarity).toBe('EPIC');
  });

  it('lists the caller’s scans, newest first, over the API', async () => {
    await raid();
    const first = await scan();
    f.clock.advance(1);
    const second = await scan();
    const authorization = `Bearer ${await new TokenService('test-secret-that-is-long-enough', 15, 30).issueAccess(f.accountIds[0]!)}`;
    const res = await app.inject({ url: '/api/intel/moon-scans', headers: { authorization } });
    expect(res.statusCode).toBe(200);
    const body = z.object({ scans: z.array(z.object({ id: z.string() }).passthrough()) }).parse(res.json());
    expect(body.scans.map((row) => row.id)).toEqual([second.id, first.id]);
    const other = `Bearer ${await new TokenService('test-secret-that-is-long-enough', 15, 30).issueAccess(f.accountIds[1]!)}`;
    const theirs = z.object({ scans: z.array(z.unknown()) }).parse((await app.inject({ url: '/api/intel/moon-scans', headers: { authorization: other } })).json());
    expect(theirs.scans).toEqual([]);
  });
});
