import type { FastifyInstance } from 'fastify';
import { HULLS, distance, engagementEndsAt, fleetTravelExact, interceptOrbit, missionFuel, piratePosition, type Fleet, type PirateSpec } from '@astera/rules';
import { eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import { arenaShips, asteroidSpawnHours, battleReports, planets, pirateRaids, seasons } from '../src/db/schema.js';
import { chooseShip } from '../src/services/arenaShips.js';
import { readCommanderShip } from '../src/services/arenaShipState.js';
import { loadPirateSnapshot, pirateId } from '../src/services/pirateField.js';
import { launchPirateRaid, recallPirateRaid } from '../src/services/pirateRaid.js';
import { pendingThreads } from '../src/services/session.js';
import { EventWorker } from '../src/worker/loop.js';
import { giveUnits, grant, placeAt, seedWorld, testDb, testEnv, type Fixture } from './helpers.js';

const silent = pino({ level: 'silent' });
afterAll(async () => { await (await testDb()).close(); });

/**
 * THE COMMANDER SHIP ESCORTS A PIRATE RAID (Y9, owner 2026-10-25, doc 22 "Amiral savaşmaz").
 * Same rule as a raid at a world: it lends its bonus, is never hit, and a lost fight or a fleet
 * lost to the last ship sends it home alone to repair. A pirate's meeting is an orbit solve, so a
 * Kılavuz's shorter road is solved at its own speed and quoted on `/api/pirates` as `escortReach`.
 */
describe('the admiral on a pirate raid', () => {
  let f: Fixture; let mine: string; let me: string; let target: string; let app: FastifyInstance; let close: () => Promise<void>;
  let auth: { authorization: string }; let spec: PirateSpec;
  const worker = () => new EventWorker(f.db, f.clock, { pollMs: 1, batch: 100, staleMinutes: 5 }, silent);
  const ship = async () => (await f.db.select().from(arenaShips).where(eq(arenaShips.playerId, me)))[0]!;
  const row = async (id: string) => (await f.db.select().from(pirateRaids).where(eq(pirateRaids.id, id)))[0]!;
  const raid = async (fleet: Fleet, admiral = true, quoted?: number) => {
    await giveUnits(f.db, mine, fleet);
    return launchPirateRaid(f.db, mine, target, fleet, f.clock, undefined, quoted, false, admiral);
  };
  const runTo = async (at: Date) => { f.clock.set(new Date(at.getTime() + 60_000)); await worker().tick(); await worker().tick(); };
  const quote = async () => {
    const response = await app.inject({ method: 'GET', url: '/api/pirates', headers: auth });
    expect(response.statusCode, response.body).toBe(200);
    type Reach = { hull: string; minutes: number }[];
    return response.json<{ pirates: { id: string; reach: Reach; escortReach?: Reach }[] }>().pirates.find(p => p.id === target)!;
  };

  beforeEach(async () => {
    f = await seedWorld(2, 4242, { pirates: true });
    mine = f.planetIds[0]!; me = f.playerIds[0]!;
    // A ruleset-19 season spawns its pirates from the hour's lane (as the HP-season raid test does).
    await f.db.update(seasons).set({ rulesetVersion: 19 }).where(eq(seasons.id, f.seasonId));
    const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    await f.db.insert(asteroidSpawnHours).values({ seasonId: f.seasonId, hourStartsAt: season!.startsAt, spawnFrom: season!.startsAt,
      activePlayers: 2, lanes: [], pirateLane: { fromMinute: 0, untilMinute: 60, count: 3 } });
    f.clock.set(new Date(season!.startsAt.getTime() + 61 * 60_000));
    const snapshot = await loadPirateSnapshot(f.db, f.seasonId, f.clock.now());
    spec = snapshot.standing(f.clock.now())[0]!;
    const at = piratePosition(spec, 61);
    await placeAt(f.db, mine, { x: at.x + 100, y: at.y, z: at.z });
    target = pirateId(snapshot.key, spec.index);
    await grant(f.db, mine, 400_000, 80_000);
    await chooseShip(f.db, f.clock, f.accountIds[0]!, 'kilavuz');
    const built = buildApp({ env: testEnv({ PROJECTION_CACHE_ENABLED: 'false' }), logger: silent, db: f.db, clock: f.clock });
    app = built.app; close = built.close;
    await app.ready();
    auth = { authorization: `Bearer ${await new TokenService('test-secret-that-is-long-enough', 15, 30).issueAccess(f.accountIds[0]!)}` };
  });
  afterEach(async () => { await close(); });

  it('quotes and flies the Kılavuz meeting at its own speed, on less fuel', async () => {
    await giveUnits(f.db, mine, { DART: 20 });
    const quoted = await quote();
    const plain = quoted.reach.find(r => r.hull === 'DART')!;
    const escorted = quoted.escortReach!.find(r => r.hull === 'DART')!;
    const [world] = await f.db.select().from(planets).where(eq(planets.id, mine));
    const solved = interceptOrbit({ x: world!.x, y: world!.y, z: world!.z }, HULLS.DART.speed / 0.97, spec, spec.expiresAt, 61)!;
    expect(escorted.minutes).toBeCloseTo(solved.flightMinutes, 4);
    expect(escorted.minutes).toBeLessThan(plain.minutes);

    const launched = await launchPirateRaid(f.db, mine, target, { DART: 20 }, f.clock, undefined, escorted.minutes, false, true);
    expect(launched.flightMinutes).toBeCloseTo(solved.flightMinutes, 4);
    expect(launched.fuel).toBe(Math.ceil(missionFuel({ DART: 20 }, distance(world!, solved.at), 2) * 0.95));
    expect((await ship()).admiralId).not.toBeNull();
  });

  it('marks the escorted pirate raid on its commander\'s flight list', async () => {
    const launched = await raid({ DART: 20 });
    const thread = (await pendingThreads(f.db, mine, f.clock.now())).find(t => t.id === launched.raidId);
    expect(thread?.admiral).toEqual({ ship: 'kilavuz', level: 1 });
  });

  it('offers no escorted quote before its season', async () => {
    await f.db.update(seasons).set({ rulesetVersion: 18 }).where(eq(seasons.id, f.seasonId));
    await giveUnits(f.db, mine, { DART: 20 });
    expect((await quote()).escortReach).toBeUndefined();
    await expect(raid({ DART: 20 })).rejects.toMatchObject({ code: 'ADMIRAL_RULESET' });
    expect(await f.db.select().from(pirateRaids)).toHaveLength(0);
  });

  it('comes home from a won fight to service, with XP, a shorter road home and its name on the report', async () => {
    const launched = await raid({ DART: 400 });
    await runTo(new Date(launched.arriveAt.getTime() + 60_000));
    const [report] = await f.db.select().from(battleReports).where(eq(battleReports.pirateRaidId, launched.raidId));
    expect(report!.grade).toBe('DECISIVE');
    expect(report!.admirals).toEqual([{ side: 'attack', ship: 'kilavuz', level: 1 }]);
    const back = await row(launched.raidId);
    const [world] = await f.db.select().from(planets).where(eq(planets.id, mine));
    const meet = { x: back.interceptX, y: back.interceptY, z: back.interceptZ };
    const survivors = { DART: 400 - (report!.attackerLosses.DART ?? 0) };
    expect((back.homeAt!.getTime() - back.returnDepartAt!.getTime()) / 60_000)
      .toBeCloseTo(fleetTravelExact(distance(meet, world!), survivors, { boost: 1, tech: {} }) * 0.97, 3);
    await runTo(back.homeAt!);
    const home = await ship();
    expect(home).toMatchObject({ admiralId: null, readyReason: 'service' });
    expect(home.xp).toBeGreaterThanOrEqual(10);
  });

  it('flies home alone to repair when the whole fleet is lost', async () => {
    // This tests a last-ship loss, not a random outcome against the first small
    // contact. Arrange a pinned hour with a level-4 crew before sending one Dart.
    const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    await f.db.update(asteroidSpawnHours).set({ pirateLane: { fromMinute: 0, untilMinute: 60, count: 100 } })
      .where(eq(asteroidSpawnHours.seasonId, f.seasonId));
    const snapshot = await loadPirateSnapshot(f.db, f.seasonId, f.clock.now());
    const dangerous = snapshot.standing(f.clock.now()).find(candidate => candidate.level === 4);
    if (!dangerous) throw new Error('Pinned loss fixture has no level-4 pirate');
    const position = piratePosition(dangerous, (f.clock.now().getTime() - season!.startsAt.getTime()) / 60_000);
    await placeAt(f.db, mine, { x: position.x + 100, y: position.y, z: position.z });
    target = pirateId(snapshot.key, dangerous.index);
    const launched = await raid({ DART: 1 });
    const out = launched.arriveAt.getTime() - launched.departAt.getTime();
    await runTo(new Date(launched.arriveAt.getTime() + 60_000));
    const [report] = await f.db.select().from(battleReports).where(eq(battleReports.pirateRaidId, launched.raidId));
    expect(report!.attackerLosses, JSON.stringify(report)).toEqual({ DART: 1 });
    const alone = await ship();
    expect(alone).toMatchObject({ admiralId: null, readyReason: 'repair' });
    // It leaves when the engagement ends, flies the outbound leg's length home, then repairs.
    expect(alone.readyAt!.getTime()).toBe(engagementEndsAt(launched.arriveAt.getTime()) + out + 60 * 60_000);
    const leaves = engagementEndsAt(launched.arriveAt.getTime());
    const at = await row(launched.raidId);
    const [world] = await f.db.select().from(planets).where(eq(planets.id, mine));
    // The meeting is close: read it halfway home.
    f.clock.set(new Date(leaves + out / 2));
    expect((await readCommanderShip(f.db, f.accountIds[0]!, f.clock)).homeward).toEqual({
      from: { x: at.interceptX, y: at.interceptY, z: at.interceptZ }, to: { x: world!.x, y: world!.y, z: world!.z },
      departAt: new Date(leaves).toISOString(), arriveAt: new Date(leaves + out).toISOString() });
  });

  it('comes home from a recall to service with the idle XP', async () => {
    const launched = await raid({ DART: 20 });
    f.clock.set(new Date(launched.departAt.getTime() + (launched.arriveAt.getTime() - launched.departAt.getTime()) / 2));
    const recalled = await recallPirateRaid(f.db, launched.raidId, f.clock, me);
    await runTo(recalled.homeAt!);
    expect(await ship()).toMatchObject({ admiralId: null, readyReason: 'service', xp: 5 });
  });

  it('writes no escort on a raid flown without one', async () => {
    const launched = await raid({ DART: 400 }, false);
    expect((await ship()).admiralId).toBeNull();
    await runTo(new Date(launched.arriveAt.getTime() + 60_000));
    const [report] = await f.db.select().from(battleReports).where(eq(battleReports.pirateRaidId, launched.raidId));
    expect(report!.admirals).toEqual([]);
  });
});
