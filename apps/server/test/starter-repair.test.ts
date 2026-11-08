import { randomUUID } from 'node:crypto';
import { COMBAT, ECONOMY_PROFILE, REPAIR_LADDER, STARTER, alloyRate, cancelRefund, shieldHp, vesselAegisHp } from '@astera/rules';
import { and, eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { starterEvents, vesselNotifications, vesselOrders, vesselUnits, vessels } from '../src/db/schema.js';
import { EventWorker } from '../src/worker/loop.js';
import { STARTER_HANDLERS } from '../src/worker/starterHandlers.js';
import { testDb } from './helpers.js';
import { bearer, freshAccount, starterWorld } from './starterFixture.js';

afterAll(async () => { await (await testDb()).close(); });

interface VesselAnswer {
  id: string; alloy: number; crystal: number; deuterium: number; bufferAlloy: number;
  modules: Record<string, number>; queue: { id: string; subject: string; stage: number; readyAt: string; startedAt: string }[];
}

describe('repairing the ship', () => {
  let world: Awaited<ReturnType<typeof starterWorld>>;
  let token: string;
  let accountId: string;
  let vesselId: string;
  let worker: EventWorker;

  const repair = (module: string, stage: number) => world.app.inject({ method: 'POST', url: '/api/starter/repair', headers: bearer(token), payload: { module, stage } });
  const collect = () => world.app.inject({ method: 'POST', url: '/api/starter/collect', headers: bearer(token) });
  const cancel = (id: string) => world.app.inject({ method: 'POST', url: `/api/starter/orders/${id}/cancel`, headers: bearer(token) });
  const read = async () => (await world.app.inject({ url: '/api/starter/vessel', headers: bearer(token) })).json<{ vessel: VesselAnswer }>().vessel;
  const advance = (minutes: number) => { world.f.clock.set(new Date(world.f.clock.now().getTime() + minutes * 60_000)); };
  const setShip = (values: Partial<typeof vessels.$inferInsert>) => world.f.db.update(vessels).set(values).where(eq(vessels.id, vesselId));

  beforeEach(async () => {
    world = await starterWorld();
    const person = await freshAccount(world.f);
    token = person.token;
    accountId = person.id;
    vesselId = (await world.app.inject({ method: 'POST', url: '/api/starter/enlist', headers: bearer(token) })).json<{ vessel: VesselAnswer }>().vessel.id;
    worker = new EventWorker(world.f.db, world.f.clock, { pollMs: 50, batch: 50, staleMinutes: 5 }, pino({ level: 'silent' }));
  });
  afterEach(async () => { await world.built.close(); });

  it('reads the ship back', async () => {
    const view = await read();
    expect(view.id).toBe(vesselId);
    expect(view.queue).toEqual([]);
  });

  it('says so when the account has no ship', async () => {
    const other = await freshAccount(world.f, 'Other');
    const response = await world.app.inject({ url: '/api/starter/vessel', headers: bearer(other.token) });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: 'VESSEL_NOT_FOUND' });
  });

  it('asks for a session', async () => {
    expect((await world.app.inject({ url: '/api/starter/vessel' })).statusCode).toBe(401);
    expect((await world.app.inject({ method: 'POST', url: '/api/starter/repair', payload: { module: 'REFINERY', stage: 2 } })).statusCode).toBe(401);
  });

  it('turns a left ship away toward its new home', async () => {
    await setShip({ status: 'DEPARTED', slotIndex: null });
    const response = await repair('REFINERY', 2);
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: 'PLACEMENT_CHANGED' });
  });

  describe('the works', () => {
    it('says what moved and what would not fit, as the main collect does', async () => {
      world.f.clock.advance(60);
      const answer = (await collect()).json<{ moved: { alloy: number }; blocked: { alloy: number } }>();
      // The prologue's batch was already waiting (owner 2026-11-06), and an hour more joined it.
      expect(answer.moved.alloy).toBeCloseTo(STARTER.opening.works.alloy + alloyRate(1), 0);
      expect(answer.blocked).toEqual({ alloy: 0, crystal: 0, deuterium: 0 });
    });

    it('fills while the player is away and moves into storage on collect', async () => {
      advance(60);
      expect((await read()).bufferAlloy).toBeCloseTo(STARTER.opening.works.alloy + alloyRate(1), 0);
      const collected = (await collect()).json<{ vessel: VesselAnswer }>().vessel;
      expect(collected.bufferAlloy).toBe(0);
      expect(collected.alloy).toBeCloseTo(STARTER.opening.alloy + STARTER.opening.works.alloy + alloyRate(1), 0);
    });

    it('moves nothing the second time', async () => {
      advance(60);
      const first = (await collect()).json<{ vessel: VesselAnswer }>().vessel;
      const second = (await collect()).json<{ vessel: VesselAnswer }>().vessel;
      expect(second.alloy).toBe(first.alloy);
    });
  });

  describe('an order', () => {
    it('pays at once and joins the queue', async () => {
      const response = await repair('REFINERY', 2);
      expect(response.statusCode).toBe(200);
      const view = response.json<{ vessel: VesselAnswer }>().vessel;
      expect(view.alloy).toBe(STARTER.opening.alloy - 154);
      expect(view.crystal).toBe(STARTER.opening.crystal - 20);
      expect(view.modules.REFINERY).toBe(1);
      expect(view.queue).toHaveLength(1);
      expect(view.queue[0]).toMatchObject({ subject: 'REFINERY', stage: 2 });
      // Owner 2026-11-06: the guided first repairs take seconds; this one ten.
      expect(new Date(view.queue[0]!.readyAt).getTime()).toBe(world.f.clock.now().getTime() + 10_000);
      const [order] = await world.f.db.select().from(vesselOrders);
      expect(order!.remainingSeconds).toBe(10);
    });

    it('refuses what the ladder does not hold', async () => {
      const response = await repair('AEGIS', 3);
      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ error: 'UNKNOWN_STEP' });
    });

    it('refuses a step whose requirement is missing, and names it', async () => {
      const response = await repair('SURVEY', 1);
      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({ error: 'REPAIR_REQUIREMENT' });
      expect(await world.f.db.select().from(vesselOrders)).toHaveLength(0);
    });

    /** Plan F3: bought first, the deuterium plant took all the crystal a ship without an Extractor will ever have. */
    it('refuses the deuterium plant before the first Extractor, which a ship without crystal could never pay', async () => {
      const response = await repair('DEUTERIUM_PLANT', 1);
      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({ error: 'REPAIR_REQUIREMENT' });
      expect(await world.f.db.select().from(vesselOrders)).toHaveLength(0);
    });

    it('refuses a real act that has not happened', async () => {
      await setShip({ alloy: 2000, crystal: 2000, modules: { REFINERY: 1, EXTRACTOR: 1, SURVEY: 1 } });
      expect((await repair('SURVEY', 2)).json()).toMatchObject({ error: 'REPAIR_REQUIREMENT' });
      await setShip({ facts: ['FIRST_PROBE_REPORT'] });
      expect((await repair('SURVEY', 2)).statusCode).toBe(200);
    });

    it('refuses what the ship cannot pay', async () => {
      await setShip({ alloy: 10 });
      const response = await repair('REFINERY', 2);
      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({ error: 'INSUFFICIENT_RESOURCES' });
    });

    it('refuses what is already in the queue', async () => {
      await repair('REFINERY', 2);
      expect((await repair('REFINERY', 2)).json()).toMatchObject({ error: 'ALREADY_REPAIRED' });
    });

    it('lets a queued stage count for the next one, and chains their times', async () => {
      await setShip({ alloy: 2000 });
      await repair('REFINERY', 2);
      const view = (await repair('REFINERY', 3)).json<{ vessel: VesselAnswer }>().vessel;
      expect(view.queue.map(order => order.subject)).toEqual(['REFINERY', 'REFINERY']);
      expect(view.queue[1]!.startedAt).toBe(view.queue[0]!.readyAt);
    });

    it('holds three at a time', async () => {
      await setShip({ alloy: 5000, crystal: 2000 });
      await repair('REFINERY', 2);
      await repair('EXTRACTOR', 1);
      await repair('EXTRACTOR', 2);
      const response = await repair('REFINERY', 3);
      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({ error: 'QUEUE_FULL', params: { context: 'repairs' } });
    });

    it('charges once for two orders at the same instant', async () => {
      const answers = await Promise.all([repair('REFINERY', 2), repair('REFINERY', 2)]);
      expect(answers.map(answer => answer.statusCode).sort()).toEqual([200, 409]);
      expect((await read()).alloy).toBe(STARTER.opening.alloy - 154);
      expect(await world.f.db.select().from(vesselOrders)).toHaveLength(1);
    });

    it.each([
      [{ module: 'REFINERY' }],
      [{ module: 'REFINERY', stage: 2.5 }],
      [{ module: 'REFINERY', stage: -1 }],
      [{ module: 'NOPE', stage: 1 }],
      [{ module: 'REFINERY', stage: 2, alloy: 0 }],
      [{}],
    ])('rejects a malformed order %j', async (payload) => {
      const response = await world.app.inject({ method: 'POST', url: '/api/starter/repair', headers: bearer(token), payload });
      expect(response.statusCode).toBe(400);
      expect((await read()).alloy).toBe(STARTER.opening.alloy);
    });
  });

  describe('when it finishes', () => {
    it('raises the module through the worker, and tells the player', async () => {
      await repair('REFINERY', 2);
      advance(1);
      await worker.tick();
      const view = await read();
      expect(view.modules.REFINERY).toBe(2);
      expect(view.queue).toEqual([]);
      expect(await world.f.db.select().from(vesselNotifications)).toMatchObject([{ vesselId, kind: 'REPAIR_DONE', payload: { module: 'REFINERY', stage: 2 } }]);
    });

    it('produces at the old rate until the instant it finished', async () => {
      await repair('REFINERY', 2);
      advance(61);
      await worker.tick();
      const view = await read();
      // The old rate for the repair's own seconds, the new one for the rest of the 61 minutes.
      const repairHours = (REPAIR_LADDER.find(s => s.module === 'REFINERY' && s.stage === 2)!.minutes) / 60;
      expect(view.bufferAlloy).toBeCloseTo(STARTER.opening.works.alloy + alloyRate(1) * repairHours + alloyRate(2) * (61 / 60 - repairHours), 0);
    });

    it('settles a due order on the next command, even if the worker is behind', async () => {
      await setShip({ alloy: 2000 });
      await repair('REFINERY', 2);
      advance(2);
      const view = (await repair('REFINERY', 3)).json<{ vessel: VesselAnswer }>().vessel;
      expect(view.modules.REFINERY).toBe(2);
      expect(view.queue.map(order => order.stage)).toEqual([3]);
      expect(await world.f.db.select().from(vesselNotifications)).toHaveLength(1);
    });

    it('does nothing the second time a finished event is delivered', async () => {
      await repair('REFINERY', 2);
      advance(1);
      await worker.tick();
      const [event] = await world.f.db.select().from(starterEvents);
      await world.f.db.update(starterEvents).set({ status: 'pending' }).where(eq(starterEvents.id, event!.id));
      await worker.tick();
      expect((await read()).modules.REFINERY).toBe(2);
      expect(await world.f.db.select().from(vesselNotifications)).toHaveLength(1);
    });

    it('gives the shipyard\'s ships once', async () => {
      await setShip({ alloy: 2000, modules: { REFINERY: 3, EXTRACTOR: 1, SURVEY: 1 } });
      await repair('SHIPYARD', 1);
      advance(60);
      await worker.tick();
      const units = await world.f.db.select().from(vesselUnits).where(eq(vesselUnits.vesselId, vesselId));
      expect(units.map(({ hull, count, location }) => ({ hull, count, location })).sort((a, b) => a.hull.localeCompare(b.hull)))
        .toEqual([{ hull: 'DART', count: 2, location: 'HOME' }, { hull: 'PROSPECTOR', count: 1, location: 'HOME' }]);
    });

    it('gives the deuterium plant its fuel', async () => {
      await setShip({ modules: { REFINERY: 1, EXTRACTOR: 1 } });
      await repair('DEUTERIUM_PLANT', 1);
      advance(60);
      await worker.tick();
      expect((await read()).deuterium).toBe(STARTER.deuteriumGrant);
    });

    it('starts the twelve-hour shield and the Aegis when the Aegis is repaired', async () => {
      await setShip({ alloy: 2000, crystal: 2000, modules: { REFINERY: 1, RADAR: 1 } });
      await repair('AEGIS', 1);
      advance(45);
      await worker.tick();
      const [row] = await world.f.db.select().from(vessels).where(eq(vessels.id, vesselId));
      expect(row!.pvpOpenAt!.getTime()).toBe(world.f.clock.now().getTime() + STARTER.pvp.shieldHours * 3_600_000);
      advance(60 * 24 * 7);
      const later = (await world.app.inject({ url: '/api/starter/vessel', headers: bearer(token) })).json<{ vessel: { shield: number } }>().vessel;
      expect(later.shield).toBe(vesselAegisHp(1));
      expect(later.shield).toBe(Math.round(shieldHp(1) * STARTER.combat.tempo / COMBAT.tempo));
    });

    it('hands over a charged Aegis, because the first raid is what it is being repaired for', async () => {
      await setShip({ alloy: 2000, crystal: 2000, modules: { REFINERY: 1, RADAR: 1 } });
      await repair('AEGIS', 1);
      advance(45);
      await worker.tick();
      const [row] = await world.f.db.select().from(vessels).where(eq(vessels.id, vesselId));
      expect(row!.shield).toBe(vesselAegisHp(1));
    });
  });

  describe('cancelling', () => {
    it('hands back half, and pulls the rest forward', async () => {
      await repair('EXTRACTOR', 1);
      const queued = (await repair('REFINERY', 2)).json<{ vessel: VesselAnswer }>().vessel.queue;
      const [before] = await world.f.db.select().from(vessels).where(eq(vessels.id, vesselId));
      const answer = (await cancel(queued[0]!.id)).json<{ vessel: VesselAnswer; refund: { alloy: number; crystal: number; deuterium: number } }>();
      expect(answer.refund).toEqual(cancelRefund({ alloy: 44, crystal: 33, deuterium: 0 }));
      const view = answer.vessel;
      expect(view.alloy).toBeCloseTo(before!.alloy + cancelRefund({ alloy: 44, crystal: 33, deuterium: 0 }).alloy, 0);
      expect(view.queue).toHaveLength(1);
      expect(view.queue[0]!.subject).toBe('REFINERY');
      expect(new Date(view.queue[0]!.readyAt).getTime()).toBe(world.f.clock.now().getTime() + 10_000);
      const [event] = await world.f.db.select().from(starterEvents).where(and(eq(starterEvents.refId, view.queue[0]!.id), eq(starterEvents.status, 'pending')));
      expect(event!.resolveAt.getTime()).toBe(new Date(view.queue[0]!.readyAt).getTime());
    });

    it('does not finish the order it cancelled', async () => {
      const queued = (await repair('REFINERY', 2)).json<{ vessel: VesselAnswer }>().vessel.queue;
      await cancel(queued[0]!.id);
      advance(5);
      await worker.tick();
      expect((await read()).modules.REFINERY).toBe(1);
    });

    it('refuses to pull a stage out from under the one behind it', async () => {
      await setShip({ alloy: 2000 });
      const first = (await repair('REFINERY', 2)).json<{ vessel: VesselAnswer }>().vessel.queue[0]!;
      await repair('REFINERY', 3);
      const response = await cancel(first.id);
      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({ error: 'BUILD_ORDER_HAS_DEPENDENTS' });
    });

    it('refuses to pull out a step another requires', async () => {
      const first = (await repair('EXTRACTOR', 1)).json<{ vessel: VesselAnswer }>().vessel.queue[0]!;
      await repair('SURVEY', 1);
      expect((await cancel(first.id)).json()).toMatchObject({ error: 'BUILD_ORDER_HAS_DEPENDENTS' });
    });

    it('refuses another ship\'s order, without saying it exists', async () => {
      const first = (await repair('REFINERY', 2)).json<{ vessel: VesselAnswer }>().vessel.queue[0]!;
      const other = await freshAccount(world.f, 'Other');
      await world.app.inject({ method: 'POST', url: '/api/starter/enlist', headers: bearer(other.token) });
      const response = await world.app.inject({ method: 'POST', url: `/api/starter/orders/${first.id}/cancel`, headers: bearer(other.token) });
      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({ error: 'BUILD_ORDER_NOT_FOUND' });
    });

    it('refuses a finished order', async () => {
      const first = (await repair('REFINERY', 2)).json<{ vessel: VesselAnswer }>().vessel.queue[0]!;
      advance(5);
      expect((await cancel(first.id)).statusCode).toBeGreaterThanOrEqual(404);
      expect((await read()).modules.REFINERY).toBe(2);
    });

    it('rejects an id that is not one', async () => {
      expect((await cancel('nope')).statusCode).toBe(400);
      expect((await cancel(randomUUID())).statusCode).toBe(404);
    });
  });

  describe('notifications', () => {
    it('lists them newest first, and marks them seen', async () => {
      await repair('REFINERY', 2);
      advance(1);
      await worker.tick();
      const headers = bearer(token);
      const list = (await world.app.inject({ url: '/api/starter/notifications', headers })).json<{ notifications: { id: string; seen: boolean }[] }>().notifications;
      expect(list).toHaveLength(1);
      expect(list[0]!.seen).toBe(false);
      const seen = await world.app.inject({ method: 'POST', url: '/api/starter/notifications/seen', headers });
      expect(seen.statusCode).toBe(200);
      const again = (await world.app.inject({ url: '/api/starter/notifications', headers })).json<{ notifications: { seen: boolean }[] }>().notifications;
      expect(again[0]!.seen).toBe(true);
    });
  });

  describe('announcing an opening', () => {
    it('remembers what has been shown, and only known features', async () => {
      const headers = bearer(token);
      const seen = await world.app.inject({ method: 'POST', url: '/api/starter/unlocks/seen', headers, payload: { feature: 'production' } });
      expect(seen.statusCode).toBe(200);
      expect((await world.f.db.select({ seen: vessels.unlocksSeen }).from(vessels).where(eq(vessels.accountId, accountId)))[0]!.seen).toEqual(['production']);
      const bad = await world.app.inject({ method: 'POST', url: '/api/starter/unlocks/seen', headers, payload: { feature: 'clan' } });
      expect(bad.statusCode).toBe(400);
    });

    it('refuses to mark as seen what has not opened', async () => {
      const response = await world.app.inject({ method: 'POST', url: '/api/starter/unlocks/seen', headers: bearer(token), payload: { feature: 'attack' } });
      expect(response.json()).toMatchObject({ error: 'FEATURE_LOCKED' });
    });
  });

  describe('an out-of-date client', () => {
    it('is told to update, as on every other game route', async () => {
      const strict = await starterWorld({ REQUIRE_CURRENT_RULES: 'true' });
      const person = await freshAccount(strict.f, 'Strict');
      const response = await strict.app.inject({ method: 'POST', url: '/api/starter/enlist', headers: bearer(person.token) });
      expect(response.statusCode).toBe(426);
      expect(response.json()).toMatchObject({ error: 'UPDATE_REQUIRED' });
      const current = await strict.app.inject({ method: 'POST', url: '/api/starter/enlist', headers: { ...bearer(person.token), 'x-astera-rules': ECONOMY_PROFILE.id } });
      expect(current.statusCode).toBe(200);
      await strict.built.close();
    });
  });

  describe('a broken event', () => {
    it('does not stop the queue, and retries', async () => {
      await repair('REFINERY', 2);
      advance(1);
      const spy = vi.spyOn(STARTER_HANDLERS, 'vessel_order_complete').mockRejectedValueOnce(new Error('boom'));
      await expect(worker.tick()).resolves.toBeDefined();
      const [event] = await world.f.db.select().from(starterEvents);
      expect(event).toMatchObject({ status: 'pending', lastError: 'boom' });
      spy.mockRestore();
      advance(1);
      await worker.tick();
      expect((await read()).modules.REFINERY).toBe(2);
    });
  });
});
