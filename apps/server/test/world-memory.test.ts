import { and, eq } from 'drizzle-orm';
import { MULTI_WORLD, SENSOR } from '@astera/rules';
import type { FastifyInstance } from 'fastify';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import {
  missions,
  neutralPlanetState,
  planets,
  probeWorldMemories,
  seasons,
} from '../src/db/schema.js';
import { TokenService } from '../src/auth/tokens.js';
import { launchProbe } from '../src/services/intel.js';
import { launchAttack } from '../src/services/mission.js';
import { launchSettlement } from '../src/services/movement.js';
import { EventWorker } from '../src/worker/loop.js';
import {
  fuelUp,
  giveSatellite,
  giveUnits,
  grant,
  levelWorld,
  placeAt,
  seedWorld,
  setLevel,
  settledAt,
  testDb,
  testEnv,
  type Fixture,
} from './helpers.js';

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

/**
 * A WORLD YOU HAVE HAD EYES ON IS A WORLD YOU REMEMBER. D151.
 *
 * D127 built the galaxy's third state — REMEMBERED — around the probe, because at
 * the time the probe was the only craft that ever went and LOOKED at a world. It
 * is not. A raiding fleet crosses the same distance, arrives at the same
 * coordinates, fights in that world's orbit and flies home, and until D151 it
 * brought back nothing the map would draw: the disc went on showing whatever the
 * last probe had seen, however many hours or owners ago that was.
 *
 * WHAT THAT PRODUCED IS THE ONE SENTENCE THIS PROJECT CANNOT AFFORD. In the live
 * galaxy's chat, repeatedly: "sorry, it showed as an empty world, I sent a fleet
 * and it turned out to be yours." Every one of those was the game working as
 * specified — and every one of them was a player who had PAID a fleet for a
 * reading the map then refused to keep.
 *
 * So the record is no longer "what a probe saw". It is WHAT YOU LAST HAD EYES ON,
 * and a fleet is eyes. Everything else about D127 is unchanged and asserted here
 * as such: the record is still frozen between visits, it still never resolves the
 * world, and it still tells you when it was taken.
 */
