import { and, eq } from 'drizzle-orm';
import { vacationCost, VACATION_DAY_MS } from '@astera/rules';
import { afterAll, describe, expect, it } from 'vitest';
import { pino } from 'pino';
import { buildOrders, hpRadiationSources, missions, planetFaults, planets, players, scheduledEvents, seasons, vacations } from '../src/db/schema.js';
import { upgradeBuilding, collectWorks } from '../src/services/build.js';
import { loadLocked } from '../src/services/planet.js';
import { buildPlanetView, loadPlanetViewData } from '../src/services/planetView.js';
import { startVacation, endVacation, vacationStatus } from '../src/services/vacation.js';
import { schedulePlanetRadiation } from '../src/services/planetRadiation.js';
import { launchProbe } from '../src/services/intel.js';
import { armFaults, breakFaults } from '../src/services/faults.js';
import { EventWorker } from '../src/worker/loop.js';
import { HANDLERS } from '../src/worker/handlers.js';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import { giveUnits, seedWorld, setLevel, testDb, testEnv } from './helpers.js';

afterAll(async () => { await (await testDb()).close(); });
describe('commander vacation', () => {
  it.each([2, 24, 25])('preserves colony fault protection across return after %i hours', async hours => {
    const f = await seedWorld(2);
    const home = f.planetIds[0]!;
    const colony = f.planetIds[1]!;
    const playerId = f.playerIds[0]!;
    const entry = f.clock.now();
    const hour = 3_600_000;
    await f.db.update(planets).set({ alloy: 10000, crystal: 10000, deuterium: 1000000 });
    await f.db.update(planets).set({ kind: 'COLONY', controllerPlayerId: playerId }).where(eq(planets.id, colony));
    await setLevel(f.db, colony, 'CORE', 12);
    await upgradeBuilding(f.db, colony, 'REFINERY', f.clock, playerId);
    const originalUntil = new Date(entry.getTime() + 12 * hour);
    const quote = await vacationStatus(f.db, playerId, f.clock);
    expect(quote.blocker).toBeNull();
    const started = await startVacation(f.db, playerId, 1, quote.fingerprint,
      '00000000-0000-4000-8000-000000000030', f.clock);
    const read = () => f.db.select().from(planets).where(eq(planets.id, colony)).then(rows => rows[0]!);
    expect((await read()).faultProtectedUntil).toEqual(new Date(originalUntil.getTime() + VACATION_DAY_MS));
    expect((await f.db.select().from(planets).where(eq(planets.id, home)))[0]!.faultProtectedUntil).toBeNull();

    f.clock.advance(hours * 60);
    if (hours < 24) {
      await endVacation(f.db, playerId, started.active!.id, f.clock);
      await endVacation(f.db, playerId, started.active!.id, f.clock);
    } else {
      // Scheduled return works through the real world/view even before an end request.
      const view = await f.db.transaction(async tx => buildPlanetView(await loadPlanetViewData(tx, colony, f.clock)));
      expect(view.vacationUntil).toBeNull();
    }
    const until = new Date(originalUntil.getTime() + Math.min(hours, 24) * hour);
    expect((await read()).faultProtectedUntil).toEqual(until);
    const tryFault = () => f.db.transaction(async tx => {
      await loadLocked(tx, colony, f.clock);
      return breakFaults(tx, { seasonId: f.seasonId, planetId: colony, now: f.clock.now(),
        count: 1, seed: 'vacation-protection', lane: 'ATTACK', announce: false });
    });
    f.clock.set(new Date(until.getTime() - 1));
    expect(await tryFault()).toEqual([]);
    f.clock.set(until);
    expect(await tryFault()).toHaveLength(1);
  });

  it.each([-1, 0])('does not revive protection expiring %i ms before entry or move another commander deadline', async offset => {
    const f = await seedWorld(3);
    const home = f.planetIds[0]!;
    const colony = f.planetIds[1]!;
    const other = f.planetIds[2]!;
    const playerId = f.playerIds[0]!;
    const entry = f.clock.now();
    const expired = new Date(entry.getTime() + offset);
    const otherUntil = new Date(entry.getTime() + 12 * 3_600_000);
    await f.db.update(planets).set({ deuterium: 1000000 }).where(eq(planets.id, home));
    await f.db.update(planets).set({ kind: 'COLONY', controllerPlayerId: playerId, faultProtectedUntil: expired })
      .where(eq(planets.id, colony));
    await f.db.update(planets).set({ kind: 'COLONY', faultProtectedUntil: otherUntil }).where(eq(planets.id, other));
    const quote = await vacationStatus(f.db, playerId, f.clock);
    const started = await startVacation(f.db, playerId, 1, quote.fingerprint,
      '00000000-0000-4000-8000-000000000031', f.clock);
    f.clock.advance(120);
    await endVacation(f.db, playerId, started.active!.id, f.clock);
    const [own] = await f.db.select().from(planets).where(eq(planets.id, colony));
    const [foreign] = await f.db.select().from(planets).where(eq(planets.id, other));
    expect(own!.faultProtectedUntil).toEqual(expired);
    expect(foreign!.faultProtectedUntil).toEqual(otherUntil);
  });

  it('serializes vacation admission behind a running completion without a nested-lock deadlock', async () => {
    const f = await seedWorld(1);
    const id = f.planetIds[0]!;
    const playerId = f.playerIds[0]!;
    await f.db.update(planets).set({ alloy: 5000, crystal: 5000, deuterium: 10000 });
    await setLevel(f.db, id, 'CORE', 4);
    await upgradeBuilding(f.db, id, 'REFINERY', f.clock);
    const q = await vacationStatus(f.db, playerId, f.clock);
    const [order] = await f.db.select().from(buildOrders);
    let reached: () => void = () => undefined;
    let release: () => void = () => undefined;
    const entered = new Promise<void>(resolve => { reached = resolve; });
    const proceed = new Promise<void>(resolve => { release = resolve; });
    const original = HANDLERS.build_complete!;
    HANDLERS.build_complete = async (ctx, event) => { reached(); await proceed; await original(ctx, event); };
    try {
      f.clock.set(order!.readyAt);
      const worker = new EventWorker(f.db, f.clock, { pollMs: 1000, batch: 100, staleMinutes: 5 }, pino({ level: 'silent' }));
      const tick = worker.tick();
      await entered;
      const purchase = startVacation(f.db, playerId, 1, q.fingerprint, '00000000-0000-4000-8000-000000000022', f.clock);
      await new Promise(resolve => { setTimeout(resolve, 50); });
      release();
      const [processed, started] = await Promise.all([tick, purchase]);
      expect(processed.failed).toBe(0);
      expect(started.active).not.toBeNull();
    } finally { release(); HANDLERS.build_complete = original; }
  });
  it('freezes radiation damage and never schedules a new damage boundary inside the vacation', async () => {
    const f = await seedWorld(1);
    const id = f.planetIds[0]!;
    const playerId = f.playerIds[0]!;
    await f.db.update(seasons).set({ rulesetVersion: 18, radiationBombStartsAt: f.clock.now() }).where(eq(seasons.id, f.seasonId));
    await f.db.update(planets).set({ deuterium: 10000 });
    await giveUnits(f.db, id, { CITADEL: 1 });
    const [home] = await f.db.select().from(planets).where(eq(planets.id, id));
    await f.db.insert(hpRadiationSources).values({ seasonId: f.seasonId, origin: 'ENVIRONMENT', anchorKind: 'PLANET', anchorId: id,
      x: home!.x, y: home!.y, z: home!.z, radius: 100, mode: 'EMIT', intensityHpPerMinute: 50,
      activeFrom: f.clock.now(), activeUntil: new Date(f.clock.now().getTime() + 7 * VACATION_DAY_MS) });
    const q = await vacationStatus(f.db, playerId, f.clock);
    const started = await startVacation(f.db, playerId, 1, q.fingerprint, '00000000-0000-4000-8000-000000000020', f.clock);
    await f.db.transaction(async tx => {
      const [world] = await tx.select().from(planets).where(eq(planets.id, id));
      const [season] = await tx.select().from(seasons).where(eq(seasons.id, f.seasonId));
      await schedulePlanetRadiation(tx, world!, season!, f.clock.now());
    });
    const damageEvents = await f.db.select().from(scheduledEvents).where(and(eq(scheduledEvents.refId, id), eq(scheduledEvents.kind, 'planet_radiation_boundary'), eq(scheduledEvents.status, 'pending')));
    expect(damageEvents.every(e => e.resolveAt >= started.active!.endsAt)).toBe(true);
    f.clock.advance(12 * 60);
    const frozen = await f.db.transaction(tx => loadLocked(tx, id, f.clock));
    expect(frozen.homeFleet.CITADEL).toBe(1);
    expect(frozen.homeDamage).toEqual([]);
    await endVacation(f.db, playerId, started.active!.id, f.clock);
    f.clock.advance(1);
    const resumed = await f.db.transaction(tx => loadLocked(tx, id, f.clock));
    expect(resumed.homeDamage).toHaveLength(1);
  });
  it('preserves personal shield delay and queued completion through early return', async () => {
    const f = await seedWorld(1);
    const id = f.planetIds[0]!;
    const playerId = f.playerIds[0]!;
    const entry = f.clock.now();
    const shieldReady = new Date(entry.getTime() + 3_600_000);
    await f.db.update(planets).set({ alloy: 5000, crystal: 5000, deuterium: 10000, shieldRegenAt: shieldReady }).where(eq(planets.id, id));
    await setLevel(f.db, id, 'CORE', 4);
    await upgradeBuilding(f.db, id, 'REFINERY', f.clock);
    const [order] = await f.db.select().from(buildOrders);
    const q = await vacationStatus(f.db, playerId, f.clock);
    const started = await startVacation(f.db, playerId, 1, q.fingerprint, '00000000-0000-4000-8000-000000000021', f.clock);
    const [paused] = await f.db.select().from(planets);
    expect(paused?.shieldRegenAt).toEqual(new Date(shieldReady.getTime() + VACATION_DAY_MS));
    f.clock.advance(120);
    await endVacation(f.db, playerId, started.active!.id, f.clock);
    const [resumed] = await f.db.select().from(planets);
    expect(resumed?.shieldRegenAt).toEqual(new Date(shieldReady.getTime() + 2 * 3_600_000));
    const worker = new EventWorker(f.db, f.clock, { pollMs: 1000, batch: 100, staleMinutes: 5 }, pino({ level: 'silent' }));
    f.clock.set(new Date(order!.readyAt.getTime() + 2 * 3_600_000));
    expect((await worker.tick()).failed).toBe(0);
    expect((await f.db.select().from(buildOrders))[0]?.status).toBe('COMPLETED');
    expect((await f.db.transaction(tx => loadLocked(tx, id, f.clock))).buildings.REFINERY).toBe(2);
  });
  it('blocks incoming probes and every gameplay API mutation while retaining reads and early return', async () => {
    const f = await seedWorld(2);
    const playerId = f.playerIds[0]!;
    await f.db.update(planets).set({ deuterium: 10000, alloy: 10000, crystal: 10000 });
    const q = await vacationStatus(f.db, playerId, f.clock);
    const started = await startVacation(f.db, playerId, 1, q.fingerprint, '00000000-0000-4000-8000-000000000010', f.clock);
    await expect(launchProbe(f.db, f.planetIds[1]!, f.planetIds[0]!, f.clock)).rejects.toMatchObject({ code: 'TARGET_VACATION' });
    const built = buildApp({ db: f.db, clock: f.clock, env: testEnv(), logger: pino({ level: 'silent' }) });
    try {
      await built.app.ready();
      const headers = { authorization: `Bearer ${await new TokenService('test-secret-that-is-long-enough', 15, 30).issueAccess(f.accountIds[0]!)}` };
      expect((await built.app.inject({ method: 'GET', url: '/api/planet', headers })).statusCode).toBe(200);
      const denied = await built.app.inject({ method: 'POST', url: '/api/planet/collect', headers });
      expect(denied.statusCode).toBe(409);
      expect(denied.json()).toMatchObject({ error: 'VACATION_ACTIVE' });
      expect((await built.app.inject({ method: 'POST', url: '/api/vacation/end', headers, payload: { vacationId: started.active!.id } })).statusCode).toBe(200);
    } finally { await built.close(); }
  });
  it('waits for incoming flights and atomically buys every colony, freezing faults and loyalty', async () => {
    const f = await seedWorld(3);
    const [home, colony, enemy] = f.planetIds;
    const playerId = f.playerIds[0]!;
    await f.db.update(planets).set({ deuterium: 100000, alloy: 10000, crystal: 10000 });
    await f.db.update(planets).set({ kind: 'COLONY', controllerPlayerId: playerId, loyalty: 60 }).where(eq(planets.id, colony!));
    await setLevel(f.db, colony!, 'CORE', 12);
    await setLevel(f.db, colony!, 'DEUTERIUM_PLANT', 6);
    await f.db.insert(planetFaults).values({ planetId: colony!, kind: 'REFINERY_OUTAGE', startedAt: f.clock.now() });
    await f.db.transaction(tx => armFaults(tx, { seasonId: f.seasonId, planetId: colony!, kind: 'COLONY', coreLevel: 12, now: f.clock.now() }));
    const sent = await launchProbe(f.db, enemy!, home!, f.clock);
    expect((await vacationStatus(f.db, playerId, f.clock)).blocker).toBe('VACATION_FLIGHTS');
    const worker = new EventWorker(f.db, f.clock, { pollMs: 1000, batch: 100, staleMinutes: 5 }, pino({ level: 'silent' }));
    f.clock.set(sent.arriveAt);
    expect((await worker.tick()).failed).toBe(0);
    const [returning] = await f.db.select().from(missions).where(eq(missions.status, 'in_flight'));
    if (returning) {
      f.clock.set(returning.arriveAt);
      expect((await worker.tick()).failed).toBe(0);
    }
    const q = await vacationStatus(f.db, playerId, f.clock, 2);
    expect(q.blocker).toBeNull();
    expect(q.price?.worlds).toHaveLength(2);
    const started = await startVacation(f.db, playerId, 2, q.fingerprint, '00000000-0000-4000-8000-000000000011', f.clock);
    const before = await f.db.transaction(tx => loadLocked(tx, colony!, f.clock));
    f.clock.set(new Date(f.clock.now().getTime() + VACATION_DAY_MS));
    expect((await worker.tick()).failed).toBe(0);
    const frozen = await f.db.transaction(tx => loadLocked(tx, colony!, f.clock));
    expect(frozen.loyalty).toBe(before.loyalty);
    expect(frozen.faults).toEqual(before.faults);
    expect(frozen.vacationUntil).toEqual(started.active?.endsAt);
    await endVacation(f.db, playerId, started.active!.id, f.clock);
    f.clock.advance(60);
    const resumed = await f.db.transaction(tx => loadLocked(tx, colony!, f.clock));
    expect(resumed.loyalty).toBeLessThan(before.loyalty);
  });
  it('retries and concurrent purchases debit once, and an old end request cannot close a newer vacation', async () => {
    const f = await seedWorld(1);
    const playerId = f.playerIds[0]!;
    await f.db.update(planets).set({ deuterium: 10000 });
    const q = await vacationStatus(f.db, playerId, f.clock);
    const requestId = '00000000-0000-4000-8000-000000000012';
    const results = await Promise.all([startVacation(f.db, playerId, 1, q.fingerprint, requestId, f.clock), startVacation(f.db, playerId, 1, q.fingerprint, requestId, f.clock)]);
    expect(results[0].active?.id).toBe(results[1].active?.id);
    expect(await f.db.select().from(vacations)).toHaveLength(1);
    const [paid] = await f.db.select().from(planets);
    expect(paid?.deuterium).toBe(10000 - q.price!.total);
    await endVacation(f.db, playerId, results[0].active!.id, f.clock);
    const nextQuote = await vacationStatus(f.db, playerId, f.clock);
    const next = await startVacation(f.db, playerId, 1, nextQuote.fingerprint, '00000000-0000-4000-8000-000000000013', f.clock);
    const old = await endVacation(f.db, playerId, results[0].active!.id, f.clock);
    expect(old.active?.id).toBe(next.active?.id);
  });
  it('pays from store then buffer, freezes production and orders, and resumes on early return without refund', async () => {
    const f = await seedWorld(1);
    const id = f.planetIds[0]!;
    const playerId = f.playerIds[0]!;
    await setLevel(f.db, id, 'CORE', 4);
    await f.db.update(planets).set({ alloy: 5000, crystal: 5000, deuterium: 1, bufferDeuterium: 5000 }).where(eq(planets.id, id));
    await upgradeBuilding(f.db, id, 'REFINERY', f.clock);
    const [order] = await f.db.select().from(buildOrders);
    const quote = await vacationStatus(f.db, playerId, f.clock, 2);
    const expected = vacationCost(2, [{ id, coreLevel: 4, capital: true }]).total;
    expect(quote.price?.total).toBe(expected);
    const started = await startVacation(f.db, playerId, 2, quote.fingerprint, '00000000-0000-4000-8000-000000000001', f.clock);
    expect(started.active).not.toBeNull();
    const [paid] = await f.db.select().from(planets).where(eq(planets.id, id));
    expect(paid?.deuterium).toBe(0);
    expect(paid?.bufferDeuterium).toBe(5001 - expected);
    await expect(collectWorks(f.db, id, f.clock)).rejects.toMatchObject({ code: 'VACATION_ACTIVE' });
    f.clock.set(new Date(f.clock.now().getTime() + VACATION_DAY_MS));
    const frozen = await f.db.transaction(tx => loadLocked(tx, id, f.clock));
    expect(frozen.bufferDeuterium).toBe(paid?.bufferDeuterium);
    expect(frozen.bufferAlloy).toBe(paid?.bufferAlloy);
    const view = await f.db.transaction(async tx => buildPlanetView(await loadPlanetViewData(tx, id, f.clock)));
    expect(view.planet.alloyPerHour).toBe(0);
    const ended = await endVacation(f.db, playerId, started.active!.id, f.clock);
    expect(ended.active).toBeNull();
    const [resumed] = await f.db.select().from(buildOrders).where(eq(buildOrders.id, order!.id));
    expect(resumed!.readyAt.getTime()).toBe(order!.readyAt.getTime() + VACATION_DAY_MS);
    const [balance] = await f.db.select().from(planets).where(eq(planets.id, id));
    expect(balance?.bufferDeuterium).toBe(paid?.bufferDeuterium);
    const [player] = await f.db.select().from(players).where(eq(players.id, playerId));
    expect(player?.silentSpaceResetAt).toEqual(f.clock.now());
    await expect(collectWorks(f.db, id, f.clock)).resolves.toBeDefined();
  });
  it('is all-or-nothing on insufficient funds and rejects stale prices', async () => {
    const f = await seedWorld(1);
    const playerId = f.playerIds[0]!;
    const id = f.planetIds[0]!;
    await f.db.update(planets).set({ deuterium: 0, bufferDeuterium: 0 }).where(eq(planets.id, id));
    const quote = await vacationStatus(f.db, playerId, f.clock, 1);
    await expect(startVacation(f.db, playerId, 1, quote.fingerprint, '00000000-0000-4000-8000-000000000002', f.clock)).rejects.toMatchObject({ code: 'VACATION_FUNDS' });
    await f.db.update(planets).set({ deuterium: 10000 }).where(eq(planets.id, id));
    await setLevel(f.db, id, 'CORE', 3);
    await expect(startVacation(f.db, playerId, 1, quote.fingerprint, '00000000-0000-4000-8000-000000000003', f.clock)).rejects.toMatchObject({ code: 'VACATION_QUOTE_CHANGED' });
    expect((await vacationStatus(f.db, playerId, f.clock, 1)).active).toBeNull();
  });
  it('preserves the last 24 hours and automatically resumes production at the exact end without a worker', async () => {
    const f = await seedWorld(1);
    const playerId = f.playerIds[0]!;
    const id = f.planetIds[0]!;
    await f.db.update(seasons).set({ endsAt: new Date(f.clock.now().getTime() + 2 * VACATION_DAY_MS) }).where(eq(seasons.id, f.seasonId));
    await f.db.update(planets).set({ deuterium: 10000 }).where(eq(planets.id, id));
    const q = await vacationStatus(f.db, playerId, f.clock, 1);
    expect(q.maxDays).toBe(1);
    await expect(startVacation(f.db, playerId, 2, q.fingerprint, '00000000-0000-4000-8000-000000000004', f.clock)).rejects.toMatchObject({ code: 'VACATION_DURATION' });
    const started = await startVacation(f.db, playerId, 1, q.fingerprint, '00000000-0000-4000-8000-000000000005', f.clock);
    const finish = started.active!.endsAt;
    f.clock.set(new Date(finish.getTime() + 3_600_000));
    expect((await vacationStatus(f.db, playerId, f.clock, 1)).active).toBeNull();
    const p = await f.db.transaction(tx => loadLocked(tx, id, f.clock));
    expect(p.bufferAlloy).toBeGreaterThan(0);
    expect(p.vacationUntil).toBeNull();
    expect(await f.db.select().from(buildOrders).where(and(eq(buildOrders.planetId, id), eq(buildOrders.status, 'BUILDING')))).toHaveLength(0);
  });
});
