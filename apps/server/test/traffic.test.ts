import { and, eq } from 'drizzle-orm';
import {
  COMBAT,
  DEATH_STAR,
  activeAsteroids,
  prospectorSpeed,
  interceptAsteroid,
  asteroidPosition,
  coreTier,
  engagementEndsAt,
  orbitStandoff,
  surfaceStandoff,
  visualLeg,
  worldRadius,
  TRAFFIC,
} from '@astera/rules';
import type { FastifyInstance } from 'fastify';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import {
  buildings,
  debrisFields,
  miningRuns,
  missions,
  planets,
  strategicAssets,
  strategicImpacts,
  strategicInterceptions,
} from '../src/db/schema.js';
import { TokenService } from '../src/auth/tokens.js';
import { launchAttack } from '../src/services/mission.js';
import { launchProbe } from '../src/services/intel.js';
import { pendingThreads } from '../src/services/session.js';
import { EventWorker } from '../src/worker/loop.js';
import { launchHarvest, launchMining } from '../src/services/mining.js';
import {
  galaxyTraffic,
  loadTrafficSnapshot,
  projectStrategicInterceptionImpacts,
  projectStrategicInterceptions,
  sensorPosts,
} from '../src/services/traffic.js';
import { refreshSensorEpoch } from '../src/services/sensorHistory.js';
import {
  fuelUp,
  giveInstrument,
  giveSatellite,
  grant,
  giveUnits,
  placeAt,
  seedWorld,
  setLevel,
  settledAt,
  testDb,
  testEnv,
  type Fixture,
} from './helpers.js';

/**
 * A world that has been running a while.
 *
 * These used to advance past the newcomer grace period, which no longer exists
 * (D14). The advance stays because the assertions below are about a settled
 * world — accrued resources, telescope windows that have turned over — and
 * removing it would quietly change what they test.
 */
const SETTLED_MINUTES = 250;

const silent = pino({ level: 'silent' });

interface Contact {
  id: string;
  kind: 'unknown' | 'fleet' | 'probe' | 'death_star' | 'mining' | 'harvest';
  mass?: 'LIGHT' | 'MEDIUM' | 'HEAVY';
  silhouette?: 'unknown' | 'fleet' | 'probe' | 'death_star' | 'mining' | 'harvest';
  fleet?: Record<string, number>;
  craft?: number;
  from: { x: number; y: number; z: number };
  to: { x: number; y: number; z: number };
  startAt: string;
  endAt: string;
  landing?: boolean;
  route?: { from: unknown; to: unknown; departAt: string; arriveAt: string };
  minutesRemaining?: number;
  effectOnly?: true;
  engagement?: { arriveAt: string; endsAt: string; target: { x: number; y: number; z: number } };
}

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

/**
 * POSITION IS PUBLIC; INTENT IS NOT. D24.
 *
 * The rule this file guards was rewritten by owner decision. Other people's craft
 * used to be anonymous motes, offset past attribution and visible only through the
 * middle of a flight — which protected the fog completely and left a galaxy of two
 * hundred people looking deserted. They are real craft at real positions now, for
 * the whole flight, wearing the neon that says what kind they are.
 *
 * WHAT STAYED PRIVATE IS THE ROUTE. The payload carries a bearing window — where a
 * contact is and where it will be shortly — and never the world it left or the one
 * it is heading for. That is the line these tests hold, and they hold it against
 * the raw body rather than the rendering, because a modified client is the threat.
 *
 * Mining has a narrow route exception once the observer has both identified the
 * Prospector and discovered its rock: the line and clock are then readable. An
 * unseen craft or undiscovered target stays behind the same fog.
 */
