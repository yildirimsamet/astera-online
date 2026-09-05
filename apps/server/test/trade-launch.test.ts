import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { and, eq, inArray } from 'drizzle-orm';
import {
  GALAXY_EVENTS,
  TRADE,
  distance,
  fleetSpeed,
  fleetSpeedMult,
  flightSlots,
  interceptOrbit,
  missionFuel,
  quoteTrade,
  tradeShipPosition,
  transferCargoCapacity,
  type Fleet,
} from '@astera/rules';
import {
  buildings,
  galaxyEventOccurrences,
  planets,
  seasons,
  tradeRuns,
  units,
} from '../src/db/schema.js';
import { minutesSince } from '../src/clock.js';
import { tradeShipOf } from '../src/services/tradeField.js';
import { launchTrade, tradeLocation } from '../src/services/trade.js';
import { launchAttack } from '../src/services/mission.js';
import { baysInUse } from '../src/services/flight.js';
import { fleetTruthFor } from '../src/services/intel.js';
import {
  fuelUp,
  giveUnits,
  grant,
  levelWorld,
  seedWorld,
  testDb,
  type Fixture,
} from './helpers.js';

/**
 * SENDING A CONVOY TO THE MERCHANT. D156.
 *
 * The fourth target class and the first one you DEAL with rather than take from.
 * Every refusal below is a sentence the launch screen has to be able to say before
 * a fleet is committed, because there is no recall — and the one this feature is
 * really built on is `CARGO_CAPACITY`: the hold is sized by `max(outbound,
 * return)`, so a small offer that buys a large haul must fly out in a convoy big
 * enough to bring the haul home. That is the decision. Everything else is a brake
 * the rest of the game already runs on: a bay (D28), prepaid fuel (D136), and the
 * transports you actually own.
 */
afterAll(async () => {
  const { close } = await testDb();
  await close();
});

const DEFINITION = GALAXY_EVENTS.definitions.TRADE_SHIP;

interface Merchant {
  occurrenceId: string;
  spec: ReturnType<typeof tradeShipOf>;
  seasonStartsAt: Date;
}

