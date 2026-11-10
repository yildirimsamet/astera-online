import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, expect, it } from 'vitest';
import { alertPrice } from '@astera/rules';
import {
  notificationCenters, paidAlerts, planets, players, radiationBombFlights, scheduledEvents, seasons, strategicAssets,
} from '../src/db/schema.js';
import {
  buildNotificationCenter, commanderDeuteriumPerHour, fundNotificationCenter, registerPushDevice, setPushTransport,
  type PushMessage,
} from '../src/services/notificationCenter.js';
import { buildRadiationBomb, launchRadiationBomb } from '../src/services/radiationBomb.js';
import { EventWorker } from '../src/worker/loop.js';
import { giveInstrument, giveSatellite, grant, placeAt, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

/**
 * A RADIATION BOMB IS A STRATEGIC WEAPON TOO. Bildirim Merkezi, owner 2026-10-30 (decision 3:
 * "Ölüm Yıldızı / stratejik silah"), fixed 2026-11-10: the in-game warning reached the
 * defender, the paid push never armed.
 */
let f: Fixture;
let flightId: string;
let sent: PushMessage[];
const worker = () => new EventWorker(f.db, f.clock, { pollMs: 1, batch: 100, staleMinutes: 5 }, pino({ level: 'silent' }));
const wallet = async () => (await f.db.select().from(notificationCenters)
  .where(eq(notificationCenters.playerId, f.playerIds[1]!)))[0]!.wallet;
const alerts = () => f.db.select().from(paidAlerts).where(eq(paidAlerts.playerId, f.playerIds[1]!));
const runTo = async (kind: 'radar_warning' | 'paid_alert') => {
  const [next] = await f.db.select().from(scheduledEvents)
    .where(and(eq(scheduledEvents.kind, kind), eq(scheduledEvents.status, 'pending')))
    .orderBy(scheduledEvents.resolveAt).limit(1);
  if (!next) throw new Error(`no pending ${kind}`);
  if (next.resolveAt > f.clock.now()) f.clock.set(next.resolveAt);
  await worker().tick();
};

beforeEach(async () => {
  f = await seedWorld(2);
  sent = [];
  setPushTransport({ send: (tokens, message) => { sent.push(message); return Promise.resolve({ invalid: [], accepted: tokens.length }); } });
  await f.db.update(seasons).set({ rulesetVersion: 18, radiationBombStartsAt: f.clock.now() }).where(eq(seasons.id, f.seasonId));
  await f.db.update(players).set({ newcomerShieldUntil: null, recoveryShieldUntil: null });
  await placeAt(f.db, f.planetIds[0]!, { x: 0 });
  await placeAt(f.db, f.planetIds[1]!, { x: 8000 });
  await setLevel(f.db, f.planetIds[0]!, 'CORE', 13); await setLevel(f.db, f.planetIds[1]!, 'CORE', 13); await setLevel(f.db, f.planetIds[0]!, 'SHIPYARD', 5);
  await grant(f.db, f.planetIds[0]!, 500000, 500000);
  await grant(f.db, f.planetIds[1]!, 500000, 500000);
  await f.db.update(planets).set({ deuterium: 500000 }).where(eq(planets.id, f.planetIds[0]!));
  await f.db.update(planets).set({ deuterium: 5000 }).where(eq(planets.id, f.planetIds[1]!));
  await giveSatellite(f.db, f.planetIds[1]!, 'UPLINK');
  await giveInstrument(f.db, f.planetIds[1]!, 'RADAR', 1);
  await buildNotificationCenter(f.db, f.playerIds[1]!, f.planetIds[1]!, f.clock);
  await fundNotificationCenter(f.db, f.playerIds[1]!, f.planetIds[1]!, 1000, true, f.clock);
  await registerPushDevice(f.db, f.accountIds[1]!, 'token-a', 'android', 'tr', f.clock);
  const built = await buildRadiationBomb(f.db, f.planetIds[0]!, 2, f.clock, f.playerIds[0]);
  await f.db.update(strategicAssets).set({ status: 'READY' }).where(eq(strategicAssets.id, built.assetId));
  const launched = await launchRadiationBomb(f.db, { playerId: f.playerIds[0]!, originPlanetId: f.planetIds[0]!,
    target: { kind: 'PLANET', id: f.planetIds[1]! }, level: 2, key: randomUUID(), clock: f.clock });
  flightId = launched.flightId;
});
afterEach(() => { setPushTransport(null); });
afterAll(async () => { await (await testDb()).close(); });

/** The radar check reschedules itself until the bomb crosses the circle. */
const untilArmed = async () => {
  for (let i = 0; i < 12; i++) {
    await runTo('radar_warning');
    if ((await alerts()).length > 0) return;
  }
  throw new Error('no paid alert armed');
};

it('arms a strategic alert when the radar sees the bomb and charges the strategic price on sending', async () => {
  await untilArmed();
  const [armed] = await alerts();
  const [flight] = await f.db.select().from(radiationBombFlights).where(eq(radiationBombFlights.id, flightId));
  expect(armed).toMatchObject({ kind: 'incoming_strategic', refId: flightId, status: 'PENDING', timing: 'T5' });
  expect(armed!.sendAt.getTime()).toBe(Math.max(flight!.arriveAt.getTime() - 5 * 60_000, armed!.createdAt.getTime()));

  const before = await wallet();
  const rate = await f.db.transaction(tx => commanderDeuteriumPerHour(tx, f.playerIds[1]!));
  await runTo('paid_alert');
  const price = alertPrice('incoming_strategic', 'T5', rate);
  expect((await alerts())[0]).toMatchObject({ status: 'SENT', price });
  expect(await wallet()).toBe(before - price);
  expect(sent).toHaveLength(1);
  expect(sent[0]).toMatchObject({ kind: 'incoming_strategic', data: { refId: flightId, planetId: f.planetIds[1] } });
});

it('charges nothing for a bomb that is no longer on its way', async () => {
  await untilArmed();
  await f.db.update(radiationBombFlights).set({ status: 'INEFFECTIVE', resolvedAt: f.clock.now() }).where(eq(radiationBombFlights.id, flightId));
  await runTo('paid_alert');
  expect((await alerts())[0]).toMatchObject({ status: 'CANCELLED' });
  expect(await wallet()).toBe(1000);
  expect(sent).toHaveLength(0);
});
