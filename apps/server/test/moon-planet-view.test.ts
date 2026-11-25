import { eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { MOON, crackLimit, gateCapacity, hullBulk, scanRange } from '@astera/rules';
import { moons, seasons, units } from '../src/db/schema.js';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import { launchProbe } from '../src/services/intel.js';
import { hopFleet } from '../src/services/moonMovement.js';
import { planetView } from '../src/services/planetView.js';
import { MOON_LOCATION } from '../src/services/unitLocation.js';
import { EventWorker } from '../src/worker/loop.js';
import {
  fuelUp, giveUnits, grant, levelWorld, placeAt, seedWorld, setLevel, testDb, testEnv, type Fixture,
} from './helpers.js';

/*
  F9a — Server-client moon contract (§9.1, F3a remaining):
  - `planetView` carries `moon` (null when none) with rarity, lazy-healed cracks, gate/closure timers,
    moon fleet, dock usage/free room (including inbound hops), Gözcü stats, and pending moves.
  - `GET /api/intel` exposes the probe report's `moon` section when the probed world held a moon.
*/
describe('moon planetView & probe intel API (F9a)', () => {
  let f: Fixture;
  let home: string;
  let target: string;

  const viewOf = (id = home) => f.db.transaction((tx) => planetView(tx, id, f.clock));

  beforeEach(async () => {
    f = await seedWorld(2, 20_901);
    [home, target] = f.planetIds as [string, string];
    await f.db.update(seasons).set({ rulesetVersion: MOON.rulesetVersion }).where(eq(seasons.id, f.seasonId));
    await placeAt(f.db, home, { x: 0, y: 0, z: 0 });
    await placeAt(f.db, target, { x: 300, y: 0, z: 0 });
    await setLevel(f.db, home, 'CORE', 10);
    await setLevel(f.db, home, 'HANGAR', 6);
    await grant(f.db, home, 100_000, 100_000);
    await fuelUp(f.db, home, 2_000);
    await levelWorld(f.db, [home, target]);
    f.clock.advance(10);
  });

  afterAll(async () => { await (await testDb()).close(); });

  it('returns moon: null when the world has no moon', async () => {
    const view = await viewOf();
    expect(view.moon).toBeNull();
  });

  it('returns moon details, lazy-healed cracks, moon fleet, dock room, and pending hops', async () => {
    const hitAt = new Date(f.clock.now().getTime() - (MOON.crackHealHours - 1) * 3_600_000);
    await f.db.insert(moons).values({
      planetId: home,
      rarity: 'RARE',
      origin: 'BATTLE',
      cracks: 2,
      lastHitAt: hitAt,
      visualSeed: 42,
      bornAt: f.clock.now(),
    });
    await f.db.insert(units).values({
      planetId: home, ownerPlayerId: f.playerIds[0]!, hull: 'DART', location: MOON_LOCATION, count: 5,
    });
    await giveUnits(f.db, home, { DART: 4 });
    await hopFleet(f.db, f.playerIds[0]!, home, 'UP', { DART: 4 }, f.clock);

    const view = await viewOf();
    expect(view.moon).not.toBeNull();
    expect(view.moon!.rarity).toBe('RARE');
    expect(view.moon!.origin).toBe('BATTLE');
    expect(view.moon!.cracks).toBe(2);
    expect(view.moon!.crackLimit).toBe(crackLimit('RARE'));
    expect(view.moon!.visualSeed).toBe(42);
    expect(view.moon!.fleet).toEqual({ DART: 5 });
    expect(view.moon!.dockUsed).toBe(5 * hullBulk('DART'));
    expect(view.moon!.dockCapacity).toBe(gateCapacity('RARE'));
    // 5 standing + 4 hopping up reserve dock room.
    expect(view.moon!.dockFree).toBe(gateCapacity('RARE') - 9 * hullBulk('DART'));
    expect(view.moon!.scanRange).toBe(scanRange('RARE'));
    expect(view.moon!.scanPierces).toBe(false);
    // Owner 2026-11-25: the moon's Asteryum is read on the moon: what it has paid, and where its next unit stands.
    const { syncedAt, ...asterium } = view.moon!.asterium;
    expect(typeof syncedAt).toBe('string');
    expect(asterium).toEqual({ fraction: 0, produced: 0 });
    expect(view.moon!.moves).toHaveLength(1);
    expect(view.moon!.moves[0]!.kind).toBe('HOP_UP');

    // Past 24 h since last hit: cracks heal lazily to 0 on read.
    f.clock.advance(2 * 60);
    const healed = await viewOf();
    expect(healed.moon!.cracks).toBe(0);
  });

  it('exposes the probe report moon section on GET /api/intel', async () => {
    await f.db.insert(moons).values({
      planetId: target, rarity: 'EPIC', origin: 'SEED', cracks: 1, lastHitAt: f.clock.now(), visualSeed: 99, bornAt: f.clock.now(),
    });
    await f.db.insert(units).values({
      planetId: target, ownerPlayerId: f.playerIds[1]!, hull: 'DART', location: MOON_LOCATION, count: 10,
    });
    const probe = await launchProbe(f.db, home, target, f.clock, f.playerIds[0]);
    const worker = new EventWorker(f.db, f.clock, { pollMs: 1, batch: 100, staleMinutes: 5 }, pino({ level: 'silent' }));
    f.clock.set(new Date(probe.arriveAt.getTime() + 60_000));
    await worker.tick();
    f.clock.advance(60);
    await worker.tick();

    const env = testEnv();
    const built = buildApp({ db: f.db, clock: f.clock, env, logger: pino({ level: 'silent' }) });
    await built.app.ready();
    try {
      const token = await new TokenService(env.JWT_SECRET, 15, 30).issueAccess(f.accountIds[0]!);
      const res = await built.app.inject({
        method: 'GET',
        url: '/api/intel',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
      const body: { probeReports: { targetPlanetId: string; moon?: { rarity: string; cracks: number } }[] } = res.json();
      const report = body.probeReports.find((r) => r.targetPlanetId === target);
      expect(report?.moon).toBeDefined();
      expect(report?.moon?.rarity).toBe('EPIC');
      expect(report?.moon?.cracks).toBe(1);
    } finally {
      await built.close();
    }
  });
});
