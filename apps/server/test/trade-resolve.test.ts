import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { GALAXY_EVENTS, TRADE, type Fleet } from '@astera/rules';
import {
  galaxyEventOccurrences,
  notifications,
  planets,
  players,
  scheduledEvents,
  seasons,
  tradeRuns,
  units,
} from '../src/db/schema.js';
import { minutesSince } from '../src/clock.js';
import { tradeShipOf } from '../src/services/tradeField.js';
import {
  dockEndsAt,
  launchTrade,
  resolveTradeArrival,
  resolveTradeReturn,
  tradeLocation,
} from '../src/services/trade.js';
import { transferPlanetControl } from '../src/services/ownership.js';
import { baysInUse } from '../src/services/flight.js';
import { abandon } from '../src/worker/abandon.js';
import { EventWorker } from '../src/worker/loop.js';
import { fuelUp, giveUnits, grant, seedWorld, testDb, type Fixture } from './helpers.js';

const silent = pino({ level: 'silent' });
const DEFINITION = GALAXY_EVENTS.definitions.TRADE_SHIP;

/**
 * THE CONVOY GETS THERE, AND THE CONVOY GETS HOME. D156.
 *
 * Nothing is exchanged in the world at the rendezvous: the offer left the store at
 * launch and the haul is frozen on the row, so the arrival is a claim, a clock and
 * a return leg. What this file guards is the part that has cost this project real
 * fleets before — that a redelivered event settles once, that an unresolvable
 * flight comes home rather than parking a bay for the season, and that a world
 * captured mid-flight never receives somebody else's convoy or its cargo (D150).
 */
afterAll(async () => {
  const { close } = await testDb();
  await close();
});

