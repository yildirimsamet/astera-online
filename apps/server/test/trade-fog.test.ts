import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  GALAXY_EVENTS,
  TRADE,
  distance,
  sensorSphere,
  type Fleet,
  type Vec3,
} from '@astera/rules';
import { galaxyEventOccurrences, planets, seasons, tradeRuns } from '../src/db/schema.js';
import { minutesSince } from '../src/clock.js';
import { tradeShipOf } from '../src/services/tradeField.js';
import { launchTrade } from '../src/services/trade.js';
import { loadPirateSnapshot } from '../src/services/pirateField.js';
import {
  loadTrafficSnapshot,
  projectGalaxyTraffic,
  type Contact,
  type SensorPost,
} from '../src/services/traffic.js';
import { pendingThreads } from '../src/services/session.js';
import { transferPlanetControl } from '../src/services/ownership.js';
import { fuelUp, giveUnits, grant, seedWorld, testDb, type Fixture } from './helpers.js';

/**
 * A CONVOY IS AN ORDINARY CRAFT. D123 · D156.
 *
 * The MERCHANT's position is public — it is an announced moment and the disc draws
 * its whole circle. The convoy flying at it is not: it answers to the same three
 * zones as every other craft, because a laden convoy and an inbound raid look
 * exactly alike at Radar range, and that uncertainty is the thing this game sells.
 *
 * `packages/rules/src/sight.ts` is the only statement of the zones, so this file
 * asserts what falls out of it rather than restating the boundaries.
 */
afterAll(async () => {
  const { close } = await testDb();
  await close();
});

const DEFINITION = GALAXY_EVENTS.definitions.TRADE_SHIP;

const post = (at: Vec3, telescope: number, radar: number, planetId: string): SensorPost => ({
  ...sensorSphere(at, telescope, radar, planetId),
  planetId,
  telescope: telescope > 0,
  warn: 0,
  revealsSize: false,
  revealsKind: false,
});

const BLIND: SensorPost[] = [];

