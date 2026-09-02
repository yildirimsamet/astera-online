import { and, asc, eq, inArray } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { ANTI_STRATEGIC, DEATH_STAR, TRAVEL, radarRange } from '@astera/rules';
import {
  galaxyEvents,
  missions,
  notifications,
  planets,
  scheduledEvents,
  strategicAssets,
  strategicImpacts,
  strategicInterceptions,
} from '../src/db/schema.js';
import { buildDeathStar, buildInterceptor, launchDeathStar } from '../src/services/strategic.js';
import { planetView } from '../src/services/planetView.js';
import { transferPlanetControl } from '../src/services/ownership.js';
import { launchAttack } from '../src/services/mission.js';
import { EventWorker } from '../src/worker/loop.js';
import { EventBus } from '../src/stream/bus.js';
import {
  TEST_DATABASE_URL,
  giveInstrument,
  giveResearch,
  giveSatellite,
  giveUnits,
  grant,
  placeAt,
  seedWorld,
  setLevel,
  settledAt,
  testDb,
  type Fixture,
} from './helpers.js';

const silent = pino({ level: 'silent' });
const workerFor = (f: Fixture) =>
  new EventWorker(f.db, f.clock, { pollMs: 1, batch: 100, staleMinutes: 5 }, silent);

const interceptors = async (f: Fixture, planetId: string, status?: string) => {
  const rows = await f.db
    .select()
    .from(strategicAssets)
    .where(and(eq(strategicAssets.planetId, planetId), eq(strategicAssets.type, 'INTERCEPTOR')));
  return status === undefined ? rows : rows.filter((row) => row.status === status);
};

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

/**
 * A DEATH STAR DIES ON THE CIRCLE THE DEFENDER CAN SEE. T10.
 *
 * An arrival-time check would be an INVISIBLE rule — you would only ever meet its
 * result, which D124 forbids outright. The timed radar circle is already drawn on
 * the disc (D126), so a weapon destroyed on it is a rule with a picture: the
 * explosion happens in space, over the ring, beside the world; the Radar rung
 * suddenly buys something enormous; and an attacker who scouts can read the reach
 * and price the risk before spending 33,000 resources.
 */
