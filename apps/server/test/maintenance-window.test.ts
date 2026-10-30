import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { pino } from 'pino';
import { GALAXY_EVENTS, MAINTENANCE, TRADE } from '@astera/rules';
import { galaxyEventOccurrences, maintenanceWindows, seasons } from '../src/db/schema.js';
import {
  assertFliesOutsideMaintenance, assertLandsOutsideMaintenance, cancelMaintenance, listMaintenance, nextMaintenance, scheduleMaintenance,
} from '../src/services/maintenanceWindow.js';
import { GameError } from '../src/services/planet.js';
import { launchAttack } from '../src/services/mission.js';
import { launchProbe } from '../src/services/intel.js';
import { buildApp } from '../src/app.js';
import { giveUnits, seedWorld, testDb, testEnv, type Fixture } from './helpers.js';

/**
 * THE PLANNED MAINTENANCE WINDOW. Scaling plan F0.9, owner K5/K7.
 *
 * Announced a day ahead; from then on nothing hostile may land inside it, because the
 * worker is down and a raid would resolve at the reopening against a defender who
 * could not answer.
 */
let f: Fixture;
const hours = (n: number) => n * 3_600_000;
const at = (offsetMs: number) => new Date(f.clock.now().getTime() + offsetMs);
/** A row as the scheduler would leave it, at any distance: the refusal is the subject here. */
const windowAt = async (startsInMs: number, minutes: number) => (await f.db.insert(maintenanceWindows).values({
  startsAt: at(startsInMs), endsAt: at(startsInMs + minutes * 60_000), createdAt: f.clock.now(),
}).returning())[0]!;
const refusal = async (promise: Promise<unknown>) => {
  try { await promise; } catch (err) { if (err instanceof GameError) return err; throw err; }
  return null;
};

beforeEach(async () => {
  f = await seedWorld(2);
  // A long season and no calendar, so only the rule under test can refuse.
  await f.db.update(seasons).set({ endsAt: at(hours(24 * 30)) }).where(eq(seasons.id, f.seasonId));
  await f.db.delete(galaxyEventOccurrences);
});
afterAll(async () => { await (await testDb()).close(); });

describe('scheduling a window', () => {
  it('announces it a day ahead and names it as the next one until it ends', async () => {
    const window = await scheduleMaintenance(f.db, { startsAt: at(hours(25)), minutes: 45, now: f.clock.now() });
    expect(window.endsAt.getTime() - window.startsAt.getTime()).toBe(45 * 60_000);
    expect(await nextMaintenance(f.db, f.clock.now())).toEqual(window);
    expect(await nextMaintenance(f.db, at(hours(25) + 46 * 60_000))).toBeNull();
  });

  it('lists every planned window still ahead, soonest first', async () => {
    const later = await scheduleMaintenance(f.db, { startsAt: at(hours(50)), minutes: 30, now: f.clock.now() });
    const sooner = await scheduleMaintenance(f.db, { startsAt: at(hours(26)), minutes: 30, now: f.clock.now() });
    const cancelled = await scheduleMaintenance(f.db, { startsAt: at(hours(30)), minutes: 30, now: f.clock.now() });
    await cancelMaintenance(f.db, cancelled.id, f.clock.now());
    await windowAt(-hours(2), 30);
    expect(await listMaintenance(f.db, f.clock.now())).toEqual([sooner, later]);
  });

  it('forgets a cancelled window', async () => {
    const window = await scheduleMaintenance(f.db, { startsAt: at(hours(25)), minutes: 45, now: f.clock.now() });
    await cancelMaintenance(f.db, window.id, f.clock.now());
    expect(await nextMaintenance(f.db, f.clock.now())).toBeNull();
  });

  it('refuses a window announced less than a day ahead, too short or too long, or on another', async () => {
    const now = f.clock.now();
    expect((await refusal(scheduleMaintenance(f.db, { startsAt: at(hours(MAINTENANCE.noticeHours) - 60_000), minutes: 45, now })))?.code)
      .toBe('MAINTENANCE_NOTICE');
    expect((await refusal(scheduleMaintenance(f.db, { startsAt: at(hours(25)), minutes: MAINTENANCE.minMinutes - 1, now })))?.code)
      .toBe('MAINTENANCE_LENGTH');
    expect((await refusal(scheduleMaintenance(f.db, { startsAt: at(hours(25)), minutes: MAINTENANCE.maxMinutes + 1, now })))?.code)
      .toBe('MAINTENANCE_LENGTH');
    await scheduleMaintenance(f.db, { startsAt: at(hours(25)), minutes: 45, now });
    expect((await refusal(scheduleMaintenance(f.db, { startsAt: at(hours(25) + 30 * 60_000), minutes: 45, now })))?.code)
      .toBe('MAINTENANCE_OVERLAP');
  });

  it('keeps clear of a season end', async () => {
    await f.db.update(seasons).set({ endsAt: at(hours(30)) }).where(eq(seasons.id, f.seasonId));
    expect((await refusal(scheduleMaintenance(f.db, { startsAt: at(hours(25)), minutes: 45, now: f.clock.now() })))?.code)
      .toBe('MAINTENANCE_SEASON_END');
  });

  it('keeps an hour clear of a convoy or a shower, never of the trade ship', async () => {
    const span = (startsInMs: number) => ({ seasonId: f.seasonId, definitionVersion: 1,
      startsAt: at(startsInMs), endsAt: at(startsInMs + hours(3)) });
    await f.db.insert(galaxyEventOccurrences).values({ ...span(hours(25)), sequence: 0, kind: 'TRADE_SHIP',
      effect: { rate: TRADE.rate } });
    const window = await scheduleMaintenance(f.db, { startsAt: at(hours(25) + hours(1)), minutes: 45, now: f.clock.now() });
    await cancelMaintenance(f.db, window.id, f.clock.now());
    // The convoy ends at +28 h; a window opening 30 minutes later is too near it.
    await f.db.insert(galaxyEventOccurrences).values({ ...span(hours(25)), sequence: 0, kind: 'INTERGALACTIC_CONVOY',
      effect: GALAXY_EVENTS.definitions.INTERGALACTIC_CONVOY.windows[0]!.effect });
    expect((await refusal(scheduleMaintenance(f.db, { startsAt: at(hours(28) + 30 * 60_000), minutes: 45, now: f.clock.now() })))?.code)
      .toBe('MAINTENANCE_EVENT');
    expect(await scheduleMaintenance(f.db, { startsAt: at(hours(29)), minutes: 45, now: f.clock.now() })).toBeDefined();
  });
});

