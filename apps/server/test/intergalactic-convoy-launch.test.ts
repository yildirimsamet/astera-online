import { and, eq } from 'drizzle-orm';
import { pino } from 'pino';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  GALAXY_EVENTS,
  INTERGALACTIC_CONVOY,
  TRAVEL,
  fleetPace,
  fleetSpeedMult,
  interceptIntergalacticConvoy,
  sensorSphere,
  type Fleet,
} from '@astera/rules';
import {
  galaxyEventOccurrences,
  intergalacticConvoyRuns,
  notifications,
  planets,
  scheduledEvents,
  seasons,
  units,
} from '../src/db/schema.js';
import { minutesSince } from '../src/clock.js';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import { baysInUse } from '../src/services/flight.js';
import { strandedFlightCount, sweepStranded } from '../src/worker/abandon.js';
import { loadPirateSnapshot } from '../src/services/pirateField.js';
import { loadTrafficSnapshot, projectGalaxyTraffic } from '../src/services/traffic.js';
import { intergalacticConvoyOf } from '../src/services/intergalacticConvoyField.js';
import { pendingThreads } from '../src/services/session.js';
import { planetView } from '../src/services/planetView.js';
import {
  abandonIntergalacticConvoyRun,
  intergalacticConvoyLocation,
  launchIntergalacticConvoy,
  resolveIntergalacticConvoyArrival,
  resolveIntergalacticConvoyReturn,
  type IntergalacticConvoyOrder,
} from '../src/services/intergalacticConvoyRaid.js';
import {
  fuelUp,
  giveUnits,
  grant,
  seedWorld,
  testDb,
  testEnv,
  type Fixture,
} from './helpers.js';

const DEFINITION = GALAXY_EVENTS.definitions.INTERGALACTIC_CONVOY;
const effect = DEFINITION.windows[0]!.effect;

let f: Fixture;
let mine: string;
let season: typeof seasons.$inferSelect;

beforeEach(async () => {
  f = await seedWorld(2, 4242);
  mine = f.planetIds[0]!;
  const [loadedSeason] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
  if (!loadedSeason) throw new Error('fixture season missing');
  season = loadedSeason;
  await f.db.update(seasons).set({ rulesetVersion: 8 }).where(eq(seasons.id, f.seasonId));
});

afterAll(async () => { await (await testDb()).close(); });

async function convoyUp(nowMinute = 30): Promise<{
  occurrenceId: string;
  order: (fleet: Fleet, planetId?: string) => Promise<IntergalacticConvoyOrder>;
}> {
  const startsAtMinute = 0;
  const endsAtMinute = 120;
  const startsAt = season.startsAt;
  const endsAt = new Date(startsAt.getTime() + endsAtMinute * 60_000);
  const [occurrence] = await f.db.insert(galaxyEventOccurrences).values({
    seasonId: f.seasonId,
    sequence: 0,
    kind: 'INTERGALACTIC_CONVOY',
    definitionVersion: DEFINITION.version,
    startsAt,
    endsAt,
    effect,
  }).returning();
  f.clock.set(new Date(startsAt.getTime() + nowMinute * 60_000));

  const spec = intergalacticConvoyOf(season.asteroidKey, {
    sequence: 0,
    kind: 'INTERGALACTIC_CONVOY',
    startsAtMinute,
    endsAtMinute,
    definitionVersion: DEFINITION.version,
    effect,
  });
  return {
    occurrenceId: occurrence!.id,
    order: async (fleet, planetId = mine) => {
      const [origin] = await f.db.select().from(planets).where(eq(planets.id, planetId));
      const departAtMinute = minutesSince(season.startsAt, f.clock.now());
      const hit = interceptIntergalacticConvoy({
        origin: origin!,
        spec,
        departAtMinute,
        fleetUnitsPerMinute: fleetPace(fleet, { boost: fleetSpeedMult([]), tech: {} })
          / TRAVEL.distanceFactor,
      });
      if (!hit) throw new Error('fixture fleet cannot intercept convoy');
      const flightSeconds = (hit.arrivesAtMinute - departAtMinute) * 60;
      return {
        occurrenceId: occurrence!.id,
        fleet,
        quotedAt: f.clock.now(),
        quotedFlightSeconds: flightSeconds,
        quotedArriveAt: new Date(f.clock.now().getTime() + flightSeconds * 1_000),
      };
    },
  };
}

