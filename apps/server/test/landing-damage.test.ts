import { and, eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { DamageLot, Fleet, HullId } from '@astera/rules';
import { missions, planets, scheduledEvents, units } from '../src/db/schema.js';
import { launchTransfer, recallFlight } from '../src/services/movement.js';
import { dockLotsOf } from '../src/services/shipDamage.js';
import { abandon } from '../src/worker/abandon.js';
import { EventWorker } from '../src/worker/loop.js';
import {
  fuelUp,
  giveUnits,
  grant,
  levelWorld,
  placeAt,
  seedWorld,
  setLevel,
  testDb,
  type Fixture,
} from './helpers.js';

/**
 * EVERY LANDING CARRIES ITS DAMAGE. Kalıcı gemi hasarı, `plan.md` F3.
 *
 * Only a battle or radiation damages a ship, and a transfer fights nothing — so on these
 * lanes the damage is radiation's (F9), written here straight onto the flying leg. What
 * this pins is the landing itself: wherever the ships come down, on a delivery, a round
 * trip, a recall, a reroute or a leg the server gives up on, the Repair Station judges
 * what they carry. A landing that dropped it would be a free repair.
 */

const silent = pino({ level: 'silent' });
const EMPTY = { alloy: 0, crystal: 0, deuterium: 0 };
const lot = (hull: HullId, count: number, damageBp: number): DamageLot => ({ hull, count, damageBp });

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

describe('landing a damaged fleet', () => {
  let f: Fixture;
  let mine: string;
  let colony: string;

  const worker = () => new EventWorker(f.db, f.clock, { pollMs: 1, batch: 100, staleMinutes: 5 }, silent);

  const homeOf = async (planetId: string): Promise<Fleet> => {
    const rows = await f.db.select().from(units)
      .where(and(eq(units.planetId, planetId), eq(units.location, 'home')));
    const out: Fleet = {};
    for (const row of rows) if (row.count > 0) out[row.hull] = row.count;
    return out;
  };

  const dockOf = async (planetId: string) =>
    (await dockLotsOf(f.db, planetId)).map(({ hull, count, damageBp }) => ({ hull, count, damageBp }));

  /** Radiation's work, done by hand until F9 does it in the air. */
  const irradiate = (missionId: string, lots: DamageLot[]) =>
    f.db.update(missions).set({ damage: lots }).where(eq(missions.id, missionId));

  beforeEach(async () => {
    f = await seedWorld(3);
    [mine, colony] = f.planetIds as [string, string];
    await setLevel(f.db, mine, 'CORE', 8);
    await setLevel(f.db, colony, 'HANGAR', 3);
    await grant(f.db, mine, 200_000, 60_000);
    await levelWorld(f.db, f.planetIds);
    await f.db.update(planets)
      .set({ controllerPlayerId: f.playerIds[0]!, kind: 'COLONY' })
      .where(eq(planets.id, colony));
    await placeAt(f.db, mine, { x: 0 });
    await placeAt(f.db, colony, { x: 4_000 });
    await giveUnits(f.db, mine, { DART: 10, COURIER: 4 });
    await fuelUp(f.db, mine, 200_000);
    f.clock.advance(250);
  });

  it('docks a transfer\'s badly damaged ships at the world it reaches', async () => {
    const launched = await launchTransfer(f.db, f.playerIds[0]!, mine, colony, { DART: 10 }, EMPTY, f.clock);
    await irradiate(launched.missionId, [lot('DART', 3, 6000), lot('DART', 1, 1500)]);
    f.clock.set(launched.arriveAt);
    await worker().tick();

    expect((await homeOf(colony)).DART).toBe(7);
    expect(await dockOf(colony)).toEqual([lot('DART', 3, 6000)]);
  });

  it('splits a round trip by hull: the staying hulls land their damage, the returning carry theirs', async () => {
    const launched = await launchTransfer(
      f.db, f.playerIds[0]!, mine, colony, { DART: 6, COURIER: 2 }, EMPTY, f.clock, 1,
      { cargoShips: 'RETURN', otherShips: 'STAY' },
    );
    await irradiate(launched.missionId, [lot('DART', 2, 6000), lot('COURIER', 1, 7000)]);
    f.clock.set(launched.arriveAt);
    await worker().tick();

    expect((await homeOf(colony)).DART).toBe(4);
    expect(await dockOf(colony)).toEqual([lot('DART', 2, 6000)]);
    const [back] = await f.db.select().from(missions)
      .where(and(eq(missions.parentMissionId, launched.missionId), eq(missions.status, 'in_flight')));
    expect(back?.damage).toEqual([lot('COURIER', 1, 7000)]);

    f.clock.set(back!.arriveAt);
    await worker().tick();
    expect(await dockOf(mine)).toEqual([lot('COURIER', 1, 7000)]);
    expect((await homeOf(mine)).COURIER).toBe(3);
  });

  it('brings a recalled flight home with what it carries', async () => {
    const launched = await launchTransfer(f.db, f.playerIds[0]!, mine, colony, { DART: 10 }, EMPTY, f.clock);
    await irradiate(launched.missionId, [lot('DART', 2, 4500)]);
    f.clock.advance(1);
    const recall = await recallFlight(f.db, launched.missionId, f.clock, f.playerIds[0]!);
    f.clock.set(new Date(recall.arriveAt.getTime() + 1_000));
    await worker().tick();

    expect((await homeOf(mine)).DART).toBe(8);
    expect(await dockOf(mine)).toEqual([lot('DART', 2, 4500)]);
  });

  it('carries the damage onto a reroute when the world it flew to is gone', async () => {
    const launched = await launchTransfer(f.db, f.playerIds[0]!, mine, colony, { DART: 10 }, EMPTY, f.clock);
    await irradiate(launched.missionId, [lot('DART', 1, 8000)]);
    await f.db.update(planets).set({ controllerPlayerId: f.playerIds[1]! }).where(eq(planets.id, colony));
    f.clock.set(launched.arriveAt);
    await worker().tick();

    const [reroute] = await f.db.select().from(missions)
      .where(and(eq(missions.parentMissionId, launched.missionId), eq(missions.status, 'in_flight')));
    expect(reroute?.damage).toEqual([lot('DART', 1, 8000)]);
    f.clock.set(reroute!.arriveAt);
    await worker().tick();
    expect(await dockOf(mine)).toEqual([lot('DART', 1, 8000)]);
  });

  it('never repairs a stranded fleet for free when the server gives up on its leg', async () => {
    const launched = await launchTransfer(f.db, f.playerIds[0]!, mine, colony, { DART: 10 }, EMPTY, f.clock);
    await irradiate(launched.missionId, [lot('DART', 4, 5500)]);
    const [event] = await f.db.select().from(scheduledEvents)
      .where(eq(scheduledEvents.refId, launched.missionId));
    expect(await abandon(f.db, event!, f.clock)).toBe(true);

    expect((await homeOf(mine)).DART).toBe(6);
    expect(await dockOf(mine)).toEqual([lot('DART', 4, 5500)]);
  });
});