describe('what may land inside it', () => {
  it('refuses an instant inside the window or its guard, never one clear of both', async () => {
    const window = await windowAt(hours(2), 45);
    const guard = MAINTENANCE.guardMinutes * 60_000;
    const lands = (instant: Date) => f.db.transaction(tx => assertLandsOutsideMaintenance(tx, [instant]));
    const inside = await refusal(lands(at(hours(2) + 10 * 60_000)));
    expect(inside?.code).toBe('MAINTENANCE_LANDING');
    expect(inside?.params).toEqual({ startsAt: window.startsAt.toISOString(), endsAt: window.endsAt.toISOString() });
    expect((await refusal(lands(at(hours(2) - guard + 1_000))))?.code).toBe('MAINTENANCE_LANDING');
    expect((await refusal(lands(at(hours(2) + 45 * 60_000 + guard - 1_000))))?.code).toBe('MAINTENANCE_LANDING');
    expect(await refusal(lands(at(hours(2) - guard - 1_000)))).toBeNull();
    expect(await refusal(lands(at(hours(2) + 45 * 60_000 + guard + 1_000)))).toBeNull();
  });

  it('refuses a weapon whose flight crosses the window, wherever it lands', async () => {
    await windowAt(hours(2), 45);
    const flies = (from: Date, to: Date) => f.db.transaction(tx => assertFliesOutsideMaintenance(tx, from, to));
    expect((await refusal(flies(f.clock.now(), at(hours(5)))))?.code).toBe('MAINTENANCE_IN_FLIGHT');
    expect(await refusal(flies(f.clock.now(), at(hours(1))))).toBeNull();
    expect(await refusal(flies(at(hours(4)), at(hours(6))))).toBeNull();
  });

  it('ignores a cancelled window', async () => {
    const window = await windowAt(hours(2), 45);
    await cancelMaintenance(f.db, window.id, f.clock.now());
    expect(await refusal(f.db.transaction(tx => assertLandsOutsideMaintenance(tx, [at(hours(2) + 60_000)])))).toBeNull();
  });

  it('refuses a raid that would land inside it, and lets a probe fly', async () => {
    const [mine, theirs] = f.planetIds as [string, string];
    await giveUnits(f.db, mine, { DART: 10, COURIER: 4 });
    // Twelve hours covers any raid this pair can fly.
    await windowAt(60_000, 12 * 60);
    const raid = await refusal(launchAttack(f.db, mine, theirs, { DART: 10 }, f.clock));
    expect(raid?.code).toBe('MAINTENANCE_LANDING');
    expect(await refusal(launchProbe(f.db, mine, theirs, f.clock))).toBeNull();
    await f.db.update(maintenanceWindows).set({ cancelledAt: f.clock.now() });
    expect(await refusal(launchAttack(f.db, mine, theirs, { DART: 10 }, f.clock))).toBeNull();
  });
});

describe('the public notice', () => {
  it('names the next window to anyone, signed in or not, and nothing once it is cancelled', async () => {
    const built = buildApp({ env: testEnv(), logger: pino({ level: 'silent' }), db: f.db, clock: f.clock });
    try {
      await built.app.ready();
      expect((await built.app.inject({ method: 'GET', url: '/api/maintenance' })).json()).toEqual({ window: null });
      const window = await scheduleMaintenance(f.db, { startsAt: at(hours(25)), minutes: 45, now: f.clock.now() });
      const response = await built.app.inject({ method: 'GET', url: '/api/maintenance' });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ window: { startsAt: window.startsAt.toISOString(), endsAt: window.endsAt.toISOString() } });
      await cancelMaintenance(f.db, window.id, f.clock.now());
      expect((await built.app.inject({ method: 'GET', url: '/api/maintenance' })).json()).toEqual({ window: null });
    } finally {
      await built.close();
    }
  });
});