describe('the interception grid', () => {
  let f: Fixture;
  let attacker: string;
  let defender: string;

  const armAttacker = async () => {
    await setLevel(f.db, attacker, 'CORE', DEATH_STAR.requiredCore);
    await setLevel(f.db, attacker, 'SHIPYARD', DEATH_STAR.requiredShipyard);
    await grant(f.db, attacker, 400_000, 200_000);
    await giveResearch(f.db, attacker, 'DEATH_STAR_PROTOCOL');
    await f.db.insert(strategicAssets).values({
      planetId: attacker,
      status: 'READY',
      startedAt: f.clock.now(),
      remainingSeconds: 0,
    });
  };

  const armDefender = async (radar: number = ANTI_STRATEGIC.requiredRadar) => {
    // An Uplink gates the Radar, so a grid needs one before its ring exists at all.
    await giveSatellite(f.db, defender, 'UPLINK');
    await giveInstrument(f.db, defender, 'RADAR', radar);
    await giveResearch(f.db, defender, ANTI_STRATEGIC.requiredResearch);
    await f.db.insert(strategicAssets).values({
      planetId: defender,
      type: 'INTERCEPTOR',
      status: 'READY',
      startedAt: f.clock.now(),
      remainingSeconds: 0,
    });
  };

  /**
   * Fly the strike the way the worker actually would.
   *
   * The interception fires on a RING, which is somewhere in the middle of the leg
   * — jumping the clock straight to `arriveAt` skips the whole event and lands a
   * weapon that should have died on the way. So this walks the pending queue the
   * way a one-second worker does: to each due event in turn, then on to arrival.
   */
  const strike = async () => {
    const launched = await launchDeathStar(f.db, attacker, defender, f.clock);
    const worker = workerFor(f);
    for (let step = 0; step < 30; step++) {
      const [next] = await f.db
        .select({ at: scheduledEvents.resolveAt })
        .from(scheduledEvents)
        .where(eq(scheduledEvents.status, 'pending'))
        .orderBy(asc(scheduledEvents.resolveAt))
        .limit(1);
      if (!next || next.at > launched.arriveAt) break;
      if (next.at > f.clock.now()) f.clock.set(next.at);
      await worker.tick();
    }
    f.clock.set(launched.arriveAt);
    await worker.tick();
    return launched;
  };

  beforeEach(async () => {
    f = await seedWorld(3);
    [attacker, defender] = f.planetIds as [string, string, string];
    await placeAt(f.db, attacker, { x: 0 });
    await placeAt(f.db, defender, { x: radarRange(5) * 4 });
    await setLevel(f.db, defender, 'CORE', 8);
    await grant(f.db, defender, 200_000, 80_000);
    f.clock.advance(250);
  });

  describe('when it fires', () => {
    it('destroys the weapon before it lands, and spends the charge', async () => {
      await armAttacker();
      await armDefender();

      const launched = await strike();

      const [mission] = await f.db.select().from(missions)
        .where(eq(missions.id, launched.missionId));
      expect(mission?.status).not.toBe('in_flight');
      expect(await interceptors(f, defender, 'READY')).toHaveLength(0);
      expect(await interceptors(f, defender, 'CONSUMED')).toHaveLength(1);
      // And the world was never struck.
      const [world] = await f.db.select().from(planets).where(eq(planets.id, defender));
      expect(world?.recoveryUntil).toBeNull();
    });

    /**
     * THE MOST EXPENSIVE THING IN THE GAME DYING IS NOT A PRIVATE EVENT. D106.
     * Shared effects publish their moment and their place, and both commanders are
     * told — the defender that they stopped it, the attacker that they lost it.
     */
    it('tells the whole galaxy where it happened, and both sides what it means', async () => {
      await armAttacker();
      await armDefender();

      const launched = await strike();

      const [event] = await f.db.select().from(galaxyEvents)
        .where(eq(galaxyEvents.refId, launched.missionId));
      expect(event?.kind).toBe('strategic_intercept');
      // Both commanders, and each told from their own side: one stopped it, one
      // lost it. Filtered to the kind, because a launch legitimately produces
      // other news of its own.
      const told = (await f.db.select().from(notifications))
        .filter((row) => row.kind === 'strategic_intercepted');
      expect(told.map((row) => row.playerId).sort())
        .toEqual([f.playerIds[0]!, f.playerIds[1]!].sort());
      expect(told.some((row) => (row.payload as { defended?: boolean }).defended)).toBe(true);
      expect(told.some((row) => !(row.payload as { defended?: boolean }).defended)).toBe(true);
    });

    it('keeps the eight-second launch private until the public impact moment', async () => {
      await armAttacker();
      await armDefender();
      const bus = new EventBus(TEST_DATABASE_URL, silent);
      await bus.start();
      const shardKinds: string[] = [];
      const attackerKinds: string[] = [];
      const defenderKinds: string[] = [];
      const outsiderKinds: string[] = [];
      const stops = [
        bus.subscribeShard(f.seasonId, (event) => shardKinds.push(event.kind)),
        bus.subscribe(f.playerIds[0]!, (event) => attackerKinds.push(event.kind)),
        bus.subscribe(f.playerIds[1]!, (event) => defenderKinds.push(event.kind)),
        bus.subscribe(f.playerIds[2]!, (event) => outsiderKinds.push(event.kind)),
      ];
      try {
        const launched = await launchDeathStar(f.db, attacker, defender, f.clock);
        await new Promise((resolve) => setTimeout(resolve, 300));
        shardKinds.length = 0; // The weapon's ordinary public launch is not this event.

        const worker = workerFor(f);
        for (let step = 0; step < 30; step += 1) {
          const [next] = await f.db
            .select({ at: scheduledEvents.resolveAt })
            .from(scheduledEvents)
            .where(eq(scheduledEvents.status, 'pending'))
            .orderBy(asc(scheduledEvents.resolveAt))
            .limit(1);
          if (!next || next.at >= launched.arriveAt) break;
          f.clock.set(next.at);
          await worker.tick();
          const [shot] = await f.db.select({ id: strategicInterceptions.id })
            .from(strategicInterceptions)
            .where(eq(strategicInterceptions.missionId, launched.missionId));
          if (shot) break;
        }
        await new Promise((resolve) => setTimeout(resolve, 300));

        expect(attackerKinds).toContain('private:strategic-sight');
        expect(defenderKinds).toContain('private:strategic-sight');
        expect(outsiderKinds).not.toContain('private:strategic-sight');
        expect(shardKinds).not.toContain('shard:impact');
      } finally {
        for (const stop of stops) stop();
        await bus.stop();
      }
    });

    /**
     * AND THE DEFENDER IS NEVER TOLD BOTH THINGS. A warning that something is
     * coming, delivered beside the news that it is already wreckage, is the
     * interface contradicting itself at the one moment it matters most.
     */
    it('suppresses the incoming warning it just made untrue', async () => {
      await armAttacker();
      await armDefender();

      await strike();

      const kinds = (await f.db.select().from(notifications)).map((row) => row.kind);
      expect(kinds).not.toContain('strategic_incoming');
    });

    /**
     * OWNER'S DECISION, and the alternative gives the capture route away for free:
     * D113 takes a colony with a SECOND strike inside the recovery window, so a
     * grid that went quiet during recovery would never stop the hit that matters.
     */
    it('fires during the recovery window, which is the hit that matters', async () => {
      await armAttacker();
      await armDefender();
      await f.db
        .update(planets)
        .set({ recoveryUntil: new Date(f.clock.now().getTime() + 3 * 60 * 60_000) })
        .where(eq(planets.id, defender));

      await strike();

      expect(await interceptors(f, defender, 'CONSUMED')).toHaveLength(1);
    });

    /** Redelivery is normal. One weapon, one charge, however many times it runs. */
    it('spends exactly one charge however often the handler runs', async () => {
      await armAttacker();
      await armDefender();

      const launched = await strike();
      f.clock.advance(1);
      await workerFor(f).tick();
      await workerFor(f).tick();

      expect(await interceptors(f, defender, 'CONSUMED')).toHaveLength(1);
      const [mission] = await f.db.select().from(missions)
        .where(eq(missions.id, launched.missionId));
      expect(mission?.status).not.toBe('in_flight');
    });

    /**
     * The rung is read WHEN IT FIRES, never when the weapon left — the mirror of
     * the rule the radar warning already obeys. A defender who raised their Radar
     * while the strike was in the air gets the reach they have now.
     */
    it('reads the Radar rung at the moment of the shot', async () => {
      await armAttacker();
      await giveResearch(f.db, defender, ANTI_STRATEGIC.requiredResearch);
      await f.db.insert(strategicAssets).values({
        planetId: defender,
        type: 'INTERCEPTOR',
        status: 'READY',
        startedAt: f.clock.now(),
        remainingSeconds: 0,
      });
      // The rung is raised before the shot and read at it, not at launch.
      await giveSatellite(f.db, defender, 'UPLINK');
      await giveInstrument(f.db, defender, 'RADAR', 5);

      await strike();

      expect(await interceptors(f, defender, 'CONSUMED')).toHaveLength(1);
    });

    it('fires a charge that finishes while an inbound Death Star is already inside the ring', async () => {
      await armAttacker();
      await giveSatellite(f.db, defender, 'UPLINK');
      await giveInstrument(f.db, defender, 'RADAR', 5);
      await giveResearch(f.db, defender, ANTI_STRATEGIC.requiredResearch);

      // A 31-minute leg puts the normal Radar crossing before the 30-minute
      // charge completion, leaving one minute for the newly ready grid to react.
      const distanceForThirtyOneMinutes = (
        DEATH_STAR.speed * (ANTI_STRATEGIC.buildMinutes + 1)
      ) / TRAVEL.distanceFactor;
      await placeAt(f.db, attacker, { x: 0 });
      await placeAt(f.db, defender, { x: distanceForThirtyOneMinutes });

      const launched = await launchDeathStar(f.db, attacker, defender, f.clock);
      const loading = await buildInterceptor(f.db, defender, f.clock);
      expect(loading.readyAt.getTime()).toBeLessThan(launched.arriveAt.getTime());

      const [crossing] = await f.db
        .select({ at: scheduledEvents.resolveAt })
        .from(scheduledEvents)
        .where(and(
          eq(scheduledEvents.kind, 'strategic_intercept'),
          eq(scheduledEvents.refId, launched.missionId),
        ));
      expect(crossing?.at.getTime()).toBeLessThan(loading.readyAt.getTime());

      const worker = workerFor(f);
      f.clock.set(crossing!.at);
      await worker.tick();
      expect(await interceptors(f, defender, 'CONSUMED')).toHaveLength(0);

      f.clock.set(loading.readyAt);
      await worker.tick(); // The charge becomes READY and wakes the missed crossing.
      await worker.tick(); // The newly scheduled immediate interception fires.

      const [shot] = await f.db.select().from(strategicInterceptions)
        .where(eq(strategicInterceptions.missionId, launched.missionId));
      expect(shot?.launchAt).toEqual(loading.readyAt);
      expect(shot!.impactAt.getTime()).toBeLessThan(launched.arriveAt.getTime());
      expect(await interceptors(f, defender, 'CONSUMED')).toHaveLength(1);

      f.clock.set(shot!.impactAt);
      await worker.tick();
      f.clock.set(launched.arriveAt);
      await worker.tick();
      const [world] = await f.db.select().from(planets).where(eq(planets.id, defender));
      expect(world?.recoveryUntil).toBeNull();
      const impacts = await f.db.select().from(strategicImpacts)
        .where(eq(strategicImpacts.missionId, launched.missionId));
      expect(impacts.map((impact) => impact.outcome)).toEqual(['INTERCEPTED']);
    });

    it('does not invent an interception circle below Radar L3', async () => {
      await armAttacker();
      await armDefender(2);

      await strike();

      expect(await interceptors(f, defender, 'READY')).toHaveLength(1);
      const [world] = await f.db.select().from(planets).where(eq(planets.id, defender));
      expect(world?.recoveryUntil).not.toBeNull();
    });

    it('fires through Telescope sight when Radar is below L3', async () => {
      await armAttacker();
      await armDefender(2);
      await giveInstrument(f.db, defender, 'TELESCOPE', 1);
      const view = await f.db.transaction((tx) => planetView(tx, defender, f.clock));
      expect(view.effectiveInstruments.TELESCOPE).toBe(1);

      const launched = await strike();

      const [shot] = await f.db.select().from(strategicInterceptions)
        .where(eq(strategicInterceptions.missionId, launched.missionId));
      expect(shot?.trigger).toBe('TELESCOPE');
      expect(shot!.impactAt.getTime() - shot!.launchAt.getTime()).toBe(8_000);
      const [impact] = await f.db.select().from(strategicImpacts)
        .where(eq(strategicImpacts.missionId, launched.missionId));
      expect(impact?.outcome).toBe('INTERCEPTED');
      expect(await interceptors(f, defender, 'CONSUMED')).toHaveLength(1);
    });

    it('honours an early Telescope crossing from another controlled world', async () => {
      await armAttacker();
      await armDefender(2);
      const colony = f.planetIds[2]!;
      await f.db.update(planets).set({
        controllerPlayerId: f.playerIds[1]!,
        kind: 'COLONY',
      }).where(eq(planets.id, colony));
      await placeAt(f.db, colony, { x: 2_000 });
      await giveSatellite(f.db, colony, 'UPLINK');
      await giveInstrument(f.db, colony, 'TELESCOPE', 1);

      const launched = await strike();

      const [shot] = await f.db.select().from(strategicInterceptions)
        .where(eq(strategicInterceptions.missionId, launched.missionId));
      expect(shot?.trigger).toBe('TELESCOPE');
      // The colony sees it around x=1,500, long before the target's widest Radar
      // boundary around x=6,600. Arming first at the Radar shell would miss this.
      expect(shot!.collisionX).toBeLessThan(3_000);
    });
  });

  describe('when it does not', () => {
    it('lets the strike land on a world with no grid at all', async () => {
      await armAttacker();
      await giveSatellite(f.db, defender, 'UPLINK');
      await giveInstrument(f.db, defender, 'RADAR', 5);

      await strike();

      const [world] = await f.db.select().from(planets).where(eq(planets.id, defender));
      expect(world?.recoveryUntil).not.toBeNull();
    });

    it('lets the strike land once the charge is spent', async () => {
      await armAttacker();
      await armDefender();
      await strike();

      // A second weapon, and nothing left to stop it.
      await f.db.insert(strategicAssets).values({
        planetId: attacker,
        status: 'READY',
        startedAt: f.clock.now(),
        remainingSeconds: 0,
      });
      await strike();

      const [world] = await f.db.select().from(planets).where(eq(planets.id, defender));
      expect(world?.recoveryUntil).not.toBeNull();
    });

    /** A caretaker world has no commander, no research and nothing to fire. */
    it('never fires for a neutral target', async () => {
      await armAttacker();
      const neutral = f.planetIds[2]!;
      await f.db
        .update(planets)
        .set({ controllerPlayerId: null, kind: 'NEUTRAL' })
        .where(eq(planets.id, neutral));

      const launched = await launchDeathStar(f.db, attacker, neutral, f.clock);
      f.clock.set(launched.arriveAt);
      await expect(workerFor(f).tick()).resolves.not.toThrow();
      void launched;
      expect(await interceptors(f, neutral)).toHaveLength(0);
    });
  });

  describe('what it takes to have one', () => {
    it('cannot be built without the research', async () => {
      await giveSatellite(f.db, defender, 'UPLINK');
      await giveInstrument(f.db, defender, 'RADAR', ANTI_STRATEGIC.requiredRadar);
      await expect(buildInterceptor(f.db, defender, f.clock))
        .rejects.toMatchObject({ code: 'INTERCEPTOR_LOCKED' });
    });

    it('cannot be built on a world with no circle to fire along', async () => {
      await giveResearch(f.db, defender, ANTI_STRATEGIC.requiredResearch);
      await giveSatellite(f.db, defender, 'UPLINK');
      await giveInstrument(f.db, defender, 'RADAR', ANTI_STRATEGIC.requiredRadar - 1);
      await expect(buildInterceptor(f.db, defender, f.clock))
        .rejects.toMatchObject({ code: 'INTERCEPTOR_LOCKED', params: {
          requiredRadar: ANTI_STRATEGIC.requiredRadar,
        } });
    });

    it('refuses a second charge while one is already loaded', async () => {
      await armDefender();
      await expect(buildInterceptor(f.db, defender, f.clock))
        .rejects.toMatchObject({ code: 'INTERCEPTOR_LOADED' });
    });

    it('can be reloaded once it has been spent', async () => {
      await armAttacker();
      await armDefender();
      await strike();

      await expect(buildInterceptor(f.db, defender, f.clock)).resolves.toBeTruthy();
    });
  });

  /**
   * IT COMES WITH THE WORLD, exactly as the Death Star does (D113). A commander
   * who takes a defended colony takes its defence — which is the whole reason
   * scouting for one is worth the flight.
   */
  it('changes hands with the world, charge and all', async () => {
    await armDefender();

    await f.db.transaction((tx) =>
      transferPlanetControl(tx, {
        targetPlanetId: defender,
        newPlayerId: f.playerIds[2]!,
        expectedControllerPlayerId: f.playerIds[1]!,
        now: f.clock.now(),
        protectedUntil: f.clock.now(),
      }),
    );

    expect(await interceptors(f, defender, 'READY')).toHaveLength(1);
  });

  /** And a raid does not reach it: it is installed hardware, not a fleet. */
  it('survives an ordinary raid', async () => {
    await armDefender();
    await setLevel(f.db, attacker, 'CORE', 8);
    await giveUnits(f.db, attacker, { DART: 40 });
    await placeAt(f.db, defender, { x: 200 });

    const launch = await launchAttack(f.db, attacker, defender, { DART: 40 }, f.clock);
    f.clock.set(settledAt(launch.arriveAt));
    await workerFor(f).tick();

    expect(await interceptors(f, defender, 'READY')).toHaveLength(1);
  });
});

