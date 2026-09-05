import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { GALAXY_EVENTS, SERVERS, TRADE, type Fleet } from '@astera/rules';
import {
  galaxyEventOccurrences,
  planets,
  players,
  seasons,
  tradeRuns,
  units,
} from '../src/db/schema.js';
import { minutesSince } from '../src/clock.js';
import { tradeShipOf } from '../src/services/tradeField.js';
import { dockEndsAt, launchTrade, tradeLocation } from '../src/services/trade.js';
import { transferPlanetControl } from '../src/services/ownership.js';
import { reclaimIdleSeats } from '../src/services/reclaim.js';
import { EventWorker } from '../src/worker/loop.js';
import { fuelUp, giveUnits, grant, seedWorld, testDb, type Fixture } from './helpers.js';

const silent = pino({ level: 'silent' });
const DEFINITION = GALAXY_EVENTS.definitions.TRADE_SHIP;

/**
 * AN INDEPENDENT AUDIT OF THE MERCHANT LANE. D156.
 *
 * Written by somebody who did not implement it, against the two things a green
 * suite is worst at proving: that resources are conserved when two commanders
 * (or two requests) touch one world at the same instant, and that the housekeeping
 * sweeps which run days later still know what a convoy is.
 */
afterAll(async () => {
  const { close } = await testDb();
  await close();
});

