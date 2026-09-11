import { eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { BUILDING_IDS, HULLS, groundLoad, groundSlots, hullBulk } from '@astera/rules';
import { missions, planets, units } from '../src/db/schema.js';
import { buildUnits } from '../src/services/build.js';
import { launchTransfer } from '../src/services/movement.js';
import { planetView } from '../src/services/planetView.js';
import { EventWorker } from '../src/worker/loop.js';
import { giveUnits, grant, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

const silent = pino({ level: 'silent' });
const workerFor = (f: Fixture) =>
  new EventWorker(f.db, f.clock, { pollMs: 1, batch: 100, staleMinutes: 5 }, silent);

async function fleetAt(f: Fixture, planetId: string): Promise<Record<string, number>> {
  const rows = await f.db.select().from(units).where(eq(units.planetId, planetId));
  const out: Record<string, number> = {};
  for (const row of rows) out[row.hull] = (out[row.hull] ?? 0) + row.count;
  return out;
}

async function handTo(f: Fixture, planetId: string, playerIndex: number): Promise<void> {
  const playerId = f.playerIds[playerIndex]!;
  await f.db
    .update(planets)
    .set({ controllerPlayerId: playerId, kind: 'COLONY' })
    .where(eq(planets.id, planetId));
  await f.db.update(units).set({ ownerPlayerId: playerId }).where(eq(units.planetId, planetId));
}

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

/**
 * A FLEET IS BOUNDED BY A PURSE, NOT BY A BUILDING. D184, reversing T4.
 *
 * T4 gave the fleet a ceiling because "how many more can I afford" felt like too
 * thin a question. The Hangar that answered it grew geometrically against a
 * capacity that grew by a flat eighty a rung — the eighth cost more alloy than a
 * whole season produces and bought room for twenty-six Darts — so what it actually
 * taught was "stop and raise the warehouse", which is a tax rather than a decision.
 *
 * THE THREE BRAKES THAT REMAIN ARE THE HONEST ONES: a hull is paid for, a flight
 * burns fuel, and a fleet that loses is gone. Emplacements keep their ceiling, and
 * that asymmetry is deliberate — a gun never moves, salvages at 60%, leaves no
 * wreckage and cannot be counter-raided, so an uncapped wall inside D168's tier
 * band would be a world nobody legally able to attack it could break.
 */
describe('the fleet has no ceiling', () => {
  let f: Fixture;
  let home: string;
  let colony: string;

  beforeEach(async () => {
    f = await seedWorld(3);
    [home, colony] = f.planetIds as [string, string, string];
    await handTo(f, colony, 0);
    for (const id of [home, colony]) {
      await setLevel(f.db, id, 'CORE', 10);
      await setLevel(f.db, id, 'SHIPYARD', 4);
      await grant(f.db, id, 2_000_000, 600_000);
      await f.db.delete(units).where(eq(units.planetId, id));
    }
  });

  it('is not a building any more', () => {
    expect(BUILDING_IDS).not.toContain('HANGAR');
  });

  describe('building a ship', () => {
    it('accepts an order far past what any Hangar ever held', async () => {
      await expect(buildUnits(f.db, home, 'DART', 400, f.clock)).resolves.toBeTruthy();
    });

    it('accepts a second order on top of a world already full of hulls', async () => {
      await giveUnits(f.db, home, { DART: 500 });
      await expect(buildUnits(f.db, home, 'DART', 50, f.clock)).resolves.toBeTruthy();
    });

    /** The purse is the brake, and it still refuses — with a price, not a ceiling. */
    it('still refuses what the world cannot pay for', async () => {
      await grant(f.db, home, 10, 10);
      await expect(buildUnits(f.db, home, 'DART', 500, f.clock)).rejects.toMatchObject({
        code: 'INSUFFICIENT_RESOURCES',
      });
    });
  });

  describe('ground emplacements keep theirs', () => {
    it('refuses a gun the world has no room to stand', async () => {
      await setLevel(f.db, home, 'CORE', 10);
      const room = groundSlots(10);
      await giveUnits(f.db, home, { THORN: Math.floor(room / hullBulk('THORN')) });

      await expect(buildUnits(f.db, home, 'BASTION', 1, f.clock)).rejects.toMatchObject({
        code: 'GROUND_SLOTS_FULL',
        params: { capacity: room },
      });
    });

    it('raising the Core opens more ground', async () => {
      await setLevel(f.db, home, 'CORE', 6);
      await giveUnits(f.db, home, { THORN: Math.floor(groundSlots(6) / hullBulk('THORN')) });
      await expect(buildUnits(f.db, home, 'THORN', 1, f.clock)).rejects.toMatchObject({
        code: 'GROUND_SLOTS_FULL',
      });

      await setLevel(f.db, home, 'CORE', 12);
      await expect(buildUnits(f.db, home, 'THORN', 1, f.clock)).resolves.toBeTruthy();
    });

    /** A world packed with guns can still build ships, and a fleet never eats ground. */
    it('spends neither pool on the other', async () => {
      await setLevel(f.db, home, 'CORE', 10);
      await giveUnits(f.db, home, { DART: 400 });
      await expect(buildUnits(f.db, home, 'THORN', 1, f.clock)).resolves.toBeTruthy();

      const fresh = f.planetIds[2]!;
      await setLevel(f.db, fresh, 'CORE', 10);
      await setLevel(f.db, fresh, 'SHIPYARD', 4);
      await grant(f.db, fresh, 2_000_000, 600_000);
      await f.db.delete(units).where(eq(units.planetId, fresh));
      await giveUnits(f.db, fresh, { THORN: Math.floor(groundSlots(10) / hullBulk('THORN')) });
      await expect(buildUnits(f.db, fresh, 'DART', 1, f.clock)).resolves.toBeTruthy();
    });
  });

  describe('arriving by transfer', () => {
    /**
     * The refusal this replaces was `TARGET_HANGAR_FULL`, and it was the worst one
     * in the game: a launch is committed, cannot be recalled, and the destination
     * could fill while the squadron was in the air. There is nothing left to fill.
     */
    it('lands a squadron however full the destination already is', async () => {
      await giveUnits(f.db, colony, { DART: 600 });
      await giveUnits(f.db, home, { DART: 5 });

      const launched = await launchTransfer(
        f.db,
        f.playerIds[0]!,
        home,
        colony,
        { DART: 5 },
        { alloy: 0, crystal: 0, deuterium: 0 },
        f.clock,
      );
      expect(await f.db.select().from(missions)).toHaveLength(1);
      f.clock.set(launched.arriveAt);
      await workerFor(f).tick();

      expect((await fleetAt(f, colony)).DART).toBe(605);
    });
  });

  /**
   * The order screen must not offer a control the server will refuse, so the one
   * surviving ceiling still reaches the client — and the one that is gone must not
   * linger in the payload as a field nothing can fill.
   */
  it('reports the ground ceiling to the client, and nothing else', async () => {
    await setLevel(f.db, home, 'CORE', 10);
    await giveUnits(f.db, home, { DART: 7, BASTION: 1 });

    const view = await f.db.transaction((tx) => planetView(tx, home, f.clock));

    expect(view.capacity).toEqual({
      ground: groundSlots(10),
      groundUsed: groundLoad({ BASTION: 1 }),
    });
    expect(HULLS.BASTION.ground).toBe(true);
  });
});