/**
 * TWO ON THE PAD, BUILT ONE AFTER THE OTHER. T11.
 *
 * The stockpile removes the CHORE — being at the keyboard the minute the first
 * finishes — and keeps the COST, because the second still takes its own hour.
 * Anything else hands one commander a same-hour double strike, and D113 already
 * turns two hits inside a recovery window into a colony changing hands.
 *
 * IT SHIPS WITH THE GRID ON PURPOSE. A charged defender stops the first weapon,
 * so the stockpile is what a serious attacker answers with: send one as bait,
 * land the second. Each feature is the other's price, and either alone reads as
 * one-sided.
 */
describe('stockpiling a second Death Star', () => {
  let f: Fixture;
  let capital: string;

  beforeEach(async () => {
    f = await seedWorld(2);
    capital = f.planetIds[0]!;
    await setLevel(f.db, capital, 'CORE', DEATH_STAR.requiredCore);
    await setLevel(f.db, capital, 'SHIPYARD', DEATH_STAR.requiredShipyard);
    await grant(f.db, capital, 800_000, 400_000);
    await giveResearch(f.db, capital, 'DEATH_STAR_PROTOCOL');
    f.clock.advance(250);
  });

  it('allows only one without the stockpile research', async () => {
    await buildDeathStar(f.db, capital, f.clock);
    await expect(buildDeathStar(f.db, capital, f.clock))
      .rejects.toMatchObject({ code: 'DEATH_STAR_EXISTS' });
  });

  it('allows a second once the research is held', async () => {
    await giveResearch(f.db, capital, 'STRATEGIC_STOCKPILE');
    await buildDeathStar(f.db, capital, f.clock);
    await expect(buildDeathStar(f.db, capital, f.clock)).resolves.toBeTruthy();
  });

  it('never allows a third', async () => {
    await giveResearch(f.db, capital, 'STRATEGIC_STOCKPILE');
    await buildDeathStar(f.db, capital, f.clock);
    await buildDeathStar(f.db, capital, f.clock);
    await expect(buildDeathStar(f.db, capital, f.clock))
      .rejects.toMatchObject({ code: 'DEATH_STAR_EXISTS' });
  });

  /**
   * SERIAL, AND THIS IS THE WHOLE BALANCE OF THE FEATURE. The second weapon does
   * not begin until the first is finished, so two weapons still cost two hours.
   * What the player is spared is having to come back at the exact minute.
   */
  it('does not start the second before the first has finished', async () => {
    await giveResearch(f.db, capital, 'STRATEGIC_STOCKPILE');
    const first = await buildDeathStar(f.db, capital, f.clock);
    const second = await buildDeathStar(f.db, capital, f.clock);

    const rows = await f.db.select().from(strategicAssets)
      .where(eq(strategicAssets.planetId, capital));
    const firstRow = rows.find((row) => row.id === first.assetId);
    const secondRow = rows.find((row) => row.id === second.assetId);
    expect(firstRow?.readyAt).toBeTruthy();
    expect(secondRow?.readyAt).toBeTruthy();
    // The queue is a line, not a pair: the second finishes a full build later.
    expect(secondRow!.readyAt!.getTime() - firstRow!.readyAt!.getTime())
      .toBeGreaterThanOrEqual(DEATH_STAR.buildMinutes * 60_000);
  });

  it('finishes both, and finishing one never finishes the other', async () => {
    await giveResearch(f.db, capital, 'STRATEGIC_STOCKPILE');
    await buildDeathStar(f.db, capital, f.clock);
    await buildDeathStar(f.db, capital, f.clock);

    f.clock.advance(DEATH_STAR.buildMinutes + 1);
    await workerFor(f).tick();
    const half = await f.db.select().from(strategicAssets)
      .where(eq(strategicAssets.planetId, capital));
    expect(half.filter((row) => row.status === 'READY')).toHaveLength(1);

    f.clock.advance(DEATH_STAR.buildMinutes + 1);
    await workerFor(f).tick();
    const both = await f.db.select().from(strategicAssets)
      .where(eq(strategicAssets.planetId, capital));
    expect(both.filter((row) => row.status === 'READY')).toHaveLength(2);
  });

  /** Back to back, and each one holds a flight bay while it flies. */
  it('launches both, one after the other', async () => {
    const target = f.planetIds[1]!;
    await giveResearch(f.db, capital, 'STRATEGIC_STOCKPILE');
    for (let i = 0; i < 2; i++) {
      await f.db.insert(strategicAssets).values({
        planetId: capital,
        status: 'READY',
        startedAt: f.clock.now(),
        remainingSeconds: 0,
      });
    }

    await expect(launchDeathStar(f.db, capital, target, f.clock)).resolves.toBeTruthy();
    await expect(launchDeathStar(f.db, capital, target, f.clock)).resolves.toBeTruthy();

    const flying = await f.db.select().from(missions).where(and(
      eq(missions.kind, 'death_star'),
      eq(missions.status, 'in_flight'),
    ));
    expect(flying).toHaveLength(2);
  });
});

