import { eq, inArray } from 'drizzle-orm';
import { REPAIR_LADDER, afterQueue, openFeatures, type RepairStep, type VesselProgress } from '@astera/rules';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { notificationCenters, paidAlerts, pushDevices, starterEvents, vesselMissions, vesselOrders, vessels } from '../src/db/schema.js';
import { setPushTransport, type PushMessage } from '../src/services/notificationCenter.js';
import { resolveMissionArrival } from '../src/services/starter/arrival.js';
import { deliverRadarWarning } from '../src/services/starter/fleet.js';
import { testDb } from './helpers.js';
import { starterWorld } from './starterFixture.js';
import { STARTER_HANDLERS } from '../src/worker/starterHandlers.js';
import { aboard, arm } from './starterShips.js';

const READY = { REFINERY: 1, SHIPYARD: 1, HANGAR: 1, AEGIS: 1, RADAR: 1 };

afterAll(async () => { await (await testDb()).close(); });

describe('a phone, aboard', () => {
  let world: Awaited<ReturnType<typeof starterWorld>>;
  let sent: { tokens: string[]; message: PushMessage }[];
  beforeEach(async () => {
    world = await starterWorld();
    world.f.clock.advance(12 * 60);
    sent = [];
    setPushTransport({ send: async (tokens, message) => { sent.push({ tokens, message }); return Promise.resolve({ invalid: tokens.filter(token => token === 'dead'), accepted: tokens.filter(token => token !== 'dead').length }); } });
  });
  afterEach(async () => { setPushTransport(null); await world.built.close(); });

  const device = (accountId: string, token: string, locale: 'tr' | 'en' = 'en') => world.f.db.insert(pushDevices).values({
    token, accountId, platform: 'android', locale, createdAt: world.f.clock.now(), lastSeenAt: world.f.clock.now(),
  });
  const inbound = async (targetVesselId: string, status: 'OUTBOUND' | 'RETURNING' = 'OUTBOUND') => {
    const me = await world.f.db.query.vessels.findFirst({ where: (row, { eq: is }) => is(row.id, targetVesselId) });
    const [row] = await world.f.db.insert(vesselMissions).values({
      starterGalaxyId: me!.starterGalaxyId, targetVesselId, kind: 'PIRATE', fromX: 0, fromY: 0, fromZ: 0, toX: 1, toY: 1, toZ: 1, fleet: { DART: 1 }, damage: [],
      departAt: world.f.clock.now(), arriveAt: new Date(world.f.clock.now().getTime() + 600_000), status,
    }).returning();
    return row!.id;
  };

  it('rings free of charge when the radar warns, in the phone\'s language', async () => {
    const me = await aboard(world, 'Me', { RADAR: 1 });
    await device(me.id, 'tok-tr', 'tr');
    await device(me.id, 'tok-en', 'en');
    await deliverRadarWarning(world.f.db, await inbound(me.vesselId), world.f.clock);
    expect(sent).toHaveLength(2);
    const turkish = sent.find(call => call.tokens.includes('tok-tr'))!;
    expect(turkish.message.kind).toBe('incoming_attack');
    expect(turkish.message.body).toContain('10');
    expect(turkish.message.body).toMatch(/gemi/i);
    expect(await world.f.db.select().from(paidAlerts)).toHaveLength(0);
    expect(await world.f.db.select().from(notificationCenters)).toHaveLength(0);
  });

  it('rings once, however many times the queue delivers', async () => {
    const me = await aboard(world, 'Me', { RADAR: 1 });
    await device(me.id, 'tok');
    const mission = await inbound(me.vesselId);
    await deliverRadarWarning(world.f.db, mission, world.f.clock);
    await deliverRadarWarning(world.f.db, mission, world.f.clock);
    expect(sent).toHaveLength(1);
  });

  it('rings when a probe is caught looking', async () => {
    const me = await aboard(world, 'Me', { RADAR: 1 });
    const them = await aboard(world, 'Them', { SURVEY: 1 });
    await device(me.id, 'tok');
    const [row] = await world.f.db.select().from(vessels).where(eq(vessels.id, me.vesselId));
    const [probe] = await world.f.db.insert(vesselMissions).values({
      starterGalaxyId: row!.starterGalaxyId, ownerVesselId: them.vesselId, targetVesselId: me.vesselId, kind: 'PROBE', fromX: 0, fromY: 0, fromZ: 0, toX: 1, toY: 1, toZ: 1, fleet: {}, damage: [],
      departAt: world.f.clock.now(), arriveAt: world.f.clock.now(), status: 'OUTBOUND',
    }).returning();
    await resolveMissionArrival(world.f.db, probe!.id, world.f.clock);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.message.kind).toBe('probe_detected');
    expect(sent[0]!.message.body.length).toBeGreaterThan(0);
  });

  it('rings both sides when a raid is over, and neither when it turned back with no fight', async () => {
    const me = await aboard(world, 'Me', READY);
    const them = await aboard(world, 'Them', READY);
    await device(me.id, 'mine');
    await device(them.id, 'theirs');
    await world.f.db.update(vessels).set({ facts: ['FIRST_BATTLE_REPORT'], pvpOpenAt: new Date(world.f.clock.now().getTime() - 3_600_000) }).where(inArray(vessels.id, [me.vesselId, them.vesselId]));
    await arm(world, me.vesselId, { DART: 1 });
    const [row] = await world.f.db.select().from(vessels).where(eq(vessels.id, me.vesselId));
    const flight = async (target: string | null) => (await world.f.db.insert(vesselMissions).values({
      starterGalaxyId: row!.starterGalaxyId, ownerVesselId: them.vesselId, targetVesselId: target, kind: 'ATTACK', fromX: 0, fromY: 0, fromZ: 0, toX: 1, toY: 1, toZ: 1, fleet: { DART: 8 }, damage: [],
      departAt: world.f.clock.now(), arriveAt: world.f.clock.now(), status: 'OUTBOUND',
    }).returning())[0]!.id;
    await resolveMissionArrival(world.f.db, await flight(me.vesselId), world.f.clock);
    expect(sent.map(call => call.tokens[0]).sort()).toEqual(['mine', 'theirs']);
    expect(sent.find(call => call.tokens[0] === 'mine')!.message.kind).toBe('raided');
    expect(sent.find(call => call.tokens[0] === 'theirs')!.message.kind).toBe('raid_over');
    sent.length = 0;
    await resolveMissionArrival(world.f.db, await flight(null), world.f.clock);
    expect(sent).toHaveLength(0);
  });

  it('rings when a repair opens a system, and stays quiet for one that opens nothing', async () => {
    const me = await aboard(world, 'Me', { REFINERY: 1 });
    await device(me.id, 'tok');
    const start: VesselProgress = { modules: { REFINERY: 1 }, facts: [], parts: 0, fuel: 0 };
    const opens = (step: RepairStep) => openFeatures(afterQueue(start, [step])).size > openFeatures(start).size;
    const opener = REPAIR_LADDER.find(opens)!;
    const silent = REPAIR_LADDER.find(step => !opens(step) && !(step.module === 'REFINERY' && step.stage === 1) && !openFeatures(afterQueue(afterQueue(start, [opener]), [step])).has('fleet') && step.module !== opener.module)!;
    const [ship] = await world.f.db.select().from(vessels).where(eq(vessels.id, me.vesselId));
    const finish = async (step: RepairStep) => {
      const [order] = await world.f.db.insert(vesselOrders).values({
        vesselId: me.vesselId, queue: 'CONSTRUCTION', slot: 0, subject: step.module, stage: step.stage, startedAt: world.f.clock.now(), readyAt: world.f.clock.now(), remainingSeconds: 0, cost: { alloy: 0, crystal: 0, deuterium: 0 },
      }).returning();
      const [event] = await world.f.db.insert(starterEvents).values({ starterGalaxyId: ship!.starterGalaxyId, kind: 'vessel_order_complete', refId: order!.id, resolveAt: world.f.clock.now() }).returning();
      await STARTER_HANDLERS.vessel_order_complete({ db: world.f.db, clock: world.f.clock }, event!);
    };
    await finish(opener);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.message.kind).toBe('system_open');
    sent.length = 0;
    await finish(silent);
    expect(sent).toHaveLength(0);
  });

  it('stops being free when the ship has landed: the main rule takes over', async () => {
    const me = await aboard(world, 'Me', { RADAR: 1 });
    await device(me.id, 'tok');
    const mission = await inbound(me.vesselId);
    await world.f.db.update(vessels).set({ status: 'DEPARTED', slotIndex: null }).where(eq(vessels.id, me.vesselId));
    await deliverRadarWarning(world.f.db, mission, world.f.clock);
    expect(sent).toHaveLength(0);
  });

  it('forgets a token the provider has given up on', async () => {
    const me = await aboard(world, 'Me', { RADAR: 1 });
    await device(me.id, 'dead');
    await deliverRadarWarning(world.f.db, await inbound(me.vesselId), world.f.clock);
    expect(await world.f.db.select().from(pushDevices).where(eq(pushDevices.token, 'dead'))).toHaveLength(0);
  });

  it('says nothing about a craft that has turned round', async () => {
    const me = await aboard(world, 'Me', { RADAR: 1 });
    await device(me.id, 'tok');
    await deliverRadarWarning(world.f.db, await inbound(me.vesselId, 'RETURNING'), world.f.clock);
    expect(sent).toHaveLength(0);
  });

  it('rings no one when there is no phone, and a dead provider does not stop the warning', async () => {
    const me = await aboard(world, 'Me', { RADAR: 1 });
    await deliverRadarWarning(world.f.db, await inbound(me.vesselId), world.f.clock);
    expect(sent).toHaveLength(0);
    await device(me.id, 'tok');
    setPushTransport({ send: () => Promise.reject(new Error('provider down')) });
    await expect(deliverRadarWarning(world.f.db, await inbound(me.vesselId), world.f.clock)).resolves.toBeUndefined();
  });
});