describe('a convoy resolving', () => {
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
    // Derived so the fixture cannot drift from the ship the server resolves.
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

  const sendConvoy = async (
    from: string,
    fleet: Fleet = { COURIER: 4 },
    give = RES(900),
    want = RES(0, 300),
  ) => {
    const occurrenceId = await merchantUp();
    await grant(f.db, from, 400_000, 120_000);
    await fuelUp(f.db, from);
    await giveUnits(f.db, from, fleet);
    return launchTrade(f.db, from, { occurrenceId, fleet, give, want }, f.clock);
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

  /* ── the two moments ────────────────────────────────────── */

  it('docks, turns for home, and delivers the haul it was promised', async () => {
    const launch = await sendConvoy(capital);
    const [before] = await f.db.select().from(planets).where(eq(planets.id, capital));

    f.clock.set(new Date(dockEndsAt(launch.arriveAt).getTime() + 1000));
    await worker().tick();

    const [docked] = await f.db.select().from(tradeRuns).where(eq(tradeRuns.id, launch.runId));
    expect(docked!.status).toBe('returning');
    expect(docked!.homeAt).not.toBeNull();
    // Nothing changed hands in the world here: the offer went at launch and the
    // haul is frozen on the row until the ships are actually home.
    const [midFlight] = await f.db.select().from(planets).where(eq(planets.id, capital));
    expect(midFlight!.crystal).toBeCloseTo(before!.crystal, 3);
    expect(await baysInUse(f.db, capital)).toBe(1);

    f.clock.set(new Date(docked!.homeAt!.getTime() + 1000));
    await worker().tick();

    const [done] = await f.db.select().from(tradeRuns).where(eq(tradeRuns.id, launch.runId));
    expect(done!.status).toBe('done');
    const [after] = await f.db.select().from(planets).where(eq(planets.id, capital));
    expect(after!.crystal).toBeCloseTo(before!.crystal + 300, 3);

    // The ships are back in the garrison and nothing is parked against the run.
    const home = await f.db
      .select()
      .from(units)
      .where(and(eq(units.planetId, capital), eq(units.location, 'home')));
    expect(home.find((row) => row.hull === 'COURIER')?.count ?? 0).toBe(4);
    const parked = await f.db
      .select()
      .from(units)
      .where(and(eq(units.planetId, capital), eq(units.location, tradeLocation(launch.runId))));
    expect(parked).toHaveLength(0);
    expect(await baysInUse(f.db, capital)).toBe(0);

    const told = await f.db
      .select()
      .from(notifications)
      .where(and(eq(notifications.refId, launch.runId), eq(notifications.kind, 'fleet_returned')));
    expect(told).toHaveLength(1);
    expect(told[0]!.playerId).toBe(trader);
  });

  /**
   * THE MERCHANT LEAVING DOES NOT STRAND A CONVOY THAT WAS ALREADY COMMITTED.
   *
   * Found by audit — nothing tested it and nothing said what should happen, which
   * is the shape a future "fix" walks into: `resolveTradeArrival` does not re-check
   * `tradeShipActive`, and an implementer reading only the launch guard would
   * reasonably add one.
   *
   * ADDING ONE WOULD BE A BUG. The rendezvous is solved against `spec.expiresAt` at
   * launch, so a convoy that left legally is inside the window when it arrives —
   * and the only ways to be outside it are a slow worker, a restart or a redelivery
   * (`WORKER_POLL_MS` is one second, but a deploy is not). Refusing there would
   * take a paid-for offer and a bought haul away from a commander because a queue
   * ran late, and D136 has already settled the principle: what is committed is
   * committed, no path asks for more and no cancellation gives any back.
   *
   * The window governs COMMITMENT, not settlement. This holds that in place.
   */
  it('settles a convoy that lands after the merchant has gone', async () => {
    const launch = await sendConvoy(capital);
    const [before] = await f.db.select().from(planets).where(eq(planets.id, capital));

    // Shut the window while the convoy is still outbound, exactly as a window that
    // ends on time does to a flight committed in its last minute.
    await f.db
      .update(galaxyEventOccurrences)
      .set({ endsAt: new Date(launch.arriveAt.getTime() - 60_000) })
      .where(eq(galaxyEventOccurrences.seasonId, f.seasonId));

    f.clock.set(new Date(dockEndsAt(launch.arriveAt).getTime() + 1000));
    await worker().tick();
    const [docked] = await f.db.select().from(tradeRuns).where(eq(tradeRuns.id, launch.runId));
    expect(docked!.status).toBe('returning');

    f.clock.set(new Date(docked!.homeAt!.getTime() + 1000));
    await worker().tick();

    const [done] = await f.db.select().from(tradeRuns).where(eq(tradeRuns.id, launch.runId));
    expect(done!.status).toBe('done');
    const [after] = await f.db.select().from(planets).where(eq(planets.id, capital));
    expect(after!.crystal).toBeCloseTo(before!.crystal + 300, 3);
    expect(await baysInUse(f.db, capital)).toBe(0);
  });

  it('settles once however many times the event is delivered', async () => {
    const launch = await sendConvoy(capital);
    const [before] = await f.db.select().from(planets).where(eq(planets.id, capital));

    f.clock.set(new Date(dockEndsAt(launch.arriveAt).getTime() + 1000));
    await f.db.transaction((tx) => resolveTradeArrival(tx, launch.runId, f.clock));
    const [first] = await f.db.select().from(tradeRuns).where(eq(tradeRuns.id, launch.runId));
    // A redelivery finds the run already claimed and does nothing at all.
    await f.db.transaction((tx) => resolveTradeArrival(tx, launch.runId, f.clock));
    const [again] = await f.db.select().from(tradeRuns).where(eq(tradeRuns.id, launch.runId));
    expect(again!.homeAt!.getTime()).toBe(first!.homeAt!.getTime());

    f.clock.set(new Date(first!.homeAt!.getTime() + 1000));
    await f.db.transaction((tx) => resolveTradeReturn(tx, launch.runId, f.clock));
    await f.db.transaction((tx) => resolveTradeReturn(tx, launch.runId, f.clock));
    await f.db.transaction((tx) => resolveTradeReturn(tx, launch.runId, f.clock));

    const [after] = await f.db.select().from(planets).where(eq(planets.id, capital));
    // Paid once, not three times.
    expect(after!.crystal).toBeCloseTo(before!.crystal + 300, 3);
    const home = await f.db
      .select()
      .from(units)
      .where(and(eq(units.planetId, capital), eq(units.location, 'home')));
    expect(home.find((row) => row.hull === 'COURIER')?.count ?? 0).toBe(4);
    const told = await f.db
      .select()
      .from(notifications)
      .where(and(eq(notifications.refId, launch.runId), eq(notifications.kind, 'fleet_returned')));
    expect(told).toHaveLength(1);
  });

  it('recomputes the commander\'s wealth on both legs', async () => {
    const launch = await sendConvoy(capital);
    const [launched] = await f.db.select().from(players).where(eq(players.id, trader));
    expect(launched!.wealth).toBeGreaterThan(0);

    f.clock.set(new Date(dockEndsAt(launch.arriveAt).getTime() + 1000));
    await worker().tick();
    const [run] = await f.db.select().from(tradeRuns).where(eq(tradeRuns.id, launch.runId));
    f.clock.set(new Date(run!.homeAt!.getTime() + 1000));
    await worker().tick();

    const [settled] = await f.db.select().from(players).where(eq(players.id, trader));
    expect(settled!.wealth).toBeGreaterThan(0);
  });

  /* ── a return follows its commander, never the pad. D150 ── */

  it('delivers to the commander who committed the fleet when the pad falls mid-flight', async () => {
    const launch = await sendConvoy(colony, { COURIER: 4 }, RES(900), RES(0, 300));

    f.clock.set(new Date(dockEndsAt(launch.arriveAt).getTime() + 1000));
    await worker().tick();
    const [run] = await f.db.select().from(tradeRuns).where(eq(tradeRuns.id, launch.runId));
    expect(run!.status).toBe('returning');

    // THE COLONY FALLS WHILE THE CONVOY IS STILL IN THE AIR.
    await handOver(colony, trader, captor);
    const [capitalBefore] = await f.db.select().from(planets).where(eq(planets.id, capital));
    const [colonyBefore] = await f.db.select().from(planets).where(eq(planets.id, colony));

    f.clock.set(new Date(run!.homeAt!.getTime() + 1000));
    await worker().tick();

    const [capitalAfter] = await f.db.select().from(planets).where(eq(planets.id, capital));
    const [colonyAfter] = await f.db.select().from(planets).where(eq(planets.id, colony));
    expect(capitalAfter!.crystal).toBeCloseTo(capitalBefore!.crystal + 300, 3);
    expect(colonyAfter!.crystal).toBeCloseTo(colonyBefore!.crystal, 3);

    const landed = await f.db
      .select()
      .from(units)
      .where(and(eq(units.planetId, capital), eq(units.location, 'home')));
    expect(landed.find((row) => row.hull === 'COURIER')?.count ?? 0).toBe(4);
    for (const row of landed) expect(row.ownerPlayerId).toBe(trader);

    const seized = await f.db
      .select()
      .from(units)
      .where(and(eq(units.planetId, colony), eq(units.location, 'home')));
    expect(seized.find((row) => row.hull === 'COURIER')?.count ?? 0).toBe(0);

    const toCaptor = await f.db
      .select()
      .from(notifications)
      .where(and(eq(notifications.playerId, captor), eq(notifications.refId, launch.runId)));
    expect(toCaptor).toHaveLength(0);
  });

  /* ── abandoning either moment ───────────────────────────── */

  /**
   * ABANDONING IS THE SERVER ADMITTING IT COULD NOT RESOLVE A FLIGHT. D28 · D46.
   *
   * The conservative reading of an unresolvable convoy is that the deal never
   * happened: the ships come home and the GOODS THAT NEVER CHANGED HANDS come with
   * them. Which pile that is depends on the leg, which is why the abandon path
   * matches on the event's own kind.
   */
  it('returns the ships and the untraded offer when the outbound leg is abandoned', async () => {
    const launch = await sendConvoy(capital);
    const [before] = await f.db.select().from(planets).where(eq(planets.id, capital));

    const [event] = await f.db
      .select()
      .from(scheduledEvents)
      .where(and(
        eq(scheduledEvents.refId, launch.runId),
        eq(scheduledEvents.kind, 'trade_arrival'),
      ));
    expect(await abandon(f.db, event!, f.clock)).toBe(true);
    // Idempotent: a second abandon of the same event releases nothing.
    expect(await abandon(f.db, event!, f.clock)).toBe(false);

    const [after] = await f.db.select().from(planets).where(eq(planets.id, capital));
    // The OFFER comes back. The haul never existed and the fuel is never refunded.
    expect(after!.alloy).toBeCloseTo(before!.alloy + 900, 3);
    expect(after!.crystal).toBeCloseTo(before!.crystal, 3);
    expect(after!.deuterium).toBeCloseTo(before!.deuterium, 3);

    const home = await f.db
      .select()
      .from(units)
      .where(and(eq(units.planetId, capital), eq(units.location, 'home')));
    expect(home.find((row) => row.hull === 'COURIER')?.count ?? 0).toBe(4);
    expect(await baysInUse(f.db, capital)).toBe(0);
    const told = await f.db
      .select()
      .from(notifications)
      .where(and(eq(notifications.refId, launch.runId), eq(notifications.kind, 'fleet_returned')));
    expect(told).toHaveLength(1);
  });

  /**
   * TWO CONVOYS ABANDONED AT ONCE, AND BOTH CREWS COME HOME. D166.
   *
   * The bug this guards was a LOCK ORDER: `abandonTradeRun` read the destination's
   * `units` rows, merged its stranded crew into them and wrote the result — and only
   * then took the planet's row lock. `setUnits` REPLACES a count rather than adding
   * to it, so two abandons landing on one world both read the same "before", both
   * wrote their own total, and whichever committed second deleted the other's ships.
   * No error, no report: the fleet was simply smaller than it had been.
   *
   * `resolveTradeReturn` has always locked first, which is why this only ever bit
   * the abandon path. Locking first here makes the two functions the same shape.
   */
  it('brings both crews home when two convoys are abandoned at once', async () => {
    // One merchant, two convoys at it: the occurrence is unique per season.
    const occurrenceId = await merchantUp();
    await grant(f.db, capital, 400_000, 120_000);
    await fuelUp(f.db, capital);
    await giveUnits(f.db, capital, { COURIER: 4 });
    const order = { occurrenceId, fleet: { COURIER: 2 }, give: RES(900), want: RES(0, 300) };
    const first = await launchTrade(f.db, capital, order, f.clock);
    const second = await launchTrade(f.db, capital, order, f.clock);
    expect(await baysInUse(f.db, capital)).toBe(2);

    const events = await f.db
      .select()
      .from(scheduledEvents)
      .where(eq(scheduledEvents.kind, 'trade_arrival'));
    const forRun = (runId: string) => events.find((event) => event.refId === runId)!;

    // Both at once, on separate transactions, exactly as the worker can deliver them.
    await Promise.all([
      abandon(f.db, forRun(first.runId), f.clock),
      abandon(f.db, forRun(second.runId), f.clock),
    ]);

    const home = await f.db
      .select()
      .from(units)
      .where(and(eq(units.planetId, capital), eq(units.location, 'home')));
    // Four went out in two convoys; four are standing again. A lost update leaves two.
    expect(home.find((row) => row.hull === 'COURIER')?.count ?? 0).toBe(4);
    expect(await baysInUse(f.db, capital)).toBe(0);
  });

  it('returns the ships and the bought haul when the return leg is abandoned', async () => {
    const launch = await sendConvoy(capital);
    const [before] = await f.db.select().from(planets).where(eq(planets.id, capital));

    f.clock.set(new Date(dockEndsAt(launch.arriveAt).getTime() + 1000));
    await worker().tick();

    const [event] = await f.db
      .select()
      .from(scheduledEvents)
      .where(and(
        eq(scheduledEvents.refId, launch.runId),
        eq(scheduledEvents.kind, 'trade_return'),
      ));
    expect(await abandon(f.db, event!, f.clock)).toBe(true);

    const [after] = await f.db.select().from(planets).where(eq(planets.id, capital));
    // The goods were bought and paid for; the offer is gone for good.
    expect(after!.crystal).toBeCloseTo(before!.crystal + 300, 3);
    expect(after!.alloy).toBeCloseTo(before!.alloy, 3);

    const home = await f.db
      .select()
      .from(units)
      .where(and(eq(units.planetId, capital), eq(units.location, 'home')));
    expect(home.find((row) => row.hull === 'COURIER')?.count ?? 0).toBe(4);
    expect(await baysInUse(f.db, capital)).toBe(0);
  });

  it('abandons to the commander, not to whoever holds the pad', async () => {
    const launch = await sendConvoy(colony);
    await handOver(colony, trader, captor);
    const [capitalBefore] = await f.db.select().from(planets).where(eq(planets.id, capital));

    const [event] = await f.db
      .select()
      .from(scheduledEvents)
      .where(and(
        eq(scheduledEvents.refId, launch.runId),
        eq(scheduledEvents.kind, 'trade_arrival'),
      ));
    expect(await abandon(f.db, event!, f.clock)).toBe(true);

    const [capitalAfter] = await f.db.select().from(planets).where(eq(planets.id, capital));
    expect(capitalAfter!.alloy).toBeCloseTo(capitalBefore!.alloy + 900, 3);
    const landed = await f.db
      .select()
      .from(units)
      .where(and(eq(units.planetId, capital), eq(units.location, 'home')));
    expect(landed.find((row) => row.hull === 'COURIER')?.count ?? 0).toBe(4);
    for (const row of landed) expect(row.ownerPlayerId).toBe(trader);
  });
});
