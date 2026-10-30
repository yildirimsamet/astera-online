import { and, eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CENTER_STATUSES, NOTIFICATION_CENTER, alertPrice, deuteriumRate } from '@astera/rules';
import { missions, notificationCenters, notifications, paidAlerts, planets, probeReports, scheduledEvents } from '../src/db/schema.js';
import { launchProbe } from '../src/services/intel.js';
import { EventWorker } from '../src/worker/loop.js';
import { launchAttack } from '../src/services/mission.js';
import { recallFlight } from '../src/services/movement.js';
import {
  buildNotificationCenter, commanderDeuteriumPerHour, fundNotificationCenter, notificationCenterView,
  registerPushDevice, setNotificationCenter, setPushTransport, type PushMessage,
} from '../src/services/notificationCenter.js';
import {
  giveSatellite, giveUnits, grant, levelWorld, placeAt, seedWorld, setLevel, testDb, truncateAll, type Fixture,
} from './helpers.js';

/** Bildirim Merkezi, server side. docs/bildirim-merkezi-plani-2026-10-30.md. */
const silent = pino({ level: 'silent' });
const makeWorker = (f: Fixture): EventWorker =>
  new EventWorker(f.db, f.clock, { pollMs: 1000, batch: 100, staleMinutes: 5 }, silent);

let f: Fixture;
let sent: { tokens: string[]; message: PushMessage }[];
beforeEach(async () => {
  f = await seedWorld(2);
  sent = [];
  setPushTransport({ send: (tokens, message) => { sent.push({ tokens, message }); return Promise.resolve({ invalid: [] }); } });
});
afterEach(() => { setPushTransport(null); });
afterAll(async () => { const { db, close } = await testDb(); await truncateAll(db); await close(); });

const stock = async (planetId: string) => {
  const [row] = await f.db.select({ alloy: planets.alloy, crystal: planets.crystal, deuterium: planets.deuterium })
    .from(planets).where(eq(planets.id, planetId));
  return row!;
};
const wallet = async (playerId: string) =>
  (await f.db.select().from(notificationCenters).where(eq(notificationCenters.playerId, playerId)))[0]?.wallet;

describe('building and funding the centre', () => {
  it('is built once, from the chosen world\'s store', async () => {
    const [me] = f.playerIds; const [home] = f.planetIds;
    await grant(f.db, home!, 10_000, 10_000);
    const before = await stock(home!);
    await buildNotificationCenter(f.db, me!, home!, f.clock);
    const after = await stock(home!);
    expect(before.alloy - after.alloy).toBeCloseTo(NOTIFICATION_CENTER.buildCost.alloy, 6);
    expect(before.crystal - after.crystal).toBeCloseTo(NOTIFICATION_CENTER.buildCost.crystal, 6);
    expect(await wallet(me!)).toBe(0);
    await expect(buildNotificationCenter(f.db, me!, home!, f.clock)).rejects.toMatchObject({ code: 'ALREADY_BUILT' });
  });

  it('refuses a world the commander cannot pay from or does not own', async () => {
    const [me] = f.playerIds; const [home, theirs] = f.planetIds;
    await f.db.update(planets).set({ alloy: 0, crystal: 0 }).where(eq(planets.id, home!));
    await expect(buildNotificationCenter(f.db, me!, home!, f.clock)).rejects.toMatchObject({ code: 'INSUFFICIENT_RESOURCES' });
    await grant(f.db, theirs!, 10_000, 10_000);
    await expect(buildNotificationCenter(f.db, me!, theirs!, f.clock)).rejects.toThrow();
    expect(await wallet(me!)).toBeUndefined();
  });

  it('moves deuterium one way, only when confirmed, and never more than the world holds', async () => {
    const [me] = f.playerIds; const [home] = f.planetIds;
    await grant(f.db, home!, 10_000, 10_000);
    await expect(fundNotificationCenter(f.db, me!, home!, 50, true, f.clock)).rejects.toMatchObject({ code: 'NOT_BUILT' });
    await buildNotificationCenter(f.db, me!, home!, f.clock);
    await f.db.update(planets).set({ deuterium: 300 }).where(eq(planets.id, home!));
    await expect(fundNotificationCenter(f.db, me!, home!, 50, false, f.clock)).rejects.toMatchObject({ code: 'CONFIRM_REQUIRED' });
    for (const bad of [0, -5, 1.5, Number.NaN]) {
      await expect(fundNotificationCenter(f.db, me!, home!, bad, true, f.clock)).rejects.toMatchObject({ code: 'BAD_AMOUNT' });
    }
    await expect(fundNotificationCenter(f.db, me!, home!, 100_000, true, f.clock)).rejects.toMatchObject({ code: 'INSUFFICIENT_RESOURCES' });
    await fundNotificationCenter(f.db, me!, home!, 120, true, f.clock);
    expect(await wallet(me!)).toBe(120);
    expect((await stock(home!)).deuterium).toBeLessThanOrEqual(300 - 120 + 1);
  });

  it('keeps the commander\'s choices and refuses unknown ones', async () => {
    const [me] = f.playerIds; const [home] = f.planetIds;
    await grant(f.db, home!, 10_000, 10_000);
    await buildNotificationCenter(f.db, me!, home!, f.clock);
    await setNotificationCenter(f.db, me!, { timing: 'T15', muted: ['probe_detected'] });
    const view = await notificationCenterView(f.db, me!, f.clock);
    expect(view).toMatchObject({ built: true, timing: 'T15', muted: ['probe_detected'] });
    await expect(setNotificationCenter(f.db, me!, { timing: 'T7' as never })).rejects.toMatchObject({ code: 'BAD_SETTINGS' });
    await expect(setNotificationCenter(f.db, me!, { muted: ['nope'] as never })).rejects.toMatchObject({ code: 'BAD_SETTINGS' });
  });

  it('prices alerts on the whole commander\'s deuterium output, floor below it', async () => {
    const [me] = f.playerIds; const [home] = f.planetIds;
    await setLevel(f.db, home!, 'DEUTERIUM_PLANT', 0);
    expect((await notificationCenterView(f.db, me!, f.clock)).prices.incoming_attack.T5).toBe(30);
    await setLevel(f.db, home!, 'DEUTERIUM_PLANT', 10);
    const rate = await f.db.transaction(tx => commanderDeuteriumPerHour(tx, me!));
    expect(rate).toBeCloseTo(deuteriumRate(10), 6);
    expect((await notificationCenterView(f.db, me!, f.clock)).prices.incoming_attack.RADAR)
      .toBe(alertPrice('incoming_attack', 'RADAR', deuteriumRate(10)));
  });
});

