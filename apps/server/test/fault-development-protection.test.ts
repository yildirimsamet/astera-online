import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { BUILDING_IDS } from '@astera/rules';
import { planets, planetFaults, scheduledEvents } from '../src/db/schema.js';
import { raiseInstrument, upgradeBuilding } from '../src/services/build.js';
import { cancelBuildOrder } from '../src/services/buildQueue.js';
import { armFaults, breakFaults, onFaultSpawn } from '../src/services/faults.js';
import { loadLocked } from '../src/services/planet.js';
import { secedeColony } from '../src/services/loyalty.js';
import { giveResearch, grant, seedWorld, setLevel, settleBuilds, testDb, type Fixture } from './helpers.js';

const HOURS = 60 * 60_000;
afterAll(async () => { await (await testDb()).close(); });

describe('colony-local twelve-hour protection from accepted building orders', () => {
  let f: Fixture;
  let colony: string;
  let started: Date;

  const faults = () => f.db.select().from(planetFaults).where(eq(planetFaults.planetId, colony));
  const breakAt = (lane: 'CLOCK' | 'ATTACK', planetId = colony) => f.db.transaction(async tx => {
    await loadLocked(tx, planetId, f.clock);
    return breakFaults(tx, { seasonId: f.seasonId, planetId, now: f.clock.now(), count: 1,
      seed: `development:${f.clock.now().getTime()}`, lane });
  });
  const start = () => upgradeBuilding(f.db, colony, 'REFINERY', f.clock, f.playerIds[0]);
  const pending = () => f.db.select().from(scheduledEvents).where(and(
    eq(scheduledEvents.kind, 'fault_spawn'), eq(scheduledEvents.refId, colony),
    eq(scheduledEvents.status, 'pending'),
  ));

  beforeEach(async () => {
    f = await seedWorld(2);
    colony = f.planetIds[0]!;
    started = f.clock.now();
    for (const planetId of f.planetIds) {
      await f.db.update(planets).set({ kind: 'COLONY' }).where(eq(planets.id, planetId));
      await grant(f.db, planetId, 500_000, 200_000);
      await setLevel(f.db, planetId, 'CORE', 12);
      await setLevel(f.db, planetId, 'REFINERY', 1);
      await setLevel(f.db, planetId, 'EXTRACTOR', 1);
    }
  });

  it('publishes the deadline immediately, before construction finishes', async () => {
    const result = await start();
    expect(result.planet).toMatchObject({ faultProtectedUntil: new Date(started.getTime() + 12 * HOURS) });
    expect(result.planet.buildings.REFINERY).toBe(1);
  });

  it.each(BUILDING_IDS)('%s orders qualify as building development', async type => {
    await giveResearch(f.db, colony, 'DEUTERIUM_SYNTHESIS');
    const result = await upgradeBuilding(f.db, colony, type, f.clock, f.playerIds[0]);
    expect(result.planet).toMatchObject({ faultProtectedUntil: new Date(started.getTime() + 12 * HOURS) });
  });

  it('does not grant colony protection on the capital', async () => {
    await f.db.update(planets).set({ kind: 'CAPITAL' }).where(eq(planets.id, colony));
    expect((await start()).planet).toMatchObject({ faultProtectedUntil: null });
  });

  it('does not grant protection for instrument development', async () => {
    await raiseInstrument(f.db, colony, 'AEGIS', f.clock, f.playerIds[0]);
    expect(await breakAt('ATTACK')).toHaveLength(1);
  });

  it('keeps the earned protection after cancellation', async () => {
    const result = await start();
    const order = result.planet.queues.CONSTRUCTION[0]!;
    await cancelBuildOrder(f.db, colony, order.id, f.clock, f.playerIds[0]);
    expect(await breakAt('CLOCK')).toEqual([]);
  });

  it('completion does not restart the twelve-hour window', async () => {
    await start();
    await settleBuilds(f, colony);
    const [world] = await f.db.select().from(planets).where(eq(planets.id, colony));
    expect(world!.faultProtectedUntil).toEqual(new Date(started.getTime() + 12 * HOURS));
  });

  it('arms a colony crossing the Core gate after its protection ends', async () => {
    await setLevel(f.db, colony, 'CORE', 5);
    await upgradeBuilding(f.db, colony, 'CORE', f.clock, f.playerIds[0]);
    await settleBuilds(f, colony);
    const [event] = await pending();
    expect(event!.resolveAt.getTime()).toBeGreaterThanOrEqual(started.getTime() + 12 * HOURS);
  });

  it('does not shorten an existing longer protection', async () => {
    const until = new Date(started.getTime() + 24 * HOURS);
    await f.db.update(planets).set({ faultProtectedUntil: until }).where(eq(planets.id, colony));
    expect((await start()).planet).toMatchObject({ faultProtectedUntil: until });
  });

  it('clears protection when a colony becomes neutral', async () => {
    await f.db.update(planets).set({ kind: 'CAPITAL', controllerPlayerId: f.playerIds[0]! })
      .where(eq(planets.id, f.planetIds[1]!));
    await start();
    expect(await f.db.transaction(tx => secedeColony(tx, colony, started, colony, 'ABANDONED'))).toBe(true);
    const [world] = await f.db.select().from(planets).where(eq(planets.id, colony));
    expect(world).toMatchObject({ kind: 'NEUTRAL', faultProtectedUntil: null });
  });

  it.each(['CLOCK', 'ATTACK'] as const)('blocks %s faults until the exact deadline', async lane => {
    await start();
    f.clock.set(new Date(started.getTime() + 12 * HOURS - 1));
    expect(await breakAt(lane)).toEqual([]);
    expect(await faults()).toHaveLength(0);
    f.clock.set(new Date(started.getTime() + 12 * HOURS));
    expect(await breakAt(lane)).toHaveLength(1);
  });

  it('does not protect another colony', async () => {
    await f.db.update(planets).set({ controllerPlayerId: f.playerIds[0]! })
      .where(eq(planets.id, f.planetIds[1]!));
    await start();
    expect(await breakAt('CLOCK', f.planetIds[1])).toHaveLength(1);
  });

  it('renews protection on another accepted building order', async () => {
    await start();
    f.clock.set(new Date(started.getTime() + 2 * HOURS));
    await settleBuilds(f, colony);
    const result = await upgradeBuilding(f.db, colony, 'EXTRACTOR', f.clock, f.playerIds[0]);
    expect(result.planet).toMatchObject({ faultProtectedUntil: new Date(started.getTime() + 14 * HOURS) });
    f.clock.set(new Date(started.getTime() + 13 * HOURS));
    expect(await breakAt('ATTACK')).toEqual([]);
  });

  it('does not grant protection for a rejected order', async () => {
    await setLevel(f.db, colony, 'REFINERY', 12);
    await expect(start()).rejects.toMatchObject({ code: 'CORE_CEILING' });
    expect(await breakAt('CLOCK')).toHaveLength(1);
  });

  it('keeps existing faults in place', async () => {
    await f.db.insert(planetFaults).values({ planetId: colony, kind: 'EXTRACTOR_OUTAGE', startedAt: started });
    await start();
    expect(await breakAt('ATTACK')).toEqual([]);
    expect(await faults()).toMatchObject([{ kind: 'EXTRACTOR_OUTAGE' }]);
  });

  it('defers a previously claimed timer and redelivery cannot create a second chain', async () => {
    await f.db.transaction(tx => armFaults(tx, {
      seasonId: f.seasonId, planetId: colony, kind: 'COLONY', coreLevel: 12, now: started,
    }));
    const [event] = await pending();
    await f.db.update(scheduledEvents).set({ status: 'processing' }).where(eq(scheduledEvents.id, event!.id));
    await start();
    f.clock.set(new Date(started.getTime() + HOURS));
    const context = { db: f.db, clock: f.clock };
    await Promise.all([onFaultSpawn(context, event!), onFaultSpawn(context, event!)]);
    expect(await faults()).toHaveLength(0);
    const [next] = await pending();
    expect(await pending()).toHaveLength(1);
    expect(next!.resolveAt).toEqual(new Date(started.getTime() + 12 * HOURS));
    f.clock.set(next!.resolveAt);
    // Redelivering the old deferred event after protection expires is still harmless.
    await onFaultSpawn(context, event!);
    expect(await faults()).toHaveLength(0);
    await onFaultSpawn(context, next!);
    expect(await faults()).toHaveLength(1);
  });
});
