import { and, eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { missions, planets, strategicAssets } from '../src/db/schema.js';
import { DEATH_STAR, activeAsteroids, engagementEndsAt, generateGalaxy } from '@astera/rules';
import { launchAttack } from '../src/services/mission.js';
import { launchMining } from '../src/services/mining.js';
import { EventWorker } from '../src/worker/loop.js';
import { launchDeathStar } from '../src/services/strategic.js';
import { launchProbe } from '../src/services/intel.js';
import { pendingThreads } from '../src/services/session.js';
import { publicWorlds } from '../src/services/publicGalaxy.js';
import {
  galaxyTraffic,
  loadTrafficSnapshot,
  projectGalaxyTraffic,
  type Contact,
} from '../src/services/traffic.js';
import type { PendingThread } from '../../web/src/api/schemas.js';
import {
  contactPosition,
  legStandoff,
  planetNodes,
  runPosition,
  threadPosition,
  type PlanetNode,
} from '../../web/src/galaxy/scene.js';
import {
  giveInstrument,
  giveSatellite,
  giveUnits,
  grant,
  levelWorld,
  seedWorld,
  setLevel,
  testDb,
  type Fixture,
} from './helpers.js';

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

/**
 * ONE GALAXY, ONE CLOCK — EVERY VIEWER SEES THE SAME CRAFT IN THE SAME PLACE.
 *
 * This is the test the owner asked for after watching a Death Star land twice:
 * *"Herkes aynı anda aynı şeyi görmeli"*. The galaxy is real-time and public, so a
 * craft's position at an instant is a FACT — and there are two completely separate
 * pieces of code that answer it:
 *
 *   THE OWNER draws their own craft from `pendingThreads`: two endpoints and two
 *   instants, interpolated over the whole leg (`threadPosition`).
 *   EVERYBODY ELSE draws it from `/api/galaxy/traffic`: a bearing window, a slice
 *   of the same leg, interpolated over its own span (`contactPosition`).
 *
 * Every existing test checks ONE of those against its own arithmetic, and both
 * passed while the two disagreed by a fifth of a leg — two minutes of flight, on a
 * disc where the whole point is that a raid lands in front of witnesses. Nothing in
 * the suite compared them, because they live in different packages and are fed by
 * different payloads.
 *
 * So this file states the property instead of the arithmetic: **at any instant, for
 * any craft, the picture the owner is shown and the picture a stranger is shown are
 * the same picture.** It drives the real services and the real client renderers —
 * imported across the package boundary exactly as `contract.test.ts` imports the
 * client's parsers — and walks a whole flight second by second.
 *
 * WHAT IT IS FOR, BEYOND THE BUG THAT PRODUCED IT. Every new craft kind, every new
 * effect and every new payload field arrives with the same question: does the
 * stranger see it too, at the same moment, in the same place? A conformance test is
 * how that question gets answered once instead of per feature.
 */

/** How far apart the two pictures may be before a player can see it, in world units. */
const TOLERANCE = 0.2;

/** A planet marker's own radius is 0.44–1.4, so this is a fraction of one world. */
const gapOf = (a: readonly [number, number, number], b: readonly [number, number, number]): number =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe('one galaxy, one clock', () => {
  let f: Fixture;
  let mine: string;
  let theirs: string;
  let nodes: PlanetNode[];

  /**
   * The disc as the client builds it, from the same public figures every player
   * gets. Only `position` and `coreTier` decide geometry, and both are public on
   * `/api/galaxy` for every world — which is why a stranger's client can solve the
   * same standoff the owner's does.
   */
  const discNodes = async (): Promise<PlanetNode[]> => {
    const worlds = await publicWorlds(f.db, f.seasonId, f.clock.now());
    // `isSelf` is added by the route for the caller; the disc's geometry does not
    // read it, and neither does anything below.
    return planetNodes(worlds.map((world) => ({ ...world, isSelf: false })));
  };

  /** Where the OWNER's client draws their own craft, at `now`. */
  const ownerAt = (thread: PendingThread, now: number): [number, number, number] => {
    if (!thread.path) throw new Error('the owner was given no path to draw');
    return threadPosition(thread.path, now, legStandoff(thread, nodes));
  };

  /** Where EVERYBODY ELSE's client draws the same craft, at `now`. */
  const strangerAt = (contact: Contact, now: number): [number, number, number] =>
    contactPosition(contact, now, nodes);

  const centreOf = async (planetId: string) => {
    const [world] = await f.db.select().from(planets).where(eq(planets.id, planetId));
    return { x: world!.x, y: world!.y, z: world!.z };
  };

  beforeEach(async () => {
    f = await seedWorld(3);
    mine = f.planetIds[0]!;
    theirs = f.planetIds[1]!;
    /**
     * SPREAD THE WORLDS OUT, BECAUSE THE FIXTURE'S CLUSTER HIDES THIS ENTIRE CLASS
     * OF BUG.
     *
     * `seedWorld` puts its commanders inside a couple of world units of each other
     * so that telescope range tests do not have to think about distance. At that
     * spacing a leg is shorter than twice the orbital standoff, both ends clamp to
     * the midpoint, and every geometry below agrees for the one reason that proves
     * nothing. Six hundred game units apart is an ordinary neighbour in a real
     * galaxy and it is where the disagreement actually lived.
     */
    await f.db.update(planets).set({ x: 0, y: 0, z: 0 }).where(eq(planets.id, mine));
    await f.db.update(planets).set({ x: 600, y: 20, z: 0 }).where(eq(planets.id, theirs));
    await f.db.update(planets).set({ x: 300, y: -40, z: 420 })
      .where(eq(planets.id, f.planetIds[2]!));
    await levelWorld(f.db, f.planetIds);
    nodes = await discNodes();
  });

  /**
   * WALK A WHOLE FLIGHT, AS A HONEST CLIENT WOULD.
   *
   * The stranger's client holds one bearing window and asks for the next one the
   * moment the one it has runs out (`useContactWindows`), so that is what this
   * does: it re-projects traffic when the window expires and at no other time. A
   * test that re-read the payload every frame would be measuring a client nobody
   * ships and would hide exactly the staleness this is about.
   */
  const walk = async (
    ownerPlanetId: string,
    strangerPlanetId: string,
    strangerPlayerId: string,
    stepMs: number,
  ): Promise<{ worst: number; at: number; samples: number }> => {
    // The client's disc is whatever `/api/galaxy` last said, and `grant()` raises a
    // Core — so rebuild it after the arrangement rather than before, exactly as a
    // client does when `shard:world` announces a world that has grown.
    nodes = await discNodes();
    const [row] = await f.db
      .select()
      .from(missions)
      .where(and(eq(missions.originPlanetId, ownerPlanetId), eq(missions.status, 'in_flight')));
    return walkMission(row!, strangerPlanetId, strangerPlayerId, stepMs);
  };

  /** The same walk, for a leg the caller has already found. */
  const walkMission = async (
    mission: typeof missions.$inferSelect,
    strangerPlanetId: string,
    strangerPlayerId: string,
    stepMs: number,
  ): Promise<{ worst: number; at: number; samples: number }> => {
    const ownerPlanetId = mission.kind === 'return' || mission.parentMissionId !== null
      ? mission.targetPlanetId
      : mission.originPlanetId;
    const depart = mission.departAt.getTime();
    const arrive = mission.arriveAt.getTime();

    const threads = await pendingThreads(f.db, ownerPlanetId, new Date(depart));
    const thread = threads.find((t) => t.path !== undefined && t.id === mission.id);
    if (!thread) throw new Error('the owner was given no path to draw');

    const snapshot = await loadTrafficSnapshot(f.db, f.seasonId, new Date(depart));

    let held: Contact | undefined;
    let worst = 0;
    let at = depart;
    let samples = 0;

    /**
     * PAST THE ARRIVAL, THROUGH THE ENGAGEMENT. The ten seconds a raid holds over a
     * world are drawn from two different fields — the owner's leg runs out and
     * clamps, a stranger's contact switches to the published hold — so they are two
     * more computations that have to produce one point.
     */
    for (let now = depart + stepMs; now < arrive + engagementEndsAt(0); now += stepMs) {
      if (!held || now >= held.endAt.getTime()) {
        held = projectGalaxyTraffic(
          snapshot,
          strangerPlanetId,
          new Date(now),
          strangerPlayerId,
          [strangerPlanetId],
        ).find((c) => c.id === mission.id);
      }
      if (!held) continue;
      const apart = gapOf(ownerAt(thread, now), strangerAt(held, now));
      samples += 1;
      if (apart > worst) {
        worst = apart;
        at = now;
      }
    }

    return { worst, at, samples };
  };

  it('draws a raid in the same place for its owner and for a stranger, all the way down', async () => {
    await grant(f.db, mine, 40_000, 16_000);
    await levelWorld(f.db, f.planetIds);
    await giveUnits(f.db, mine, { WASP: 10 });
    await launchAttack(f.db, mine, theirs, { WASP: 6 }, f.clock);

    const { worst, at, samples } = await walk(mine, f.planetIds[2]!, f.playerIds[2]!, 1_000);
    expect(samples).toBeGreaterThan(60);
    expect(
      worst,
      `owner and stranger disagreed by ${worst.toFixed(2)} world units at ${new Date(at).toISOString()}`,
    ).toBeLessThan(TOLERANCE);
  });


  /**
   * THE WEAPON THE WHOLE GALAXY IS SUPPOSED TO WATCH.
   *
   * The report that produced this file was about a Death Star: the attacker saw the
   * craft arrive and detonate, and NOBODY else did — not the commander whose world
   * it hit. Two separate faults, and this covers both. The flight has to be drawn in
   * the same place for everyone (the walk), and the detonation has to be a PUBLISHED
   * moment rather than something each renderer works out from a flight it may not
   * have (the payload).
   */
  it('flies a Death Star to the same point for everyone, and tells them all when it goes off', async () => {
    await grant(f.db, mine, 60_000, 30_000);
    await levelWorld(f.db, f.planetIds);
    await setLevel(f.db, mine, 'CORE', 6);
    await f.db.insert(strategicAssets).values({
      planetId: mine,
      status: 'READY',
      startedAt: f.clock.now(),
      readyAt: null,
      remainingSeconds: 0,
    });
    const launch = await launchDeathStar(f.db, mine, theirs, f.clock);

    const { worst, at } = await walk(mine, f.planetIds[2]!, f.playerIds[2]!, 1_000);
    expect(
      worst,
      `owner and stranger disagreed by ${worst.toFixed(2)} world units at ${new Date(at).toISOString()}`,
    ).toBeLessThan(TOLERANCE);

    /**
     * AND THE MOMENT ITSELF, WHICH IS THE HALF NO AMOUNT OF POSITION ACCURACY BUYS.
     *
     * On the final approach the strike is announced: the instant, and the world it
     * lands on. A stranger's client arms the explosion from those two figures — the
     * same two the owner reads off their own mission — so the flash happens on every
     * screen at once instead of on the attacker's alone.
     */
    const arrive = launch.arriveAt.getTime();
    const stranger = await galaxyTraffic(
      f.db,
      f.seasonId,
      f.planetIds[2]!,
      new Date(arrive - 30_000),
      f.playerIds[2],
      [f.planetIds[2]!],
    );
    const inbound = stranger.find((c) => c.kind === 'death_star');
    expect(inbound?.impact?.at.getTime()).toBe(arrive);
    expect(inbound?.impact?.target).toEqual(await centreOf(theirs));

    /**
     * AND AFTER IT HAS RESOLVED. A tab that was in another window for the ten
     * seconds either side still has to be able to reconstruct it, so the finished
     * mission is republished for exactly as long as the effect lasts — which is also
     * what makes the moment survive a reload.
     */
    await f.db.update(missions).set({ status: 'resolved' }).where(eq(missions.id, launch.missionId));
    const after = await galaxyTraffic(
      f.db,
      f.seasonId,
      f.planetIds[2]!,
      new Date(arrive + 2_000),
      f.playerIds[2],
      [f.planetIds[2]!],
    );
    expect(after.find((c) => c.kind === 'death_star')?.impact?.at.getTime()).toBe(arrive);

    /**
     * AND THE PERSON IT HAPPENED TO, WHO IS THE WHOLE REASON THIS MATTERS.
     *
     * The commander whose world is being hit is not a bystander and is not the
     * owner of the mission, so they read it off the same public payload every
     * stranger does — `traffic` excludes what you OWN, never what is aimed at you.
     * They were the one player in the galaxy who could not see the strike land on
     * their own planet.
     */
    const defender = await galaxyTraffic(
      f.db,
      f.seasonId,
      theirs,
      new Date(arrive + 2_000),
      f.playerIds[1],
      [theirs],
    );
    expect(defender.find((c) => c.kind === 'death_star')?.impact?.at.getTime()).toBe(arrive);

    // And it stops being republished once the effect is over, rather than haunting
    // the disc as a permanent contact.
    const later = await galaxyTraffic(
      f.db,
      f.seasonId,
      f.planetIds[2]!,
      new Date(arrive + DEATH_STAR.impactSeconds * 1000 + 1_000),
      f.playerIds[2],
      [f.planetIds[2]!],
    );
    expect(later.find((c) => c.kind === 'death_star')).toBeUndefined();
  });

  /**
   * THE LEG THAT IS STORED BACKWARDS, WHICH IS WHERE A GEOMETRY RULE GOES WRONG.
   *
   * A return mission is written with its origin and target SWAPPED (D28), so the
   * foreign world — the one the survivors are leaving orbit from — is its ORIGIN.
   * Every rule that stands a craft off "the world" therefore has to hold it off the
   * OTHER end on the way home, and a version that reads the target column gets a
   * fleet setting out from the middle of the planet it just raided.
   */
  it('draws a fleet coming home in the same place for its owner and for a stranger', async () => {
    await grant(f.db, mine, 40_000, 16_000);
    await levelWorld(f.db, f.planetIds);
    await giveUnits(f.db, mine, { WASP: 10 });
    const raid = await launchAttack(f.db, mine, theirs, { WASP: 6 }, f.clock);

    // Land it, so the worker writes the leg home.
    f.clock.set(new Date(engagementEndsAt(raid.arriveAt.getTime())));
    await new EventWorker(
      f.db,
      f.clock,
      { pollMs: 1000, batch: 100, staleMinutes: 5 },
      pino({ level: 'silent' }),
    ).tick();

    const [home] = await f.db
      .select()
      .from(missions)
      .where(and(eq(missions.kind, 'return'), eq(missions.status, 'in_flight')));
    expect(home, 'the raid never turned for home').toBeDefined();
    // The disc the client holds, after a battle that may have changed a silhouette.
    nodes = await discNodes();

    const { worst, at } = await walkMission(home!, f.planetIds[2]!, f.playerIds[2]!, 1_000);
    expect(
      worst,
      `owner and stranger disagreed by ${worst.toFixed(2)} world units at ${new Date(at).toISOString()}`,
    ).toBeLessThan(TOLERANCE);
  });

  /**
   * AND THE CRAFT NOBODY THINKS OF, WHICH IS WHY THE PROPERTY IS TESTED RATHER
   * THAN THE CASE.
   *
   * A Prospector is drawn from `/api/mining` for its owner and from a public
   * contact for everybody else — a third pair of renderers, with its own leg (the
   * INTERCEPTION point, not the rock) and its own payload. Nothing about the fix
   * for raids reaches it automatically; what reaches it is that both sides put
   * their answer through the same two functions.
   */
  it('draws a mining run in the same place for its owner and for a stranger', async () => {
    await giveUnits(f.db, mine, { PROSPECTOR: 3 });
    // The field turns over, so ask it which rocks are actually up rather than
    // naming an index that stops existing the next time lifetimes are re-cut.
    f.clock.advance(250);
    const [rock] = activeAsteroids(generateGalaxy(f.seed).asteroids, 250);
    if (!rock) throw new Error('no rock in the disc');
    const run = await launchMining(f.db, mine, rock.index, 2, f.clock);
    nodes = await discNodes();

    const [home] = await f.db.select().from(planets).where(eq(planets.id, mine));
    const depart = f.clock.now().getTime();
    const arrive = run.arriveAt.getTime();
    const snapshot = await loadTrafficSnapshot(f.db, f.seasonId, new Date(depart));
    const owned = {
      id: run.runId,
      status: 'outbound' as const,
      intercept: run.intercept,
      departAt: new Date(depart),
      arriveAt: run.arriveAt,
      craft: 2,
      targetKind: 'asteroid' as const,
      asteroidIndex: rock.index,
      minutesRemaining: 0,
      homeAt: null,
    };

    let held: Contact | undefined;
    for (let now = depart + 1_000; now < arrive; now += 1_000) {
      if (!held || now >= held.endAt.getTime()) {
        held = projectGalaxyTraffic(
          snapshot,
          f.planetIds[2]!,
          new Date(now),
          f.playerIds[2],
          [f.planetIds[2]!],
        ).find((c) => c.id === run.runId);
      }
      if (!held) continue;
      const owner = runPosition(
        owned as never,
        { x: home!.x, y: home!.y, z: home!.z },
        now,
        nodes,
      );
      const apart = gapOf(owner, strangerAt(held, now));
      expect(
        apart,
        `owner and stranger disagreed about a drill by ${apart.toFixed(2)} world units`,
      ).toBeLessThan(TOLERANCE);
    }
  });

  /**
   * A CLIENT WHOSE READ NEVER LANDED MAY FALL BEHIND. IT MAY NOT RUN AHEAD.
   *
   * A bearing window runs out and the client asks for the next one; when that ask
   * fails — a backgrounded tab, a phone with no signal — the craft coasts on the
   * last heading so the galaxy does not freeze. Coasting is a GUESS, and a guess
   * that overshoots is the failure the owner reported: everybody else's copy of the
   * fleet reached the target and sat on it while the fleet was still minutes out.
   *
   * So the rule is one-sided. A stale client may draw a craft short of where it is;
   * it must never draw it past where it is, because "past" is what an arrival looks
   * like and an arrival is a thing the whole galaxy is about to react to.
   */
  it('never draws a stranger’s craft further along than it really is, however stale the read', async () => {
    await grant(f.db, mine, 40_000, 16_000);
    await levelWorld(f.db, f.planetIds);
    await giveUnits(f.db, mine, { WASP: 10 });
    await launchAttack(f.db, mine, theirs, { WASP: 6 }, f.clock);
    nodes = await discNodes();

    const [row] = await f.db.select().from(missions).where(eq(missions.originPlanetId, mine));
    const mission = row!;
    const depart = mission.departAt.getTime();
    const arrive = mission.arriveAt.getTime();
    const threads = await pendingThreads(f.db, mine, new Date(depart));
    const thread = threads.find((t) => t.path !== undefined)!;
    const snapshot = await loadTrafficSnapshot(f.db, f.seasonId, new Date(depart));

    const origin = ownerAt(thread, depart);
    const flown = (p: [number, number, number]) => gapOf(origin, p);

    /**
     * The window is fetched ONCE and never refreshed, at every point of the leg a
     * tab could plausibly have been backgrounded — including the last minute, where
     * the published window is shortest and the coast has the most room to overshoot
     * a target that is only seconds away.
     */
    for (const secondsOut of [300, 180, 120, 95, 75, 61, 45, 20]) {
      const fetchedAt = arrive - secondsOut * 1_000;
      if (fetchedAt <= depart) continue;
      const stale = projectGalaxyTraffic(
        snapshot,
        f.planetIds[2]!,
        new Date(fetchedAt),
        f.playerIds[2],
        [f.planetIds[2]!],
      ).find((c) => c.id === mission.id);
      if (!stale) continue;

      /**
       * PAST THE ARRIVAL AS WELL, WHICH IS THE HALF THAT MATTERS. Coasting matches
       * the true speed exactly while a craft is still flying, so it cannot overshoot
       * during the flight — it overshoots the moment the real craft STOPS and the
       * guess carries on, which is the ten seconds the whole galaxy is watching a
       * bombardment.
       */
      for (let now = fetchedAt; now < arrive + engagementEndsAt(0); now += 1_000) {
        const ahead = flown(strangerAt(stale, now)) - flown(ownerAt(thread, now));
        expect(
          ahead,
          `a window fetched ${String(secondsOut)}s before arrival drew the craft ${ahead.toFixed(2)} units past the truth`,
        ).toBeLessThanOrEqual(TOLERANCE);
      }
    }
  });

  it('draws a probe in the same place for its owner and for a stranger', async () => {
    await grant(f.db, mine, 5_000, 2_000);
    await giveSatellite(f.db, mine, 'UPLINK');
    await giveInstrument(f.db, mine, 'TELESCOPE', 1);
    await launchProbe(f.db, mine, theirs, f.clock);

    const { worst, at } = await walk(mine, f.planetIds[2]!, f.playerIds[2]!, 1_000);
    expect(
      worst,
      `owner and stranger disagreed by ${worst.toFixed(2)} world units at ${new Date(at).toISOString()}`,
    ).toBeLessThan(TOLERANCE);
  });
});
