import { and, eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, expect, it } from 'vitest';
import { pushDevices, deferredPushes } from '../src/db/schema.js';
import { deliverDeferredPushes, quietDeliveryAt } from '../src/services/pushDelivery.js';
import { registerPushDevice, sendPush, setPushTransport, type PushMessage } from '../src/services/notificationCenter.js';
import { starterWorld } from './starterFixture.js';
import { aboard } from './starterShips.js';
import { testDb } from './helpers.js';
let world: Awaited<ReturnType<typeof starterWorld>>;
let sent: PushMessage[];
beforeEach(async () => {
  world = await starterWorld(); sent = [];
  setPushTransport({ send: (tokens, message) => { sent.push(message); return Promise.resolve({ invalid: [], accepted: tokens.length }); } });
});
afterEach(async () => { setPushTransport(null); await world.built.close(); });
afterAll(async () => { await (await testDb()).close(); });
it('moves only non-attack messages from 23:00–08:00 local time to 08:00, including fractional offsets', () => {
  expect(quietDeliveryAt(new Date('2026-11-06T20:00:00Z'), 180).toISOString()).toBe('2026-11-07T05:00:00.000Z');
  expect(quietDeliveryAt(new Date('2026-11-06T02:15:00Z'), 330).toISOString()).toBe('2026-11-06T02:30:00.000Z');
  expect(quietDeliveryAt(new Date('2026-11-06T08:00:00Z'), 0).toISOString()).toBe('2026-11-06T08:00:00.000Z');
});
it('persists a device offset on registration and token refresh', async () => {
  const me = await aboard(world, 'Me');
  await registerPushDevice(world.f.db, me.id, 'tok', 'android', 'tr', world.f.clock, 180);
  expect((await world.f.db.select().from(pushDevices))[0]?.utcOffsetMinutes).toBe(180);
  await registerPushDevice(world.f.db, me.id, 'tok', 'android', 'en', world.f.clock, -300);
  expect((await world.f.db.select().from(pushDevices))[0]?.utcOffsetMinutes).toBe(-300);
});
it('defers per device, delivers once at dawn and lets an attack pass immediately', async () => {
  const me = await aboard(world, 'Me');
  const now = new Date('2026-11-06T23:30:00Z');
  await world.f.db.insert(pushDevices).values({ token: 'tok', accountId: me.id, platform: 'android', locale: 'en', utcOffsetMinutes: 0, createdAt: now, lastSeenAt: now });
  const notice: PushMessage = { kind: 'system_open', title: 'Ready', body: 'Ready', data: { refId: me.vesselId } };
  const phones = [{ token: 'tok', locale: 'en' as const }];
  await sendPush(world.f.db, phones, () => notice, now);
  await sendPush(world.f.db, phones, () => notice, now);
  expect(sent).toHaveLength(0);
  expect(await world.f.db.select().from(deferredPushes)).toHaveLength(1);
  await sendPush(world.f.db, phones, () => ({ ...notice, kind: 'incoming_attack' }), now);
  expect(sent.map(m => m.kind)).toEqual(['incoming_attack']);
  await deliverDeferredPushes(world.f.db, new Date('2026-11-07T07:59:59Z'));
  expect(sent).toHaveLength(1);
  await deliverDeferredPushes(world.f.db, new Date('2026-11-07T08:00:00Z'));
  await deliverDeferredPushes(world.f.db, new Date('2026-11-07T08:00:00Z'));
  expect(sent.map(m => m.kind)).toEqual(['incoming_attack', 'system_open']);
  expect(await world.f.db.select().from(deferredPushes).where(and(eq(deferredPushes.token, 'tok')))).toHaveLength(0);
});

it('rechecks quiet hours if the device changed time zone before delivery', async () => {
  const me = await aboard(world, 'Traveller');
  const now = new Date('2026-11-06T23:30:00Z');
  await world.f.db.insert(pushDevices).values({ token: 'travel', accountId: me.id, platform: 'android', locale: 'en', utcOffsetMinutes: 0, createdAt: now, lastSeenAt: now });
  await sendPush(world.f.db, [{ token: 'travel', locale: 'en' }], () => ({ kind: 'system_open', title: 'Ready', body: 'Ready', data: { refId: me.vesselId } }), now);
  await world.f.db.update(pushDevices).set({ utcOffsetMinutes: -540 }).where(eq(pushDevices.token, 'travel'));
  await deliverDeferredPushes(world.f.db, new Date('2026-11-07T08:00:00Z'));
  expect(sent).toHaveLength(0);
  expect(await world.f.db.select().from(deferredPushes)).toHaveLength(1);
  await deliverDeferredPushes(world.f.db, new Date('2026-11-07T17:00:00Z'));
  expect(sent).toHaveLength(1);
});

it('delivers paid probe alerts and free shield warnings at night, but holds a free repair', async () => {
  const { notificationCenters, paidAlerts } = await import('../src/db/schema.js');
  const { settlePaidAlert } = await import('../src/services/notificationCenter.js');
  const now = new Date('2026-11-06T23:30:00Z'); world.f.clock.set(now);
  const accountId = world.f.accountIds[0]!, playerId = world.f.playerIds[0]!;
  await registerPushDevice(world.f.db, accountId, 'night', 'android', 'en', world.f.clock);
  await world.f.db.insert(notificationCenters).values({ playerId, builtAt: now, wallet: 1000 });
  const [alert] = await world.f.db.insert(paidAlerts).values({ playerId, kind: 'probe_detected', refId: world.f.planetIds[0]!, sendAt: now, payload: {}, createdAt: now }).returning();
  await settlePaidAlert(world.f.db, world.f.clock, alert!.id);
  expect(sent.map(m => m.kind)).toEqual(['probe_detected']);
  await sendPush(world.f.db, [{ token: 'night', locale: 'en' }], () => ({ kind: 'shield_falling', title: 'Shield', body: 'Shield', data: {} }), now);
  expect(sent.map(m => m.kind)).toEqual(['probe_detected', 'shield_falling']);
  await sendPush(world.f.db, [{ token: 'night', locale: 'en' }], () => ({ kind: 'repair_done', title: 'Repair', body: 'Repair', data: {} }), now);
  expect(sent).toHaveLength(2);
  expect(await world.f.db.select().from(deferredPushes)).toHaveLength(1);
});

it('commits deferred claims before transport and never repeats a delivered message after an outage', async () => {
  const me = await aboard(world);
  const now = new Date('2026-11-06T23:30:00Z');
  await registerPushDevice(world.f.db, me.id, 'batch', 'android', 'en', world.f.clock);
  for (const id of ['first', 'second', 'third']) await sendPush(world.f.db, [{ token: 'batch', locale: 'en' }], () => ({ kind: 'repair_done', title: id, body: id, data: {} }), now);
  const delivered: string[] = [];
  setPushTransport({ send: async (_tokens, message) => {
    const queued = await world.f.db.select().from(deferredPushes);
    expect(queued).toHaveLength(0);
    delivered.push(message.title);
    if (delivered.length === 2) throw new Error('offline');
    return { invalid: [], accepted: 1 };
  } });
  await deliverDeferredPushes(world.f.db, new Date('2026-11-07T08:00:00Z')).catch(() => undefined);
  await deliverDeferredPushes(world.f.db, new Date('2026-11-07T08:00:00Z'));
  expect(delivered.filter(id => id === delivered[0])).toHaveLength(1);
  expect(delivered).toHaveLength(3);
});