describe('a fleet refreshes what its owner remembers', () => {
  let f: Fixture;
  let app: FastifyInstance;
  let close: () => Promise<void>;
  let auth: { authorization: string };
  /** The caller's own world. */
  let mine: string;
  /** Far outside every reach this fixture can buy, so it can only be REMEMBERED. */
  let far: string;
  /** A second commander, for the world that changes hands. */
  let neighbour: string;

  const silent = pino({ level: 'silent' });
  const worker = () =>
    new EventWorker(f.db, f.clock, { pollMs: 1000, batch: 100, staleMinutes: 5 }, silent);

  interface World {
    id: string;
    intel?: string;
    seenAt?: string;
    owner?: string;
    kind?: string;
    coreLevel?: number;
    satellites?: string[];
    shielded?: boolean;
  }

  /**
   * Cache state is a parameter here rather than a fixed setting.
   *
   * Most of this file measures the RULE and turns the projection caches off for
   * the reason `intel-states.test.ts` gives: it arranges worlds by writing to the
   * database, which publishes nothing. One test turns them back ON, because the
   * invalidation is itself part of the feature — a memory the server refuses to
   * re-read is a memory the player does not have.
   */
  const start = async (cache: boolean): Promise<void> => {
    const built = buildApp({
      env: testEnv({ PROJECTION_CACHE_ENABLED: cache ? 'true' : 'false' }),
      logger: silent,
      db: f.db,
      clock: f.clock,
    });
    app = built.app;
    close = built.close;
    await built.bus.start();
    await app.ready();
    const tokens = new TokenService('test-secret-that-is-long-enough', 15, 30);
    auth = { authorization: `Bearer ${await tokens.issueAccess(f.accountIds[0]!)}` };
  };

  beforeEach(async () => {
    f = await seedWorld(4, 151151);
    [mine, neighbour, far] = f.planetIds as [string, string, string];

    await placeAt(f.db, mine, { x: 0 });
    await placeAt(f.db, neighbour, { x: SENSOR.baseRadius * 0.5 });
    await placeAt(f.db, far, { x: SENSOR.maxRadius * 1.4 });
    await placeAt(f.db, f.planetIds[3]!, { x: SENSOR.maxRadius * 1.6 });

    for (const id of f.planetIds) {
      await setLevel(f.db, id, 'CORE', 8);
      await grant(f.db, id, 40_000, 8_000);
      await fuelUp(f.db, id);
    }
    await setLevel(f.db, mine, 'SHIPYARD', 3);
    await levelWorld(f.db, f.planetIds);
    await giveUnits(f.db, mine, { DART: 12 });

    await start(false);
  });

  afterEach(async () => {
    await close();
  });

  const galaxyFor = async (headers: { authorization: string }): Promise<{ planets: World[] }> => {
    const res = await app.inject({ method: 'GET', url: '/api/galaxy', headers });
    expect(res.statusCode).toBe(200);
    return res.json();
  };
  const galaxy = async (): Promise<World[]> => (await galaxyFor(auth)).planets;
  const world = async (id: string): Promise<World> => (await galaxy()).find((p) => p.id === id)!;

  /** Fly a probe to `target` and let it come home with what it saw. */
  const probe = async (target: string): Promise<void> => {
    const launch = await launchProbe(f.db, mine, target, f.clock);
    f.clock.set(launch.arriveAt);
    await worker().tick();
    f.clock.advance(launch.flightMinutes + 1);
    await worker().tick();
  };

  /** Send a raid to `target` and resolve the battle. Returns the fight's instant. */
  const raid = async (target: string, fleet = { DART: 4 }): Promise<Date> => {
    const launch = await launchAttack(f.db, mine, target, fleet, f.clock, f.playerIds[0]);
    const at = settledAt(launch.arriveAt);
    f.clock.set(at);
    await worker().tick();
    return at;
  };

  /**
   * Bring the survivors home, so the origin is free to launch at that world again.
   * One fleet per target at a time is a launch rule, not a memory rule.
   */
  const comeHome = async (): Promise<void> => {
    const [leg] = await f.db
      .select()
      .from(missions)
      .where(and(eq(missions.kind, 'return'), eq(missions.status, 'in_flight')));
    if (!leg) return;
    f.clock.set(leg.arriveAt);
    await worker().tick();
  };

  /* ── the record a fleet writes ─────────────────────────────── */

  /**
   * THE HEADLINE, AND THE REASON THE FEATURE EXISTS. A commander who has never
   * probed a world but has FOUGHT over it knows what it looks like.
   */
  it('remembers a world it has only ever raided', async () => {
    expect((await world(far)).intel).toBe('UNKNOWN');

    const at = await raid(far);

    const seen = await world(far);
    expect(seen.intel).toBe('REMEMBERED');
    expect(seen.owner).toBeDefined();
    expect(seen.kind).toBe('CAPITAL');
    expect(new Date(seen.seenAt!).getTime()).toBe(at.getTime());
  });

  /**
   * THE SENTENCE FROM THE LIVE GALAXY'S CHAT, AS A TEST.
   *
   * Probed while it was a rock, settled by somebody else in the meantime, raided.
   * Before D151 the disc went on calling it neutral for the rest of the season.
   */
  it('names the commander who held the world at the fight, not the one at the probe', async () => {
    await f.db
      .update(planets)
      .set({ kind: 'NEUTRAL', controllerPlayerId: null })
      .where(eq(planets.id, far));
    await probe(far);
    expect((await world(far)).kind).toBe('NEUTRAL');

    // Somebody settles it. The observer is not told and has no way to know.
    const [holder] = await f.db
      .select({ id: planets.controllerPlayerId })
      .from(planets)
      .where(eq(planets.id, neighbour));
    await f.db
      .update(planets)
      .set({ kind: 'COLONY', controllerPlayerId: holder!.id })
      .where(eq(planets.id, far));
    expect((await world(far)).kind, 'still the record, until something looks').toBe('NEUTRAL');

    f.clock.advance(61);
    await raid(far);

    const fought = await world(far);
    expect(fought.intel).toBe('REMEMBERED');
    expect(fought.kind).toBe('COLONY');
    expect(fought.owner).toBe('Tester1');
  });

  /** The whole outside of the world, not only its flag. */
  it('records the development and hardware the fleet found', async () => {
    await probe(far);
    const recorded = (await world(far)).coreLevel!;

    /*
      EXACTLY ONE TIER OF GROWTH, because the fleet still has to be allowed to fly.
      `coreTier` buckets Core levels in threes, so `+3` is one tier and D168 lets a
      raid cross one; the `+6` this used to use is two, and the launch below would
      be refused for a reason this test is not about. What is being proved is that
      the record moves with what the fleet found, and a level is a level.
    */
    await setLevel(f.db, far, 'CORE', recorded + 3);
    await giveSatellite(f.db, far, 'FOUNDRY');
    f.clock.advance(61);
    await raid(far);

    const fought = await world(far);
    expect(fought.coreLevel).toBe(recorded + 3);
    expect(fought.satellites).toEqual(['FOUNDRY']);
  });

  /**
   * AND IT IS STILL FROZEN BETWEEN VISITS, which is the half of D127 that does not
   * move. A fleet refreshes the record at the moment it is there; it does not
   * subscribe the observer to the world.
   */
  it('freezes again the moment the fleet leaves', async () => {
    await raid(far);
    const recorded = (await world(far)).coreLevel!;

    await setLevel(f.db, far, 'CORE', recorded + 5);
    await giveSatellite(f.db, far, 'FOUNDRY');

    const still = await world(far);
    expect(still.coreLevel, 'the record moved with its subject').toBe(recorded);
    expect(still.satellites).toEqual([]);
  });

  /** A record is not a reading. The world stays dark. */
  it('never resolves the world it remembers', async () => {
    await raid(far);
    expect((await world(far)).intel).toBe('REMEMBERED');
  });

  /**
   * THE RECORD IS THE NEWEST LOOK, WHATEVER TOOK IT. An older probe may not
   * overwrite a fresher battle, and a fresher probe replaces a battle.
   */
  it('keeps the newest look when a probe lands after a raid', async () => {
    await raid(far);
    const battleLevel = (await world(far)).coreLevel!;

    await setLevel(f.db, far, 'CORE', battleLevel + 4);
    f.clock.advance(61);
    await probe(far);

    expect((await world(far)).coreLevel).toBe(battleLevel + 4);
  });

  /* ── whose record it is ────────────────────────────────────── */

  /**
   * THE DEFENDER LEARNED NOTHING ABOUT THE ATTACKER'S WORLD, and the direction
   * matters: sight is bought by GOING somewhere. Being attacked tells you who came
   * — that is the battle report's job — never what their home looks like.
   */
  it('gives the defender no record of the attacker’s world', async () => {
    await raid(far);

    const defenderMemories = await f.db
      .select()
      .from(probeWorldMemories)
      .where(eq(probeWorldMemories.observerPlayerId, f.playerIds[2]!));
    expect(defenderMemories).toEqual([]);
  });

  it('writes exactly one bounded pointer per target, however many raids land', async () => {
    await raid(far);
    await comeHome();
    f.clock.advance(120);
    await raid(far);

    const rows = await f.db
      .select()
      .from(probeWorldMemories)
      .where(eq(probeWorldMemories.targetPlanetId, far));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.source).toBe('BATTLE');
    expect(rows[0]!.reportId, 'a battle record belongs to no probe report').toBeNull();
  });

  /* ── the fleet that arrives and does not fight ─────────────── */

  /**
   * A FLEET THAT BOUNCES OFF A SHIELDED WORLD STILL WENT THERE.
   *
   * `returnAttackUntouched` is the arrival that finds recovery or occupation
   * protection standing and turns the squadron round without a shot. The craft
   * crossed the distance and was in that world's orbit, so it saw what any other
   * arrival sees — and this is exactly the case where the observer most needs the
   * truth, because "it was protected" is the answer to "why did nothing happen".
   */
  it('records the world even when the raid bounces off protection', async () => {
    const launch = await launchAttack(f.db, mine, far, { DART: 4 }, f.clock, f.playerIds[0]);
    await f.db
      .update(planets)
      .set({ protectedUntil: new Date(launch.arriveAt.getTime() + 3_600_000) })
      .where(eq(planets.id, far));
    f.clock.set(settledAt(launch.arriveAt));
    await worker().tick();

    expect((await world(far)).intel).toBe('REMEMBERED');
  });

  /**
   * AND THE SETTLERS THAT LOST THE RACE. D112 · D151.
   *
   * A claim window that closes under a settlement reroutes the transports home
   * from the rock's own coordinates. "Who beat me to it" is the whole of what the
   * commander is left holding, and the record is the only place they can read it.
   */
  it('records the rock a losing settlement flew to', async () => {
    await f.db
      .update(planets)
      .set({ kind: 'NEUTRAL', controllerPlayerId: null })
      .where(eq(planets.id, far));
    await f.db.insert(neutralPlanetState).values({
      planetId: far,
      tier: 2,
      profileSeed: 3,
      economyAnchorAt: f.clock.now(),
      // Wide enough that the launch is legal — a settlement that cannot arrive in
      // time is refused at the door, which is a different rule and not this one.
      claimUntil: new Date(f.clock.now().getTime() + 30 * 86_400_000),
    });
    expect((await world(far)).intel).toBe('UNKNOWN');

    await giveUnits(f.db, mine, { COURIER: MULTI_WORLD.settlement.transports });
    const launch = await launchSettlement(f.db, f.playerIds[0]!, mine, far, f.clock);
    // The window shuts while they are in the air, which is the case under test:
    // somebody else got there first and the transports come home empty.
    await f.db
      .update(neutralPlanetState)
      .set({ claimUntil: new Date(f.clock.now().getTime() - 60_000) })
      .where(eq(neutralPlanetState.planetId, far));
    f.clock.set(launch.arriveAt);
    await worker().tick();

    expect((await world(far)).intel).toBe('REMEMBERED');
  });

  /* ── and the server must actually serve it ─────────────────── */

  /**
   * THE INVALIDATION IS PART OF THE FEATURE. D99.
   *
   * `remembered` is a player-keyed projection cache. A raid that wrote the record
   * and left the cache warm would give the attacker a map that still called the
   * world unsurveyed until a TTL expired — the same bug, arriving through the
   * cache instead of through the schema. Run with caching ON, which is production.
   */
  it('serves the new record immediately, with the projection cache on', async () => {
    await close();
    await start(true);

    expect((await world(far)).intel).toBe('UNKNOWN');
    await raid(far);
    expect((await world(far)).intel).toBe('REMEMBERED');
  });

  /**
   * AND THE FOG IS UNCHANGED FOR EVERYBODY ELSE. A record is one commander's, and
   * a raid is not a public announcement of what a world looks like.
   */
  it('leaves every other commander’s map exactly as it was', async () => {
    await f.db.update(seasons).set({ rulesetVersion: 3 }).where(eq(seasons.id, f.seasonId));
    const tokens = new TokenService('test-secret-that-is-long-enough', 15, 30);
    // The commander on `neighbour`, whose own eyes are 1,800 units short of `far`.
    // The fourth world sits beside `far` and resolves it honestly, which would be
    // measuring the fixture's geometry rather than the rule.
    const other = { authorization: `Bearer ${await tokens.issueAccess(f.accountIds[1]!)}` };

    await raid(far);

    const theirs = (await galaxyFor(other)).planets.find((p) => p.id === far)!;
    expect(theirs.intel).toBe('UNKNOWN');
  });
});