/**
 * AN UPLINK GATES THE RADAR, so it gates the grid that fires along it.
 *
 * A Radar 5 with nothing in orbit to relay it draws no circle at all — the
 * effective rung is zero — and a grid sold against the INSTALLED rung would be the
 * "I built the expensive thing and it never fired" trap arriving through the back
 * door. The build check and the shot read the same effective figure.
 */
describe('the grid needs the ring to actually exist', () => {
  let f: Fixture;
  let world: string;

  beforeEach(async () => {
    f = await seedWorld(2);
    world = f.planetIds[0]!;
    await setLevel(f.db, world, 'CORE', 8);
    await grant(f.db, world, 200_000, 80_000);
    await giveResearch(f.db, world, ANTI_STRATEGIC.requiredResearch);
    await giveInstrument(f.db, world, 'RADAR', 5);
  });

  it('refuses a grid on a world whose Radar has no Uplink', async () => {
    await expect(buildInterceptor(f.db, world, f.clock))
      .rejects.toMatchObject({ code: 'INTERCEPTOR_LOCKED', params: { radar: 0 } });
  });

  it('sells it the moment the Uplink is in orbit', async () => {
    await giveSatellite(f.db, world, 'UPLINK');
    await expect(buildInterceptor(f.db, world, f.clock)).resolves.toBeTruthy();
  });
});