describe('a convoy sent to the merchant', () => {
  let f: Fixture;
  let mine: string;
  let seasonStartsAt: Date;
  let key: string;

  beforeEach(async () => {
    f = await seedWorld(2, 4242);
    mine = f.planetIds[0]!;
    const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    seasonStartsAt = season!.startsAt;
    key = season!.asteroidKey;
  });

  /**
   * Put a merchant in the sky and stand the clock inside its window.
   *
   * Through the same door production uses: a persisted occurrence row, and the
   * spec derived from it by `tradeField.ts`. A fixture that invented a spec would
   * be testing a ship the server cannot resolve.
   */
  const merchantUp = async (
    opts: { sequence?: number; startsAtMinute?: number; nowMinute?: number } = {},
  ): Promise<Merchant> => {
    const startsAtMinute = opts.startsAtMinute ?? 0;
    const endsAtMinute = startsAtMinute + DEFINITION.durationMinutes;
    const startsAt = new Date(seasonStartsAt.getTime() + startsAtMinute * 60_000);
    const endsAt = new Date(seasonStartsAt.getTime() + endsAtMinute * 60_000);
    const [row] = await f.db
      .insert(galaxyEventOccurrences)
      .values({
        seasonId: f.seasonId,
        sequence: opts.sequence ?? 0,
        kind: 'TRADE_SHIP',
        definitionVersion: DEFINITION.version,
        startsAt,
        endsAt,
        effect: { rate: TRADE.rate },
        createdAt: startsAt,
      })
      .returning();
    const spec = tradeShipOf(key, {
      sequence: opts.sequence ?? 0,
      kind: 'TRADE_SHIP',
      startsAtMinute: minutesSince(seasonStartsAt, startsAt),
      endsAtMinute: minutesSince(seasonStartsAt, endsAt),
      definitionVersion: DEFINITION.version,
      effect: { rate: TRADE.rate },
    });
    f.clock.set(new Date(seasonStartsAt.getTime() + (opts.nowMinute ?? 30) * 60_000));
    return { occurrenceId: row!.id, spec, seasonStartsAt };
  };

  const armed = async (fleet: Fleet = { COURIER: 4 }): Promise<Fleet> => {
    await grant(f.db, mine, 400_000, 120_000);
    await fuelUp(f.db, mine);
    await giveUnits(f.db, mine, fleet);
    return fleet;
  };

  const RES = (alloy = 0, crystal = 0, deuterium = 0) => ({ alloy, crystal, deuterium });

  /* ── the shape of a launch ──────────────────────────────── */

  it('takes a bay and both legs of fuel, debits the offer, and leaves the world AWAY', async () => {
    const merchant = await merchantUp();
    const fleet = await armed({ COURIER: 4 });
    const [before] = await f.db.select().from(planets).where(eq(planets.id, mine));

    const give = RES(900);
    const want = RES(0, 300);
    const launch = await launchTrade(
      f.db,
      mine,
      { occurrenceId: merchant.occurrenceId, fleet, give, want },
      f.clock,
    );

    expect(launch.arriveAt.getTime()).toBeGreaterThan(f.clock.now().getTime());
    expect(launch.fuel).toBeGreaterThan(0);
    expect(launch.rate).toEqual(TRADE.rate);
    expect(await baysInUse(f.db, mine)).toBe(1);

    // The offer left the store at launch, together with the fuel, in one write.
    const [after] = await f.db.select().from(planets).where(eq(planets.id, mine));
    expect(after!.alloy).toBeCloseTo(before!.alloy - give.alloy, 3);
    expect(after!.deuterium).toBeCloseTo(before!.deuterium - launch.fuel, 3);

    // The ships are off the pad, and the world says so. There is nothing here.
    const truth = await fleetTruthFor(f.db, [mine], f.clock.now());
    expect(truth.get(mine)?.status).toBe('AWAY');
    const parked = await f.db
      .select()
      .from(units)
      .where(and(eq(units.planetId, mine), eq(units.location, tradeLocation(launch.runId))));
    expect(parked.map((row) => [row.hull, row.count])).toEqual([['COURIER', 4]]);

    // D53: the mutation answers with exactly the views its GETs would.
    expect(launch.planet.planet.id).toBe(mine);
    expect(launch.pending.some((thread) => thread.id === launch.runId)).toBe(true);
  });

  /**
   * THE RENDEZVOUS IS SOLVED ONCE AND STORED. D156, and D150's own lesson.
   *
   * Re-deriving it later would let the merchant's own motion move a flight already
   * in the air onto a new course, and a player watching their convoy cross the disc
   * would see it jump.
   */
  it('freezes the rendezvous the launch solved, and it is a point in empty space', async () => {
    const merchant = await merchantUp();
    const fleet = await armed({ COURIER: 4 });
    const launch = await launchTrade(
      f.db,
      mine,
      { occurrenceId: merchant.occurrenceId, fleet, give: RES(900), want: RES(0, 300) },
      f.clock,
    );

    const [row] = await f.db.select().from(tradeRuns).where(eq(tradeRuns.id, launch.runId));
    expect(row!.interceptX).toBeCloseTo(launch.intercept.x, 2);
    expect(row!.interceptY).toBeCloseTo(launch.intercept.y, 2);
    expect(row!.interceptZ).toBeCloseTo(launch.intercept.z, 2);
    expect(row!.rate).toEqual(TRADE.rate);
    expect(row!.give).toEqual(RES(900));
    expect(row!.want).toEqual(RES(0, 300));
    expect(row!.ownerPlayerId).toBe(f.playerIds[0]);

    const worlds = await f.db.select().from(planets);
    for (const world of worlds) {
      expect(distance(world, launch.intercept)).toBeGreaterThan(1);
    }

    // The same solve the shared solver gives, from the same inputs.
    const [origin] = await f.db.select().from(planets).where(eq(planets.id, mine));
    const speed = fleetSpeed(fleet, {}) * fleetSpeedMult([]);
    const hit = interceptOrbit(
      origin!,
      speed,
      (minutes) => tradeShipPosition(merchant.spec, minutes),
      merchant.spec.expiresAt,
      minutesSince(seasonStartsAt, f.clock.now()),
    );
    expect(hit).not.toBeNull();
    expect(launch.flightMinutes).toBeCloseTo(hit!.flightMinutes, 4);
  });

  /* ── the hold is sized by the return leg ────────────────── */

  /**
   * THE CENTRAL REQUIREMENT OF THE WHOLE FEATURE. D156.
   *
   * A thousand Deuterium is ninety thousand units and buys ninety thousand Alloy.
   * The convoy that carries the offer out needs room for a thousand; the one that
   * brings the goods home needs room for ninety thousand. Sizing a wing against
   * the outbound leg is the mistake `requiredHold` exists to prevent.
   */
  it('sizes the hold by the RETURN leg, not by the offer', async () => {
    const merchant = await merchantUp();
    const give = RES(0, 0, 1_000);
    const want = RES(90_000);
    const quote = quoteTrade(give, want, TRADE.rate);
    expect(quote.refusal).toBeNull();
    expect(quote.outboundVolume).toBe(1_000);
    expect(quote.returnVolume).toBe(90_000);
    expect(quote.requiredHold).toBe(90_000);

    // A single Courier carries the OFFER twice over and the haul not at all.
    const tooSmall: Fleet = { COURIER: 2 };
    expect(transferCargoCapacity(tooSmall)).toBeGreaterThan(quote.outboundVolume);
    expect(transferCargoCapacity(tooSmall)).toBeLessThan(quote.requiredHold);
    await armed({ COURIER: 2, ATLAS: 15 });
    await expect(
      launchTrade(
        f.db,
        mine,
        { occurrenceId: merchant.occurrenceId, fleet: tooSmall, give, want },
        f.clock,
      ),
    ).rejects.toMatchObject({ code: 'CARGO_CAPACITY' });

    // The wing that can bring it home flies.
    const big: Fleet = { ATLAS: 15 };
    expect(transferCargoCapacity(big)).toBeGreaterThanOrEqual(quote.requiredHold);
    const launch = await launchTrade(
      f.db,
      mine,
      { occurrenceId: merchant.occurrenceId, fleet: big, give, want },
      f.clock,
    );
    expect(launch.want).toEqual(want);
  });

  /**
   * THE THIRD ARGUMENT OF `assertFuel` IS LOAD-BEARING. D136 · T6.
   *
   * A commander paying the merchant in deuterium must not be able to spend the
   * same tank twice. `fuelAvailable` exists because `launchTransfer` shipped this
   * exact bug once and wrote a NEGATIVE store, which nothing downstream defends
   * against.
   */
  it('will not let one tank pay the merchant and fly the convoy', async () => {
    const merchant = await merchantUp();
    const fleet = await armed({ ATLAS: 4 });
    const [origin] = await f.db.select().from(planets).where(eq(planets.id, mine));
    const speed = fleetSpeed(fleet, {}) * fleetSpeedMult([]);
    const hit = interceptOrbit(
      origin!,
      speed,
      (minutes) => tradeShipPosition(merchant.spec, minutes),
      merchant.spec.expiresAt,
      minutesSince(seasonStartsAt, f.clock.now()),
    )!;
    const fuel = missionFuel(fleet, distance(origin!, hit.at), 2);
    expect(fuel).toBeGreaterThan(0);

    // Exactly enough for the flight, and the offer is the whole tank as well.
    const tank = fuel + 500;
    await f.db.update(planets).set({ deuterium: tank }).where(eq(planets.id, mine));
    // Bought in Crystal so the haul fits the hold: this test is about the tank.
    const give = RES(0, 0, tank - fuel + 1);
    await expect(
      launchTrade(
        f.db,
        mine,
        { occurrenceId: merchant.occurrenceId, fleet, give, want: RES(0, give.deuterium * 30) },
        f.clock,
      ),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_FUEL' });

    // One drop less committed and the same convoy flies.
    const legal = RES(0, 0, tank - fuel);
    const launch = await launchTrade(
      f.db,
      mine,
      {
        occurrenceId: merchant.occurrenceId,
        fleet,
        give: legal,
        want: RES(0, legal.deuterium * 30),
      },
      f.clock,
    );
    const [after] = await f.db.select().from(planets).where(eq(planets.id, mine));
    expect(after!.deuterium).toBeGreaterThanOrEqual(0);
    expect(after!.deuterium).toBeCloseTo(0, 3);
    expect(launch.fuel).toBe(fuel);
  });

  /* ── the refusal ladder, code by code ───────────────────── */

  it('refuses a fleet that is not a fleet, structure before semantics', async () => {
    const merchant = await merchantUp();
    await armed({ COURIER: 4, BASTION: 2 });
    const order = { occurrenceId: merchant.occurrenceId, give: RES(900), want: RES(0, 300) };

    await expect(launchTrade(f.db, mine, { ...order, fleet: {} }, f.clock))
      .rejects.toMatchObject({ code: 'EMPTY_FLEET' });
    await expect(launchTrade(f.db, mine, { ...order, fleet: { COURIER: 1.5 } }, f.clock))
      .rejects.toMatchObject({ code: 'BAD_FLEET' });
    /*
      A NEGATIVE COUNT BESIDE A REAL ONE, because the shared validator answers a
      fleet that sums to nothing with EMPTY_FLEET first — which is the truer
      sentence for `{ COURIER: -2 }` and the transfer lane's own answer. What has to
      be proved here is that the PER-HULL check runs at all.
    */
    await expect(launchTrade(f.db, mine, { ...order, fleet: { COURIER: 4, DART: -2 } }, f.clock))
      .rejects.toMatchObject({ code: 'BAD_FLEET' });
    await expect(launchTrade(f.db, mine, { ...order, fleet: { BASTION: 1 } }, f.clock))
      .rejects.toMatchObject({ code: 'GROUND_UNIT' });
  });

  it('refuses ships the world does not have, and a convoy that cannot move', async () => {
    const merchant = await merchantUp();
    await armed({ COURIER: 2 });
    await giveUnits(f.db, mine, { PROSPECTOR: 2 });
    const order = { occurrenceId: merchant.occurrenceId, give: RES(900), want: RES(0, 300) };

    await expect(launchTrade(f.db, mine, { ...order, fleet: { COURIER: 9 } }, f.clock))
      .rejects.toMatchObject({ code: 'NOT_ENOUGH_SHIPS' });
    // A Prospector is not ground and is not a mobile hull either: it has no speed
    // this lane can read, so the convoy cannot leave.
    await expect(launchTrade(f.db, mine, { ...order, fleet: { PROSPECTOR: 2 } }, f.clock))
      .rejects.toMatchObject({ code: 'IMMOBILE_FLEET' });
  });

  it('refuses a merchant that is not there — expired, wrong kind, or unknown', async () => {
    const fleet = await armed({ COURIER: 4 });
    const order = { fleet, give: RES(900), want: RES(0, 300) };

    // Gone: the window closed an hour before the clock.
    const past = await merchantUp({ startsAtMinute: 0, nowMinute: DEFINITION.durationMinutes + 60 });
    await expect(
      launchTrade(f.db, mine, { ...order, occurrenceId: past.occurrenceId }, f.clock),
    ).rejects.toMatchObject({ code: 'TRADE_WINDOW_CLOSED', status: 409 });

    // Not yet: the calendar row exists and its window has not opened.
    const future = await merchantUp({
      sequence: 1,
      startsAtMinute: DEFINITION.durationMinutes * 4,
      nowMinute: 30,
    });
    await expect(
      launchTrade(f.db, mine, { ...order, occurrenceId: future.occurrenceId }, f.clock),
    ).rejects.toMatchObject({ code: 'TRADE_WINDOW_CLOSED' });

    // A shower is a public moment too, and you cannot trade with weather.
    const [shower] = await f.db
      .insert(galaxyEventOccurrences)
      .values({
        seasonId: f.seasonId,
        sequence: 0,
        kind: 'ASTEROID_SHOWER',
        definitionVersion: GALAXY_EVENTS.definitions.ASTEROID_SHOWER.version,
        startsAt: new Date(seasonStartsAt.getTime()),
        endsAt: new Date(seasonStartsAt.getTime() + 60 * 60_000),
        effect: { asteroidSpawnMultiplier: 5 },
        createdAt: seasonStartsAt,
      })
      .returning();
    await expect(
      launchTrade(f.db, mine, { ...order, occurrenceId: shower!.id }, f.clock),
    ).rejects.toMatchObject({ code: 'TRADE_WINDOW_CLOSED' });

    await expect(
      launchTrade(
        f.db,
        mine,
        { ...order, occurrenceId: '00000000-0000-4000-8000-000000000000' },
        f.clock,
      ),
    ).rejects.toMatchObject({ code: 'TRADE_WINDOW_CLOSED' });
  });

  it('refuses when there is no bay left, before it solves a rendezvous', async () => {
    const merchant = await merchantUp();
    await armed({ COURIER: 200 });
    const [core] = await f.db
      .select({ level: buildings.level })
      .from(buildings)
      .where(and(eq(buildings.planetId, mine), eq(buildings.type, 'CORE')));
    const bays = flightSlots(core?.level ?? 0);
    const order = {
      occurrenceId: merchant.occurrenceId,
      fleet: { COURIER: 1 },
      give: RES(90),
      want: RES(0, 30),
    };
    /*
      NO PER-WORLD CONVOY LIMIT — owner instruction. There is deliberately no
      unique index on (planet_id, occurrence_id): a world may run as many convoys
      at one appearance as it can pay bays and fuel for.
    */
    for (let i = 0; i < bays; i += 1) await launchTrade(f.db, mine, order, f.clock);
    expect(await baysInUse(f.db, mine)).toBe(bays);
    await expect(launchTrade(f.db, mine, order, f.clock))
      .rejects.toMatchObject({ code: 'NO_FREE_BAY', status: 409 });
  });

  /**
   * D28's ONE SCARCITY, AND THE MERCHANT PAYS IT LIKE EVERYTHING ELSE.
   *
   * The lane has no quota, no fee and no per-world convoy limit by owner
   * instruction, which makes the bay count the brake that actually holds. A flight
   * table that `baysInUse` did not count would let a commander keep their entire
   * raid budget while running convoys on the side — the "resources replace players
   * as the fun" regression the design watches for.
   */
  it('competes for the same bays a raid does', async () => {
    const merchant = await merchantUp();
    await armed({ COURIER: 200, DART: 40 });
    // Every world in one development band, or the raid below is refused for a
    // reason this test is not about (D49).
    await levelWorld(f.db, f.planetIds);

    const [core] = await f.db
      .select({ level: buildings.level })
      .from(buildings)
      .where(and(eq(buildings.planetId, mine), eq(buildings.type, 'CORE')));
    const bays = flightSlots(core?.level ?? 0);
    const order = {
      occurrenceId: merchant.occurrenceId,
      fleet: { COURIER: 1 },
      give: RES(90),
      want: RES(0, 30),
    };
    for (let i = 0; i < bays; i += 1) await launchTrade(f.db, mine, order, f.clock);
    expect(await baysInUse(f.db, mine)).toBe(bays);

    await expect(
      launchAttack(f.db, mine, f.planetIds[1]!, { DART: 20 }, f.clock),
    ).rejects.toMatchObject({ code: 'NO_FREE_BAY' });
  });

  it('refuses a convoy with no carrier in it', async () => {
    const merchant = await merchantUp();
    await armed({ DART: 20 });
    await expect(
      launchTrade(
        f.db,
        mine,
        {
          occurrenceId: merchant.occurrenceId,
          fleet: { DART: 20 },
          give: RES(900),
          want: RES(0, 300),
        },
        f.clock,
      ),
    ).rejects.toMatchObject({ code: 'TRANSFER_NEEDS_CARGO_HULL' });
  });

  it('carries the quote refusal in the error rather than restating it', async () => {
    const merchant = await merchantUp();
    const fleet = await armed({ COURIER: 4 });
    const order = { occurrenceId: merchant.occurrenceId, fleet };

    const cases: { give: ReturnType<typeof RES>; want: ReturnType<typeof RES>; reason: string }[] = [
      { give: RES(0), want: RES(0, 300), reason: 'EMPTY_GIVE' },
      { give: RES(900), want: RES(0), reason: 'EMPTY_WANT' },
      { give: RES(900), want: RES(100), reason: 'OVERLAPPING_RESOURCE' },
      { give: RES(90), want: RES(0, 300), reason: 'INSUFFICIENT_OFFER' },
      { give: RES(1.5), want: RES(0, 300), reason: 'BAD_AMOUNT' },
    ];
    for (const { give, want, reason } of cases) {
      await expect(
        launchTrade(f.db, mine, { ...order, give, want }, f.clock),
        reason,
      ).rejects.toMatchObject({ code: 'BAD_TRADE', status: 400, params: { reason } });
    }
  });

  it('refuses an offer the world does not actually hold', async () => {
    const merchant = await merchantUp();
    const fleet = await armed({ ATLAS: 4 });
    // An offer the convoy could easily carry and the world simply does not hold —
    // `CARGO_CAPACITY` is checked first and would otherwise mask this.
    await f.db.update(planets).set({ alloy: 100 }).where(eq(planets.id, mine));
    await expect(
      launchTrade(
        f.db,
        mine,
        { occurrenceId: merchant.occurrenceId, fleet, give: RES(900), want: RES(0, 300) },
        f.clock,
      ),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_RESOURCES' });
  });

  it('refuses a meeting the merchant would leave before the convoy could reach it', async () => {
    // One minute of window left, and the slowest hold in the catalogue.
    const merchant = await merchantUp({
      startsAtMinute: 0,
      nowMinute: DEFINITION.durationMinutes - 1,
    });
    const fleet = await armed({ ATLAS: 2 });
    await expect(
      launchTrade(
        f.db,
        mine,
        { occurrenceId: merchant.occurrenceId, fleet, give: RES(900), want: RES(0, 300) },
        f.clock,
      ),
    ).rejects.toMatchObject({ code: 'CANNOT_INTERCEPT', status: 409 });
  });

  it('refuses without the deuterium for the round trip', async () => {
    const merchant = await merchantUp();
    const fleet = await armed({ ATLAS: 6 });
    await f.db.update(planets).set({ deuterium: 0 }).where(eq(planets.id, mine));
    await expect(
      launchTrade(
        f.db,
        mine,
        { occurrenceId: merchant.occurrenceId, fleet, give: RES(900), want: RES(0, 300) },
        f.clock,
      ),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_FUEL' });
  });

  it('refuses a world that is not the caller\'s', async () => {
    const merchant = await merchantUp();
    const fleet = await armed({ COURIER: 4 });
    await expect(
      launchTrade(
        f.db,
        mine,
        { occurrenceId: merchant.occurrenceId, fleet, give: RES(900), want: RES(0, 300) },
        f.clock,
        f.playerIds[1],
      ),
    ).rejects.toMatchObject({ code: 'PLANET_NOT_OWNED' });
  });

  it('leaves nothing behind when a refusal fires', async () => {
    const merchant = await merchantUp();
    const fleet = await armed({ COURIER: 4 });
    const [before] = await f.db.select().from(planets).where(eq(planets.id, mine));
    await expect(
      launchTrade(
        f.db,
        mine,
        { occurrenceId: merchant.occurrenceId, fleet, give: RES(900), want: RES(900) },
        f.clock,
      ),
    ).rejects.toMatchObject({ code: 'BAD_TRADE' });

    const [after] = await f.db.select().from(planets).where(eq(planets.id, mine));
    expect(after!.alloy).toBeCloseTo(before!.alloy, 3);
    expect(await baysInUse(f.db, mine)).toBe(0);
    expect(
      await f.db.select().from(tradeRuns).where(inArray(tradeRuns.planetId, [mine])),
    ).toHaveLength(0);
  });
});
