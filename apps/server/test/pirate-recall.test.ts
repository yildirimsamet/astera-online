import type { FastifyInstance } from 'fastify';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { fleetCount, piratePosition, sensorSphere, sensorZone, type Fleet } from '@astera/rules';
import { asteroidSpawnHours, battleReports, notifications, pirateRaids, planets, seasons, units } from '../src/db/schema.js';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import { launchPirateRaid, recallPirateRaid } from '../src/services/pirateRaid.js';
import { pendingThreads } from '../src/services/session.js';
import { loadPirateSnapshot, pirateId, privatePirateField } from '../src/services/pirateField.js';
import { EventWorker } from '../src/worker/loop.js';
import { giveUnits, grant, placeAt, seedWorld, testDb, testEnv, type Fixture } from './helpers.js';

const silent = pino({ level: 'silent' });

afterAll(async () => { await (await testDb()).close(); });

/**
 * A PIRATE RAID CAN BE CALLED BACK, LIKE EVERY OTHER OUTBOUND FLEET. Owner, 2026-10-08.
 *
 * Once, while it is still flying toward the rendezvous — the moment the engagement begins
 * the decision is made. It turns where it is and flies home; nothing is fought, nothing is
 * taken and no fuel comes back.
 */
describe('calling a pirate raid back', () => {
  let f: Fixture;
  let mine: string;
  let me: string;

  const fleet: Fleet = { DART: 30, COURIER: 2 };
  const worker = () => new EventWorker(f.db, f.clock, { pollMs: 50, batch: 50, staleMinutes: 5 }, silent);

  const launch = async () => {
    const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    const [world] = await f.db.select().from(planets).where(eq(planets.id, mine));
    const eye = sensorSphere({ x: world!.x, y: world!.y, z: world!.z }, 0, 0, mine);
    const seasonMinutes = (season!.endsAt.getTime() - season!.startsAt.getTime()) / 60_000;
    for (const spec of privatePirateField(season!.asteroidKey)) {
      for (let minute = Math.ceil(spec.appearsAt) + 1; minute < Math.min(spec.expiresAt, seasonMinutes); minute += 1) {
        if (sensorZone([eye], piratePosition(spec, minute)) === 'NONE') continue;
        f.clock.set(new Date(season!.startsAt.getTime() + minute * 60_000));
        await grant(f.db, mine, 200_000, 40_000);
        await giveUnits(f.db, mine, fleet);
        return launchPirateRaid(f.db, mine, pirateId(season!.asteroidKey, spec.index), fleet, f.clock);
      }
    }
    throw new Error('no visible pirate this season');
  };
  const raidRow = async (id: string) => (await f.db.select().from(pirateRaids).where(eq(pirateRaids.id, id)))[0]!;
  const along = (raid: { departAt: Date; arriveAt: Date }, share: number): Date =>
    new Date(raid.departAt.getTime() + (raid.arriveAt.getTime() - raid.departAt.getTime()) * share);
  const halfway = (raid: { departAt: Date; arriveAt: Date }): Date => along(raid, 0.5);

  beforeEach(async () => {
    f = await seedWorld(2, 4242, { pirates: true });
    mine = f.planetIds[0]!;
    me = f.playerIds[0]!;
  });

  it('turns an outbound raid home from where it is, once', async () => {
    const launched = await launch();
    const before = await raidRow(launched.raidId);
    f.clock.set(halfway(before));
    const recalled = await recallPirateRaid(f.db, launched.raidId, f.clock, me);

    const after = await raidRow(launched.raidId);
    expect(after).toMatchObject({ status: 'returning', recalledAt: f.clock.now(), arriveAt: f.clock.now(), loot: null });
    expect(recalled.homeAt).toEqual(after.homeAt);
    // Home takes about as long as was flown: the same hulls cover the same road back.
    const flown = f.clock.now().getTime() - before.departAt.getTime();
    const back = after.homeAt!.getTime() - f.clock.now().getTime();
    expect(Math.abs(back - flown)).toBeLessThan(flown * 0.25);

    await expect(recallPirateRaid(f.db, launched.raidId, f.clock, me)).rejects.toMatchObject({ code: 'NOT_RECALLABLE', status: 409 });
  });

  it('brings every ship home with nothing fought or taken, and says it was called back', async () => {
    const launched = await launch();
    const before = await raidRow(launched.raidId);
    // Late enough that the way home outlasts the old rendezvous, so the stale arrival fires mid-return.
    f.clock.set(along(before, 0.8));
    const { homeAt } = await recallPirateRaid(f.db, launched.raidId, f.clock, me);
    expect(homeAt!.getTime()).toBeGreaterThan(before.arriveAt.getTime() + 10_000);

    // The stale arrival event fires at the old rendezvous and must change nothing.
    f.clock.set(new Date(before.arriveAt.getTime() + 10_000));
    await worker().tick();
    expect(await f.db.select().from(battleReports)).toHaveLength(0);
    expect((await raidRow(launched.raidId)).status).toBe('returning');

    f.clock.set(new Date(homeAt!.getTime() + 1000));
    await worker().tick();
    expect((await raidRow(launched.raidId)).status).toBe('done');
    const home = await f.db.select().from(units).where(and(eq(units.planetId, mine), eq(units.location, 'home')));
    expect(home.reduce((sum, row) => sum + row.count, 0)).toBe(fleetCount(fleet));
    const [notice] = await f.db.select().from(notifications)
      .where(and(eq(notifications.playerId, me), eq(notifications.kind, 'fleet_returned')));
    expect(notice!.payload).toMatchObject({ trip: 'pirate', recalled: true, ships: fleetCount(fleet), lootAlloy: 0, lootCrystal: 0 });
  });

  it('cannot turn once the engagement begins', async () => {
    const launched = await launch();
    f.clock.set((await raidRow(launched.raidId)).arriveAt);
    await expect(recallPirateRaid(f.db, launched.raidId, f.clock, me)).rejects.toMatchObject({ code: 'NOT_RECALLABLE' });
    expect((await raidRow(launched.raidId)).recalledAt).toBeNull();
  });

  it('answers only to the commander who launched it', async () => {
    const launched = await launch();
    f.clock.set(halfway(await raidRow(launched.raidId)));
    await expect(recallPirateRaid(f.db, launched.raidId, f.clock, f.playerIds[1]!)).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
    expect((await raidRow(launched.raidId)).status).toBe('outbound');
  });

  it('settles radiation up to the turn on a ruleset that prices it', async () => {
    // An HP season deals its pirates from the hourly spawn (pirate-raid.test.ts, the lethal route).
    await f.db.update(seasons).set({ rulesetVersion: 16 }).where(eq(seasons.id, f.seasonId));
    const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    await f.db.insert(asteroidSpawnHours).values({ seasonId: f.seasonId, hourStartsAt: season!.startsAt, spawnFrom: season!.startsAt,
      activePlayers: 2, lanes: [], pirateLane: { fromMinute: 0, untilMinute: 60, count: 3 } });
    f.clock.set(new Date(season!.startsAt.getTime() + 61 * 60_000));
    const snapshot = await loadPirateSnapshot(f.db, f.seasonId, f.clock.now());
    const spec = snapshot.standing(f.clock.now())[0]!;
    const position = piratePosition(spec, 61);
    await placeAt(f.db, mine, { x: position.x + 100, y: position.y, z: position.z });
    await grant(f.db, mine, 200_000, 40_000);
    await giveUnits(f.db, mine, fleet);
    const launched = await launchPirateRaid(f.db, mine, pirateId(snapshot.key, spec.index), fleet, f.clock);
    f.clock.set(halfway(await raidRow(launched.raidId)));
    await recallPirateRaid(f.db, launched.raidId, f.clock, me);
    const after = await raidRow(launched.raidId);
    expect(after.returnDepartAt).toEqual(f.clock.now());
    expect(after.radiationSettledAt).toEqual(f.clock.now());
  });

  it('is offered on the flight list only while it can still turn', async () => {
    const launched = await launch();
    const before = await raidRow(launched.raidId);
    f.clock.set(halfway(before));
    const outbound = (await pendingThreads(f.db, mine, f.clock.now())).find((thread) => thread.id === launched.raidId);
    expect(outbound).toMatchObject({ kind: 'pirate', leg: 'outbound', recallable: true });

    await recallPirateRaid(f.db, launched.raidId, f.clock, me);
    const after = await raidRow(launched.raidId);
    const returning = (await pendingThreads(f.db, mine, f.clock.now())).find((thread) => thread.id === launched.raidId);
    expect(returning).toMatchObject({ kind: 'pirate', leg: 'return', path: { departAt: f.clock.now(), arriveAt: after.homeAt } });
    expect(returning?.recallable).toBeUndefined();
  });

  describe('over HTTP', () => {
    let app: FastifyInstance;
    let close: () => Promise<void>;
    beforeEach(async () => {
      const built = buildApp({ env: testEnv(), logger: silent, db: f.db, clock: f.clock });
      app = built.app;
      close = built.close;
      await app.ready();
    });
    afterEach(async () => { await close(); });

    it('turns the raid for its commander and refuses a malformed id', async () => {
      const launched = await launch();
      f.clock.set(halfway(await raidRow(launched.raidId)));
      const tokens = new TokenService('test-secret-that-is-long-enough', 15, 30);
      const headers = { authorization: `Bearer ${await tokens.issueAccess(f.accountIds[0]!)}` };
      const ok = await app.inject({ method: 'POST', url: `/api/pirates/raids/${launched.raidId}/recall`, headers, payload: {} });
      expect(ok.statusCode).toBe(200);
      expect(ok.json()).toMatchObject({ raidId: launched.raidId });
      const bad = await app.inject({ method: 'POST', url: '/api/pirates/raids/not-a-uuid/recall', headers, payload: {} });
      expect(bad.statusCode).toBe(400);
    });
  });
});