describe('galaxy traffic — motion in public, intent in private', () => {
  let f: Fixture;
  let app: FastifyInstance;
  let close: () => Promise<void>;
  let auth: { authorization: string };
  let mine: string;
  let a: string;
  let b: string;

  beforeEach(async () => {
    f = await seedWorld(4);
    [mine, a, b] = f.planetIds as [string, string, string];

    // Opposite rims: a contact has to have a real distance to cross before its
    // window says anything, and a short hop is over before it means much.
    await placeAt(f.db, a, { x: -600 });
    await placeAt(f.db, b, { x: 600 });
    /**
     * AND THE OBSERVER SITS ON THE LEG, WITH EYES THAT COVER ALL OF IT.
     *
     * Every test in this file is about something else — what a window may say,
     * what the payload may name, where a craft is drawn — so the caller is placed
     * at the midpoint AND given the instruments to identify the whole 1,200-unit
     * leg. It used to rely on the naked-eye 500 alone, which never actually
     * reached the 600-unit rim; it only looked like it did because the old model
     * published an anonymous return at any distance. The three zones have their
     * own suite in `sensor-horizon.test.ts`.
     */
    await placeAt(f.db, mine, { x: 0 });

    for (const id of f.planetIds) await setLevel(f.db, id, 'CORE', 8);
    await giveSatellite(f.db, mine, 'UPLINK');
    await giveInstrument(f.db, mine, 'TELESCOPE', 5);
    await giveInstrument(f.db, mine, 'RADAR', 5);
    // Every case here launches something across 1,200 units; fuel is T6's subject,
    // not this file's.
    for (const id of f.planetIds) await fuelUp(f.db, id);
    f.clock.advance(SETTLED_MINUTES);

    const built = buildApp({ env: testEnv(), logger: silent, db: f.db, clock: f.clock });
    app = built.app;
    close = built.close;
    await built.bus.start();
    await app.ready();

    const tokens = new TokenService('test-secret-that-is-long-enough', 15, 30);
    auth = { authorization: `Bearer ${await tokens.issueAccess(f.accountIds[0]!)}` };
  });

  afterEach(async () => {
    await close();
  });

  /** Drains the queue, for the tests that need a raid to actually land. */
  const worker = (fixture: Fixture) =>
    new EventWorker(
      fixture.db,
      fixture.clock,
      { pollMs: 1000, batch: 100, staleMinutes: 5 },
      pino({ level: 'silent' }),
    );

  /**
   * A raid between two OTHER planets, which is what the caller may see.
   *
   * IT RETURNS THE LAUNCH, AND `midFlight` MOVES THE CLOCK BY A SHARE OF IT.
   * These tests used to `advance(10)` — ten minutes into a flight that was
   * twenty-seven — and every one of them broke at D63 when hull speeds went up and
   * the same ten minutes landed the fleet before the assertion ran. What they are
   * about is a craft part-way along its leg, so that is what they now say.
   */
  const strangersFight = async (): Promise<{ arriveAt: Date }> => {
    await giveUnits(f.db, a, { WASP: 30 });
    return launchAttack(f.db, a, b, { WASP: 30 }, f.clock);
  };

  /** Move to `share` of the way through a flight that lands at `arriveAt`. */
  const midFlight = (arriveAt: Date, share = 0.5): void => {
    const now = f.clock.now().getTime();
    f.clock.set(new Date(now + (arriveAt.getTime() - now) * share));
  };

  const fetchContacts = async (): Promise<Contact[]> => {
    const res = await app.inject({ method: 'GET', url: '/api/galaxy/traffic', headers: auth });
    expect(res.statusCode).toBe(200);
    return res.json<{ contacts: Contact[] }>().contacts;
  };

  const raw = async (): Promise<string> => {
    const res = await app.inject({ method: 'GET', url: '/api/galaxy/traffic', headers: auth });
    return res.body;
  };

  /* ── what the galaxy may see ───────────────────────────────── */

  it('shows something moving out there', async () => {
    midFlight((await strangersFight()).arriveAt);
    expect(await fetchContacts()).toHaveLength(1);
  });

  it('reuses one shared traffic row snapshot while deriving motion on every read', async () => {
    const delivered = app.bus.status().delivered;
    midFlight((await strangersFight()).arriveAt);
    await vi.waitFor(() => {
      expect(app.bus.status().delivered).toBeGreaterThan(delivered);
    });
    const first = await fetchContacts();
    f.clock.advance(0.1);
    const second = await fetchContacts();

    expect(first[0]?.from).not.toEqual(second[0]?.from);
    expect(app.projections.status().traffic).toMatchObject({ misses: 1, hits: 1 });
  });

  /**
   * A CRAFT IS VISIBLE FROM THE INSTANT IT LEAVES, AND THE SHROUD IS GONE.
   *
   * D123 blacked out the first planet-spacing of every leg, from everybody, at
   * every instrument level — the argument being that "is their fleet home" is the
   * Telescope's product and watching a world tells you for free. The owner's model
   * answers that differently: a telescope sees what happens inside its circle, and
   * what it withholds is the ROUTE. The watch slot still sells the definitive,
   * Veil-contested answer, for every world in the galaxy including the ones out of
   * reach — which is more than eyeballing a departure ever gave.
   *
   * What the shroud actually cost is in `sensor-horizon.test.ts`: a fleet leaving
   * a world 300 units from a maxed Telescope was invisible for a third of its
   * flight, and a probe for most of its life.
   */
  it('shows a craft from the first instant of its leg', async () => {
    const launch = await strangersFight();
    const departAt = f.clock.now().getTime();
    const span = launch.arriveAt.getTime() - departAt;

    for (const share of [0.001, 0.1, 0.3]) {
      f.clock.set(new Date(departAt + span * share));
      expect(await fetchContacts(), `blind at ${String(share)}`).toHaveLength(1);
    }
  });

  it('is still visible on final approach', async () => {
    await giveUnits(f.db, a, { WASP: 30 });
    const launch = await launchAttack(f.db, a, b, { WASP: 30 }, f.clock);
    f.clock.set(new Date(launch.arriveAt.getTime() - 60_000));
    expect(await fetchContacts()).toHaveLength(1);
  });

  it('says what kind of craft it is, because the neon does', async () => {
    midFlight((await strangersFight()).arriveAt);
    expect((await fetchContacts())[0]?.kind).toBe('fleet');
  });

  /** Telescope sight means the formation itself is readable, not merely detected. */
  it('says exactly what is in a fleet inside Telescope sight', async () => {
    midFlight((await strangersFight()).arriveAt);
    const [contact] = await fetchContacts();

    expect(contact?.mass).toBe('LIGHT');
    expect(contact?.fleet).toEqual({ WASP: 30 });
    // Not reconstructed in the renderer — exact on the wire after sight earned it.
    expect(await raw()).toContain('WASP');
  });

  /** Three steps, so the disc says "something big" without saying what. */
  it('reads a serious fleet as a heavier silhouette', async () => {
    await giveUnits(f.db, a, { BULWARK: 30 });
    midFlight((await launchAttack(f.db, a, b, { BULWARK: 30 }, f.clock)).arriveAt);

    expect((await fetchContacts())[0]?.mass).toBe('HEAVY');
  });

  /** And it is stable, or focus would drop the thing the player selected. */
  it('keeps the same id across requests, so focus survives a refetch', async () => {
    midFlight((await strangersFight()).arriveAt);

    const first = await fetchContacts();
    const second = await fetchContacts();
    expect(first[0]?.id).toBeTruthy();
    expect(second[0]?.id).toBe(first[0]?.id);
  });

  it('replays a resolved Death Star impact for the exact public effect window', async () => {
    const arriveAt = f.clock.now();
    const [impact] = await f.db.insert(missions).values({
      seasonId: f.seasonId,
      kind: 'death_star',
      status: 'resolved',
      ownerPlayerId: f.playerIds[1]!,
      originPlanetId: a,
      targetPlanetId: b,
      fleet: {},
      distance: 1200,
      departAt: new Date(arriveAt.getTime() - 120_000),
      arriveAt,
    }).returning();
    const [staleImpact] = await f.db.insert(missions).values({
      seasonId: f.seasonId,
      kind: 'death_star',
      status: 'resolved',
      ownerPlayerId: f.playerIds[1]!,
      originPlanetId: a,
      targetPlanetId: b,
      fleet: {},
      distance: 1200,
      departAt: new Date(arriveAt.getTime() - 240_000),
      arriveAt: new Date(arriveAt.getTime() - DEATH_STAR.impactSeconds * 1000 - 1),
    }).returning();
    await f.db.insert(strategicImpacts).values([
      {
        seasonId: f.seasonId,
        missionId: impact!.id,
        attackerPlayerId: f.playerIds[1]!,
        defenderPlayerId: f.playerIds[2]!,
        targetPlanetId: b,
        outcome: 'FIRST_STRIKE',
        damage: 1,
        destroyedFleet: {},
        createdAt: arriveAt,
      },
      {
        seasonId: f.seasonId,
        missionId: staleImpact!.id,
        attackerPlayerId: f.playerIds[1]!,
        defenderPlayerId: f.playerIds[2]!,
        targetPlanetId: b,
        outcome: 'FIRST_STRIKE',
        damage: 1,
        destroyedFleet: {},
        createdAt: staleImpact!.arriveAt,
      },
    ]);

    f.clock.set(new Date(arriveAt.getTime() + 1));
    const snapshot = await loadTrafficSnapshot(f.db, f.seasonId, f.clock.now());
    expect(snapshot.missionRows.map(({ mission }) => mission.id)).toContain(impact!.id);
    expect(snapshot.missionRows.map(({ mission }) => mission.id)).not.toContain(staleImpact!.id);
    const observer = await galaxyTraffic(
      f.db,
      f.seasonId,
      mine,
      f.clock.now(),
      f.playerIds[0],
      [mine],
    );
    const sender = await galaxyTraffic(
      f.db,
      f.seasonId,
      a,
      f.clock.now(),
      f.playerIds[1],
      [a],
    );
    expect(observer).toContainEqual(expect.objectContaining({
      id: impact!.id,
      kind: 'death_star',
      landing: true,
      endAt: arriveAt,
    }));
    expect(sender).toContainEqual(expect.objectContaining({ id: impact!.id }));

    f.clock.set(new Date(arriveAt.getTime() + DEATH_STAR.impactSeconds * 1000));
    expect(await galaxyTraffic(f.db, f.seasonId, mine, f.clock.now())).toEqual([]);
  });

  it('never draws a ghost weapon or later planet explosion for an intercepted Death Star', async () => {
    const interceptedAt = f.clock.now();
    const arriveAt = new Date(interceptedAt.getTime() + 60_000);
    const [mission] = await f.db.insert(missions).values({
      seasonId: f.seasonId,
      kind: 'death_star',
      status: 'resolved',
      ownerPlayerId: f.playerIds[1]!,
      originPlanetId: a,
      targetPlanetId: b,
      fleet: {},
      distance: 1200,
      departAt: new Date(interceptedAt.getTime() - 60_000),
      arriveAt,
    }).returning();
    await f.db.insert(strategicImpacts).values({
      seasonId: f.seasonId,
      missionId: mission!.id,
      attackerPlayerId: f.playerIds[1]!,
      defenderPlayerId: f.playerIds[2]!,
      targetPlanetId: b,
      outcome: 'INTERCEPTED',
      damage: 0,
      destroyedFleet: {},
      createdAt: interceptedAt,
    });

    // During the dedicated eight-second interception scene, the old contact path
    // must already be gone.
    f.clock.set(new Date(interceptedAt.getTime() + 1));
    expect(await galaxyTraffic(f.db, f.seasonId, mine, f.clock.now())).toEqual([]);
    // Its original arrival instant must not manufacture a planet detonation.
    f.clock.set(new Date(arriveAt.getTime() + 1));
    expect(await galaxyTraffic(f.db, f.seasonId, mine, f.clock.now())).toEqual([]);
  });

  it('shares an interception with participants and Telescope witnesses only', async () => {
    const now = f.clock.now();
    const [mission] = await f.db.insert(missions).values({
      seasonId: f.seasonId,
      kind: 'death_star',
      status: 'resolved',
      ownerPlayerId: f.playerIds[1]!,
      originPlanetId: a,
      targetPlanetId: b,
      fleet: {},
      distance: 1200,
      departAt: new Date(now.getTime() - 60_000),
      arriveAt: new Date(now.getTime() + 60_000),
    }).returning();
    const [charge] = await f.db.insert(strategicAssets).values({
      planetId: b,
      type: 'INTERCEPTOR',
      status: 'CONSUMED',
      missionId: mission!.id,
      startedAt: new Date(now.getTime() - 120_000),
      remainingSeconds: 0,
    }).returning();
    await f.db.insert(strategicInterceptions).values({
      seasonId: f.seasonId,
      missionId: mission!.id,
      attackerPlayerId: f.playerIds[1]!,
      defenderPlayerId: f.playerIds[2]!,
      targetPlanetId: b,
      chargeId: charge!.id,
      trigger: 'TELESCOPE',
      launchAt: now,
      impactAt: new Date(now.getTime() + 8_000),
      launchX: 600,
      launchY: 0,
      launchZ: 0,
      deathStarFromX: -10,
      deathStarFromY: 0,
      deathStarFromZ: 0,
      collisionX: 10,
      collisionY: 0,
      collisionZ: 0,
    });

    const snapshot = await loadTrafficSnapshot(f.db, f.seasonId, now);
    const observerEyes = await sensorPosts(f.db, [mine]);
    expect(projectStrategicInterceptions(snapshot, f.playerIds[0]!, observerEyes)).toHaveLength(1);
    expect(projectStrategicInterceptions(snapshot, f.playerIds[0]!, [{
      planetId: mine,
      at: { x: 10, y: 0, z: 0 },
      telescope: false,
      identify: 500,
      detect: 500,
      warn: 500,
      revealsSize: false,
      revealsKind: false,
    }])).toEqual([]);
    expect(projectStrategicInterceptions(snapshot, f.playerIds[0]!, [{
      planetId: mine,
      at: { x: 10, y: 0, z: 0 },
      telescope: true,
      identify: 500,
      detect: 500,
      warn: 500,
      revealsSize: false,
      revealsKind: false,
    }])).toHaveLength(1);
    expect(projectStrategicInterceptions(snapshot, f.playerIds[3]!, [])).toEqual([]);
    expect(projectStrategicInterceptions(snapshot, f.playerIds[1]!, [])).toHaveLength(1);
    expect(projectStrategicInterceptions(snapshot, f.playerIds[2]!, [])).toHaveLength(1);

    // The craft/route stays private, but the explosion becomes a public live
    // effect at the collision instant. Out-of-sight viewers get only a dim event.
    expect(projectStrategicInterceptionImpacts(
      snapshot,
      f.playerIds[3]!,
      [],
      new Date(now.getTime() + 7_999),
    )).toEqual([]);
    const publicImpacts = projectStrategicInterceptionImpacts(
      snapshot,
      f.playerIds[3]!,
      [],
      new Date(now.getTime() + 8_001),
    );
    expect(publicImpacts).toHaveLength(1);
    expect(publicImpacts[0]).toMatchObject({
      effectOnly: true,
      focusEligible: false,
      collision: { x: 10, y: 0, z: 0 },
    });
    expect(publicImpacts[0]?.id).toEqual(expect.any(String));
    expect(projectStrategicInterceptionImpacts(
      snapshot,
      f.playerIds[2]!,
      [],
      new Date(now.getTime() + 8_001),
    )).toEqual([expect.objectContaining({ effectOnly: false, focusEligible: true })]);
    expect(projectStrategicInterceptionImpacts(
      snapshot,
      f.playerIds[1]!,
      [],
      new Date(now.getTime() + 8_001),
    )).toEqual([expect.objectContaining({ effectOnly: false, focusEligible: false })]);
  });

  /**
   * A CONTACT IS ON A REAL PATH BETWEEN TWO REAL WORLDS. Nothing here is spawned.
   *
   * The owner looked at two craft on the disc, drew their headings back, found no
   * planet behind them and asked whether these were random. They are not — but the
   * question is a fair one to be unable to answer by eye, because the origin is
   * usually off-frame and a 3D line looks like it misses in a 2D projection. So the
   * property is asserted instead of argued: the published window must lie ON the
   * segment joining the two planets that produced it, to within a rounding error.
   *
   * If this ever fails, craft really are appearing out of nowhere.
   */
  it('lies exactly on the line between the two worlds that produced it', async () => {
    midFlight((await strangersFight()).arriveAt);

    const [contact] = await fetchContacts();
    const [origin] = await f.db.select().from(planets).where(eq(planets.id, a));
    const [target] = await f.db.select().from(planets).where(eq(planets.id, b));

    /** Perpendicular distance from a point to the infinite line through two others. */
    const offLine = (p: { x: number; y: number; z: number }): number => {
      const d = { x: target!.x - origin!.x, y: target!.y - origin!.y, z: target!.z - origin!.z };
      const v = { x: p.x - origin!.x, y: p.y - origin!.y, z: p.z - origin!.z };
      const c = {
        x: v.y * d.z - v.z * d.y,
        y: v.z * d.x - v.x * d.z,
        z: v.x * d.y - v.y * d.x,
      };
      return Math.hypot(c.x, c.y, c.z) / Math.hypot(d.x, d.y, d.z);
    };

    expect(offLine(contact!.from)).toBeLessThan(0.001);
    expect(offLine(contact!.to)).toBeLessThan(0.001);

    // And it runs the right way: further along the leg at the end than at the start.
    const along = (p: { x: number; y: number; z: number }): number =>
      Math.hypot(p.x - origin!.x, p.y - origin!.y, p.z - origin!.z);
    expect(along(contact!.to)).toBeGreaterThan(along(contact!.from));
  });

  /* ── what it must never say ────────────────────────────────── */

  /**
   * The payload is the attack surface. An id, an owner or an endpoint would each
   * be enough to rebuild the route in a modified client.
   */
  it('names no world and no owner', async () => {
    midFlight((await strangersFight()).arriveAt);

    const body = await raw();
    for (const leak of ['planetId', 'originPlanetId', 'targetPlanetId', 'owner', 'Tester']) {
      expect(body).not.toContain(leak);
    }
  });

  /** A fleet's fields are exactly the window, its kind and what is in it. */
  it('gives a fleet a bearing window and no route at all', async () => {
    midFlight((await strangersFight()).arriveAt);

    const [contact] = await fetchContacts();
    expect(Object.keys(contact!).sort()).toEqual([
      'endAt',
      'fleet',
      'from',
      'id',
      'kind',
      'mass',
      'startAt',
      'to',
    ]);
    expect(contact?.fleet).toEqual({ WASP: 30 });
    expect(contact?.mass).toBe('LIGHT');
    expect(contact?.route).toBeUndefined();
    expect(contact?.minutesRemaining).toBeUndefined();
  });

  /**
   * THE LOAD-BEARING ONE, IN ITS NEW FORM.
   *
   * The window is a heading, so it must never run past the flight that produced
   * it — a `to` beyond the arrival point would be the destination, stated outright
   * and ahead of time, which is the one thing this payload exists to withhold.
   */
  /**
   * A WINDOW, NOT A ROUTE — AT ANY SPEED. D63.
   *
   * `BEARING_MINUTES` is an absolute duration, and an absolute duration stops being
   * a heading the moment flights get shorter than it. When hull speeds went up
   * 9.46× a mean leg became four minutes — exactly the window — so the published
   * end point WAS the destination, and "a contact carries a bearing window, never
   * a route" quietly stopped holding.
   *
   * Asserted as a share of the flight rather than as a count of minutes, so the
   * next speed change cannot walk past it either.
   */
  it('publishes a heading, never the whole of what is left to fly', async () => {
    await giveUnits(f.db, a, { WASP: 30 });
    const launch = await launchAttack(f.db, a, b, { WASP: 30 }, f.clock);

    /**
     * Sampled where there is still a real flight left to give away. The final
     * approach is deliberately NOT covered: the window is floored at one refetch
     * so a craft never freezes short of its target, which means a craft inside its
     * last minute does publish its arrival point. That is the same concession D52
     * already makes for a raid that has landed — the fog rule is about the flight,
     * not the last few seconds of it.
     */
    // Sampled past the departure shroud (D123), which is what decides whether a
    // craft is published at all; this test is about what the window may SAY.
    for (const share of [0.3, 0.4, 0.7]) {
      const start = f.clock.now().getTime();
      midFlight(launch.arriveAt, share);
      const [contact] = await fetchContacts();
      expect(contact, `no contact at ${String(share)} of the leg`).toBeDefined();

      const now = f.clock.now().getTime();
      const remaining = launch.arriveAt.getTime() - now;
      const shown = new Date(contact!.endAt).getTime() - now;
      expect(shown, 'the window reached the landing').toBeLessThan(remaining);
      f.clock.set(new Date(start));
    }
  });

  it('never publishes a point past the end of the flight', async () => {
    await giveUnits(f.db, a, { WASP: 30 });
    const launch = await launchAttack(f.db, a, b, { WASP: 30 }, f.clock);
    midFlight(launch.arriveAt);

    const [contact] = await fetchContacts();
    expect(new Date(contact!.endAt).getTime()).toBeLessThan(launch.arriveAt.getTime());
    expect(new Date(contact!.startAt).getTime()).toBeLessThanOrEqual(
      new Date(contact!.endAt).getTime(),
    );
  });

  /**
   * WHICH KIND OF WINDOW THIS IS, SAID OUT LOUD.
   *
   * The client interpolates inside the window and coasts a little past it when a
   * read is late, because a craft stopping dead in open space reads as a broken
   * game. That is right for a heading and wrong for an arrival — coasting past a
   * point that IS the destination draws the craft through the world it is landing
   * on and out the far side.
   *
   * Four coordinates and two instants cannot tell the two apart, so the server
   * says. It discloses nothing: the flag is only ever set in the last minute, and
   * in that minute the window's end point already IS the destination.
   */
  it('says nothing about landing while there is real flight left', async () => {
    await giveUnits(f.db, a, { WASP: 30 });
    const launch = await launchAttack(f.db, a, b, { WASP: 30 }, f.clock);

    for (const share of [0.1, 0.4, 0.7]) {
      const start = f.clock.now().getTime();
      midFlight(launch.arriveAt, share);
      const [contact] = await fetchContacts();
      expect(contact?.landing, `claimed a landing at ${String(share)} of the leg`).toBeUndefined();
      f.clock.set(new Date(start));
    }
  });

  it('marks the window as the arrival once it is clamped to it', async () => {
    await giveUnits(f.db, a, { WASP: 30 });
    const launch = await launchAttack(f.db, a, b, { WASP: 30 }, f.clock);

    /*
      INSIDE THE FINAL WINDOW, DERIVED RATHER THAN TYPED. It was "half a minute
      out", against a floor that was a flat sixty seconds — and that floor was a
      poll interval written on the wrong side of the wire. It is the refetch
      cadence now, so the instant this test needs is read from the same constant
      the server floors the window at.
    */
    f.clock.set(new Date(launch.arriveAt.getTime() - TRAFFIC.refreshMs / 2));
    const [contact] = await fetchContacts();
    expect(contact, 'the craft vanished on final approach').toBeDefined();
    expect(new Date(contact!.endAt).getTime()).toBe(launch.arriveAt.getTime());
    expect(contact!.landing, 'the arrival window was not marked as one').toBe(true);
  });

  /**
   * THE BUG THE OWNER FOUND FROM TWO ACCOUNTS AT ONCE. D50.
   *
   * The window used to be clamped to four fifths of the LEG, and a window whose
   * end is already in the past collapses to a single point — `from` and `to` the
   * same coordinate. The client interpolates a contact along that window, so for
   * the whole final approach every craft in the galaxy was drawn STANDING STILL,
   * on the doorstep of the world it was flying at. The attacker watched their
   * fleet fly; the defender watched it park and waited for a countdown that had
   * nothing left to count.
   *
   * The clamp is now a fixed margin measured in minutes, so a window is a real
   * heading right up to the last few seconds.
   */
  it('is still MOVING on final approach, not parked on its target', async () => {
    await giveUnits(f.db, a, { WASP: 30 });
    const launch = await launchAttack(f.db, a, b, { WASP: 30 }, f.clock);

    // Nine tenths of the way there: deep inside the old blackout.
    const departAt = f.clock.now().getTime();
    const span = launch.arriveAt.getTime() - departAt;
    f.clock.set(new Date(departAt + span * 0.9));

    const [contact] = await fetchContacts();
    expect(contact).toBeDefined();
    const travelled = Math.hypot(
      contact!.to.x - contact!.from.x,
      contact!.to.y - contact!.from.y,
      contact!.to.z - contact!.from.z,
    );
    expect(travelled, 'the window has no direction — the craft is frozen').toBeGreaterThan(0);
    expect(new Date(contact!.endAt).getTime()).toBeGreaterThan(
      new Date(contact!.startAt).getTime(),
    );
  });

  /**
   * THE POSITION PUBLISHED IS THE POSITION DRAWN, AND THAT IS THE POINT. D106/D120.
   *
   * This used to assert the craft's TRUE centre-to-centre position, and that is
   * exactly what made two screens disagree: the owner's client has stopped its own
   * legs short of a world since D44 — a craft drawn at a planet's coordinates is
   * drawn inside it — so the published figure was right about physics and wrong
   * about the only thing this payload is for. The gap grew along the leg and
   * reached more than a planet's width at the arrival, which is the moment the
   * whole galaxy is looking.
   *
   * The physical position is unchanged and still decides everything the SERVER
   * decides: arrival, combat, loot. What is published is where the craft is drawn,
   * derived from the same public figures on both sides (`visualLeg`).
   */
  it('publishes the craft’s drawn position at every point of the flight', async () => {
    await giveUnits(f.db, a, { WASP: 30 });
    const launch = await launchAttack(f.db, a, b, { WASP: 30 }, f.clock);
    const departAt = f.clock.now().getTime();
    const span = launch.arriveAt.getTime() - departAt;

    const [from] = await f.db.select().from(planets).where(eq(planets.id, a));
    const [to] = await f.db.select().from(planets).where(eq(planets.id, b));
    const cores = await f.db
      .select({ planetId: buildings.planetId, level: buildings.level })
      .from(buildings)
      .where(eq(buildings.type, 'CORE'));
    const levelByPlanet = new Map(cores.map((core) => [core.planetId, core.level]));
    const drawn = visualLeg(
      { x: from!.x, y: from!.y, z: from!.z },
      { x: to!.x, y: to!.y, z: to!.z },
      surfaceStandoff(worldRadius(coreTier(levelByPlanet.get(a) ?? 0))),
      orbitStandoff(worldRadius(coreTier(levelByPlanet.get(b) ?? 0))),
    );

    // Past the departure shroud (D123): before it there is deliberately nothing
    // to compare, and this test is about where a published craft is drawn.
    for (const fraction of [0.3, 0.5, 0.9, 0.99]) {
      f.clock.set(new Date(departAt + span * fraction));
      const [contact] = await fetchContacts();
      expect(contact, `nothing in the air at ${String(fraction)}`).toBeDefined();
      // Date stores whole milliseconds. Exact flight spans are fractional after
      // D83, so compare with the instant the clock can actually represent.
      const representedFraction = (f.clock.now().getTime() - departAt) / span;
      const expected = {
        x: drawn.from.x + (drawn.to.x - drawn.from.x) * representedFraction,
        z: drawn.from.z + (drawn.to.z - drawn.from.z) * representedFraction,
      };
      expect(contact!.from.x).toBeCloseTo(expected.x, 3);
      expect(contact!.from.z).toBeCloseTo(expected.z, 3);
    }
  });

  /**
   * Your own craft are drawn from your own payload at full fidelity, route and
   * all. A second anonymous copy beside the real one would be confusing and would
   * hand out a calibration sample for everyone else's.
   *
   * BOTH LEGS, and that is the whole reason `ownsLeg` exists: a return leg is
   * stored with origin and target SWAPPED (D28), so a fleet coming home has its
   * owner in `targetPlanetId`. Matching on origin alone would draw an anonymous
   * copy of your own squadron beside the real one all the way home.
   */
  it('excludes your own craft on the way out and on the way home', async () => {
    await giveUnits(f.db, mine, { WASP: 30 });
    const out = await launchAttack(f.db, mine, a, { WASP: 30 }, f.clock);
    f.clock.advance(10);
    expect(await fetchContacts()).toHaveLength(0);

    // Land it and let the survivors turn for home; the return leg is still mine.
    f.clock.set(settledAt(out.arriveAt));
    await worker(f).tick();
    const [back] = await f.db
      .select()
      .from(missions)
      .where(and(eq(missions.kind, 'return'), eq(missions.status, 'in_flight')));
    expect(back, 'the fixture raid left no survivors to fly home').toBeDefined();
    expect(back!.targetPlanetId).toBe(mine);

    f.clock.advance(1);
    expect(await fetchContacts()).toHaveLength(0);
  });

  /**
   * THE TARGET IS NOT THE OWNER. D47.
   *
   * A raid flying AT me is somebody else's craft, and D24 makes other people's
   * craft public. The exclusion used to match `origin === me || target === me`,
   * which caught it too — so every stranger in the galaxy saw the contact and the
   * one player it was aimed at saw nothing at all. That is strictly less than a
   * bystander knows about a fleet approaching my own world.
   *
   * It gives away no more than it gives a stranger: a bearing window, no endpoints,
   * no owner. Whether it is coming for ME, and how long I have, is still the
   * Radar's to sell (D9) — asserted below.
   */
  it('shows a fleet flying at you, exactly as it shows one flying at anybody else', async () => {
    await giveUnits(f.db, b, { WASP: 30 });
    midFlight((await launchAttack(f.db, b, mine, { WASP: 30 }, f.clock)).arriveAt);

    const seen = await fetchContacts();
    expect(seen).toHaveLength(1);
    expect(seen[0]!.kind).toBe('fleet');
    // And still anonymous: no endpoints, no owner, no name.
    expect(seen[0]).not.toHaveProperty('route');
    expect(Object.keys(seen[0]!)).not.toContain('originPlanetId');
  });

  /**
   * AND THE RADAR LADDER IS UNTOUCHED BY IT.
   *
   * The contact says "a craft is out there". It must not say "it is landing on you
   * in nine minutes" — that is the product D9 sells, and it lives in the pending
   * payload, which stays radar-gated.
   */
  it('still tells a defender with no radar nothing about their own arrival', async () => {
    // The shared fixture hands the caller a full instrument set so the rest of
    // this file can see its own leg. This one case is about the ABSENCE of a
    // radar, so it takes it back off.
    await giveInstrument(f.db, mine, 'RADAR', 0);
    await giveUnits(f.db, b, { WASP: 30 });
    const raid = await launchAttack(f.db, b, mine, { WASP: 30 }, f.clock);
    f.clock.set(new Date(raid.arriveAt.getTime() - 60_000));

    const threads = await pendingThreads(f.db, mine, f.clock.now());
    expect(threads.filter((t) => t.kind === 'incoming')).toHaveLength(0);
  });

  /** An inbound PROBE is visible for the same reason — and probing is loud anyway. */
  it('shows a probe flying at you', async () => {
    await grant(f.db, b, 5_000, 5_000);
    const probe = await launchProbe(f.db, b, mine, f.clock);
    // HALF THE LEG, NOT A FIXED MINUTE. A probe pays no launch overhead since D121
    // and crosses to a neighbour in well under a minute, so a whole minute put the
    // clock past its arrival and there was nothing left in the air to see.
    f.clock.advance(probe.flightMinutes / 2);

    const seen = await fetchContacts();
    expect(seen.map((c) => c.kind)).toEqual(['probe']);
  });

  /* ── the battle everybody watches ──────────────────────────── */

  /**
   * A RAID LANDING IS PUBLIC, AND IT IS THE BEST THING ON THE DISC. D52.
   *
   * D44 built the ten-second engagement for the attacker alone — a contact carries a
   * bearing and no destination, so a bystander's client had nothing to fire at and
   * the payload simply stopped at `arriveAt`. Every other player in the galaxy
   * watched a squadron reach a world and blink out.
   *
   * The owner's decision reverses it for the EFFECT: the world and clock remain
   * published so everybody sees the bombardment. The fleet itself still answers
   * to D123; this suite's observer has Telescope sight, so it also receives the
   * anonymous silhouette and its final sensed bearing.
   */
  describe('a raid landing', () => {
    const landed = async (offsetSeconds: number): Promise<Contact[]> => {
      await giveUnits(f.db, a, { WASP: 30 });
      const launch = await launchAttack(f.db, a, b, { WASP: 30 }, f.clock);
      f.clock.set(new Date(launch.arriveAt.getTime() + offsetSeconds * 1000));
      return fetchContacts();
    };

    it('is still on the disc while the engagement is running', async () => {
      const [contact] = await landed(3);
      expect(contact, 'the raid vanished the moment it landed').toBeDefined();
      expect(contact?.engagement).toBeDefined();
      expect(contact?.effectOnly).toBeUndefined();
      expect(contact?.kind).toBe('fleet');
    });

    it('names the world it is hitting, and only for those seconds', async () => {
      const [contact] = await landed(1);
      const [target] = await f.db.select().from(planets).where(eq(planets.id, b));
      expect(contact?.engagement?.target).toEqual({ x: target!.x, y: target!.y, z: target!.z });
    });

    it('carries the window both clients draw against', async () => {
      const [contact] = await landed(2);
      const arriveAt = new Date(contact!.engagement!.arriveAt).getTime();
      const endsAt = new Date(contact!.engagement!.endsAt).getTime();
      expect(endsAt).toBe(engagementEndsAt(arriveAt));
    });

    /**
     * The client interpolates a squadron along its window and CLAMPS, so a payload
     * that stopped short would hold it in mid-air. The approach segment exists only
     * to give the bearing it came in on.
     */
    /**
     * The window ends at the ORBIT the squadron holds at, and the engagement names
     * the WORLD. Two different points on purpose since D106: the hold is where the
     * craft is drawn, the world is what the volley is fired at and what an effect
     * is anchored to.
     */
    it('gives the bearing it came in on, and names the world it is over', async () => {
      const [contact] = await landed(1);
      const [target] = await f.db.select().from(planets).where(eq(planets.id, b));
      expect(contact?.engagement?.target).toEqual({ x: target!.x, y: target!.y, z: target!.z });
      const gap = Math.hypot(
        contact!.to.x - contact!.from.x,
        contact!.to.y - contact!.from.y,
        contact!.to.z - contact!.from.z,
      );
      expect(gap, 'no direction to hold the squadron off along').toBeGreaterThan(0);
    });

    it('says nothing about who sent it, even while it is firing', async () => {
      await landed(2);
      const body = await raw();
      for (const leak of ['originPlanetId', 'playerId', 'owner', 'departAt']) {
        expect(body).not.toContain(leak);
      }
    });

    /** A probe takes a photograph. There is no battle and there must be no window. */
    it('is an attack only — a probe arriving carries no engagement', async () => {
      await setLevel(f.db, a, 'SHIPYARD', 2);
      const probe = await launchProbe(f.db, a, b, f.clock);
      f.clock.set(new Date(probe.arriveAt.getTime() + 2000));
      for (const contact of await fetchContacts()) {
        expect(contact.engagement).toBeUndefined();
      }
    });

    /** And it stops when the battle is actually settled, not a moment later. */
    it('is gone once the engagement is over', async () => {
      const contacts = await landed(COMBAT.engagementSeconds + 1);
      expect(contacts.filter((c) => c.engagement !== undefined)).toHaveLength(0);
    });
  });

  /* ── the drill is the exception ────────────────────────────── */

  /**
   * D19's narrow carve-out: once this observer both sees the Prospector and has
   * discovered its rock, the line and clock make the race readable. Neither fact
   * is permission to see the craft outside the sensor horizon.
   */
  describe('mining runs to a discovered rock are public in full', () => {
    /**
     * Returns the run so a test can move to a share of it rather than guess minutes.
     *
     * THE ROCK IS CHOSEN, NOT HARD-CODED. Index 0 used to be reliably in the disc
     * at `SETTLED_MINUTES`; it stopped being so the moment asteroid lifetimes were
     * re-cut, and every test in this block failed with ASTEROID_GONE for a reason
     * that had nothing to do with traffic. Asking the field which rocks are up
     * survives the next re-cut too.
     */
    const strangerMines = async () => {
      await giveUnits(f.db, a, { PROSPECTOR: 3 });
      /**
       * A ROCK THE CRAFT CAN ACTUALLY REACH, SOLVED RATHER THAN BRUTE-FORCED.
       *
       * "Active at `SETTLED_MINUTES`" is not the same question as "a Prospector
       * launched now can intercept it before it leaves", and taking the first rock
       * that satisfies only the first fails with CANNOT_INTERCEPT for a reason
       * that has nothing to do with traffic. The file learned this once already,
       * when index 0 stopped being reliable.
       *
       * IT IS `interceptAsteroid` AND NOT A RETRY LOOP, and the difference is
       * three hundred seconds. Trying each candidate through `launchMining` makes
       * the server regenerate a 3,478-rock schedule per attempt, and with forty
       * live rocks across six call sites that turned a ninety-second suite into a
       * five-minute one — slow enough that other files began timing out and the
       * run stopped being reproducible. The reachability rule is pure; ask it
       * directly and launch once.
       */
      const [from] = await f.db.select().from(planets).where(eq(planets.id, a));
      const origin = { x: from!.x, y: from!.y, z: from!.z };
      const speed = prospectorSpeed([]);
      const rock = activeAsteroids(f.asteroids, SETTLED_MINUTES)
        .find((candidate) =>
          interceptAsteroid(origin, speed, candidate, SETTLED_MINUTES) !== null);
      if (!rock) throw new Error('no reachable rock in the disc at SETTLED_MINUTES');

      /**
       * TWO GATES, AND THEY WANT THE OBSERVER IN TWO PLACES.
       *
       * Finding the rock needs a sensor sphere over the ROCK; seeing the craft
       * needs one over the LEG, which runs to an intercept point the rock has
       * since moved to. Discovery persists once earned, so the epoch recorded at
       * the rock keeps paying after the post moves — and this exercises that.
       */
      await placeAt(f.db, mine, asteroidPosition(rock, SETTLED_MINUTES));
      await refreshSensorEpoch(f.db, mine, f.clock.now());
      const started = await launchMining(f.db, a, rock.index, 2, f.clock);

      const [row] = await f.db
        .select().from(miningRuns).where(eq(miningRuns.id, started.runId));
      await placeAt(f.db, mine, {
        x: (origin.x + row!.interceptX) / 2,
        y: (origin.y + row!.interceptY) / 2,
        z: (origin.z + row!.interceptZ) / 2,
      });
      f.clock.advance(1 / 60);
      await refreshSensorEpoch(f.db, mine, f.clock.now());
      return started;
    };

    /**
     * Somebody else flying at a wreck field.
     *
     * The field is inserted rather than fought for: this file is about what the
     * traffic payload says, and `debris.test.ts` already owns the question of what
     * a battle leaves behind.
     */
    const strangerSalvages = async () => {
      const [field] = await f.db
        .insert(debrisFields)
        .values({
          seasonId: f.seasonId,
          planetId: b,
          alloy: 5_000,
          crystal: 1_200,
          createdAt: f.clock.now(),
        })
        .returning();
      await giveUnits(f.db, a, { PROSPECTOR: 3 });
      return launchHarvest(f.db, a, field!.id, 2, f.clock);
    };

    it('shows the whole leg and the time left on it', async () => {
      midFlight((await strangerMines()).arriveAt);

      const run = (await fetchContacts()).find((c) => c.kind === 'mining');
      expect(run).toBeDefined();
      expect(run?.route).toBeDefined();
      expect(run?.minutesRemaining).toBeGreaterThan(0);
      expect(run?.craft).toBe(2);
    });

    /**
     * CARGO IS THE OWNER'S, ALWAYS. The owner's exception opened the route and the
     * clock; it did not open the hold. What a Prospector is bringing back is on
     * `/api/mining`, which answers only to the commander who sent it.
     */
    it('never says what it is carrying', async () => {
      await strangerMines();
      f.clock.advance(2);

      const body = await raw();
      for (const leak of ['minedAlloy', 'minedCrystal', 'holdEach', 'loot', 'ore']) {
        expect(body).not.toContain(leak);
      }
    });

    it('still excludes your own, which are drawn at full fidelity elsewhere', async () => {
      await giveUnits(f.db, mine, { PROSPECTOR: 3 });
      const [rock] = activeAsteroids(f.asteroids, SETTLED_MINUTES);
      if (!rock) throw new Error('no rock in the disc at SETTLED_MINUTES');
      midFlight((await launchMining(f.db, mine, rock.index, 2, f.clock)).arriveAt);

      expect((await fetchContacts()).filter((c) => c.kind === 'mining')).toHaveLength(0);
    });

    /**
     * The carve-out has to stay a carve-out. A route on a fleet would give away a
     * raid, and this is the guard against `route` being set on the wrong branch.
     */
    it('is the only kind that ever carries a route', async () => {
      await strangersFight();
      await strangerMines();
      await strangerSalvages();
      f.clock.advance(2);

      for (const contact of await fetchContacts()) {
        if (contact.kind === 'mining' || contact.kind === 'harvest') {
          expect(contact.route).toBeDefined();
        } else expect(contact.route).toBeUndefined();
      }
    });

    /**
     * A SALVAGE RUN IS ITS OWN KIND, AND FOR A LONG TIME IT WAS NOT. D32.
     *
     * `harvest` has been in `ContactKind` since D32 and nothing ever set it: every
     * row in `mining_runs` went out as `mining`, so a craft flying to a wreck field
     * was drawn in the miner's amber and its panel described a rock. The client has
     * carried the paler amber, the "Salvage run" title and the schema branch the
     * whole time and could not reach any of them.
     *
     * It is published in full for the same reason a mining run is: a field is a
     * public prize at a public address on a public clock, and hiding the race would
     * hide the contest D32 exists to create.
     */
    it('publishes a salvage run as a salvage run, in full', async () => {
      midFlight((await strangerSalvages()).arriveAt);

      const contacts = await fetchContacts();
      const run = contacts.find((c) => c.kind === 'harvest');
      expect(run, 'a harvest was published as something else').toBeDefined();
      expect(contacts.some((c) => c.kind === 'mining')).toBe(false);
      expect(run?.route).toBeDefined();
      expect(run?.minutesRemaining).toBeGreaterThan(0);
      expect(run?.craft).toBe(2);
    });

    it('never says what a salvage run is bringing home either', async () => {
      await strangerSalvages();
      f.clock.advance(2);

      const body = await raw();
      for (const leak of ['minedAlloy', 'minedCrystal', 'holdEach', 'loot']) {
        expect(body).not.toContain(leak);
      }
    });
  });

  /* ── the endpoint itself ───────────────────────────────────── */

  it('is empty when the galaxy is quiet', async () => {
    expect(await fetchContacts()).toHaveLength(0);
  });

  it('refuses a caller with no planet', async () => {
    const tokens = new TokenService('test-secret-that-is-long-enough', 15, 30);
    const stranger = { authorization: `Bearer ${await tokens.issueAccess(crypto.randomUUID())}` };
    const res = await app.inject({ method: 'GET', url: '/api/galaxy/traffic', headers: stranger });
    expect(res.statusCode).toBe(404);
  });

  it('is reachable only with a token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/galaxy/traffic' });
    expect(res.statusCode).toBe(401);
  });

  /** Used directly by the 3D surface; keep the service honest too. */
  it('produces the same result through the service as through the route', async () => {
    midFlight((await strangersFight()).arriveAt);

    const direct = await galaxyTraffic(f.db, f.seasonId, mine, f.clock.now());
    const overHttp = await fetchContacts();
    expect(overHttp).toHaveLength(direct.length);
  });
});