/**
 * A PROBE IS THE ONLY WAY TO KNOW. T10 · D127.
 *
 * This is the strongest argument for the whole feature: a strategic strike stops
 * being a purchase and becomes an INTELLIGENCE decision. 33,000 resources and an
 * hour, spent on a world that may simply delete them — unless you looked first.
 * Nothing about it is public, so looking is the only way.
 */
describe('what a probe brings home about a grid', () => {
  let f: Fixture;
  let mine: string;
  let target: string;

  beforeEach(async () => {
    f = await seedWorld(2);
    [mine, target] = f.planetIds as [string, string];
    await setLevel(f.db, mine, 'CORE', 6);
    await grant(f.db, mine, 100_000, 40_000);
    await giveInstrument(f.db, mine, 'TELESCOPE', 1);
    f.clock.advance(250);
  });

  const probeAndRead = async () => {
    const { launchProbe } = await import('../src/services/intel.js');
    const { probeReports } = await import('../src/db/schema.js');
    const probe = await launchProbe(f.db, mine, target, f.clock);
    f.clock.set(probe.arriveAt);
    await workerFor(f).tick();
    f.clock.advance(600);
    await workerFor(f).tick();
    const [report] = await f.db.select().from(probeReports);
    return report;
  };

  it('says so when the world is loaded', async () => {
    await giveSatellite(f.db, target, 'UPLINK');
    await giveInstrument(f.db, target, 'RADAR', ANTI_STRATEGIC.requiredRadar);
    await f.db.insert(strategicAssets).values({
      planetId: target,
      type: 'INTERCEPTOR',
      status: 'READY',
      startedAt: f.clock.now(),
      remainingSeconds: 0,
    });

    expect((await probeAndRead())?.silhouette?.interceptor).toBe(true);
  });

  it('says so when it is not', async () => {
    expect((await probeAndRead())?.silhouette?.interceptor).toBe(false);
  });

  /**
   * A CHARGE IS NOT A WEAPON ON THE REPORT EITHER. T12.
   *
   * `strategicStatus` is what tells an attacker whether the target is building a
   * Death Star, and it was read untyped and `LIMIT 1` from a table that now holds
   * two kinds of asset. So a defender loading the charge that would SHOOT THAT
   * WEAPON DOWN reported itself as building one — a probe returning the exact
   * opposite of the truth, on the one field the whole strategic act is scouted
   * for. The interceptor flag two queries below it was typed from the day it was
   * written; this one was not.
   */
  it('does not report a loading charge as a Death Star under construction', async () => {
    /*
      A PROBE ONLY REPORTS THE STRATEGIC FIELD ABOVE `probeVisibilityAccuracy`, and
      accuracy comes off the Shipyard against the target's Veil. The three tests
      above read `silhouette.interceptor`, which has no such gate, so the harness
      never needed one.
    */
    await setLevel(f.db, mine, 'SHIPYARD', 4);
    await giveSatellite(f.db, target, 'UPLINK');
    await giveInstrument(f.db, target, 'RADAR', ANTI_STRATEGIC.requiredRadar);
    await f.db.insert(strategicAssets).values({
      planetId: target,
      type: 'INTERCEPTOR',
      status: 'BUILDING',
      startedAt: f.clock.now(),
      readyAt: new Date(f.clock.now().getTime() + 30 * 60_000),
      remainingSeconds: 30 * 60,
    });

    const report = await probeAndRead();
    expect(report?.strategicStatus).toBe('NONE');
    expect(report?.silhouette?.interceptor).toBe(false);
  });

  it('still reports a real weapon standing beside a charge', async () => {
    /*
      A PROBE ONLY REPORTS THE STRATEGIC FIELD ABOVE `probeVisibilityAccuracy`, and
      accuracy comes off the Shipyard against the target's Veil. The three tests
      above read `silhouette.interceptor`, which has no such gate, so the harness
      never needed one.
    */
    await setLevel(f.db, mine, 'SHIPYARD', 4);
    await f.db.insert(strategicAssets).values([
      {
        planetId: target,
        type: 'INTERCEPTOR',
        status: 'BUILDING',
        startedAt: f.clock.now(),
        readyAt: new Date(f.clock.now().getTime() + 30 * 60_000),
        remainingSeconds: 30 * 60,
      },
      {
        planetId: target,
        type: 'DEATH_STAR',
        status: 'READY',
        startedAt: new Date(f.clock.now().getTime() - 60_000),
        remainingSeconds: 0,
      },
    ]);

    expect((await probeAndRead())?.strategicStatus).toBe('READY');
  });

  /** And a spent charge reads as no charge, because that is what it is. */
  it('does not count a charge that has already been fired', async () => {
    await f.db.insert(strategicAssets).values({
      planetId: target,
      type: 'INTERCEPTOR',
      status: 'CONSUMED',
      startedAt: f.clock.now(),
      remainingSeconds: 0,
    });

    expect((await probeAndRead())?.silhouette?.interceptor).toBe(false);
  });
});

