import type { FastifyInstance } from 'fastify';
import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { REWARD_CHAINS, alloyRate, flightSlots, rewardId } from '@astera/rules';
import { buildings, debrisFields, notifications, planets, shards } from '../src/db/schema.js';
import { EventWorker } from '../src/worker/loop.js';
import { launchAttack } from '../src/services/mission.js';
import { launchProbe } from '../src/services/intel.js';
import { launchMining } from '../src/services/mining.js';
import { buildApp } from '../src/app.js';
import { SHARD_PREFIX } from '../src/stream/bus.js';
import { TokenService } from '../src/auth/tokens.js';
import {
  buildSchema,
  claimSchema,
  collectSchema,
  galaxySchema,
  instrumentRaiseSchema,
  intelSchema,
  launchSchema,
  leaderboardSchema,
  markedSchema,
  meSchema,
  miningLaunchSchema,
  miningSchema,
  notificationsSchema,
  okSchema,
  pendingSchema,
  placementSchema,
  planetSchema,
  previewSchema,
  probeSchema,
  reportsSchema,
  returnSchema,
  rewardClaimSchema,
  rewardsSchema,
  satelliteInstallSchema,
  seasonSchema,
  sessionSchema,
  serverListSchema,
  trafficSchema,
  unlocksSchema,
  upgradeSchema,
  watchSchema,
} from '../../web/src/api/schemas.js';
import { describeNotification } from '../../web/src/lib/notifications.js';
import {
  SHARD_PREFIX as CLIENT_SHARD_PREFIX,
  isShardEvent,
} from '../../web/src/session/shardEvents.js';
import { giveInstrument, giveSatellite, giveUnits, grant, levelWorld, seedWorld, setLevel, settledAt, testDb, testEnv, type Fixture } from './helpers.js';

/**
 * THE CLIENT'S PARSER, RUN AGAINST THE SERVER'S REAL ANSWER.
 *
 * This file exists because of a specific failure that every other kind of test we
 * have was structurally incapable of catching, and it is worth stating exactly how
 * it got through:
 *
 *   · D25 renamed a field on `GET /api/mining` — `drill: number` became
 *     `derrick: boolean` — and the client's Zod schema was not updated with it.
 *   · TYPECHECK PASSED. A Zod schema is a runtime value; nothing in the client's
 *     types is derived from the server's route handler, so the two cannot disagree
 *     at compile time.
 *   · SERVER TESTS PASSED. The endpoint answered correctly.
 *   · CLIENT TESTS PASSED. They parse fixtures the client itself wrote, and those
 *     fixtures were updated to match the schema rather than the server.
 *   · THE REQUEST EVEN RETURNED 200. Zod rejected the body at the boundary, the
 *     query resolved to an error, and `data` stayed undefined.
 *
 * The visible result was that every asteroid disappeared from the galaxy, with no
 * error in the console and nothing red anywhere in the repo. A whole system went
 * dark on a green build.
 *
 * So: the boundary is now tested from BOTH sides at once. The web's own schemas —
 * imported here by path, because the client is what has to survive the payload —
 * are pointed at a real app, a real database and a real planet. If a route's shape
 * moves without its schema, this is what goes red.
 *
 * ADDING A ROUTE THE CLIENT PARSES MEANS ADDING IT HERE.
 *
 * The import reaches across packages on purpose, and `apps/server/tsconfig.json`
 * widens `rootDir` to the monorepo so it resolves. That is the cost of the test and
 * it is a small one — the server has no build step, so `outDir` is never written —
 * and the alternative is a second copy of the expected shape, which is the same
 * two-sources-of-truth problem in a new costume.
 */

const silent = pino({ level: 'silent' });

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

