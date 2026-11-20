import { eq } from 'drizzle-orm';
import { INSTANT_BUILD, buildMinutes, buildingMinutes, hullWorkMinutes, instrumentCost } from '@astera/rules';
import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildOrders, planets, scheduledEvents } from '../src/db/schema.js';
import { buildUnits, raiseInstrument, upgradeBuilding } from '../src/services/build.js';
import { loadLocked } from '../src/services/planet.js';
import { EventWorker } from '../src/worker/loop.js';
import { seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

/**
 * THE FIVE-MINUTE RULE ON THE SERVER (owner, 2026-11-20; plan §5.6, Faz 2b). An upgrade of five minutes or
 * less finishes in the answer that ordered it when its queue is free, and a second after the order ahead
 * of it otherwise. Every gate an order passes still applies.
 */
const silent = pino({ level: 'silent' });
const worker = (f: Fixture) => new EventWorker(f.db, f.clock, { pollMs: 1000, batch: 100, staleMinutes: 5 }, silent);

afterAll(async () => { await (await testDb()).close(); });

describe('the five-minute rule', () => {
  let f: Fixture;
  let planetId: string;

  beforeEach(async () => {
    f = await seedWorld(1);
    planetId = f.planetIds[0]!;
    await setLevel(f.db, planetId, 'CORE', 3);
    await setLevel(f.db, planetId, 'REFINERY', 2);
    await setLevel(f.db, planetId, 'VAULT', 1);
    await setLevel(f.db, planetId, 'SHIPYARD', 1);
    // Written straight into the row: `grant` raises the producers and the Core to hold its purse.
    await purse(50_000);
  });

  const purse = (amount: number) => f.db.update(planets).set({ alloy: amount, crystal: amount, deuterium: amount })
    .where(eq(planets.id, planetId));

  const orders = () => f.db.select().from(buildOrders).where(eq(buildOrders.planetId, planetId));
  const completions = () => f.db.select().from(scheduledEvents).where(eq(scheduledEvents.kind, 'build_complete'));

  it('finishes an upgrade of five minutes or less in the answer that ordered it, on a free queue', async () => {
    expect(buildingMinutes('VAULT', 2, {})).toBeLessThanOrEqual(INSTANT_BUILD.maxMinutes);
    const before = await f.db.transaction(tx => loadLocked(tx, planetId, f.clock));
    const placed = await upgradeBuilding(f.db, planetId, 'VAULT', f.clock);
    expect(placed.level).toBe(2);
    expect(placed.planet.buildings.VAULT).toBe(2);
    expect(placed.planet.queues.CONSTRUCTION).toHaveLength(0);
    expect(placed.alloy).toBeLessThan(before.alloy);
    expect((await orders()).map(order => order.status)).toEqual(['COMPLETED']);
    expect(await completions()).toHaveLength(0);
  });

  it('keeps the clock of an upgrade longer than five minutes', async () => {
    const minutes = buildingMinutes('REFINERY', 3, {});
    expect(minutes).toBeGreaterThan(INSTANT_BUILD.maxMinutes);
    const placed = await upgradeBuilding(f.db, planetId, 'REFINERY', f.clock);
    expect(placed.planet.buildings.REFINERY).toBe(2);
    const [order] = await orders();
    expect(order!.status).toBe('BUILDING');
    expect(order!.readyAt.getTime() - f.clock.now().getTime()).toBe(Math.ceil(minutes * 60) * 1_000);
  });

  it('finishes a short upgrade a second after the order ahead of it', async () => {
    await upgradeBuilding(f.db, planetId, 'REFINERY', f.clock);
    const placed = await upgradeBuilding(f.db, planetId, 'VAULT', f.clock);
    expect(placed.planet.buildings.VAULT).toBe(1);
    const [refinery, vault] = (await orders()).toSorted((a, b) => a.slot - b.slot);
    expect(vault!.readyAt.getTime() - refinery!.readyAt.getTime()).toBe(1_000);
    f.clock.set(vault!.readyAt);
    await worker(f).tick();
    await worker(f).tick();
    const world = await f.db.transaction(tx => loadLocked(tx, planetId, f.clock));
    expect([world.buildings.REFINERY, world.buildings.VAULT]).toEqual([3, 2]);
  });

  it('raises an instrument of five minutes or less at once', async () => {
    // A Core high enough that the Veil's first rung fits under the line: the rule reads the real quote.
    let core = 3;
    while (buildMinutes(instrumentCost('VEIL', 0), core, {}) > INSTANT_BUILD.maxMinutes) core += 1;
    await setLevel(f.db, planetId, 'CORE', core);
    const raised = await raiseInstrument(f.db, planetId, 'VEIL', f.clock);
    expect(raised.planet.instruments.VEIL).toBe(1);
    expect((await orders()).map(order => order.status)).toEqual(['COMPLETED']);
  });

  it('leaves ships on their clock however short', async () => {
    expect(hullWorkMinutes('DART', 1, 1, {})).toBeLessThanOrEqual(INSTANT_BUILD.maxMinutes);
    const placed = await buildUnits(f.db, planetId, 'DART', 1, f.clock);
    expect(placed.planet.fleet.DART ?? 0).toBe(0);
    expect((await orders()).map(order => order.status)).toEqual(['BUILDING']);
  });

  it('still asks for the Core, the resources and a free slot in the queue', async () => {
    await setLevel(f.db, planetId, 'VAULT', 3);
    await expect(upgradeBuilding(f.db, planetId, 'VAULT', f.clock)).rejects.toMatchObject({ code: 'CORE_CEILING' });
    await setLevel(f.db, planetId, 'VAULT', 1);
    await purse(0);
    await expect(upgradeBuilding(f.db, planetId, 'VAULT', f.clock)).rejects.toMatchObject({ code: 'INSUFFICIENT_RESOURCES' });
    expect(await orders()).toHaveLength(0);
  });
});