/**
 * ONE CHARGE STOPS ONE WEAPON, AND THE SECOND ONE LANDS. T10 · D139.
 *
 * The stockpile research exists to put two Death Stars on a pad, so two strikes
 * crossing one defender's ring together is a play somebody will make. The charge
 * was read without a row lock and spent with an unguarded write, so both handlers
 * saw the same READY row and both wrote CONSUMED over it: one charge, two kills,
 * and the balance D139 rests on inverted.
 */
describe('two weapons against one charge', () => {
  let f: Fixture;
  let attacker: string;
  let second: string;
  let defender: string;

  beforeEach(async () => {
    f = await seedWorld(3);
    [attacker, defender, second] = f.planetIds as [string, string, string];
    await placeAt(f.db, attacker, { x: 0 });
    await placeAt(f.db, defender, { x: radarRange(5) * 4 });
    await placeAt(f.db, second, { x: -radarRange(5) });
    await setLevel(f.db, defender, 'CORE', 8);
    await grant(f.db, defender, 200_000, 80_000);
    f.clock.advance(250);

    await giveSatellite(f.db, defender, 'UPLINK');
    await giveInstrument(f.db, defender, 'RADAR', ANTI_STRATEGIC.requiredRadar);
    await giveResearch(f.db, defender, ANTI_STRATEGIC.requiredResearch);
    await f.db.insert(strategicAssets).values({
      planetId: defender,
      type: 'INTERCEPTOR',
      status: 'READY',
      startedAt: f.clock.now(),
      remainingSeconds: 0,
    });

    for (const world of [attacker, second]) {
      await setLevel(f.db, world, 'CORE', DEATH_STAR.requiredCore);
      await setLevel(f.db, world, 'SHIPYARD', DEATH_STAR.requiredShipyard);
      await grant(f.db, world, 400_000, 200_000);
      await giveResearch(f.db, world, 'DEATH_STAR_PROTOCOL');
      await f.db.insert(strategicAssets).values({
        planetId: world,
        status: 'READY',
        startedAt: f.clock.now(),
        remainingSeconds: 0,
      });
    }
  });

  /** Walk the queue the way the worker does, so every ring crossing is honoured. */
  const flyBoth = async () => {
    const first = await launchDeathStar(f.db, attacker, defender, f.clock);
    const other = await launchDeathStar(f.db, second, defender, f.clock);
    const last = first.arriveAt > other.arriveAt ? first.arriveAt : other.arriveAt;
    const w = workerFor(f);
    for (let step = 0; step < 40; step++) {
      const [next] = await f.db
        .select({ at: scheduledEvents.resolveAt })
        .from(scheduledEvents)
        .where(eq(scheduledEvents.status, 'pending'))
        .orderBy(asc(scheduledEvents.resolveAt))
        .limit(1);
      if (!next || next.at > last) break;
      if (next.at > f.clock.now()) f.clock.set(next.at);
      await w.tick();
    }
    f.clock.set(last);
    await w.tick();
    return [first, other] as const;
  };

  it('spends the charge exactly once', async () => {
    await flyBoth();

    expect(await interceptors(f, defender, 'CONSUMED')).toHaveLength(1);
    expect(await interceptors(f, defender, 'READY')).toHaveLength(0);
  });

  it('lets the second weapon through', async () => {
    const [first, other] = await flyBoth();

    const rows = await f.db.select().from(missions)
      .where(inArray(missions.id, [first.missionId, other.missionId]));
    const intercepted = rows.filter((row) => row.status === 'resolved'
      && row.arriveAt > f.clock.now());
    void intercepted;
    // One world was struck: recovery is the mark a strike actually landed.
    const [world] = await f.db.select().from(planets).where(eq(planets.id, defender));
    expect(world?.recoveryUntil).not.toBeNull();
  });
});