async function armed(fleet: Fleet, planetId = mine): Promise<void> {
  await grant(f.db, planetId, 500_000, 200_000);
  await fuelUp(f.db, planetId);
  await giveUnits(f.db, planetId, fleet);
}

describe('an intergalactic convoy strike launch', () => {
  it('freezes both moving endpoints, prepays unequal-leg fuel, parks the fleet, and holds a bay', async () => {
    const live = await convoyUp();
    const fleet = { VIPER: 8 } satisfies Fleet;
    await armed(fleet);
    const order = await live.order(fleet);
    const [before] = await f.db.select().from(planets).where(eq(planets.id, mine));

    const launch = await f.db.transaction((tx) => launchIntergalacticConvoy(tx, {
      planetId: mine,
      expectedPlayerId: f.playerIds[0]!,
      order,
      clock: f.clock,
    }));

    expect(launch.engagementEndsAt.getTime() - launch.arriveAt.getTime()).toBe(5_000);
    expect(launch.homeAt.getTime()).toBeGreaterThan(launch.engagementEndsAt.getTime());
    expect(launch.fuel).toBeGreaterThan(0);
    expect(launch.intercept).not.toEqual(launch.engagementEnd);
    expect(await baysInUse(f.db, mine)).toBe(1);

    const [row] = await f.db.select().from(intergalacticConvoyRuns)
      .where(eq(intergalacticConvoyRuns.id, launch.runId));
    expect(row).toMatchObject({
      occurrenceId: live.occurrenceId,
      fleet,
      quotedResourceReward: launch.quotedResourceReward,
      status: 'outbound',
    });
    expect(row!.returnX).toBe(launch.returnPoint.x);
    expect(row!.resourceReward).toBeNull();
    expect(row!.awardedFleet).toBeNull();

    const parked = await f.db.select().from(units).where(and(
      eq(units.planetId, mine),
      eq(units.location, intergalacticConvoyLocation(launch.runId)),
    ));
    expect(parked.map(({ hull, count }) => [hull, count])).toEqual([['VIPER', 8]]);
    const [after] = await f.db.select().from(planets).where(eq(planets.id, mine));
    expect(after!.deuterium).toBeCloseTo(before!.deuterium - launch.fuel, 6);

    const [arrival] = await f.db.select().from(scheduledEvents).where(and(
      eq(scheduledEvents.kind, 'convoy_arrival'),
      eq(scheduledEvents.refId, launch.runId),
    ));
    expect(arrival?.resolveAt).toEqual(launch.engagementEndsAt);
    expect(arrival?.dedupeKey).toBe(`convoy:arrival:${launch.runId}`);
  });

  it('rejects a stale quote atomically before taking fuel, ships, or quota', async () => {
    const live = await convoyUp();
    const fleet = { VIPER: 4 } satisfies Fleet;
    await armed(fleet);
    const order = await live.order(fleet);
    const [before] = await f.db.select().from(planets).where(eq(planets.id, mine));

    await expect(f.db.transaction((tx) => launchIntergalacticConvoy(tx, {
      planetId: mine,
      expectedPlayerId: f.playerIds[0]!,
      /*
        PAST THE AUTHORED AGE, READ OFF THE CONSTANT. D201 review.

        The bound moved 15 → 45 seconds when the guard stopped charging players for
        their own reading speed, and a literal here quietly stopped testing
        anything: sixteen seconds is a perfectly fresh quote now.
      */
      order: {
        ...order,
        quotedAt: new Date(
          order.quotedAt.getTime() - (INTERGALACTIC_CONVOY.maxQuoteAgeSeconds + 1) * 1_000,
        ),
      },
      clock: f.clock,
    }))).rejects.toMatchObject({ code: 'CONVOY_QUOTE_CHANGED', status: 409 });

    expect(await f.db.select().from(intergalacticConvoyRuns)).toHaveLength(0);
    expect(await baysInUse(f.db, mine)).toBe(0);
    const [after] = await f.db.select().from(planets).where(eq(planets.id, mine));
    expect(after!.deuterium).toBeCloseTo(before!.deuterium, 6);
    const [home] = await f.db.select().from(units).where(and(
      eq(units.planetId, mine),
      eq(units.location, 'home'),
      eq(units.hull, 'VIPER'),
    ));
    expect(home?.count).toBe(4);
  });

  it('rejects invalid wings, missing ships, fuel and a convoy that can no longer be reached', async () => {
    const live = await convoyUp();
    await expect(f.db.transaction((tx) => launchIntergalacticConvoy(tx, {
      planetId: mine,
      expectedPlayerId: f.playerIds[0]!,
      order: {
        occurrenceId: live.occurrenceId,
        fleet: { COURIER: 1 },
        quotedAt: f.clock.now(),
        quotedFlightSeconds: 0,
        quotedArriveAt: f.clock.now(),
      },
      clock: f.clock,
    }))).rejects.toMatchObject({ code: 'CONVOY_NEEDS_COMBAT_FLEET' });

    const fleet = { VIPER: 4 } satisfies Fleet;
    const tooMany = await live.order({ VIPER: 5 });
    await armed(fleet);
    await expect(f.db.transaction((tx) => launchIntergalacticConvoy(tx, {
      planetId: mine,
      expectedPlayerId: f.playerIds[0]!,
      order: tooMany,
      clock: f.clock,
    }))).rejects.toMatchObject({ code: 'NOT_ENOUGH_SHIPS' });

    const order = await live.order(fleet);
    await f.db.update(planets).set({ deuterium: 0 }).where(eq(planets.id, mine));
    await expect(f.db.transaction((tx) => launchIntergalacticConvoy(tx, {
      planetId: mine,
      expectedPlayerId: f.playerIds[0]!,
      order,
      clock: f.clock,
    }))).rejects.toMatchObject({ code: 'INSUFFICIENT_FUEL' });

    await f.db.update(planets).set({ deuterium: 100_000 }).where(eq(planets.id, mine));
    f.clock.set(new Date(season.startsAt.getTime() + 119.99 * 60_000));
    await expect(f.db.transaction((tx) => launchIntergalacticConvoy(tx, {
      planetId: mine,
      expectedPlayerId: f.playerIds[0]!,
      order: {
        ...order,
        quotedAt: f.clock.now(),
        quotedFlightSeconds: 0,
        quotedArriveAt: f.clock.now(),
      },
      clock: f.clock,
    }))).rejects.toMatchObject({ code: 'CONVOY_OUT_OF_REACH' });
    expect(await f.db.select().from(intergalacticConvoyRuns)).toHaveLength(0);
  });

  it('holds one active strike per world and preserves the occurrence quota after it returns', async () => {
    const live = await convoyUp();
    const fleet = { VIPER: 4 } satisfies Fleet;
    await armed(fleet);
    const firstOrder = await live.order(fleet);
    const launch = await f.db.transaction((tx) => launchIntergalacticConvoy(tx, {
      planetId: mine,
      expectedPlayerId: f.playerIds[0]!,
      order: firstOrder,
      clock: f.clock,
    }));

    const activeOrder = await live.order(fleet);
    await expect(f.db.transaction((tx) => launchIntergalacticConvoy(tx, {
      planetId: mine,
      expectedPlayerId: f.playerIds[0]!,
      order: activeOrder,
      clock: f.clock,
    }))).rejects.toMatchObject({ code: 'CONVOY_FLEET_ALREADY_AWAY' });

    f.clock.set(launch.engagementEndsAt);
    await f.db.transaction((tx) => resolveIntergalacticConvoyArrival(tx, launch.runId, f.clock));
    f.clock.set(launch.homeAt);
    await f.db.transaction((tx) => resolveIntergalacticConvoyReturn(tx, launch.runId, f.clock));
    const repeatOrder = await live.order(fleet);
    await expect(f.db.transaction((tx) => launchIntergalacticConvoy(tx, {
      planetId: mine,
      expectedPlayerId: f.playerIds[0]!,
      order: repeatOrder,
      clock: f.clock,
    }))).rejects.toMatchObject({ code: 'CONVOY_ALREADY_RAIDED' });
  });

  /**
   * A SERVER FAULT DOES NOT COST A COMMANDER THEIR ONE SHOT. D201.
   *
   * The outbound recovery path exists only when the arrival event failed for good:
   * the wing never fired and the reward is zero. Holding the occurrence quota for
   * the rest of a two-hour crossing would charge the player for our outage, so the
   * abandoned row drops out of the partial unique index. The FUEL stays spent —
   * D136 refunds nothing on any path.
   */
  it('gives the occurrence quota back when an outbound strike is abandoned', async () => {
    const live = await convoyUp();
    const fleet = { VIPER: 4 } satisfies Fleet;
    await armed(fleet);
    const firstOrder = await live.order(fleet);
    const launch = await f.db.transaction((tx) => launchIntergalacticConvoy(tx, {
      planetId: mine,
      expectedPlayerId: f.playerIds[0]!,
      order: firstOrder,
      clock: f.clock,
    }));

    expect(await abandonIntergalacticConvoyRun(f.db, launch.runId, 'outbound', f.clock))
      .not.toBeNull();
    const [abandoned] = await f.db
      .select()
      .from(intergalacticConvoyRuns)
      .where(eq(intergalacticConvoyRuns.id, launch.runId));
    expect(abandoned?.abandonedAt).toBeInstanceOf(Date);
    expect(abandoned?.resourceReward).toEqual({ alloy: 0, crystal: 0, deuterium: 0 });

    // The ration is back: the same world may strike the same crossing again.
    await armed(fleet);
    const retryOrder = await live.order(fleet);
    const again = await f.db.transaction((tx) => launchIntergalacticConvoy(tx, {
      planetId: mine,
      expectedPlayerId: f.playerIds[0]!,
      order: retryOrder,
      clock: f.clock,
    }));
    expect(again.runId).not.toBe(launch.runId);
  });

  /**
   * THE SPENT RATION TRAVELS WITH THE WORLD, NOT ONLY WITH THE REFUSAL. D124.
   *
   * `convoyLaunchLocked` clears the instant the fleet lands; the quota does not.
   * Without a second flag the control re-armed inside the same crossing.
   */
  it('publishes the spent occurrence on the planet view once the fleet is home', async () => {
    const live = await convoyUp();
    const fleet = { VIPER: 4 } satisfies Fleet;
    await armed(fleet);
    const before = await f.db.transaction((tx) => planetView(tx, mine, f.clock));
    expect(before.convoyOccurrenceSpent).toBe(false);

    const spentOrder = await live.order(fleet);
    const launch = await f.db.transaction((tx) => launchIntergalacticConvoy(tx, {
      planetId: mine,
      expectedPlayerId: f.playerIds[0]!,
      order: spentOrder,
      clock: f.clock,
    }));
    f.clock.set(launch.engagementEndsAt);
    await f.db.transaction((tx) => resolveIntergalacticConvoyArrival(tx, launch.runId, f.clock));
    f.clock.set(launch.homeAt);
    await f.db.transaction((tx) => resolveIntergalacticConvoyReturn(tx, launch.runId, f.clock));

    const after = await f.db.transaction((tx) => planetView(tx, mine, f.clock));
    expect(after.convoyLaunchLocked).toBe(false);
    expect(after.convoyOccurrenceSpent).toBe(true);
  });

  it('serialises a same-world race while allowing two worlds of one commander to launch', async () => {
    const live = await convoyUp();
    const wing = { VIPER: 4 } satisfies Fleet;
    await armed({ VIPER: 8 });
    const order = await live.order(wing);
    const race = await Promise.allSettled(Array.from({ length: 2 }, () =>
      f.db.transaction((tx) => launchIntergalacticConvoy(tx, {
        planetId: mine,
        expectedPlayerId: f.playerIds[0]!,
        order,
        clock: f.clock,
      }))));
    expect(race.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    expect(race.filter(({ status }) => status === 'rejected')).toHaveLength(1);
    expect(await f.db.select().from(intergalacticConvoyRuns)).toHaveLength(1);

    const colony = f.planetIds[1];
    if (!colony) throw new Error('fixture colony missing');
    await f.db.update(planets).set({
      controllerPlayerId: f.playerIds[0],
      kind: 'COLONY',
    }).where(eq(planets.id, colony));
    await armed(wing, colony);
    const colonyOrder = await live.order(wing, colony);
    const colonyLaunch = await f.db.transaction((tx) => launchIntergalacticConvoy(tx, {
      planetId: colony,
      expectedPlayerId: f.playerIds[0]!,
      order: colonyOrder,
      clock: f.clock,
    }));
    expect(colonyLaunch.runId).toBeTruthy();
    expect(await baysInUse(f.db, mine)).toBe(1);
    expect(await baysInUse(f.db, colony)).toBe(1);
    expect(await f.db.select().from(intergalacticConvoyRuns)).toHaveLength(2);
  });

  it('persists one deterministic result at engagement end and delivers both prizes once', async () => {
    const live = await convoyUp();
    const fleet = { VIPER: 8, COURIER: 2 } satisfies Fleet;
    await armed(fleet);
    const order = await live.order(fleet);
    const launch = await f.db.transaction((tx) => launchIntergalacticConvoy(tx, {
      planetId: mine,
      expectedPlayerId: f.playerIds[0]!,
      order,
      clock: f.clock,
    }));

    f.clock.set(launch.engagementEndsAt);
    await f.db.transaction((tx) => resolveIntergalacticConvoyArrival(tx, launch.runId, f.clock));
    const [returning] = await f.db.select().from(intergalacticConvoyRuns)
      .where(eq(intergalacticConvoyRuns.id, launch.runId));
    expect(returning).toMatchObject({
      status: 'returning',
      resourceReward: launch.quotedResourceReward,
    });
    expect(returning!.awardedFleet).not.toBeNull();
    const firstAward = returning!.awardedFleet;

    await f.db.transaction((tx) => resolveIntergalacticConvoyArrival(tx, launch.runId, f.clock));
    const results = await f.db.select().from(notifications).where(and(
      eq(notifications.kind, 'convoy_result'),
      eq(notifications.refId, launch.runId),
    ));
    expect(results).toHaveLength(1);
    expect(results[0]!.payload).toMatchObject({
      trip: 'intergalactic_convoy',
      runId: launch.runId,
      resourceReward: launch.quotedResourceReward,
      awardedFleet: firstAward,
      inTransit: true,
    });
    const returns = await f.db.select().from(scheduledEvents).where(and(
      eq(scheduledEvents.kind, 'convoy_return'),
      eq(scheduledEvents.refId, launch.runId),
    ));
    expect(returns).toHaveLength(1);
    expect(returns[0]!.resolveAt).toEqual(launch.homeAt);
    expect(returns[0]!.dedupeKey).toBe(`convoy:return:${launch.runId}`);

    const [before] = await f.db.select().from(planets).where(eq(planets.id, mine));
    f.clock.set(launch.homeAt);
    const delivery = await f.db.transaction((tx) =>
      resolveIntergalacticConvoyReturn(tx, launch.runId, f.clock));
    expect(delivery).toMatchObject({
      runId: launch.runId,
      resourceReward: launch.quotedResourceReward,
      awardedFleet: firstAward,
    });
    expect(await baysInUse(f.db, mine)).toBe(0);
    expect(await f.db.select().from(units).where(eq(
      units.location,
      intergalacticConvoyLocation(launch.runId),
    ))).toHaveLength(0);
    const [after] = await f.db.select().from(planets).where(eq(planets.id, mine));
    expect(after!.alloy).toBeCloseTo(before!.alloy + launch.quotedResourceReward.alloy, 6);
    expect(after!.crystal).toBeCloseTo(before!.crystal + launch.quotedResourceReward.crystal, 6);
    expect(after!.deuterium).toBeCloseTo(before!.deuterium + launch.quotedResourceReward.deuterium, 6);

    const home = await f.db.select().from(units).where(and(
      eq(units.planetId, mine),
      eq(units.location, 'home'),
    ));
    const delivered = Object.fromEntries(home.filter(({ count }) => count > 0)
      .map(({ hull, count }) => [hull, count]));
    expect(delivered.VIPER).toBe(8 + (firstAward!.VIPER ?? 0));
    expect(delivered.COURIER).toBe(2 + (firstAward!.COURIER ?? 0));

    await f.db.transaction((tx) => resolveIntergalacticConvoyReturn(tx, launch.runId, f.clock));
    expect((await f.db.select().from(notifications).where(and(
      eq(notifications.kind, 'fleet_returned'),
      eq(notifications.refId, launch.runId),
    )))).toHaveLength(1);
  });

  it('returns the fleet and frozen prizes to the commander when the origin changes hands', async () => {
    const fallback = f.planetIds[1];
    if (!fallback) throw new Error('fixture fallback world missing');
    await f.db.update(planets).set({ kind: 'COLONY' }).where(eq(planets.id, mine));
    await f.db.update(planets).set({
      controllerPlayerId: f.playerIds[0],
      kind: 'CAPITAL',
    }).where(eq(planets.id, fallback));
    const live = await convoyUp();
    const fleet = { VIPER: 4, COURIER: 1 } satisfies Fleet;
    await armed(fleet);
    const order = await live.order(fleet);
    const launch = await f.db.transaction((tx) => launchIntergalacticConvoy(tx, {
      planetId: mine,
      expectedPlayerId: f.playerIds[0]!,
      order,
      clock: f.clock,
    }));
    const [fallbackBefore] = await f.db.select().from(planets).where(eq(planets.id, fallback));

    await f.db.update(planets).set({
      controllerPlayerId: f.playerIds[1],
      kind: 'COLONY',
    }).where(eq(planets.id, mine));
    f.clock.set(launch.engagementEndsAt);
    await f.db.transaction((tx) => resolveIntergalacticConvoyArrival(tx, launch.runId, f.clock));
    const [resolved] = await f.db.select().from(intergalacticConvoyRuns)
      .where(eq(intergalacticConvoyRuns.id, launch.runId));
    f.clock.set(launch.homeAt);
    const delivery = await f.db.transaction((tx) =>
      resolveIntergalacticConvoyReturn(tx, launch.runId, f.clock));

    expect(delivery?.destinationPlanetId).toBe(fallback);
    const fallbackHome = await f.db.select().from(units).where(and(
      eq(units.planetId, fallback),
      eq(units.location, 'home'),
    ));
    const delivered = Object.fromEntries(fallbackHome.map(({ hull, count }) => [hull, count]));
    expect(delivered.VIPER).toBe(4 + (resolved?.awardedFleet?.VIPER ?? 0));
    expect(delivered.COURIER).toBe(1 + (resolved?.awardedFleet?.COURIER ?? 0));
    const [fallbackAfter] = await f.db.select().from(planets).where(eq(planets.id, fallback));
    expect(fallbackAfter!.alloy).toBeCloseTo(
      fallbackBefore!.alloy + (resolved?.resourceReward?.alloy ?? 0),
      6,
    );
    expect(await f.db.select().from(units).where(eq(
      units.location,
      intergalacticConvoyLocation(launch.runId),
    ))).toHaveLength(0);
  });

  it('detects and safely recalls an outbound run whose arrival event vanished', async () => {
    const live = await convoyUp();
    const fleet = { VIPER: 3 } satisfies Fleet;
    await armed(fleet);
    const order = await live.order(fleet);
    const launch = await f.db.transaction((tx) => launchIntergalacticConvoy(tx, {
      planetId: mine,
      expectedPlayerId: f.playerIds[0]!,
      order,
      clock: f.clock,
    }));
    await f.db.delete(scheduledEvents).where(and(
      eq(scheduledEvents.kind, 'convoy_arrival'),
      eq(scheduledEvents.refId, launch.runId),
    ));
    f.clock.set(new Date(launch.engagementEndsAt.getTime() + 6 * 60_000));

    expect(await strandedFlightCount(f.db, f.clock.now())).toBe(1);
    expect(await sweepStranded(f.db, f.clock)).toBe(1);
    expect(await strandedFlightCount(f.db, f.clock.now())).toBe(0);
    const [run] = await f.db.select().from(intergalacticConvoyRuns)
      .where(eq(intergalacticConvoyRuns.id, launch.runId));
    expect(run).toMatchObject({
      status: 'done',
      resourceReward: { alloy: 0, crystal: 0, deuterium: 0 },
      awardedFleet: {},
    });
    expect(await baysInUse(f.db, mine)).toBe(0);
    const [home] = await f.db.select().from(units).where(and(
      eq(units.planetId, mine),
      eq(units.location, 'home'),
      eq(units.hull, 'VIPER'),
    ));
    expect(home?.count).toBe(3);
  });

  it('delivers the persisted prizes when a returning run loses its return event', async () => {
    const live = await convoyUp();
    const fleet = { VIPER: 3 } satisfies Fleet;
    await armed(fleet);
    const order = await live.order(fleet);
    const launch = await f.db.transaction((tx) => launchIntergalacticConvoy(tx, {
      planetId: mine,
      expectedPlayerId: f.playerIds[0]!,
      order,
      clock: f.clock,
    }));
    f.clock.set(launch.engagementEndsAt);
    await f.db.transaction((tx) => resolveIntergalacticConvoyArrival(tx, launch.runId, f.clock));
    const [returning] = await f.db.select().from(intergalacticConvoyRuns)
      .where(eq(intergalacticConvoyRuns.id, launch.runId));
    if (!returning?.resourceReward || !returning.awardedFleet) {
      throw new Error('fixture convoy did not persist its prizes');
    }
    await f.db.delete(scheduledEvents).where(and(
      eq(scheduledEvents.kind, 'convoy_return'),
      eq(scheduledEvents.refId, launch.runId),
    ));
    const [before] = await f.db.select().from(planets).where(eq(planets.id, mine));
    f.clock.set(new Date(launch.homeAt.getTime() + 6 * 60_000));

    expect(await strandedFlightCount(f.db, f.clock.now())).toBe(1);
    expect(await sweepStranded(f.db, f.clock)).toBe(1);
    expect(await sweepStranded(f.db, f.clock)).toBe(0);
    const [done] = await f.db.select().from(intergalacticConvoyRuns)
      .where(eq(intergalacticConvoyRuns.id, launch.runId));
    expect(done?.status).toBe('done');
    const [after] = await f.db.select().from(planets).where(eq(planets.id, mine));
    expect(after?.alloy).toBe(before!.alloy + returning.resourceReward.alloy);
    expect(after?.crystal).toBe(before!.crystal + returning.resourceReward.crystal);
    expect(after?.deuterium).toBe(before!.deuterium + returning.resourceReward.deuterium);
    const [home] = await f.db.select().from(units).where(and(
      eq(units.planetId, mine),
      eq(units.location, 'home'),
      eq(units.hull, 'VIPER'),
    ));
    expect(home?.count).toBe(3 + (returning.awardedFleet.VIPER ?? 0));
  });

  it('keeps the attacking fleet behind sensor fog but publishes an anonymous engagement flash', async () => {
    const live = await convoyUp();
    const fleet = { VIPER: 3 } satisfies Fleet;
    await armed(fleet);
    const order = await live.order(fleet);
    const launch = await f.db.transaction((tx) => launchIntergalacticConvoy(tx, {
      planetId: mine,
      expectedPlayerId: f.playerIds[0]!,
      order,
      clock: f.clock,
    }));
    const halfway = new Date((launch.departAt.getTime() + launch.arriveAt.getTime()) / 2);
    const craftAt = {
      x: (launch.returnPoint.x + launch.intercept.x) / 2,
      y: (launch.returnPoint.y + launch.intercept.y) / 2,
      z: (launch.returnPoint.z + launch.intercept.z) / 2,
    };
    const project = async (now: Date, sensors: Parameters<typeof projectGalaxyTraffic>[5], owner: string | null = null) => {
      const [snapshot, pirates] = await Promise.all([
        loadTrafficSnapshot(f.db, f.seasonId, now),
        loadPirateSnapshot(f.db, f.seasonId, now),
      ]);
      return projectGalaxyTraffic(
        snapshot,
        owner === null ? null : mine,
        now,
        owner,
        owner === null ? [] : [mine],
        sensors,
        new Set(),
        pirates,
        new Set(),
      );
    };

    expect((await project(halfway, [])).some(({ id }) => id === launch.runId)).toBe(false);
    const sphere = sensorSphere(craftAt, 900, 900, f.planetIds[1]);
    const eye = [{
      ...sphere,
      planetId: f.planetIds[1]!,
      telescope: true,
      warn: 0,
      revealsSize: true,
      revealsKind: true,
    }];
    const seen = (await project(halfway, eye)).find(({ id }) => id === launch.runId);
    expect(seen).toMatchObject({ kind: 'fleet', fleet });
    expect((await project(halfway, eye, f.playerIds[0]))
      .some(({ id }) => id === launch.runId)).toBe(false);

    const firingAt = new Date(launch.arriveAt.getTime() + 2_500);
    const flash = (await project(firingAt, [])).find(({ id }) => id === launch.runId);
    expect(flash).toMatchObject({ kind: 'unknown', effectOnly: true, landing: true });
    expect(flash?.fleet).toBeUndefined();
    expect(flash?.silhouette).toBeUndefined();

    // A delayed worker has not changed the persisted status yet, but the frozen
    // timestamps still move the craft onto its return leg. Rendering must never
    // park it at the intercept while the queue catches up.
    const returningAt = new Date(
      (launch.engagementEndsAt.getTime() + launch.homeAt.getTime()) / 2,
    );
    const [ownerThread] = (await pendingThreads(f.db, mine, returningAt))
      .filter(({ id }) => id === launch.runId);
    expect(ownerThread).toMatchObject({
      leg: 'return',
      path: {
        from: launch.engagementEnd,
        to: launch.returnPoint,
        departAt: launch.engagementEndsAt,
        arriveAt: launch.homeAt,
      },
    });
    const returnCraftAt = {
      x: (launch.engagementEnd.x + launch.returnPoint.x) / 2,
      y: (launch.engagementEnd.y + launch.returnPoint.y) / 2,
      z: (launch.engagementEnd.z + launch.returnPoint.z) / 2,
    };
    const returnEye = [{
      ...sensorSphere(returnCraftAt, 900, 900, f.planetIds[1]),
      planetId: f.planetIds[1]!,
      telescope: true,
      warn: 0,
      revealsSize: true,
      revealsKind: true,
    }];
    expect((await project(returningAt, returnEye)).find(({ id }) => id === launch.runId))
      .toMatchObject({ kind: 'fleet', fleet });
  });
});

describe('the intergalactic convoy launch route', () => {
  let app: FastifyInstance;
  let auth: { authorization: string };

  beforeEach(async () => {
    app = buildApp({ env: testEnv(), logger: pino({ level: 'silent' }), db: f.db, clock: f.clock }).app;
    await app.ready();
    const tokens = new TokenService('test-secret-that-is-long-enough', 15, 30);
    auth = { authorization: `Bearer ${await tokens.issueAccess(f.accountIds[0]!)}` };
  });

  afterEach(async () => { await app.close(); });

  it('requires an idempotency key and replays only immutable command data with a fresh planet view', async () => {
    const live = await convoyUp();
    const fleet = { VIPER: 8 } satisfies Fleet;
    await armed(fleet);
    const order = await live.order(fleet);
    const payload = {
      originPlanetId: mine,
      occurrenceId: order.occurrenceId,
      fleet,
      quotedAt: order.quotedAt.toISOString(),
      quotedFlightSeconds: order.quotedFlightSeconds,
      quotedArriveAt: order.quotedArriveAt.toISOString(),
    };

    const missing = await app.inject({
      method: 'POST', url: '/api/intergalactic-convoy/launch', headers: auth, payload,
    });
    expect(missing.statusCode).toBe(400);

    const headers = { ...auth, 'idempotency-key': 'convoy-launch-1' };
    const first = await app.inject({
      method: 'POST', url: '/api/intergalactic-convoy/launch', headers, payload,
    });
    expect(first.statusCode, first.body).toBe(200);
    const firstBody = first.json<{
      runId: string;
      pending: { id?: string }[];
      planet: { planet: { alloy: number } };
    }>();
    expect(firstBody.pending.some((thread) => thread.id === firstBody.runId)).toBe(true);

    await f.db.update(planets).set({ alloy: 123_456 }).where(eq(planets.id, mine));
    const replay = await app.inject({
      method: 'POST', url: '/api/intergalactic-convoy/launch', headers, payload,
    });
    expect(replay.statusCode, replay.body).toBe(200);
    const replayBody = replay.json<typeof firstBody>();
    expect(replayBody.runId).toBe(firstBody.runId);
    expect(replayBody.planet.planet.alloy).toBe(123_456);
    expect(await f.db.select().from(intergalacticConvoyRuns)).toHaveLength(1);

    const conflict = await app.inject({
      method: 'POST',
      url: '/api/intergalactic-convoy/launch',
      headers,
      payload: { ...payload, fleet: { VIPER: 7 } },
    });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json<{ error: string }>().error).toBe('IDEMPOTENCY_CONFLICT');

    const telemetry = app.metrics.status();
    expect(telemetry.operations['intergalactic-convoy.launch']).toEqual({
      accepted: 1,
      replay: 1,
    });
    expect(telemetry.refusals['POST /api/intergalactic-convoy/launch']).toMatchObject({
      IDEMPOTENCY_KEY_REQUIRED: 1,
      IDEMPOTENCY_CONFLICT: 1,
    });
  });
});
