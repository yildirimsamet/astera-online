import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { TRAVEL, UNAIDED, distance, fleetTravelExact, missionFuel } from '@astera/rules';
import { missions, planets } from '../src/db/schema.js';
import { launchTransfer } from '../src/services/movement.js';
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

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

const EMPTY = { alloy: 0, crystal: 0, deuterium: 0 };

/**
 * THE LANE THE PACE EXISTS FOR. Owner decision, 2026-09-21; review, 2026-09-22.
 *
 * A commander who is about to be asleep sends the fleet to their own colony and picks a pace that
 * lands it after they are back — the raid that arrives in between finds an empty hangar. The
 * server has accepted `pace` on a transfer since the mobility package landed, and this file did
 * not exist: the attack lane had its tests and this one did not, which is exactly the gap the
 * review walked through when it found the validation running in the wrong order.
 */
describe('the pace a transfer is flown at', () => {
  let f: Fixture;
  let mine: string;
  let colony: string;

  const span = async (): Promise<number> => {
    const rows = await f.db.select().from(planets);
    return distance(rows.find((r) => r.id === mine)!, rows.find((r) => r.id === colony)!);
  };

  const send = (pace?: number) => launchTransfer(
    f.db, f.playerIds[0]!, mine, colony, { DART: 10 }, EMPTY, f.clock, pace,
  );

  beforeEach(async () => {
    f = await seedWorld(3);
    [mine, colony] = f.planetIds as [string, string, string];
    await setLevel(f.db, mine, 'CORE', 8);
    await setLevel(f.db, colony, 'HANGAR', 3);
    await grant(f.db, mine, 200_000, 60_000);
    await levelWorld(f.db, f.planetIds);
    await f.db.update(planets)
      .set({ controllerPlayerId: f.playerIds[0]!, kind: 'COLONY' })
      .where(eq(planets.id, colony));
    await placeAt(f.db, mine, { x: 0 });
    await placeAt(f.db, colony, { x: 4_000 });
    await giveUnits(f.db, mine, { DART: 10 });
    await fuelUp(f.db, mine, 200_000);
    f.clock.advance(250);
  });

  it('flies at full speed when no pace is chosen', async () => {
    const launched = await send();
    const [row] = await f.db.select().from(missions).where(eq(missions.id, launched.missionId));
    expect(row?.pace).toBe(1);
  });

  it('lands later in exact proportion to the pace, and records it', async () => {
    const dist = await span();
    const departedAt = f.clock.now().getTime();
    const launched = await send(0.5);
    const minutes = (launched.arriveAt.getTime() - departedAt) / 60_000;
    // Date stores whole milliseconds, so the flight duration can differ by less than 1 ms.
    expect(Math.abs(minutes - fleetTravelExact(dist, { DART: 10 }, UNAIDED) * 2)).toBeLessThan(1 / 60_000);
    const [row] = await f.db.select().from(missions).where(eq(missions.id, launched.missionId));
    expect(row?.pace).toBe(0.5);
  });

  /** Time, never money — and the homeward rate, whatever the pace. */
  it('charges the same homeward fuel however slowly it is flown', async () => {
    const dist = await span();
    const launched = await send(0.25);
    const [row] = await f.db.select().from(missions).where(eq(missions.id, launched.missionId));
    expect(row?.fuelPaid).toBe(missionFuel({ DART: 10 }, dist, 1, 'HOMEWARD'));
  });

  it('refuses a pace that is not on the ladder', async () => {
    await expect(send(0.37)).rejects.toMatchObject({ code: 'BAD_PACE' });
  });

  it('refuses a pace that would keep the fleet up past the ceiling', async () => {
    await placeAt(f.db, colony, { x: 30_000 });
    const dist = await span();
    expect(fleetTravelExact(dist, { DART: 10 }, UNAIDED)).toBeLessThan(TRAVEL.pacedFlightCapMinutes);
    await expect(send(0.1)).rejects.toMatchObject({ code: 'PACE_TOO_SLOW' });
  });

  /**
   * AN ORDER THAT WAS NEVER LEGAL IS NOT "YOU CANNOT AFFORD IT". Review finding 3, 2026-09-22.
   *
   * The attack lane already checked the pace before the tank; the transfer lane checked it after,
   * so an empty tank and an impossible pace came back as INSUFFICIENT_FUEL — and the commander went
   * off to buy deuterium for an order the server would have refused anyway.
   */
  it('names a bad pace before an empty tank', async () => {
    await fuelUp(f.db, mine, 0);
    await expect(send(0.37)).rejects.toMatchObject({ code: 'BAD_PACE' });
  });

  it('names a too-slow pace before an empty tank', async () => {
    await placeAt(f.db, colony, { x: 30_000 });
    await fuelUp(f.db, mine, 0);
    await expect(send(0.1)).rejects.toMatchObject({ code: 'PACE_TOO_SLOW' });
  });

  /** And a legal pace with an empty tank is still the tank's refusal. */
  it('still refuses a legal pace on an empty tank for the fuel', async () => {
    await fuelUp(f.db, mine, 0);
    await expect(send(0.5)).rejects.toMatchObject({ code: 'INSUFFICIENT_FUEL' });
  });
});