describe('a convoy on the disc', () => {
  let f: Fixture;
  let mine: string;
  let seasonStartsAt: Date;
  let key: string;

  beforeEach(async () => {
    f = await seedWorld(3, 4242);
    mine = f.planetIds[0]!;
    const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    seasonStartsAt = season!.startsAt;
    key = season!.asteroidKey;
  });

  const send = async (fleet: Fleet = { COURIER: 4 }) => {
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
    await grant(f.db, mine, 400_000, 120_000);
    await fuelUp(f.db, mine);
    await giveUnits(f.db, mine, fleet);
    return launchTrade(
      f.db,
      mine,
      {
        occurrenceId: row!.id,
        fleet,
        give: { alloy: 900, crystal: 0, deuterium: 0 },
        want: { alloy: 0, crystal: 300, deuterium: 0 },
      },
      f.clock,
    );
  };

  const contactsFor = async (
    sensors: SensorPost[],
    now: Date,
    ownIds: string[] = [],
    ownPlayerId: string | null = null,
  ): Promise<Contact[]> => {
    const [snapshot, pirates] = await Promise.all([
      loadTrafficSnapshot(f.db, f.seasonId, now),
      loadPirateSnapshot(f.db, f.seasonId, now),
    ]);
    return projectGalaxyTraffic(
      snapshot,
      ownIds[0] ?? null,
      now,
      ownPlayerId,
      ownIds,
      sensors,
      new Set(),
      pirates,
      new Set(),
    );
  };

  /** Where the convoy actually is, a third of the way out. */
  const midFlight = async (runId: string): Promise<{ at: Vec3; now: Date }> => {
    const [run] = await f.db.select().from(tradeRuns).where(eq(tradeRuns.id, runId));
    const [world] = await f.db.select().from(planets).where(eq(planets.id, run!.planetId));
    const span = run!.arriveAt.getTime() - run!.departAt.getTime();
    const now = new Date(run!.departAt.getTime() + span / 3);
    const t = 1 / 3;
    return {
      now,
      at: {
        x: world!.x + (run!.interceptX - world!.x) * t,
        y: world!.y + (run!.interceptY - world!.y) * t,
        z: world!.z + (run!.interceptZ - world!.z) * t,
      },
    };
  };

  it('does not exist for a commander whose circles do not cover it', async () => {
    const launch = await send();
    const { now, at } = await midFlight(launch.runId);

    expect((await contactsFor(BLIND, now)).some((c) => c.id === launch.runId)).toBe(false);

    const far = post({ x: -1900, y: 0, z: 0 }, 0, 0, f.planetIds[1]!);
    if (distance(far.at, at) > far.detect) {
      expect((await contactsFor([far], now)).some((c) => c.id === launch.runId)).toBe(false);
    }
  });

  it('is a moving question mark inside a Radar circle, with no roster and no line', async () => {
    const launch = await send();
    const { now, at } = await midFlight(launch.runId);

    /*
      Radar reach without telescope reach. `identify` can never be zero — the naked
      eye has a floor (`SENSOR.baseRadius`) and D123 gives that floor to the EYE,
      not to hardware nobody bought — so the post stands just outside `identify`
      and comfortably inside `detect`.
    */
    const centred = post(at, 0, 5, f.planetIds[1]!);
    const away = { x: at.x + centred.identify + 50, y: at.y, z: at.z };
    const radar = post(away, 0, 5, f.planetIds[1]!);
    expect(distance(radar.at, at)).toBeGreaterThan(radar.identify);
    expect(distance(radar.at, at)).toBeLessThanOrEqual(radar.detect);

    const seen = (await contactsFor([radar], now)).find((c) => c.id === launch.runId);
    expect(seen, 'a convoy inside a radar circle must be drawn').toBeDefined();
    expect(seen!.kind).toBe('unknown');
    expect(seen!.fleet).toBeUndefined();
    expect(seen!.route).toBeUndefined();
    expect(seen!.minutesRemaining).toBeUndefined();
    expect(seen!.mass).toBeUndefined();
    expect(seen!.silhouette).toBeUndefined();
    expect(seen!.craft).toBeUndefined();
  });

  /**
   * A CARGO CONVOY IS A FLEET, AND THAT IS THE POINT. D123 · D156.
   *
   * There is no `trade` contact kind and there must not be one: a defender who
   * could tell a laden convoy from an inbound raid at a glance would be handed,
   * free, the one judgement the intel layer is sold to make.
   */
  it('is a fleet with an exact manifest inside a Telescope circle', async () => {
    const launch = await send({ COURIER: 4, DART: 3 });
    const { now, at } = await midFlight(launch.runId);

    const eye = post(at, 800, 800, f.planetIds[1]!);
    const seen = (await contactsFor([eye], now)).find((c) => c.id === launch.runId);
    expect(seen).toBeDefined();
    expect(seen!.kind).toBe('fleet');
    expect(seen!.fleet).toEqual({ COURIER: 4, DART: 3 });
    expect(seen!.mass).toBeDefined();
    // A heading, never a route: no line, no clock, no cargo.
    expect(seen!.route).toBeUndefined();
    expect(seen!.minutesRemaining).toBeUndefined();
    expect(seen).not.toHaveProperty('give');
    expect(seen).not.toHaveProperty('want');
  });

  it('publishes a bearing, never the rendezvous it is flying to', async () => {
    const launch = await send();
    const { now, at } = await midFlight(launch.runId);
    const eye = post(at, 900, 900, f.planetIds[1]!);
    const seen = (await contactsFor([eye], now)).find((c) => c.id === launch.runId);
    expect(seen).toBeDefined();
    expect(seen!.landing).toBeUndefined();
    // The window's far end is a few minutes ahead, not the meeting point.
    expect(distance(seen!.to, launch.intercept)).toBeGreaterThan(1);
  });

  /**
   * THE OWNER GETS THEIR OWN CONVOY FROM `pendingThreads`, AND ONLY FROM THERE.
   *
   * `traffic` excludes the caller's own craft deliberately — a decorated copy of
   * your own fleet beside the anonymous one is a duplicate-craft bug this codebase
   * has already shipped once — which makes the mission strip the ONLY place a
   * launched convoy is drawn for the commander who launched it.
   */
  it('reaches its owner through the mission strip and not through traffic', async () => {
    const launch = await send();
    const { now, at } = await midFlight(launch.runId);
    const eye = post(at, 900, 900, mine);

    const mineNow = await contactsFor([eye], now, [mine], f.playerIds[0]);
    expect(mineNow.some((c) => c.id === launch.runId)).toBe(false);

    const threads = await pendingThreads(f.db, mine, now);
    const thread = threads.find((t) => t.id === launch.runId);
    expect(thread, 'a launched convoy must be on its own commander\'s strip').toBeDefined();
    expect(thread!.kind).toBe('trade');
    expect(thread!.leg).toBe('outbound');
    expect(thread!.fleet).toEqual({ COURIER: 4 });
    expect(thread!.path).toBeDefined();
    // There is no world on the far end, so no world is named.
    expect(thread!.targetPlanetId).toBeUndefined();
    // The server never writes the sentence; it names the event kind. D150's shape.
    expect(thread!.targetName).toBe('TRADE_SHIP');
  });

  /**
   * WHOSE CONVOY IT IS, NOT WHOSE PAD IT LEFT. D150, applied here before it bites.
   *
   * `trade_runs.owner_player_id` exists for exactly this: a colony that changes
   * hands mid-flight must not move the convoy into the captor's strip, nor hand
   * the captor a full-fidelity reading of a fleet they never had eyes on.
   */
  it('stays with its commander when the pad it left changes hands', async () => {
    const colony = f.planetIds[2]!;
    await f.db.transaction(async (tx) => {
      await transferPlanetControl(tx, {
        targetPlanetId: colony,
        newPlayerId: f.playerIds[0]!,
        expectedControllerPlayerId: f.playerIds[2]!,
        now: f.clock.now(),
        protectedUntil: new Date(f.clock.now().getTime() + 86_400_000),
      });
    });
    mine = colony;
    const launch = await send();
    const { now, at } = await midFlight(launch.runId);

    await f.db.transaction(async (tx) => {
      await transferPlanetControl(tx, {
        targetPlanetId: colony,
        newPlayerId: f.playerIds[1]!,
        expectedControllerPlayerId: f.playerIds[0]!,
        now,
        protectedUntil: new Date(now.getTime() + 86_400_000),
      });
    });

    // The commander who committed the fleet still owns the picture of it.
    const strip = await pendingThreads(f.db, f.planetIds[0]!, now);
    expect(strip.some((t) => t.id === launch.runId)).toBe(true);

    // And the captor, with eyes right on it, gets an anonymous contact at best.
    const eye = post(at, 900, 900, colony);
    const captorView = await contactsFor([eye], now, [colony], f.playerIds[1]);
    const seen = captorView.find((c) => c.id === launch.runId);
    expect(seen, 'a captured pad must not hide somebody else\'s convoy').toBeDefined();
    expect(seen!.kind).toBe('fleet');

    const ownerView = await contactsFor([eye], now, [f.planetIds[0]!], f.playerIds[0]);
    expect(ownerView.some((c) => c.id === launch.runId)).toBe(false);
  });
});
