import { and, eq, lte } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, expect, it } from 'vitest';
import { pushDevices, starterEvents, vesselMissions, vesselOrders, vessels } from '../src/db/schema.js';
import { settleVesselById } from '../src/services/starter/vessel.js';
import { resolveMissionReturn } from '../src/services/starter/arrival.js';
import { STARTER_HANDLERS } from '../src/worker/starterHandlers.js';
import { setPushTransport, type PushMessage } from '../src/services/notificationCenter.js';
import { starterWorld } from './starterFixture.js';
import { aboard } from './starterShips.js';
import { testDb } from './helpers.js';
let world: Awaited<ReturnType<typeof starterWorld>>, sent: PushMessage[];
beforeEach(async () => { world = await starterWorld(); world.f.clock.advance(12 * 60); sent = []; setPushTransport({ send: (_tokens, message) => { sent.push(message); return Promise.resolve({ invalid: [] }); } }); });
afterEach(async () => { setPushTransport(null); await world.built.close(); });
afterAll(async () => { await (await testDb()).close(); });
const setup = async () => {
  const me = await aboard(world, 'Me', { REFINERY: 3, EXTRACTOR: 2, SURVEY: 1, SHIPYARD: 1 });
  await world.f.db.insert(pushDevices).values({ token: 'tok', accountId: me.id, platform: 'android', locale: 'en', createdAt: world.f.clock.now(), lastSeenAt: world.f.clock.now() });
  const [ship] = await world.f.db.select().from(vessels).where(eq(vessels.id, me.vesselId));
  return ship!;
};
const flush = async () => {
  for (const event of await world.f.db.select().from(starterEvents).where(and(eq(starterEvents.status, 'pending'), lte(starterEvents.resolveAt, world.f.clock.now())))) {
    await STARTER_HANDLERS[event.kind]?.({ db: world.f.db, clock: world.f.clock }, event);
    await world.f.db.update(starterEvents).set({ status: 'done' }).where(eq(starterEvents.id, event.id));
  }
};
it('batches long repairs in thirty minutes and ignores short jobs', async () => {
  const ship = await setup();
  const now = world.f.clock.now();
  await world.f.db.insert(vesselOrders).values([
    { subject: 'EXTRACTOR', stage: 3, minutes: 15 }, { subject: 'REFINERY', stage: 4, minutes: 60 }, { subject: 'VAULT', stage: 1, minutes: 5 },
  ].map((o, slot) => ({ vesselId: ship.id, queue: 'CONSTRUCTION' as const, slot, subject: o.subject, stage: o.stage, startedAt: new Date(now.getTime() - o.minutes * 60000), readyAt: now, remainingSeconds: 0, cost: { alloy: 0, crystal: 0, deuterium: 0 } })));
  await settleVesselById(world.f.db, ship.id, world.f.clock);
  await flush(); expect(sent).toHaveLength(1);
  world.f.clock.advance(30); await flush(); await flush();
  expect(sent.map(m => m.kind)).toEqual(['repair_done']);
  expect(sent[0]?.body).toContain('2');
  const visible = await world.app.inject({ url: '/api/starter/notifications', headers: { authorization: `Bearer ${await world.app.tokens.issueAccess(ship.accountId)}` } });
  expect(visible.body).not.toContain('PUSH_SENT');
});
it('rings for the first three mining returns, then only when a part returns', async () => {
  const ship = await setup();
  for (let i = 0; i < 5; i++) {
    const [mission] = await world.f.db.insert(vesselMissions).values({ starterGalaxyId: ship.starterGalaxyId, ownerVesselId: ship.id, kind: 'MINE', status: 'RETURNING', fromX: ship.x, fromY: ship.y, fromZ: ship.z, toX: ship.x + 100, toY: ship.y, toZ: ship.z, departAt: world.f.clock.now(), arriveAt: world.f.clock.now(), returnAt: world.f.clock.now(), fleet: { PROSPECTOR: 1 }, cargo: { alloy: 10, crystal: 0, deuterium: 0 }, carriesPart: i === 4 }).returning();
    await resolveMissionReturn(world.f.db, mission!.id, world.f.clock);
    await resolveMissionReturn(world.f.db, mission!.id, world.f.clock);
    await flush();
  }
  expect(sent.filter(m => m.kind === 'miner_home')).toHaveLength(4);
});

it('includes long dock repairs in the same repair batch', async () => {
  const ship = await setup();
  const now = world.f.clock.now();
  await world.f.db.insert(vesselOrders).values({ vesselId: ship.id, queue: 'DOCK', slot: 0, subject: 'DOCK', stage: 1, startedAt: new Date(now.getTime() - 15 * 60000), readyAt: now, remainingSeconds: 0, cost: { alloy: 0, crystal: 0, deuterium: 0 } });
  await settleVesselById(world.f.db, ship.id, world.f.clock);
  world.f.clock.advance(30); await flush();
  expect(sent.map(m => m.kind)).toEqual(['repair_done']);
});
it('sends a lone long repair immediately', async () => {
  const ship = await setup(), now = world.f.clock.now();
  await world.f.db.insert(vesselOrders).values({ vesselId: ship.id, queue: 'CONSTRUCTION', slot: 0, subject: 'EXTRACTOR', stage: 3, startedAt: new Date(now.getTime() - 15 * 60000), readyAt: now, remainingSeconds: 0, cost: { alloy: 0, crystal: 0, deuterium: 0 } });
  await settleVesselById(world.f.db, ship.id, world.f.clock); await flush();
  expect(sent).toHaveLength(1); expect(sent[0]?.body).toContain('Crystal Extractor');
  expect(sent[0]?.body).not.toContain('1 long repairs');
});
it('groups two long repairs ten minutes apart at the last finish', async () => {
  const ship = await setup(), now = world.f.clock.now();
  await world.f.db.insert(vesselOrders).values([
    { subject: 'EXTRACTOR', stage: 3, offset: 0 }, { subject: 'REFINERY', stage: 4, offset: 10 },
  ].map((job, slot) => ({ vesselId: ship.id, queue: 'CONSTRUCTION' as const, slot, subject: job.subject, stage: job.stage, startedAt: new Date(now.getTime() - 15 * 60000), readyAt: new Date(now.getTime() + job.offset * 60000), remainingSeconds: 0, cost: { alloy: 0, crystal: 0, deuterium: 0 } })));
  await settleVesselById(world.f.db, ship.id, world.f.clock); await flush(); expect(sent).toHaveLength(0);
  world.f.clock.advance(10); await settleVesselById(world.f.db, ship.id, world.f.clock); await flush();
  expect(sent).toHaveLength(1); expect(sent[0]?.body).toContain('2');
});
it('names a single repair in all six languages and uses a count for a batch', async () => {
  const { returnMessage } = await import('../src/services/returnCopy.js');
  for (const locale of ['en', 'tr', 'de', 'fr', 'es', 'ja'] as const) {
    const one = returnMessage('repair_done', locale, 'repair', 1, { module: 'SHIPYARD' });
    expect(one.body).not.toContain('1');
    expect(one.body).not.toMatch(/\{|SHIPYARD/);
    expect(returnMessage('repair_done', locale, 'repair', 2).body).toContain('2');
  }
});