describe('the merchant lane under pressure', () => {
  let f: Fixture;
  let capital: string;
  let colony: string;
  let trader: string;
  let captor: string;
  let seasonStartsAt: Date;
  let key: string;

  const worker = () =>
    new EventWorker(f.db, f.clock, { pollMs: 50, batch: 50, staleMinutes: 5 }, silent);

  const handOver = async (planetId: string, from: string, to: string): Promise<void> => {
    await f.db.transaction(async (tx) => {
      await transferPlanetControl(tx, {
        targetPlanetId: planetId,
        newPlayerId: to,
        expectedControllerPlayerId: from,
        now: f.clock.now(),
        protectedUntil: new Date(f.clock.now().getTime() + 86_400_000),
      });
    });
  };

  const merchantUp = async (): Promise<string> => {
    const startsAt = new Date(seasonStartsAt.getTime());
    const endsAt = new Date(seasonStartsAt.getTime() + DEFINITION.durationMinutes * 60_000);
    const [row] = await f.db
      .insert(galaxyEventOccurrences)
      .values({
        seasonId: f.seasonId,
        sequence: 0,
        kind: 'TRADE_SHIP',
        definitionVersion: DEFINITION.version,
        startsAt,
        endsAt,
        effect: { rate: TRADE.rate },
        createdAt: startsAt,
      })
      .returning();
    tradeShipOf(key, {
      sequence: 0,
      kind: 'TRADE_SHIP',
      startsAtMinute: minutesSince(seasonStartsAt, startsAt),
      endsAtMinute: minutesSince(seasonStartsAt, endsAt),
      definitionVersion: DEFINITION.version,
      effect: { rate: TRADE.rate },
    });
    f.clock.set(new Date(seasonStartsAt.getTime() + 30 * 60_000));
    return row!.id;
  };

  const RES = (alloy = 0, crystal = 0, deuterium = 0) => ({ alloy, crystal, deuterium });

  const store = async (planetId: string) => {
    const [row] = await f.db.select().from(planets).where(eq(planets.id, planetId));
    return {
      alloy: Math.floor(row!.alloy),
      crystal: Math.floor(row!.crystal),
      deuterium: Math.floor(row!.deuterium),
    };
  };

  /** Fly every trade run in the air to its end. */
  const drain = async () => {
    for (let i = 0; i < 8; i += 1) {
      const open = await f.db
        .select()
        .from(tradeRuns)
        .where(inArray(tradeRuns.status, ['outbound', 'returning']));
      if (open.length === 0) return;
      const next = open
        .map((run) => (run.status === 'returning' ? run.homeAt : dockEndsAt(run.arriveAt)))
        .filter((at): at is Date => at !== null)
        .sort((a, b) => a.getTime() - b.getTime())[0];
      if (!next) return;
      f.clock.set(new Date(next.getTime() + 1000));
      await worker().tick();
    }
    throw new Error('trade runs never stopped arriving — the fixture is looping');
  };

  beforeEach(async () => {
    f = await seedWorld(3, 4242);
    capital = f.planetIds[0]!;
    colony = f.planetIds[2]!;
    trader = f.playerIds[0]!;
    captor = f.playerIds[1]!;
    const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    seasonStartsAt = season!.startsAt;
    key = season!.asteroidKey;
    await handOver(colony, f.playerIds[2]!, trader);
  });

  /* ── money, under concurrency ───────────────────────────────── */

  /**
   * TWO CONVOYS ORDERED AT ONCE FROM ONE WORLD MAY NOT BOTH BE PAID FOR.
   *
   * D156 deliberately removed every brake but the bay, the hold and the tank, so
   * the store check IS the brake on the offer — and a store check taken outside
   * the planet's row lock is the classic way a game writes a negative balance.
   * `loadLocked` is what makes this safe; this is the test that says so.
   */
  it('never lets two simultaneous launches spend the same store twice', async () => {
    const occurrenceId = await merchantUp();
    const fleet: Fleet = { COURIER: 6 };
    await giveUnits(f.db, capital, { COURIER: 12 });
    await fuelUp(f.db, capital);
    // Exactly one convoy's worth of alloy in the store, and room for two bays.
    await f.db.update(planets).set({ alloy: 900, crystal: 0 }).where(eq(planets.id, capital));

    const order = { occurrenceId, fleet, give: RES(900), want: RES(0, 300) };
    const results = await Promise.allSettled([
      launchTrade(f.db, capital, order, f.clock),
      launchTrade(f.db, capital, order, f.clock),
    ]);
    const launched = results.filter((r) => r.status === 'fulfilled');
    expect(launched).toHaveLength(1);

    const after = await store(capital);
    expect(after.alloy).toBe(0);
    expect(after.deuterium).toBeGreaterThanOrEqual(0);

    const runs = await f.db.select().from(tradeRuns);
    expect(runs).toHaveLength(1);
  });

  /**
   * THE WHOLE ROUND TRIP IS A CLOSED LEDGER.
   *
   * Out: the offer and both legs of fuel leave, and nothing else. Home: the haul
   * lands and the offer never comes back with it. Measured across the real worker,
   * so a redelivered event or a second credit would show up as a number that does
   * not balance rather than as a passing assertion about one field.
   */
  it('debits exactly the offer plus fuel, and credits exactly the haul', async () => {
    const occurrenceId = await merchantUp();
    const fleet: Fleet = { COURIER: 8 };
    await grant(f.db, capital, 400_000, 120_000);
    await fuelUp(f.db, capital);
    await giveUnits(f.db, capital, fleet);

    const before = await store(capital);
    const launch = await launchTrade(
      f.db,
      capital,
      { occurrenceId, fleet, give: RES(900), want: RES(0, 300) },
      f.clock,
    );

    const afterLaunch = await store(capital);
    expect(afterLaunch.alloy).toBe(before.alloy - 900);
    expect(afterLaunch.crystal).toBe(before.crystal);
    expect(before.deuterium - afterLaunch.deuterium).toBe(Math.ceil(launch.fuel));

    await drain();
    // Deliver twice: the second delivery must move nothing at all.
    const settled = await store(capital);
    await worker().tick();
    expect(await store(capital)).toEqual(settled);

    expect(settled.alloy).toBe(afterLaunch.alloy);
    expect(settled.crystal).toBe(afterLaunch.crystal + 300);
    // Fuel is never refunded (D136); the tank only moved by the launch charge.
    expect(settled.deuterium).toBe(afterLaunch.deuterium);

    const [run] = await f.db.select().from(tradeRuns);
    expect(run!.status).toBe('done');
    const parked = await f.db
      .select()
      .from(units)
      .where(eq(units.location, tradeLocation(run!.id)));
    expect(parked).toHaveLength(0);
  });

  /* ── the sweeps that run days later ─────────────────────────── */

  /**
   * A SEAT WITH A FINISHED CONVOY BEHIND IT MUST STILL COME BACK.
   *
   * `trade_runs` keeps its row for the rest of the season and both `owner_player_id`
   * and `planet_id` are `ON DELETE no action`. `reclaimIdleSeats` collects the rows
   * to delete by PLANET, so a convoy launched from a world that later changed hands
   * is invisible to it — and the `delete(players)` at the end of the seat teardown
   * then violates `trade_runs_owner_player_id_players_id_fk`. The seat can never be
   * reclaimed again, which is the exact failure `pirate_raids` and `debris_fields`
   * were both taught to avoid.
   */
  it('frees an idle seat whose convoy flew from a world that has since changed hands', async () => {
    const occurrenceId = await merchantUp();
    const fleet: Fleet = { COURIER: 8 };
    await grant(f.db, colony, 400_000, 120_000);
    await fuelUp(f.db, colony);
    await giveUnits(f.db, colony, fleet);
    await launchTrade(
      f.db,
      colony,
      { occurrenceId, fleet, give: RES(900), want: RES(0, 300) },
      f.clock,
    );
    await drain();

    // The pad falls after the convoy is home. The run's row survives; its owner
    // is still the trader and its planet is now somebody else's world.
    await handOver(colony, trader, captor);

    const idleAt = new Date(f.clock.now().getTime() - (SERVERS.idleDays + 1) * 86_400_000);
    await f.db
      .update(players)
      .set({ lastActiveAt: idleAt, joinedAt: idleAt })
      .where(eq(players.id, trader));

    const result = await reclaimIdleSeats(f.db, f.clock);
    expect(result.failed).toBe(0);
    expect(result.reclaimed).toHaveLength(1);
    expect(
      (await f.db.select().from(planets).where(eq(planets.id, capital))).length,
    ).toBe(0);
  });

});
