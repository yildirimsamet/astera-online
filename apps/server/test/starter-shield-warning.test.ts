import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { pushDevices, starterEvents, vesselNotifications, vesselOrders, vessels } from '../src/db/schema.js';
import { setPushTransport, type PushMessage } from '../src/services/notificationCenter.js';
import { settleVesselById } from '../src/services/starter/vessel.js';
import { testDb } from './helpers.js';
import { starterWorld } from './starterFixture.js';
import { aboard, pass } from './starterShips.js';

afterAll(async () => { await (await testDb()).close(); });

describe('the hour before a shield falls', () => {
  let world: Awaited<ReturnType<typeof starterWorld>>;
  beforeEach(async () => { world = await starterWorld(); });
  afterEach(async () => { setPushTransport(null); await world.built.close(); });

  const raiseShield = async (vesselId: string) => {
    await world.f.db.insert(vesselOrders).values({
      vesselId, queue: 'CONSTRUCTION', slot: 0, subject: 'AEGIS', stage: 1, startedAt: world.f.clock.now(), readyAt: world.f.clock.now(), remainingSeconds: 0, cost: { alloy: 0, crystal: 0, deuterium: 0 },
    });
    await settleVesselById(world.f.db, vesselId, world.f.clock);
    const [row] = await world.f.db.select().from(vessels).where(eq(vessels.id, vesselId));
    return row!.pvpOpenAt!;
  };
  const warnings = (vesselId: string) => world.f.db.select().from(vesselNotifications)
    .where(eq(vesselNotifications.vesselId, vesselId)).then(rows => rows.filter(row => row.kind === 'SHIELD_WARNING'));

  it('is booked when the shield goes up, an hour before it ends', async () => {
    const me = await aboard(world, 'Me');
    const falls = await raiseShield(me.vesselId);
    const [event] = await world.f.db.select().from(starterEvents).where(eq(starterEvents.kind, 'pvp_shield_warning'));
    expect(event!.resolveAt.getTime()).toBe(falls.getTime() - 3_600_000);
  });

  it('says so once, with the time it falls, and rings the phone', async () => {
    const me = await aboard(world, 'Me');
    const sent: PushMessage[] = [];
    setPushTransport({ send: (_, message) => { sent.push(message); return Promise.resolve({ invalid: [] }); } });
    await world.f.db.insert(pushDevices).values({ token: 'tok', accountId: me.id, platform: 'android', locale: 'tr', createdAt: world.f.clock.now(), lastSeenAt: world.f.clock.now() });
    const falls = await raiseShield(me.vesselId);
    await pass(world, (falls.getTime() - world.f.clock.now().getTime()) / 60_000 - 59);
    const told = await warnings(me.vesselId);
    expect(told).toHaveLength(1);
    expect(told[0]!.payload).toEqual({ until: falls.toISOString() });
    expect(sent.filter(message => message.kind === 'shield_falling')).toHaveLength(1);
  });

  it('says nothing when the commander already gave the shield up', async () => {
    const me = await aboard(world, 'Me');
    const falls = await raiseShield(me.vesselId);
    await world.f.db.update(vessels).set({ pvpOpenAt: world.f.clock.now() }).where(eq(vessels.id, me.vesselId));
    await pass(world, (falls.getTime() - world.f.clock.now().getTime()) / 60_000 - 59);
    expect(await warnings(me.vesselId)).toHaveLength(0);
  });
});