/**
 * TWO KINDS OF ASSET IN ONE TABLE, AND EVERY READ WRITTEN WHEN THERE WAS ONE. T12.
 *
 * `strategic_assets` held nothing but Death Stars until T10 put an interceptor
 * charge in it, and four reads had been written as "the strategic thing on this
 * world" — singular, untyped, `limit 1`. That was harmless for exactly as long as
 * the grid had no route to build it through; T12 gives it one, so all four become
 * live defects in the same release.
 *
 * The worst launches a Death Star off a READY interceptor. The rest are quieter
 * and no less wrong: a strike pauses one of two builds and leaves the other
 * running through a bombardment, a recovery resumes one of two, and the planet
 * view reports whichever asset is NEWEST as the weapon — so a charge built after a
 * Death Star hides the weapon from its own owner.
 */
describe('a world holding both kinds of strategic asset', () => {
  let f: Fixture;
  let attacker: string;
  let defender: string;

  beforeEach(async () => {
    f = await seedWorld(3);
    [attacker, defender] = f.planetIds as [string, string, string];
    await placeAt(f.db, attacker, { x: 0 });
    await placeAt(f.db, defender, { x: 400 });
    await setLevel(f.db, defender, 'CORE', 8);
    await grant(f.db, defender, 200_000, 80_000);
    f.clock.advance(250);
  });

  const put = async (
    planetId: string,
    type: 'DEATH_STAR' | 'INTERCEPTOR',
    status: 'BUILDING' | 'READY',
    startedAt = f.clock.now(),
  ) => {
    const [asset] = await f.db.insert(strategicAssets).values({
      planetId,
      type,
      status,
      startedAt,
      readyAt: status === 'BUILDING' ? new Date(startedAt.getTime() + 30 * 60_000) : null,
      remainingSeconds: status === 'BUILDING' ? 30 * 60 : 0,
    }).returning();
    return asset!;
  };

  const assetsOn = async (planetId: string) => f.db
    .select()
    .from(strategicAssets)
    .where(eq(strategicAssets.planetId, planetId));

  const view = async (planetId: string) =>
    f.db.transaction((tx) => planetView(tx, planetId, f.clock));

  describe('launching', () => {
    /** THE SEVERE ONE. A charge is not a weapon and must never be fired as one. */
    it('refuses a Death Star launch when only an interceptor is ready', async () => {
      await setLevel(f.db, attacker, 'CORE', DEATH_STAR.requiredCore);
      await grant(f.db, attacker, 400_000, 200_000);
      await put(attacker, 'INTERCEPTOR', 'READY');

      await expect(launchDeathStar(f.db, attacker, defender, f.clock))
        .rejects.toMatchObject({ code: 'DEATH_STAR_NOT_READY' });
      expect(await interceptors(f, attacker, 'READY')).toHaveLength(1);
    });

    it('spends the weapon and not the charge when both are ready', async () => {
      await setLevel(f.db, attacker, 'CORE', DEATH_STAR.requiredCore);
      await grant(f.db, attacker, 400_000, 200_000);
      await put(attacker, 'INTERCEPTOR', 'READY');
      const weapon = await put(
        attacker, 'DEATH_STAR', 'READY', new Date(f.clock.now().getTime() - 60_000),
      );

      await launchDeathStar(f.db, attacker, defender, f.clock);

      // The weapon leaves the pad; the charge stays loaded on it.
      const rows = await assetsOn(attacker);
      expect(rows.find((row) => row.id === weapon.id)?.status).toBe('LAUNCHED');
      expect(await interceptors(f, attacker, 'READY')).toHaveLength(1);
    });
  });

  describe('what the owner is shown', () => {
    it('reports the weapon as the weapon even when a charge is newer', async () => {
      await put(defender, 'DEATH_STAR', 'READY', new Date(f.clock.now().getTime() - 60_000));
      await put(defender, 'INTERCEPTOR', 'BUILDING');

      expect((await view(defender)).strategic?.status).toBe('READY');
    });

    it('reports the charge separately from the weapon', async () => {
      await put(defender, 'DEATH_STAR', 'READY', new Date(f.clock.now().getTime() - 60_000));
      await put(defender, 'INTERCEPTOR', 'BUILDING');

      expect((await view(defender)).interceptor?.status).toBe('BUILDING');
    });

    it('reports no charge on a world that has none', async () => {
      await put(defender, 'DEATH_STAR', 'READY');

      expect((await view(defender)).interceptor).toBeNull();
    });

    it('reports no weapon on a world that holds only a charge', async () => {
      await put(defender, 'INTERCEPTOR', 'READY');

      const shown = await view(defender);
      expect(shown.strategic).toBeNull();
      expect(shown.interceptor?.status).toBe('READY');
    });
  });

  /**
   * A strike stops strategic construction (D113). With two builds standing it has
   * to stop BOTH — pausing one and leaving the other running is a world that kept
   * building through a bombardment.
   */
  describe('under bombardment', () => {
    const smash = async () => {
      await setLevel(f.db, attacker, 'CORE', DEATH_STAR.requiredCore);
      await setLevel(f.db, attacker, 'SHIPYARD', DEATH_STAR.requiredShipyard);
      await grant(f.db, attacker, 400_000, 200_000);
      await put(attacker, 'DEATH_STAR', 'READY');
      const launched = await launchDeathStar(f.db, attacker, defender, f.clock);
      f.clock.set(launched.arriveAt);
      await workerFor(f).tick();
    };

    it('pauses both builds', async () => {
      await put(defender, 'DEATH_STAR', 'BUILDING');
      await put(defender, 'INTERCEPTOR', 'BUILDING');

      await smash();

      const rows = await assetsOn(defender);
      expect(rows).toHaveLength(2);
      expect(rows.every((row) => row.status === 'PAUSED')).toBe(true);
      expect(rows.every((row) => (row.remainingSeconds ?? 0) > 0)).toBe(true);
    });

    it('resumes both when the recovery window closes', async () => {
      await put(defender, 'DEATH_STAR', 'BUILDING');
      await put(defender, 'INTERCEPTOR', 'BUILDING');

      await smash();
      const [struck] = await f.db.select().from(planets).where(eq(planets.id, defender));
      f.clock.set(struck!.recoveryUntil!);
      await workerFor(f).tick();

      const rows = await assetsOn(defender);
      expect(rows.every((row) => row.status === 'BUILDING'), JSON.stringify(rows)).toBe(true);
      for (const row of rows) {
        expect(row.readyAt?.getTime())
          .toBe(f.clock.now().getTime() + (row.remainingSeconds ?? 0) * 1000);
      }
    });

    /** Each paused build gets its own completion event back, not one between them. */
    it('schedules a completion for each resumed build', async () => {
      await put(defender, 'DEATH_STAR', 'BUILDING');
      await put(defender, 'INTERCEPTOR', 'BUILDING');

      await smash();
      const [struck] = await f.db.select().from(planets).where(eq(planets.id, defender));
      f.clock.set(struck!.recoveryUntil!);
      await workerFor(f).tick();

      const rows = await assetsOn(defender);
      const pending = await f.db
        .select()
        .from(scheduledEvents)
        .where(and(
          eq(scheduledEvents.kind, 'death_star_ready'),
          eq(scheduledEvents.status, 'pending'),
        ));
      expect(pending.map((row) => row.refId).sort())
        .toEqual(rows.map((row) => row.id).sort());
    });
  });
});