describe('an attack the radar sees', () => {
  let attacker: string; let defender: string;
  beforeEach(async () => {
    [attacker, defender] = f.planetIds as [string, string];
    await placeAt(f.db, defender, { x: 4000 });
    await setLevel(f.db, attacker, 'CORE', 6);
    await setLevel(f.db, defender, 'CORE', 6);
    await giveSatellite(f.db, defender, 'UPLINK');
    await grant(f.db, defender, 30_000, 3_000);
    await levelWorld(f.db, f.planetIds);
    await setLevel(f.db, defender, 'RADAR', 0);
    const { giveInstrument } = await import('./helpers.js');
    await giveInstrument(f.db, defender, 'RADAR', 3);
    await giveUnits(f.db, attacker, { DART: 40 });
    await f.db.update(planets).set({ deuterium: 1000 }).where(eq(planets.id, attacker));
    await buildNotificationCenter(f.db, f.playerIds[1]!, defender, f.clock);
    f.clock.advance(300);
  });

  const fund = async (amount: number) => {
    await f.db.update(planets).set({ deuterium: amount + 1000 }).where(eq(planets.id, defender));
    await fundNotificationCenter(f.db, f.playerIds[1]!, defender, amount, true, f.clock);
  };
  const alerts = () => f.db.select().from(paidAlerts).where(eq(paidAlerts.playerId, f.playerIds[1]!));
  /** Run the worker to the next pending event of `kind` and return its instant. */
  const runTo = async (kind: 'radar_warning' | 'paid_alert') => {
    const [next] = await f.db.select().from(scheduledEvents)
      .where(and(eq(scheduledEvents.kind, kind), eq(scheduledEvents.status, 'pending')))
      .orderBy(scheduledEvents.resolveAt).limit(1);
    if (!next) throw new Error(`no pending ${kind}`);
    if (next.resolveAt > f.clock.now()) f.clock.set(next.resolveAt);
    await makeWorker(f).tick();
    return next.resolveAt;
  };
  /** Radar checks reschedule themselves until the fleet crosses the circle; run them until it warns. */
  const untilWarned = async () => {
    for (let i = 0; i < 12; i++) {
      await runTo('radar_warning');
      const warned = await f.db.select().from(notifications)
        .where(and(eq(notifications.playerId, f.playerIds[1]!), eq(notifications.kind, 'incoming_fleet')));
      if (warned.length > 0) return;
    }
    throw new Error('the radar never warned');
  };

  it('arms at radar contact, sends at the chosen lead, and charges the wallet once', async () => {
    await fund(500);
    await registerPushDevice(f.db, f.accountIds[1]!, 'token-a', 'android', 'tr', f.clock);
    const { arriveAt } = await launchAttack(f.db, attacker, defender, { DART: 40 }, f.clock);
    await untilWarned();
    const [armed] = await alerts();
    expect(armed).toMatchObject({ kind: 'incoming_attack', status: 'PENDING', timing: 'T5' });
    expect(armed!.sendAt.getTime()).toBe(Math.max(arriveAt.getTime() - 5 * 60_000, armed!.createdAt.getTime()));

    await runTo('paid_alert');
    const [settled] = await alerts();
    expect(settled).toMatchObject({ status: 'SENT', price: 30 });
    expect(await wallet(f.playerIds[1]!)).toBe(470);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.tokens).toEqual(['token-a']);
    expect(sent[0]!.message).toMatchObject({ kind: 'incoming_attack', title: 'Saldırı geliyor' });
    expect(sent[0]!.message.body).toMatch(/dünyana bir filo yaklaşıyor/);

    // A redelivered radar warning arms nothing new.
    await f.db.update(scheduledEvents).set({ status: 'pending', claimedAt: null })
      .where(eq(scheduledEvents.kind, 'radar_warning'));
    await makeWorker(f).tick();
    expect(await alerts()).toHaveLength(1);
    expect(await wallet(f.playerIds[1]!)).toBe(470);
  });

  it('sends nothing and charges nothing when the wallet cannot pay', async () => {
    await fund(10);
    await registerPushDevice(f.db, f.accountIds[1]!, 'token-a', 'android', 'tr', f.clock);
    await launchAttack(f.db, attacker, defender, { DART: 40 }, f.clock);
    await untilWarned();
    await runTo('paid_alert');
    expect((await alerts())[0]).toMatchObject({ status: 'UNFUNDED', price: null });
    expect(await wallet(f.playerIds[1]!)).toBe(10);
    expect(sent).toHaveLength(0);
    expect((await notificationCenterView(f.db, f.playerIds[1]!, f.clock)).unfunded).toBe(1);
  });

  it('charges nothing without an installed app to send to', async () => {
    await fund(500);
    await launchAttack(f.db, attacker, defender, { DART: 40 }, f.clock);
    await untilWarned();
    await runTo('paid_alert');
    expect((await alerts())[0]).toMatchObject({ status: 'NO_DEVICE' });
    expect(await wallet(f.playerIds[1]!)).toBe(500);
  });

  it('charges nothing for a raid recalled before the moment', async () => {
    await fund(500);
    await registerPushDevice(f.db, f.accountIds[1]!, 'token-a', 'android', 'tr', f.clock);
    const { missionId } = await launchAttack(f.db, attacker, defender, { DART: 40 }, f.clock);
    await untilWarned();
    // A recall keeps the row in flight, homeward: the alert must still see it is no raid now.
    await recallFlight(f.db, missionId, f.clock, f.playerIds[0]!);
    expect((await f.db.select().from(missions).where(eq(missions.id, missionId)))[0]!.recalledAt).not.toBeNull();
    await runTo('paid_alert');
    expect((await alerts())[0]).toMatchObject({ status: 'CANCELLED' });
    expect(await wallet(f.playerIds[1]!)).toBe(500);
    expect(sent).toHaveLength(0);
  });

  it('arms nothing for a muted kind', async () => {
    await fund(500);
    await setNotificationCenter(f.db, f.playerIds[1]!, { muted: ['incoming_attack'] });
    await launchAttack(f.db, attacker, defender, { DART: 40 }, f.clock);
    await untilWarned();
    expect(await alerts()).toHaveLength(0);
  });
});

describe('a probe over the centre (decision 8)', () => {
  it('brings home a reading of it, never the wallet itself', async () => {
    const [scout, target] = f.planetIds as [string, string];
    await grant(f.db, target, 10_000, 10_000);
    await buildNotificationCenter(f.db, f.playerIds[1]!, target, f.clock);
    f.clock.advance(300);
    const probe = await launchProbe(f.db, scout, target, f.clock);
    f.clock.set(probe.arriveAt);
    await makeWorker(f).tick();
    const [report] = await f.db.select().from(probeReports).where(eq(probeReports.targetPlanetId, target));
    const reading = report!.silhouette?.notificationCenter;
    expect([...CENTER_STATUSES, 'UNKNOWN']).toContain(reading);
    expect(JSON.stringify(report)).not.toMatch(/wallet/i);
  });
});