describe('every payload the client parses', () => {
  let f: Fixture;
  let app: FastifyInstance;
  let auth: { authorization: string };

  beforeEach(async () => {
    f = await seedWorld(3);
    const built = buildApp({ env: testEnv(), logger: silent, db: f.db, clock: f.clock });
    app = built.app;
    await app.ready();

    const tokens = new TokenService('test-secret-that-is-long-enough', 15, 30);
    auth = { authorization: `Bearer ${await tokens.issueAccess(f.accountIds[0]!)}` };

    // A planet with something in every column the schemas describe, so a field
    // that is only present when non-empty is still exercised.
    const [mine, theirs] = f.planetIds as [string, string];
    await setLevel(f.db, mine, 'CORE', 6);
    await setLevel(f.db, mine, 'SHIPYARD', 4);
    await grant(f.db, mine, 400_000, 200_000);
    await giveUnits(f.db, mine, { WASP: 12, HAULER: 2, BASTION: 3, THORN: 5, PROSPECTOR: 3 });
    await giveSatellite(f.db, mine, 'UPLINK');
    await giveSatellite(f.db, mine, 'DERRICK');
    await giveInstrument(f.db, mine, 'TELESCOPE', 2);
    await giveInstrument(f.db, mine, 'AEGIS', 3);
    await giveInstrument(f.db, theirs, 'AEGIS', 1);
    // Far enough in that the asteroid field has actually spawned rocks.
    f.clock.advance(600);
  });

  const get = async (url: string): Promise<unknown> => {
    const res = await app.inject({ method: 'GET', url, headers: auth });
    expect(res.statusCode, `${url} answered ${String(res.statusCode)}: ${res.body.slice(0, 300)}`).toBe(200);
    return res.json();
  };

  /**
   * A MUTATION'S ANSWER IS A PARSED PAYLOAD TOO.
   *
   * This file only ever exercised GET, and every POST response went unchecked —
   * which is how `miningLaunchSchema` came to require an `asteroidIndex` that a
   * harvest response has never carried. The client rejected every successful
   * harvest the server returned, and nothing anywhere went red.
   */
  const post = async (url: string, body: Record<string, unknown>): Promise<unknown> => {
    const res = await app.inject({ method: 'POST', url, headers: auth, payload: body });
    expect(res.statusCode, `${url} answered ${String(res.statusCode)}: ${res.body.slice(0, 300)}`).toBe(200);
    return res.json();
  };

  it('GET /api/planet parses', async () => {
    const parsed = planetSchema.parse(await get('/api/planet'));
    // Spot-check the D25 split rather than only that it parsed: a schema can be
    // loose enough to accept the wrong shape silently.
    expect(parsed.instruments.TELESCOPE).toBe(2);
    expect(parsed.orbit).toContain('UPLINK');
    expect(parsed.orbitSlots).toBeGreaterThan(0);
    // Both ground guns, because D27 made ground defence a composition and a payload
    // that can only carry one of them would hide half of it.
    expect(parsed.ground.BASTION).toBe(3);
    // Bays are on the payload and priced by the Core, not invented by the client.
    // Derived from the Core the payload actually reports, not from the level the
    // fixture asked for: `grant` raises buildings to hold what it grants, so a
    // hardcoded figure here tests the helper rather than the route.
    const core = parsed.buildings.CORE;
    expect(core).toBeGreaterThan(0);
    expect(parsed.flight.total).toBe(flightSlots(core ?? 0));
    expect(parsed.flight.used).toBe(0);
    expect(parsed.ground.THORN).toBe(5);
  });

  it('GET /api/galaxy parses', async () => {
    const parsed = galaxySchema.parse(await get('/api/galaxy'));
    expect(parsed.planets.length).toBeGreaterThan(0);
    expect(parsed.planets.some((p) => p.shielded)).toBe(true);
  });

  /**
   * THE ONE ROUTE WITH NO CALLER. D56.
   *
   * `/api/preview` is parsed by a visitor who has no token, so nothing downstream
   * will refuse a request that reads it — which makes it the single most important
   * shape in this file to hold. It is also assembled from three of the schemas
   * above, deliberately: the rehearsal answers `/api/season`, `/api/galaxy` and
   * `/api/galaxy/traffic` out of this one payload.
   */
  it('GET /api/preview parses, with no authorization at all', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/preview' });
    expect(res.statusCode, res.body.slice(0, 300)).toBe(200);

    const parsed = previewSchema.parse(res.json());
    expect(parsed.galaxy.planets.length).toBeGreaterThan(0);
    // The reserved world is drawn among the real ones and is the caller's `you`.
    expect(parsed.galaxy.you.planetId).toBe(parsed.reserved.id);
    expect(parsed.galaxy.planets.filter((w) => w.isSelf)).toHaveLength(1);
    // Sub-payloads parse as the production schemas, which is the point of the shape.
    seasonSchema.parse(parsed.season);
    galaxySchema.parse(parsed.galaxy);
    trafficSchema.parse(parsed.traffic);
  });

  /**
   * The claim answers with a whole planet view, like every other mutation (D53),
   * and with a per-step verdict the interface has to be able to read.
   */
  it('POST /api/onboarding/claim parses', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/onboarding/claim',
      payload: {
        username: 'contract_claimer',
        password: 'correct-horse-battery',
        intents: [
          { kind: 'upgrade', building: 'CORE' },
          { kind: 'upgrade', building: 'REFINERY' },
        ],
      },
    });
    expect(res.statusCode, res.body.slice(0, 300)).toBe(200);

    const parsed = claimSchema.parse(res.json());
    expect(parsed.applied.map((a) => a.ok)).toEqual([true, true]);
    expect(parsed.planet.buildings.CORE).toBe(2);
    expect(parsed.placement.planetName).not.toBe('');
    // The session half is the same shape `/api/auth/register` answers with.
    sessionSchema.parse({
      accountId: parsed.accountId,
      username: parsed.username,
      displayName: parsed.displayName,
      accessToken: parsed.accessToken,
    });
  });

  /** The one that went dark. A live season, a real field, the client's own parser. */
  it('GET /api/mining carries wreck fields as well as rocks', async () => {
    // D32 added `debris` to a payload the client already parsed. A route whose
    // shape moves without its schema answers 200 and goes dark — which is exactly
    // how the asteroid field vanished on a green build and why this file exists.
    const parsed = miningSchema.parse(await get('/api/mining'));
    expect(Array.isArray(parsed.debris)).toBe(true);
    // The discriminator survives the round trip: Zod would reject an unknown value
    // and the query would resolve to undefined rather than to an error.
    for (const r of parsed.runs) expect(r.targetKind).toBeDefined();
  });

  it('GET /api/mining parses, and carries rocks', async () => {
    const parsed = miningSchema.parse(await get('/api/mining'));
    expect(parsed.derrick).toBe(true);
    expect(parsed.craftHold).toBeGreaterThan(0);
    expect(
      parsed.asteroids.length,
      'no rocks in a ten-hour-old season — the field or the clock is wrong',
    ).toBeGreaterThan(0);
  });

  /**
   * THE TWO LAUNCHES, WHICH SHARE ONE SCHEMA AND DO NOT SHARE ONE SHAPE.
   *
   * A haul IS a mining run — same table, same resolution path, same client
   * rendering — but a wreck field is not in the generated asteroid field and has no
   * index. `miningLaunchSchema` required one, so every harvest the server answered
   * successfully was rejected by the client's parser. Both are asserted here, and
   * the harvest case asserts the ABSENCE explicitly rather than only that it
   * parsed: a schema loose enough to accept either shape would otherwise let the
   * field quietly come back as required.
   */
  it('POST /api/mining/launch parses', async () => {
    const field = miningSchema.parse(await get('/api/mining'));
    // Not every rock in the disc can still be reached; take the first that can.
    let launched: unknown = null;
    for (const rock of field.asteroids) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/mining/launch',
        headers: auth,
        payload: { asteroidIndex: rock.index, craft: 1 },
      });
      if (res.statusCode === 200) {
        launched = res.json();
        break;
      }
    }
    expect(launched, 'no rock in the field could be intercepted at all').not.toBeNull();

    const parsed = miningLaunchSchema.parse(launched);
    expect(parsed.asteroidIndex).toBeTypeOf('number');
    expect(parsed.capacity).toBeGreaterThan(0);
    expect(parsed.intercept).toBeDefined();
  });

  it('POST /api/mining/harvest parses, and carries no asteroid index', async () => {
    const [mine] = f.planetIds as [string];
    const [wreck] = await f.db
      .insert(debrisFields)
      .values({
        seasonId: f.seasonId,
        planetId: mine,
        alloy: 9_000,
        crystal: 3_000,
        createdAt: f.clock.now(),
      })
      .returning();

    const parsed = miningLaunchSchema.parse(
      await post('/api/mining/harvest', { fieldId: wreck!.id, craft: 1 }),
    );
    expect(parsed.asteroidIndex).toBeUndefined();
    expect(parsed.runId).toBeTruthy();
    expect(parsed.capacity).toBeGreaterThan(0);
  });

  /**
   * THE CAPS ON THIS PAYLOAD ARE THE ONES THE ECONOMY ACTUALLY USES. D52a.
   *
   * `advanceEconomy` fills the works to `collectorCap(rate × productionMult)` and
   * `collect` fills storage to `storageCap(rate × productionMult)`; `/api/planet`
   * published all six figures from the BARE rate. With a Foundry in orbit the works
   * therefore legitimately held more than the ceiling they were shown against, so
   * the Works widget pinned at 100% and Signals announced "production is being
   * thrown away" while it was still running.
   *
   * The assertion is `held <= cap` after the works have had time to fill: it is the
   * one relation the whole D16 interface is built on, and it was false.
   */
  it('GET /api/planet never reports more in the works than it says they hold', async () => {
    const [mine] = f.planetIds as [string];
    await giveSatellite(f.db, mine, 'FOUNDRY');
    // Long enough that the works are pinned at their true ceiling.
    f.clock.advance(60 * 24 * 7);

    const parsed = planetSchema.parse(await get('/api/planet'));
    const p = parsed.planet;
    expect(p.bufferAlloy).toBeLessThanOrEqual(p.bufferAlloyCap);
    expect(p.bufferCrystal).toBeLessThanOrEqual(p.bufferCrystalCap);

    // And the satellite it was bought for is visible in the rate it sells.
    expect(p.alloyPerHour).toBeGreaterThan(Math.round(alloyRate(parsed.buildings.REFINERY!)));
  });

  it('GET /api/galaxy/traffic parses', async () => {
    trafficSchema.parse(await get('/api/galaxy/traffic'));
  });

  /**
   * AND IT PARSES WHILE A BATTLE IS ON IT. D52.
   *
   * `engagement` only appears for the ten seconds a raid is standing on a world, so
   * the plain parse above can never reach it — which is exactly the shape of gap
   * this file exists to close. Without it the client's disc goes dark at the one
   * moment the whole galaxy is meant to be watching.
   */
  it('GET /api/galaxy/traffic parses a raid that is landing right now', async () => {
    const [, theirs, third] = f.planetIds as [string, string, string];
    await giveUnits(f.db, theirs, { WASP: 20 });
    const launch = await launchAttack(f.db, theirs, third, { WASP: 20 }, f.clock);
    f.clock.set(new Date(launch.arriveAt.getTime() + 2_000));

    const parsed = trafficSchema.parse(await get('/api/galaxy/traffic'));
    const battle = parsed.contacts.find((c) => c.engagement !== undefined);
    expect(battle, 'a landing raid was not on the payload at all').toBeDefined();
    expect(battle?.engagement?.target).toBeDefined();
    expect(battle?.engagement?.endsAt.getTime()).toBeGreaterThan(
      battle!.engagement!.arriveAt.getTime(),
    );
  });

  /**
   * AND IT CARRIES THE FLAG THAT DECIDES HOW THE CRAFT IS DRAWN ON APPROACH.
   *
   * `landing` says the window's far point is the craft's stopping place rather than
   * a heading, so the client holds there instead of coasting through the world. It
   * is optional on the schema — an older server simply behaves as it did — which
   * means a plain parse can never prove it arrives. This does.
   */
  it('GET /api/galaxy/traffic marks a contact on final approach as landing', async () => {
    const [, theirs, third] = f.planetIds as [string, string, string];
    await giveUnits(f.db, theirs, { WASP: 20 });
    const launch = await launchAttack(f.db, theirs, third, { WASP: 20 }, f.clock);
    // Half a minute out: inside the coast floor, so the window runs to the landing.
    f.clock.set(new Date(launch.arriveAt.getTime() - 30_000));

    const parsed = trafficSchema.parse(await get('/api/galaxy/traffic'));
    const approaching = parsed.contacts.find((c) => c.id === launch.missionId);
    expect(approaching, 'the craft was not on the payload at all').toBeDefined();
    expect(approaching?.landing).toBe(true);
    expect(approaching?.endAt.getTime()).toBe(launch.arriveAt.getTime());
  });

  /**
   * THE VOLLEY'S SEED, ON BOTH SIDES OF THE SAME RAID. D52.
   *
   * The bombardment is generated from the mission id, and the attacker draws from
   * `pending` while everybody else draws from `traffic`. If the two payloads ever
   * stopped naming the same string, the same battle would be two different volleys.
   */
  it('names the same mission on the attacker’s pending list and on everyone’s traffic', async () => {
    const [mine, theirs] = f.planetIds as [string, string];
    // The fixture's own world is heavily developed and the frontier rule is ±2
    // tiers (D49), so the target is levelled to match rather than to a constant.
    const [ownCore] = await f.db
      .select({ level: buildings.level })
      .from(buildings)
      .where(and(eq(buildings.planetId, mine), eq(buildings.type, 'CORE')));
    await setLevel(f.db, theirs, 'CORE', ownCore!.level);
    const launch = await launchAttack(f.db, mine, theirs, { WASP: 6 }, f.clock);
    const parsed = pendingSchema.parse(await get('/api/session/pending'));
    const thread = parsed.pending.find((t) => t.kind === 'fleet');
    expect(thread?.id).toBe(launch.missionId);
  });

  it('GET /api/reports parses', async () => {
    reportsSchema.parse(await get('/api/reports?limit=20'));
  });

  /**
   * THE GALAXY COUNTS THE PERSON ASKING.
   *
   * `online` is optional on the client's schema, so a server that stops sending it
   * parses perfectly and the corner of the disc simply goes blank — the same shape
   * of silent failure the notification payloads had. The table below would not
   * notice, so the figure gets an assertion of its own.
   *
   * Asserted through `requireAuth`, which is where presence is stamped: a caller
   * who has just made an authenticated request IS in the galaxy, by definition, so
   * the count can never honestly be zero here.
   */
  it('GET /api/season counts who is in the galaxy, including the caller', async () => {
    const parsed = seasonSchema.parse(await get('/api/season'));
    expect(parsed.online, 'the online figure was not sent at all').toBeDefined();
    expect(parsed.online).toBeGreaterThanOrEqual(1);
    expect(parsed.online).toBeLessThanOrEqual(parsed.players);
  });

  /**
   * EVERY OTHER GET THE CLIENT PARSES, in one table.
   *
   * These are one-liners because the interesting assertion is simply "the client's
   * parser accepts what the server sends". The four above get their own tests
   * because each has a field worth checking the MEANING of, not only the shape.
   *
   * A route the client parses and this table does not name is a route that can go
   * dark on a green build. That is not hypothetical — see the header.
   */
  it.each([
    ['/api/auth/me', meSchema],
    ['/api/servers', serverListSchema],
    ['/api/season', seasonSchema],
    ['/api/leaderboard', leaderboardSchema],
    ['/api/intel', intelSchema],
    ['/api/notifications', notificationsSchema],
    ['/api/session/return', returnSchema],
    ['/api/session/pending', pendingSchema],
    ['/api/session/unlocks', unlocksSchema],
  ] as const)('GET %s parses', async (url, schema) => {
    schema.parse(await get(url));
  });

  /**
   * EVERY MUTATION THE CLIENT PARSES, WHICH IS THE HALF THIS FILE WAS MISSING.
   *
   * The header's rule is "every route the client parses is in here", and it was
   * being read as "every GET". Eleven POSTs answered straight into a Zod schema
   * with nothing checking the two agreed — and one of them had ALREADY DRIFTED:
   * `satelliteInstallSchema` lost its `level` field when D25 gave satellites no
   * ladder, which is exactly the failure the rule names. It typechecked, both
   * suites were green, and the only thing that would have caught it is this.
   *
   * Each gets its own case because `beforeEach` reseeds: a launch commits units and
   * a probe takes a bay, so sharing a world would make the order load-bearing.
   */
  it('POST /api/planet/upgrade parses', async () => {
    // The Vault, because `grant` raises the Refinery until it can HOLD the grant —
    // so the fixture's richest building is also its most expensive to raise.
    const parsed = upgradeSchema.parse(await post('/api/planet/upgrade', { type: 'VAULT' }));
    expect(parsed.type).toBe('VAULT');
    expect(parsed.level).toBeGreaterThan(0);
  });

  it('POST /api/planet/build parses', async () => {
    const parsed = buildSchema.parse(await post('/api/planet/build', { hull: 'WASP', count: 2 }));
    expect(parsed.built).toBe(2);
  });

  it('POST /api/planet/collect parses', async () => {
    f.clock.advance(120);
    const parsed = collectSchema.parse(await post('/api/planet/collect', {}));
    expect(parsed).toBeDefined();
  });

  it('POST /api/planet/instrument parses', async () => {
    const parsed = instrumentRaiseSchema.parse(
      await post('/api/planet/instrument', { type: 'TELESCOPE' }),
    );
    expect(parsed.type).toBe('TELESCOPE');
    expect(parsed.level).toBe(3);
  });

  /** The one that had already drifted. D25 removed the level; the schema followed. */
  it('POST /api/planet/satellite parses, with no level on it', async () => {
    const parsed = satelliteInstallSchema.parse(
      await post('/api/planet/satellite', { type: 'FOUNDRY' }),
    );
    expect(parsed.type).toBe('FOUNDRY');
    expect(parsed.slot).toBeGreaterThanOrEqual(0);
    expect(parsed).not.toHaveProperty('level');
  });

  it('POST /api/fleet/launch parses', async () => {
    const [mine, theirs] = f.planetIds as [string, string];
    await levelWorld(f.db, f.planetIds);
    const parsed = launchSchema.parse(
      await post('/api/fleet/launch', { targetPlanetId: theirs, fleet: { WASP: 4 } }),
    );
    expect(parsed.missionId).toBeTruthy();
    expect(parsed.arriveAt.getTime()).toBeGreaterThan(f.clock.now().getTime());
    expect(mine).toBeTruthy();

    /**
     * AND THE FLEET IS IN THE ANSWER, so the disc can draw it without asking again.
     * D53. A launch that came back without its own mission would leave the client
     * writing an empty list over a cache that had the flight in it — worse than the
     * round trip it replaced.
     */
    expect(parsed.pending.some((t) => t.arriveAt.getTime() === parsed.arriveAt.getTime())).toBe(
      true,
    );
  });

  /**
   * THE VIEW A MUTATION RETURNS IS THE VIEW THE GET WOULD HAVE RETURNED. D53.
   *
   * This is the whole safety property of answering with the world instead of
   * refetching it. The client writes the mutation's payload straight into the
   * cache, so if the two ever disagreed the interface would show one thing and
   * then silently correct itself on the next unrelated refetch — the hardest class
   * of bug to see and the easiest to introduce, because the obvious optimisation
   * here is to build the answer from the objects the mutation already has in hand.
   *
   * Asserted for every mutation that carries one, and against the real GET.
   */
  it('answers every mutation with exactly what GET /api/planet would say', async () => {
    const cases: { url: string; body: Record<string, unknown> }[] = [
      { url: '/api/planet/upgrade', body: { type: 'VAULT' } },
      { url: '/api/planet/build', body: { hull: 'WASP', count: 1 } },
      { url: '/api/planet/collect', body: {} },
      { url: '/api/planet/instrument', body: { type: 'RADAR' } },
      { url: '/api/rewards/claim', body: { id: rewardId('CORE', 3) } },
    ];

    for (const { url, body } of cases) {
      const answered = planetSchema.parse(
        (await post(url, body) as { planet: unknown }).planet,
      );
      const fetched = planetSchema.parse(await get('/api/planet'));
      expect(answered, `${url} answered with a view GET disagrees with`).toEqual(fetched);
    }
  });

  /**
   * THE REWARD PANEL, WHICH IS THE ONE PAYLOAD WITH AN OPEN VOCABULARY IN IT.
   *
   * `chains[].id` and `metric` are parsed as plain STRINGS on the client, on the
   * same reasoning as a notification kind: a chain added on the server one deploy
   * ahead of a phone must cost that phone one unrenderable card, not the whole
   * panel. That only holds if the server is actually sending strings the schema
   * accepts, which is what this checks — and the spot-check below is what stops
   * the schema being loose enough to accept the wrong shape in silence.
   */
  it('GET /api/rewards parses, and states progress in the units it is measured in', async () => {
    const parsed = rewardsSchema.parse(await get('/api/rewards'));

    /**
     * A LEVEL CHAIN REPORTS THE LEVEL THE WORLD IS ACTUALLY STANDING AT — read
     * off `/api/planet` rather than written down here, because `grant()` raises
     * the Core to whatever will hold the money it is asked for and a literal
     * would be pinned to that helper's arithmetic instead of to the rule.
     */
    const planet = planetSchema.parse(await get('/api/planet'));
    const core = parsed.chains.find((c) => c.id === 'CORE');
    expect(core?.metric).toBe('level');
    expect(core?.progress).toBe(planet.buildings.CORE);
    expect(core?.tiers.every((t) => t.state === 'claimable')).toBe(true);
    expect(parsed.claimable).toBeGreaterThan(0);

    /**
     * AND THE OTHER END OF THE GRADIENT, which is the half that could pass by
     * accident. This fixture puts units on the planet with a direct insert, so
     * nothing was ever BUILT here — and `builtEver` counts building, not holding.
     * A ships chain reading anything but zero would mean the tally had been wired
     * to the live unit count, which is the exact mistake the column exists to
     * avoid.
     */
    const ships = parsed.chains.find((c) => c.id === 'SHIPS');
    expect(ships?.metric).toBe('count');
    expect(ships?.progress).toBe(0);
    expect(ships?.tiers.every((t) => t.state === 'locked')).toBe(true);

    // Every chain the rules declare is on the wire; a missing one is a card the
    // player can never see and progress that silently stops being counted.
    expect(parsed.chains).toHaveLength(REWARD_CHAINS.length);
  });

  it('POST /api/rewards/claim parses, and carries the panel as well as the planet', async () => {
    const parsed = rewardClaimSchema.parse(
      await post('/api/rewards/claim', { id: rewardId('CORE', 3) }),
    );
    expect(parsed.granted.alloy).toBeGreaterThan(0);

    // The claim answers with BOTH surfaces it moved, so neither has to refetch —
    // the same rule every other mutation follows (D53).
    const tier = parsed.rewards.chains
      .find((c) => c.id === 'CORE')
      ?.tiers.find((t) => t.goal === 3);
    expect(tier?.state).toBe('claimed');
    expect(parsed.rewards).toEqual(rewardsSchema.parse(await get('/api/rewards')));
  });

  /**
   * THE ONE STRING THE TWO SIDES BOTH HARD-CODE. D53.
   *
   * A shard event is namespaced on the wire so it can never be mistaken for a
   * notification kind, which the client turns into user-visible text. But the
   * namespace is declared twice — once in `bus.ts`, once in `shardEvents.ts` — and
   * nothing else in the system connects them: change one and every galaxy-wide
   * event silently stops routing, the disc quietly falls back to its sixty-second
   * net, and not one test in either package goes red.
   *
   * This file already imports the client's own parsers for exactly this class of
   * failure. The prefix is the same kind of contract.
   */
  it('namespaces shard events with the same prefix on both sides', () => {
    expect(SHARD_PREFIX).toBe(CLIENT_SHARD_PREFIX);
    // And the client agrees that a real one is one, so the check cannot pass by
    // both sides being equally empty.
    expect(SHARD_PREFIX).not.toBe('');
    expect(isShardEvent(`${SHARD_PREFIX}launch`)).toBe(true);
    expect(isShardEvent('fleet_returned')).toBe(false);
  });

  it('POST /api/intel/watch parses', async () => {
    const [, theirs] = f.planetIds as [string, string];
    const parsed = watchSchema.parse(
      await post('/api/intel/watch', { targetPlanetId: theirs, slot: 0 }),
    );
    expect(parsed).toBeDefined();
  });

  it('POST /api/intel/probe parses', async () => {
    const [, theirs] = f.planetIds as [string, string];
    const parsed = probeSchema.parse(await post('/api/intel/probe', { targetPlanetId: theirs }));
    expect(parsed).toBeDefined();
  });

  /**
   * THE DOOR, WHICH IS THE ONLY PART OF THE API A PLAYER MEETS BEFORE ANYTHING ELSE.
   *
   * Four routes, and a shape that drifted here would not degrade one surface — it
   * would stop anyone signing in at all, on a green build. Walked in order because
   * that is how they are used: register hands back a session and a refresh cookie,
   * login does the same, refresh spends the cookie, logout ends it.
   */
  it('the whole auth walk parses, route by route', async () => {
    const username = `contract${String(Date.now()).slice(-8)}`;
    const password = 'correct-horse-battery';

    const registered = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username, password },
    });
    expect(registered.statusCode, registered.body.slice(0, 200)).toBe(200);
    expect(sessionSchema.parse(registered.json()).username).toBe(username.toLowerCase());

    const loggedIn = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username, password },
    });
    expect(loggedIn.statusCode).toBe(200);
    sessionSchema.parse(loggedIn.json());

    // The refresh cookie is the whole mechanism; carrying it is the test.
    const cookie = loggedIn.cookies.map((c) => `${c.name}=${c.value}`).join('; ');
    const refreshed = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      headers: { cookie },
    });
    expect(refreshed.statusCode, refreshed.body.slice(0, 200)).toBe(200);
    sessionSchema.parse(refreshed.json());

    const out = await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { cookie } });
    expect(out.statusCode).toBe(200);
    okSchema.parse(out.json());
  });

  /**
   * And the one route between the door and the galaxy. Its answer is what decides
   * which screen opens, so a drift here strands a new commander on the server list.
   */
  it('POST /api/servers/:code/join parses', async () => {
    const username = `joiner${String(Date.now()).slice(-8)}`;
    const registered = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username, password: 'correct-horse-battery' },
    });
    const token = sessionSchema.parse(registered.json()).accessToken;

    const [shard] = await f.db.select().from(shards).limit(1);
    expect(shard, 'the fixture opened no galaxy to join').toBeDefined();

    const joined = await app.inject({
      method: 'POST',
      url: `/api/servers/${encodeURIComponent(shard!.code)}/join`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(joined.statusCode, joined.body.slice(0, 200)).toBe(200);
    const parsed = placementSchema.parse(joined.json());
    expect(parsed.shard).toBe(shard!.code);
    expect(parsed.planetId).toBeTruthy();
  });

  it('POST /api/notifications/seen parses', async () => {
    const parsed = markedSchema.parse(await post('/api/notifications/seen', { ids: [] }));
    expect(parsed.marked).toBe(0);
  });

  /**
   * AND THE PAYLOAD INSIDE THE PAYLOAD. D45.
   *
   * `notificationsSchema` parses `payload` as `unknown`, deliberately — the shape
   * differs per kind. So the contract that actually matters is not between the
   * route and the schema, it is between the WORKER and `lib/notifications.ts`, and
   * nothing checked it. The mining return payload shared not one field with the
   * schema the client parsed, so every drill and every salvage run in the game
   * reported "Your fleet is home." — no ore, no waste — while this file was green,
   * both suites were green, and the route answered 200.
   *
   * The assertion is therefore not "it parsed" but "it did not fall back": every
   * one of these sentences is what `describeNotification` says when it has GIVEN
   * UP on the payload, and each of them is a real bug wearing a polite face.
   */
  const DEGRADED = new Set([
    'Your fleet is home.',
    'Incoming fleet.',
    'You were raided.',
    'Your raid resolved.',
    'A probe is home. Its report is readable.',
  ]);

  /**
   * A RAID THAT TAKES NOTHING STILL HAS TO SAY WHAT IT DID.
   *
   * Reported from the live shard, and the screenshot was six of these in a row:
   *
   *     Raided · −0 taken · 0 units lost
   *     Raided · −0 taken · 0 units lost
   *     ...
   *
   * Both figures are genuinely zero and neither is the point. The vault floor
   * means nobody is ever lootable to zero, so a poor planet yields nothing; an
   * undefended one loses no units because it had none. What HAPPENED is that
   * every one of those raids knocked the works offline for three hours (D3) and
   * stripped the shield — and the payload carried neither, so the sentence could
   * not mention them. A player was told nothing was happening to them while their
   * production sat switched off all evening.
   *
   * The assertion is in two halves on purpose: the worker must SEND the figure,
   * and the sentence must USE it. Checking only the first would pass a payload
   * nothing reads, which is exactly the failure `describeNotification` was given a
   * contract test for in the first place.
   */
  it('tells a defender with nothing to lose what the raid actually did', async () => {
    const [mine, theirs] = f.planetIds as [string, string];
    const worker = new EventWorker(
      f.db,
      f.clock,
      { pollMs: 1000, batch: 100, staleMinutes: 5 },
      silent,
    );

    await levelWorld(f.db, f.planetIds);
    const launch = await launchAttack(f.db, mine, theirs, { WASP: 6 }, f.clock);

    /**
     * Empty, undefended, and ALREADY DOWN — which is the reported case rather than
     * a contrived one: this is the second raid of an evening. The standing
     * disruption is what keeps the works from refilling during the forty minutes
     * the fleet is in the air, so the planet is still empty when it lands. Without
     * it the buffer accrues over the flight and the raid leaves with 194.
     */
    await f.db
      .update(planets)
      .set({
        alloy: 0,
        crystal: 0,
        bufferAlloy: 0,
        bufferCrystal: 0,
        shield: 0,
        disruptedUntil: new Date(launch.arriveAt.getTime() + 60 * 60_000),
      })
      .where(eq(planets.id, theirs));

    f.clock.set(settledAt(launch.arriveAt));
    await worker.tick();

    const [row] = await f.db
      .select()
      .from(notifications)
      .where(eq(notifications.kind, 'raided'));
    expect(row, 'the defender was told nothing at all').toBeDefined();

    const payload = row!.payload as {
      lootAlloy: number;
      lootCrystal: number;
      unitsLost: number;
      disruptedMinutes?: number;
    };
    // The premise: this is the raid whose two old figures were both zero.
    expect(payload.lootAlloy + payload.lootCrystal).toBe(0);
    expect(payload.unitsLost).toBe(0);
    // And the thing that did happen, which used not to travel at all.
    expect(payload.disruptedMinutes, 'the works were knocked down and nobody said so')
      .toBeGreaterThan(0);

    const now = f.clock.now().getTime();
    const view = (over: Record<string, unknown>) =>
      notificationsSchema.shape.notifications.element.parse({
        id: row!.id,
        kind: row!.kind,
        payload: { ...payload, ...over },
        seen: row!.seen,
        at: row!.createdAt,
      });

    // THE FIGURE IS LOAD-BEARING IN THE SENTENCE, not merely present in the row.
    // Asserted by removing it rather than by matching wording, so the copy stays
    // free to change in either language.
    const told = describeNotification(view({}), now);
    const silent_ = describeNotification(view({ disruptedMinutes: undefined }), now);
    expect(told).not.toBe(silent_);
    expect(told).not.toBeNull();
  });

  it('every notification a real worker writes says something specific', async () => {
    const [mine, theirs] = f.planetIds as [string, string];
    const worker = new EventWorker(
      f.db,
      f.clock,
      { pollMs: 1000, batch: 100, staleMinutes: 5 },
      silent,
    );

    // A raid, both sides of it, with the defender able to see it coming.
    await giveInstrument(f.db, theirs, 'RADAR', 5);
    await grant(f.db, theirs, 60_000, 20_000);
    // Rich means tall, and tall means out of the tier band (D49). This test is
    // about what a notification SAYS, so put the world back in one band.
    await levelWorld(f.db, f.planetIds);
    const launch = await launchAttack(f.db, mine, theirs, { WASP: 12, HAULER: 2 }, f.clock);
    f.clock.set(new Date(launch.arriveAt.getTime() - 60_000));
    await worker.tick();
    f.clock.set(settledAt(launch.arriveAt));
    await worker.tick();
    // And the survivors coming home.
    f.clock.advance(120);
    await worker.tick();

    // A probe, out and back, which is what makes its report readable.
    const probe = await launchProbe(f.db, mine, f.planetIds[2]!, f.clock);
    f.clock.set(probe.arriveAt);
    await worker.tick();
    f.clock.advance(120);
    await worker.tick();

    const everyone = [...f.playerIds];
    const rows = await f.db.select().from(notifications);
    // Both sides' news, so the attacker's own outcome is covered as well as the
    // defender's — the whole point of D45.
    expect(rows.length).toBeGreaterThan(0);
    expect(new Set(rows.map((r) => r.playerId)).size).toBeGreaterThan(1);
    expect(everyone).toEqual(expect.arrayContaining([...new Set(rows.map((r) => r.playerId))]));

    const kinds = new Set(rows.map((r) => r.kind));
    for (const expected of ['incoming_fleet', 'raided', 'raid_result', 'fleet_returned', 'probe_report', 'unlock']) {
      expect(kinds, `no ${expected} was written by a real flight`).toContain(expected);
    }

    const now = f.clock.now().getTime();
    for (const row of rows) {
      const view = notificationsSchema.shape.notifications.element.parse({
        id: row.id,
        kind: row.kind,
        payload: row.payload,
        seen: row.seen,
        at: row.createdAt,
      });
      const line = describeNotification(view, now);
      expect(line, `${row.kind} rendered nothing at all`).not.toBeNull();
      expect(DEGRADED, `${row.kind} fell back to a generic sentence: ${String(line)}`).not.toContain(
        line,
      );
    }
  });

  /** The mining side of the same contract, which is where it actually broke. */
  it('a mining return says what it delivered rather than that it exists', async () => {
    const [mine] = f.planetIds as [string];
    const worker = new EventWorker(
      f.db,
      f.clock,
      { pollMs: 1000, batch: 100, staleMinutes: 5 },
      silent,
    );

    const field = miningSchema.parse(await get('/api/mining'));
    const rock = field.asteroids.find((a) => a.oreRemaining > 0);
    expect(rock, 'no rock to mine in the contract fixture').toBeDefined();

    const run = await launchMining(f.db, mine, rock!.index, 2, f.clock);
    f.clock.set(run.arriveAt);
    await worker.tick();
    f.clock.advance(run.flightMinutes + 1);
    await worker.tick();

    const rows = await f.db
      .select()
      .from(notifications)
      .where(eq(notifications.kind, 'fleet_returned'));
    expect(rows).toHaveLength(1);

    const line = describeNotification(
      notificationsSchema.shape.notifications.element.parse({
        id: rows[0]!.id,
        kind: rows[0]!.kind,
        payload: rows[0]!.payload,
        seen: false,
        at: rows[0]!.createdAt,
      }),
      f.clock.now().getTime(),
    );
    expect(line).not.toBe('Your fleet is home.');
    expect(line).toMatch(/Ore home/);
  });
});
