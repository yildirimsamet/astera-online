import type { FastifyInstance } from 'fastify';
import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import {
  ANTI_STRATEGIC,
  BUILDING_IDS,
  HULLS,
  INSTRUMENT_IDS,
  RESEARCH_PROJECT_IDS,
  SATELLITE_IDS,
  SENSOR,
  CLAN, DEATH_STAR, DISRUPTION, REWARD_CHAINS, SHIELD, alloyRate, flightSlots,
  groundLoad,
  groundSlots, hangarCapacity, hangarLoad, rewardId, shieldHp,
  asteroidPosition,
  vaultProtects,
  TRAFFIC,
} from '@astera/rules';
import {
  buildings,
  clanLootShares,
  galaxyEvents,
  miningRuns,
  neutralPlanetState,
  notifications,
  pirateRaids,
  planets,
  shards,
  seasons,
  strategicAssets,
  units,
} from '../src/db/schema.js';
import { EventWorker } from '../src/worker/loop.js';
import { launchAttack } from '../src/services/mission.js';
import { launchProbe } from '../src/services/intel.js';
import { launchMining } from '../src/services/mining.js';
import { privatePirateField, pirateId } from '../src/services/pirateField.js';
import { refreshSensorEpoch } from '../src/services/sensorHistory.js';
import { buildApp } from '../src/app.js';
import { SHARD_PREFIX } from '../src/stream/bus.js';
import { TokenService } from '../src/auth/tokens.js';
import {
  buildSchema,
  activeGalaxyEventsSchema,
  announcementsPageSchema,
  buildCancelSchema,
  clanAidLaunchSchema,
  clanAidPolicySchema,
  clanAidQuoteSchema,
  clanAidSchema,
  clanBadgeSchema,
  clanChatPageSchema,
  clanChatPostSchema,
  clanChatReadSchema,
  clanCreatedSchema,
  clanDepotClaimSchema,
  clanDepotSchema,
  clanDirectorySchema,
  clanDisbandSchema,
  clanEventsPageSchema,
  clanHomeSchema,
  clanKickSchema,
  clanLeadershipSchema,
  clanLeaderboardSchema,
  clanLeaveSchema,
  clanRequestAcceptedSchema,
  clanRequestClosedSchema,
  clanRequestCreatedSchema,
  clanSeenSchema,
  clanSettingsSchema,
  clanStrengthSchema,
  chatPageSchema,
  chatPostSchema,
  chatReadSchema,
  chatUnreadSchema,
  chroniclePageSchema,
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
  miningFieldSchema,
  piratesSchema,
  pirateRaidSchema,
  miningSchema,
  miningStatusSchema,
  movementLaunchSchema,
  notificationsSchema,
  okSchema,
  pendingSchema,
  placementSchema,
  planetSchema,
  planetsSchema,
  previewSchema,
  publicClanSchema,
  probeSchema,
  reportsSchema,
  researchCompleteSchema,
  returnSchema,
  rewardClaimSchema,
  rivalSetSchema,
  rewardsSchema,
  satelliteInstallSchema,
  seasonSchema,
  sessionSchema,
  serverListSchema,
  trafficSchema,
  unlocksSchema,
  upgradeSchema,
  watchSchema,
  deathStarBuildSchema,
  deathStarLaunchSchema,
  interceptorBuildSchema,
} from '../../web/src/api/schemas.js';
import { describeNotification } from '../../web/src/lib/notifications.js';
import {
  SHARD_PREFIX as CLIENT_SHARD_PREFIX,
  isShardEvent,
} from '../../web/src/session/shardEvents.js';
import { giveInstrument, giveResearch, giveSatellite, giveUnits, grant, levelWorld, placeAt, seedWorld, setLevel, settledAt, testDb, testEnv, type Fixture, giveDebris } from './helpers.js';

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
    f = await seedWorld(3, 4242, { pirates: true });
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
    await giveUnits(f.db, mine, { DART: 12, COURIER: 2, BASTION: 3, THORN: 5, PROSPECTOR: 3 });
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

  /** Arrange one real, non-isotope target inside this commander's current eyes. */
  const exposeMineableAsteroid = async (): Promise<void> => {
    const seasonStart = new Date('2026-01-01T00:00:00.000Z');
    let minute = (f.clock.now().getTime() - seasonStart.getTime()) / 60_000;
    let rock = f.asteroids.find((candidate) =>
      !candidate.isotopeRich
      && candidate.appearsAt <= minute
      && candidate.expiresAt - minute > 20);
    if (!rock) {
      rock = f.asteroids.find((candidate) =>
        !candidate.isotopeRich && candidate.appearsAt > minute);
      if (!rock) throw new Error('private asteroid field has no mineable target');
      minute = rock.appearsAt + 0.01;
      f.clock.set(new Date(seasonStart.getTime() + minute * 60_000));
    }
    const mine = f.planetIds[0]!;
    await placeAt(f.db, mine, asteroidPosition(rock, minute));
    await refreshSensorEpoch(f.db, mine, f.clock.now());
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

  let clanWriteSequence = 0;
  const clanPost = async (
    url: string,
    body: Record<string, unknown>,
    headers: { authorization: string } = auth,
  ): Promise<unknown> => {
    clanWriteSequence += 1;
    const res = await app.inject({
      method: 'POST',
      url,
      headers: {
        ...headers,
        'idempotency-key': `contract-clan-${String(clanWriteSequence)}`,
      },
      payload: body,
    });
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
    expect(parsed.planet.vaultCapacity).toEqual(
      vaultProtects(
        parsed.buildings.VAULT ?? 0,
        parsed.buildings.REFINERY ?? 0,
        parsed.buildings.EXTRACTOR ?? 0,
        parsed.buildings.DEUTERIUM_PLANT ?? 0,
      ),
    );
    expect(parsed.planet.vaultProtected.alloy).toBeLessThanOrEqual(parsed.planet.alloy);
    expect(parsed.planet.vaultProtected.crystal).toBeLessThanOrEqual(parsed.planet.crystal);
    // Zero on THIS world because it has no plant, and the floor is hours of a
    // resource's own production — not because deuterium is a special case. T5.
    expect(parsed.buildings.DEUTERIUM_PLANT ?? 0).toBe(0);
    expect(parsed.planet.vaultProtected.deuterium).toBe(0);
    expect(parsed.planet.shieldMax).toBe(shieldHp(3));
    expect(parsed.planet.shieldPerHour).toBe(Math.round(shieldHp(3) * SHIELD.regenPerHour));
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
    /*
      BOTH CEILINGS AND BOTH LOADS, ON THE PAYLOAD. T4/T4b.

      The order screen greys a hull the server would refuse, which it can only do
      from figures it is sent. Read off the same rules the server enforces with —
      a hardcoded number here would test the fixture rather than the route — and
      the loads are asserted against the two POOLS separately, because the whole
      design is that they do not share.
    */
    expect(parsed.capacity).toEqual({
      hangar: hangarCapacity(parsed.buildings.HANGAR ?? 0),
      hangarUsed: hangarLoad(parsed.fleet),
      ground: groundSlots(core ?? 0),
      groundUsed: groundLoad(parsed.ground),
    });
    expect(parsed.capacity!.groundUsed).toBeGreaterThan(0);
  });

  it('never accepts another commander planet id on explicit reads or mutations', async () => {
    const foreign = f.planetIds[1]!;
    const read = await app.inject({
      method: 'GET',
      url: `/api/planets/${foreign}`,
      headers: auth,
    });
    expect(read.statusCode).toBe(403);
    expect(read.json()).toMatchObject({ error: 'PLANET_NOT_OWNED' });

    const mutate = await app.inject({
      method: 'POST',
      url: `/api/planets/${foreign}/upgrade`,
      headers: auth,
      payload: { type: 'CORE' },
    });
    expect(mutate.statusCode).toBe(403);
    expect(mutate.json()).toMatchObject({ error: 'PLANET_NOT_OWNED' });
  });

  it('GET /api/planets and the explicit planet view parse', async () => {
    const list = planetsSchema.parse(await get('/api/planets'));
    expect(list.capitalPlanetId).toBe(f.planetIds[0]);
    expect(list.planets).toHaveLength(1);
    expect(list.planets[0]?.planet.kind).toBe('CAPITAL');
    planetSchema.parse(await get(`/api/planets/${list.capitalPlanetId}`));
  });

  it('serves overlapping world-list and explicit reads without a lock-upgrade deadlock', async () => {
    const planetId = f.planetIds[0]!;
    const requests = Array.from({ length: 12 }, (_, index) => app.inject({
      method: 'GET',
      url: index % 2 === 0 ? '/api/planets' : `/api/planets/${planetId}`,
      headers: auth,
    }));
    const responses = await Promise.all(requests);
    expect(responses.map((response) => response.statusCode)).toEqual(Array(12).fill(200));
  });

  it('an explicit planet mutation returns the exact explicit GET view', async () => {
    const planetId = f.planetIds[0]!;
    f.clock.advance(120);
    const mutated = collectSchema.parse(await post(`/api/planets/${planetId}/collect`, {}));
    const fetched = planetSchema.parse(await get(`/api/planets/${planetId}`));
    expect(mutated.planet).toEqual(fetched);
  });

  it('GET /api/galaxy parses', async () => {
    const parsed = galaxySchema.parse(await get('/api/galaxy'));
    expect(parsed.planets.length).toBeGreaterThan(0);
    expect(parsed.planets.some((p) => p.shielded)).toBe(true);
  });

  it('GET /api/galaxy/events parses without exposing future occurrences', async () => {
    const parsed = activeGalaxyEventsSchema.parse(await get('/api/galaxy/events'));
    expect(parsed.events).toEqual([]);
  });

  /**
   * ALL THREE INTEL SHAPES, IN ONE PAYLOAD, THROUGH THE CLIENT'S OWN SCHEMA. D127.
   *
   * THIS TEST EXISTS BECAUSE ITS ABSENCE SHIPPED A BLANK GALAXY. D127 gave a world
   * three payload shapes and the contract suite only ever saw the fully resolved
   * one, so nothing noticed when the unknown shape started carrying a PARTIAL
   * `neutral` object: `z.coerce.date()` turned its missing `nextReinforcementAt`
   * into an Invalid Date, Zod rejected the whole response, and every world in the
   * galaxy disappeared — the caller's own capital included. A shape that only one
   * of three branches produces is a shape no unit test reaches.
   *
   * `parse` rather than `safeParse` on purpose: the failure this guards is the
   * whole payload being thrown away, so the assertion has to be that it survives.
   */
  it('GET /api/galaxy parses every intel state the route can produce', async () => {
    const [mine, theirs] = f.planetIds as [string, string];
    // Far enough that the naked-eye reach cannot cover it, so the disc has to
    // produce an unknown world alongside the caller's own resolved one.
    await placeAt(f.db, mine, { x: 0 });
    await placeAt(f.db, theirs, { x: SENSOR.maxRadius * 2 });
    // A live claim window is the one public moment an unknown world still carries.
    await f.db
      .insert(neutralPlanetState)
      .values({
        planetId: theirs,
        tier: 2,
        profileSeed: 1,
        economyAnchorAt: f.clock.now(),
        claimUntil: new Date(f.clock.now().getTime() + 3_600_000),
      })
      .onConflictDoUpdate({
        target: neutralPlanetState.planetId,
        set: { claimUntil: new Date(f.clock.now().getTime() + 3_600_000) },
      });

    const parsed = galaxySchema.parse(await get('/api/galaxy'));
    const states = new Set(parsed.planets.map((planet) => planet.intel));

    expect(parsed.planets.length).toBeGreaterThan(1);
    expect(states.has('RESOLVED'), 'the caller always resolves their own world').toBe(true);
    expect(states.has('UNKNOWN'), 'nothing produced an unknown world to parse').toBe(true);

    const unknown = parsed.planets.find((planet) => planet.intel === 'UNKNOWN')!;
    // The gaps are filled by the schema, so downstream never sees a missing field.
    expect(unknown.name).toBe('');
    expect(unknown.coreTier).toBe(1);
    expect(unknown.satellites).toEqual([]);
  });

  it('the clan journey parses with the client schemas, route by route', async () => {
    await f.db.update(seasons).set({ rulesetVersion: 3 }).where(eq(seasons.id, f.seasonId));
    const tokens = new TokenService('test-secret-that-is-long-enough', 15, 30);
    const authFor = async (index: number): Promise<{ authorization: string }> => ({
      authorization: `Bearer ${await tokens.issueAccess(f.accountIds[index]!)}`,
    });
    const second = await authFor(1);
    const third = await authFor(2);

    expect(clanBadgeSchema.parse(await get('/api/clan/badge')).membership).toBeNull();
    expect(clanHomeSchema.parse(await get('/api/clan/me')).state).toBe('OUTSIDE');
    clanDirectorySchema.parse(await get('/api/clans'));
    clanLeaderboardSchema.parse(await get('/api/clans/leaderboard'));

    const [mine, theirs] = f.planetIds as [string, string];
    await setLevel(f.db, mine, 'CORE', CLAN.founderCoreLevel);
    await setLevel(f.db, theirs, 'SHIPYARD', 4);
    const founded = clanCreatedSchema.parse(await clanPost('/api/clan/create', {
      name: 'Orbit Wardens',
      tag: 'ORB',
      description: 'Watch the rim. Bring everyone home.',
      recruiting: true,
    }));
    expect(founded.planet.planet.id).toBe(mine);

    expect(clanBadgeSchema.parse(await get('/api/clan/badge')).membership?.tag).toBe('ORB');
    expect(clanHomeSchema.parse(await get('/api/clan/me')).state).toBe('MEMBER');
    expect(publicClanSchema.parse(await get(`/api/clans/${founded.clanId}`)).tag).toBe('ORB');
    expect(clanDirectorySchema.parse(await get('/api/clans')).clans[0]?.tag).toBe('ORB');
    expect(clanLeaderboardSchema.parse(await get('/api/clans/leaderboard')).clans[0]?.self).toBe(true);
    expect(galaxySchema.parse(await get('/api/galaxy')).planets.find((planet) => planet.id === mine)?.clan?.tag)
      .toBe('ORB');
    expect(leaderboardSchema.parse(await get('/api/leaderboard')).you?.clan?.tag).toBe('ORB');

    const withdrawn = clanRequestCreatedSchema.parse(await clanPost(
      `/api/clans/${founded.clanId}/apply`, {}, second,
    ));
    expect(clanRequestClosedSchema.parse(await clanPost(
      `/api/clan/requests/${withdrawn.requestId}/withdraw`, {}, second,
    )).status).toBe('WITHDRAWN');

    const declined = clanRequestCreatedSchema.parse(await clanPost(
      `/api/clans/${founded.clanId}/apply`, {}, second,
    ));
    expect(clanRequestClosedSchema.parse(await clanPost(
      `/api/clan/requests/${declined.requestId}/reject`, {},
    )).status).toBe('REJECTED');

    const application = clanRequestCreatedSchema.parse(await clanPost(
      `/api/clans/${founded.clanId}/apply`, {}, second,
    ));
    clanRequestAcceptedSchema.parse(await clanPost(
      `/api/clan/requests/${application.requestId}/accept`, { acknowledgeHostile: false },
    ));

    const invitation = clanRequestCreatedSchema.parse(await clanPost(
      '/api/clan/invite', { playerId: f.playerIds[2] },
    ));
    clanRequestAcceptedSchema.parse(await clanPost(
      `/api/clan/requests/${invitation.requestId}/accept`, { acknowledgeHostile: false }, third,
    ));

    const clanGalaxy = galaxySchema.parse(await get('/api/galaxy'));
    expect(clanGalaxy.clanPresence?.members.map((member) => member.playerId))
      .toEqual(expect.arrayContaining([f.playerIds[0], f.playerIds[1], f.playerIds[2]]));

    f.clock.advance(CLAN.adaptationMinutes);
    clanEventsPageSchema.parse(await get('/api/clan/events'));
    clanDepotSchema.parse(await get('/api/clan/depot'));
    clanAidSchema.parse(await get('/api/clan/aid'));
    clanChatPageSchema.parse(await get('/api/clan/chat'));
    const strength = clanStrengthSchema.parse(await get('/api/clan/strength'));
    expect(strength.members).toHaveLength(3);

    clanSettingsSchema.parse(await clanPost('/api/clan/settings', {
      description: 'Bring everyone home.',
      recruiting: false,
    }));
    clanAidPolicySchema.parse(await clanPost('/api/clan/aid-policy', { enabled: true }));
    const message = clanChatPostSchema.parse(await clanPost('/api/clan/chat/messages', {
      content: 'Rim clear.',
    }));
    clanChatReadSchema.parse(await clanPost('/api/clan/chat/read', { messageId: message.message.id }));
    clanSeenSchema.parse(await clanPost('/api/clan/read', {}));
    await f.db.insert(clanLootShares).values({
      seasonId: f.seasonId,
      sourceMissionId: f.playerIds[0]!,
      clanId: founded.clanId,
      playerId: f.playerIds[0]!,
      alloy: 10,
      remainingAlloy: 10,
      createdAt: f.clock.now(),
    });
    clanDepotClaimSchema.parse(await clanPost('/api/clan/depot/claim', {}));

    const aidPayload = {
      originPlanetId: mine,
      recipientPlayerId: f.playerIds[1],
      targetPlanetId: theirs,
      fleet: { DART: 1 },
      cargo: { alloy: 0, crystal: 0, deuterium: 0 },
    };
    expect(clanAidQuoteSchema.parse(await post('/api/clan/aid/quote', aidPayload)).withinAllowance)
      .toBe(true);
    clanAidLaunchSchema.parse(await clanPost('/api/clan/aid/launch', aidPayload));
    expect(clanAidSchema.parse(await get('/api/clan/aid')).transfers).toHaveLength(1);

    clanLeadershipSchema.parse(await clanPost('/api/clan/leadership', {
      playerId: f.playerIds[1],
    }));
    clanKickSchema.parse(await clanPost('/api/clan/kick', {
      playerId: f.playerIds[2],
    }, second));
    clanLeadershipSchema.parse(await clanPost('/api/clan/leadership', {
      playerId: f.playerIds[0],
    }, second));
    clanLeaveSchema.parse(await clanPost('/api/clan/leave', {}, second));
    clanDisbandSchema.parse(await clanPost('/api/clan/disband', {}));
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
    expect(parsed.planet.buildings.CORE).toBe(1);
    expect(parsed.planet.queues?.CONSTRUCTION.map((order) => order.subject))
      .toEqual(['CORE', 'REFINERY']);
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
    await exposeMineableAsteroid();
    const parsed = miningSchema.parse(await get('/api/mining'));
    expect(parsed.derrick).toBe(true);
    expect(parsed.craftHold).toBeGreaterThan(0);
    expect(
      parsed.asteroids.length,
      'no rocks in a ten-hour-old season — the field or the clock is wrong',
    ).toBeGreaterThan(0);
  });

  /**
   * THE SILENT FAILURE T7 NEARLY SHIPPED.
   *
   * `GET /api/mining` gated its isotope reading on a join against the world's own
   * research row. After research moved to the commander that join can only ever
   * miss — and it misses QUIETLY, reporting every anomaly as unreadable to a player
   * who had paid for the project. Nothing else in the suite covered the route with
   * research held, so nothing went red. This asserts the gate reads the commander.
   */
  it('GET /api/mining/status reads the isotope gate off the commander, not the world', async () => {
    // Put a real active anomaly through this commander's live sensor sphere. The
    // old test only advanced the clock and accidentally assumed every anomaly was
    // globally known — precisely the information leak this feature removes.
    const anomaly = f.asteroids.find((rock) => rock.isotopeRich);
    if (!anomaly) throw new Error('private asteroid field has no isotope anomaly');
    const seenAt = anomaly.appearsAt + 0.01;
    f.clock.set(new Date(new Date('2026-01-01T00:00:00.000Z').getTime() + seenAt * 60_000));
    await placeAt(f.db, f.planetIds[0]!, asteroidPosition(anomaly, seenAt));
    await refreshSensorEpoch(f.db, f.planetIds[0]!, f.clock.now());
    expect(miningStatusSchema.parse(await get('/api/mining/status')).isotopes).toEqual([]);

    await giveResearch(f.db, f.planetIds[0]!, 'ISOTOPE_SPECTROMETRY');

    const parsed = miningStatusSchema.parse(await get('/api/mining/status'));
    expect(parsed.isotopes, 'spectrometry is held, so the anomalies must be readable')
      .not.toEqual([]);
  });

  it('GET /api/mining/field and /status preserve the public/private split', async () => {
    await exposeMineableAsteroid();
    const field = miningFieldSchema.parse(await get('/api/mining/field'));
    const status = miningStatusSchema.parse(await get('/api/mining/status'));
    expect(field.asteroids.length).toBeGreaterThan(0);
    expect(field.nextFieldChangeAt === null || field.nextFieldChangeAt instanceof Date).toBe(true);
    expect(field.asteroids.every((asteroid) => typeof asteroid.id === 'string')).toBe(true);
    expect(field.asteroids.every((asteroid) => !('index' in asteroid))).toBe(true);
    expect(field.asteroids.every((asteroid) => !asteroid.isotopeRich)).toBe(true);
    expect(status.derrick).toBe(true);
    expect(status.isotopes).toEqual([]);
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
    const [mine] = f.planetIds as [string];
    await exposeMineableAsteroid();
    const field = miningSchema.parse(await get('/api/mining'));
    // Not every rock in the disc can still be reached; take the first that can.
    let launched: unknown = null;
    for (const rock of field.asteroids) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/mining/launch',
        headers: auth,
        payload: { asteroidId: rock.id, craft: 1 },
      });
      if (res.statusCode === 200) {
        launched = res.json();
        break;
      }
    }
    expect(launched, 'no rock in the field could be intercepted at all').not.toBeNull();

    const parsed = miningLaunchSchema.parse(launched);
    expect(parsed.asteroidId).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(parsed.capacity).toBeGreaterThan(0);
    expect(parsed.intercept).toBeDefined();
    expect(parsed.planet.planet.id).toBe(mine);
    expect(parsed.mining.runs.some((run) => run.id === parsed.runId)).toBe(true);
    // These are not hand-built launch fragments: each equals the GET surface it
    // replaces, while the transaction still guarantees the new run was included.
    expect(parsed.mining).toEqual(miningStatusSchema.parse(await get('/api/mining/status')));
    expect(parsed.planet).toEqual(planetSchema.parse(await get('/api/planet')));
    expect(parsed.pending).toEqual(
      pendingSchema.parse(await get('/api/session/pending')).pending,
    );
  });

  it('POST /api/mining/harvest parses, and carries no asteroid id', async () => {
    const [mine] = f.planetIds as [string];
    const wreck = await giveDebris(f.db, f.seasonId, mine, {
        alloy: 9_000,
        crystal: 3_000,
        createdAt: f.clock.now(),
      });

    const parsed = miningLaunchSchema.parse(
      await post('/api/mining/harvest', { fieldId: wreck.id, craft: 1 }),
    );
    expect(parsed.asteroidId).toBeUndefined();
    expect(parsed.runId).toBeTruthy();
    expect(parsed.capacity).toBeGreaterThan(0);
    expect(parsed.mining.runs.some((run) => run.id === parsed.runId)).toBe(true);
    expect(parsed.mining).toEqual(miningStatusSchema.parse(await get('/api/mining/status')));
    expect(parsed.planet).toEqual(planetSchema.parse(await get('/api/planet')));
    expect(parsed.pending).toEqual(
      pendingSchema.parse(await get('/api/session/pending')).pending,
    );
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

  /**
   * THE THIRD TARGET CLASS, END TO END. D150.
   *
   * A plain parse can only ever reach the fields a quiet payload carries, and the
   * whole ladder here lives in the OPTIONAL ones — the level and the crew arrive
   * with Telescope sight and with nothing less. So the parse is followed by a case
   * that actually stands a commander next to a pirate.
   */
  it('GET /api/pirates parses', async () => {
    piratesSchema.parse(await get('/api/pirates'));
  });

  it('GET /api/pirates identifies a pirate standing inside the Telescope circle', async () => {
    const { PIRATE, piratePosition, pirateActive, sensorSphere, sensorZone } =
      await import('@astera/rules');
    const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    const field = privatePirateField(season!.asteroidKey);
    const [world] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!));
    const eye = sensorSphere({ x: world!.x, y: world!.y, z: world!.z }, 0, 0, f.planetIds[0]);

    let found: { index: number; minute: number } | null = null;
    outer: for (const spec of field) {
      for (let minute = Math.ceil(spec.appearsAt) + 1; minute < spec.expiresAt; minute += 1) {
        if (!pirateActive(spec, minute)) continue;
        if (sensorZone([eye], piratePosition(spec, minute)) !== 'IDENTIFIED') continue;
        found = { index: spec.index, minute };
        break outer;
      }
    }
    expect(found, 'no pirate ever comes inside the naked eye this season').not.toBeNull();
    f.clock.set(new Date(season!.startsAt.getTime() + found!.minute * 60_000));

    const parsed = piratesSchema.parse(await get('/api/pirates'));
    const seen = parsed.pirates.find((p) => p.id === pirateId(season!.asteroidKey, found!.index));
    expect(seen, 'the pirate was not on the payload at all').toBeDefined();
    expect(seen!.zone).toBe('IDENTIFIED');
    expect(seen!.level).toBe(field[found!.index]!.level);
    expect(seen!.damageMult).toBe(PIRATE.damageMult[field[found!.index]!.level]);
    expect(Object.keys(seen!.fleet ?? {}).length).toBeGreaterThan(0);
    expect(seen!.expiresInMinutes).toBeGreaterThan(0);
    // No orbit, under any name: those five numbers ARE the route.
    const wire = JSON.stringify(seen);
    for (const forbidden of ['radius', 'period', 'phase', 'inclination', 'ascendingNode']) {
      expect(wire).not.toContain(forbidden);
    }
  });

  /**
   * THE POINT THE FLEET IS ACTUALLY AIMED AT, ON THE WIRE. D155.
   *
   * `reach` already carried the minute and the leg length, and the player still could
   * not see WHERE any of it was: they committed a bay, both legs of fuel and a
   * frozen doctrine to a coordinate the payload never named, and then watched the
   * squadron fly off at an angle to the pirate on the disc. D124 calls that a rule
   * the player cannot see, and D142 says a quantity a player has to judge is
   * DRAWN, not only written — the mining lane has drawn its rendezvous since D40.
   *
   * IT IS NOT A NEW READING. `distance` and `minutes` were already published for
   * every hull at this world, off a pirate the caller can currently SEE, and the
   * two of them pin the point already. This states it instead of implying it.
   */
  it('GET /api/pirates names the rendezvous each hull would fly to', async () => {
    const { HULLS, distance, interceptOrbit, piratePosition, pirateActive, sensorSphere, sensorZone } =
      await import('@astera/rules');
    const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    const field = privatePirateField(season!.asteroidKey);
    const [world] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!));
    const origin = { x: world!.x, y: world!.y, z: world!.z };
    const eye = sensorSphere(origin, 0, 0, f.planetIds[0]);

    let found: { index: number; minute: number } | null = null;
    outer: for (const spec of field) {
      for (let minute = Math.ceil(spec.appearsAt) + 1; minute < spec.expiresAt; minute += 1) {
        if (!pirateActive(spec, minute)) continue;
        if (sensorZone([eye], piratePosition(spec, minute)) === 'NONE') continue;
        found = { index: spec.index, minute };
        break outer;
      }
    }
    expect(found).not.toBeNull();
    f.clock.set(new Date(season!.startsAt.getTime() + found!.minute * 60_000));
    await giveUnits(f.db, f.planetIds[0]!, { DART: 5 });

    const parsed = piratesSchema.parse(await get('/api/pirates'));
    const seen = parsed.pirates.find((p) => p.id === pirateId(season!.asteroidKey, found!.index));
    expect(seen, 'the pirate was not on the payload at all').toBeDefined();
    const row = seen!.reach.find((entry) => entry.hull === 'DART');
    expect(row, 'a Dart stands at this world and could not be quoted').toBeDefined();

    // The same solve the launch will run, from the same two coordinates.
    const spec = field[found!.index]!;
    const solved = interceptOrbit(
      origin,
      HULLS.DART.speed,
      (m) => piratePosition(spec, m),
      spec.expiresAt,
      found!.minute,
    );
    expect(solved).not.toBeNull();
    expect(row!.at.x).toBeCloseTo(solved!.at.x, 6);
    expect(row!.at.y).toBeCloseTo(solved!.at.y, 6);
    expect(row!.at.z).toBeCloseTo(solved!.at.z, 6);
    // And it is the leg the fuel quote is charged against, so the two agree.
    expect(distance(origin, row!.at)).toBeCloseTo(row!.distance, 6);
    // The pirate is really there when the fleet is: a meeting, not a heading.
    expect(distance(piratePosition(spec, found!.minute + row!.minutes), row!.at))
      .toBeLessThan(1e-6);

    // A point is not an orbit. Those five numbers remain the route.
    const wire = JSON.stringify(seen);
    for (const forbidden of ['radius', 'period', 'phase', 'inclination', 'ascendingNode']) {
      expect(wire).not.toContain(forbidden);
    }
  });

  it('POST /api/pirates/raid parses, and answers with the strip and the world', async () => {
    const { piratePosition, pirateActive, sensorSphere, sensorZone } = await import('@astera/rules');
    const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    const field = privatePirateField(season!.asteroidKey);
    const [world] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!));
    const eye = sensorSphere({ x: world!.x, y: world!.y, z: world!.z }, 0, 0, f.planetIds[0]);

    let found: { index: number; minute: number } | null = null;
    outer: for (const spec of field) {
      for (let minute = Math.ceil(spec.appearsAt) + 1; minute < spec.expiresAt; minute += 1) {
        if (!pirateActive(spec, minute)) continue;
        if (sensorZone([eye], piratePosition(spec, minute)) === 'NONE') continue;
        found = { index: spec.index, minute };
        break outer;
      }
    }
    expect(found).not.toBeNull();
    f.clock.set(new Date(season!.startsAt.getTime() + found!.minute * 60_000));
    await giveUnits(f.db, f.planetIds[0]!, { DART: 20 });

    const parsed = pirateRaidSchema.parse(await post('/api/pirates/raid', {
      pirateId: pirateId(season!.asteroidKey, found!.index),
      fleet: { DART: 20 },
    }));
    expect(parsed.fleet).toEqual({ DART: 20 });
    expect(parsed.fuel).toBeGreaterThan(0);
    expect(parsed.arriveAt.getTime()).toBeGreaterThan(f.clock.now().getTime());
    // The strip already has it, so the craft is drawn on this very frame. D53.
    const thread = parsed.pending.find((p) => p.id === parsed.raidId);
    expect(thread, 'the launch answered without its own craft on the strip').toBeDefined();
    expect(thread!.kind).toBe('pirate');
    expect(thread!.pirate?.level).toBe(parsed.level);
    // And the raw lane index never reaches the wire.
    expect(JSON.stringify(parsed)).not.toContain('pirateIndex');
    const [row] = await f.db.select().from(pirateRaids).where(eq(pirateRaids.id, parsed.raidId));
    expect(row!.pirateIndex).toBe(found!.index);
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
    await giveUnits(f.db, theirs, { DART: 20 });
    const launch = await launchAttack(f.db, theirs, third, { DART: 20 }, f.clock);
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
    await giveUnits(f.db, theirs, { DART: 20 });
    const launch = await launchAttack(f.db, theirs, third, { DART: 20 }, f.clock);
    /*
      INSIDE THE FINAL WINDOW, DERIVED RATHER THAN TYPED. It was "half a minute
      out", against a floor that was a flat sixty seconds — and that floor was a
      poll interval written on the wrong side of the wire. It is the refetch
      cadence now, so the instant this test needs is read from the same constant
      the server floors the window at.
    */
    f.clock.set(new Date(launch.arriveAt.getTime() - TRAFFIC.refreshMs / 2));

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
    const launch = await launchAttack(f.db, mine, theirs, { DART: 6 }, f.clock);
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
    ['/api/chat/messages', chatPageSchema],
    ['/api/chat/unread', chatUnreadSchema],
    ['/api/chronicle', chroniclePageSchema],
    ['/api/announcements', announcementsPageSchema],
    ['/api/intel', intelSchema],
    ['/api/notifications', notificationsSchema],
    ['/api/session/return', returnSchema],
    ['/api/session/pending', pendingSchema],
    ['/api/session/unlocks', unlocksSchema],
  ] as const)('GET %s parses', async (url, schema) => {
    schema.parse(await get(url));
  });

  /**
   * THE PROBE'S FULL PRODUCT REACHES THE CLIENT. T9 · T10 · D137.
   *
   * `resolveProbe` has written the target's combat doctrine and whether they can
   * shoot a strategic weapon down into every report's silhouette since those
   * features shipped, and the route dropped both on the way out — so the two most
   * expensive readings in the game were collected and never delivered. Parsing the
   * schema is not enough here; the MEANING has to arrive, so this asserts the
   * values rather than the shape.
   */
  it('GET /api/intel delivers the doctrine and interceptor a probe recorded', async () => {
    const [mine, theirs] = f.planetIds as [string, string];

    // What the probe is meant to come home with, put on the target world.
    await giveResearch(f.db, theirs, 'SHIP_POWER', 2);
    await f.db.insert(strategicAssets).values({
      planetId: theirs,
      type: 'INTERCEPTOR',
      status: 'READY',
      startedAt: f.clock.now(),
      readyAt: f.clock.now(),
    });
    await grant(f.db, mine, 20_000, 5_000);
    await setLevel(f.db, mine, 'SHIPYARD', 3);

    // Fly it there and back, because delivery is what gates the reading.
    const launch = await launchProbe(f.db, mine, theirs, f.clock);
    const worker = new EventWorker(
      f.db, f.clock, { pollMs: 1000, batch: 100, staleMinutes: 5 }, silent,
    );
    f.clock.advance(launch.flightMinutes * 3);
    await worker.tick();
    f.clock.advance(launch.flightMinutes * 3);
    await worker.tick();

    const parsed = intelSchema.parse(await get('/api/intel'));
    const report = parsed.probeReports.find((r) => r.targetPlanetId === theirs);
    expect(report, 'the delivered report never reached the payload').toBeDefined();
    expect(report?.doctrines, 'the doctrine reading was dropped on the way out')
      .toEqual({ SHIP_POWER: 2 });
    expect(report?.interceptor, 'the interceptor reading was dropped on the way out')
      .toBe(true);
  });

  it('GET /api/chronicle parses every public event variant', async () => {
    const [planetId] = f.planetIds as [string];
    const identity = { planetName: 'Kestrel', commanderName: 'Tester0' };
    await f.db.insert(galaxyEvents).values([
      { seasonId: f.seasonId, kind: 'isotope_exhausted', refId: 'iso', subjectPlanetId: null, payload: {}, occurredAt: f.clock.now() },
      { seasonId: f.seasonId, kind: 'wreck_formed', refId: 'wreck-new', subjectPlanetId: planetId, payload: identity, occurredAt: f.clock.now() },
      { seasonId: f.seasonId, kind: 'wreck_exhausted', refId: 'wreck-gone', subjectPlanetId: planetId, payload: identity, occurredAt: f.clock.now() },
      { seasonId: f.seasonId, kind: 'dominion_leader', refId: 'leader', subjectPlanetId: planetId, payload: identity, occurredAt: f.clock.now() },
      { seasonId: f.seasonId, kind: 'season_act', refId: 'act', subjectPlanetId: null, payload: { act: 'war' }, occurredAt: f.clock.now() },
      { seasonId: f.seasonId, kind: 'neutral_claim', refId: 'claim', subjectPlanetId: planetId, payload: { planetName: 'Neutral', tier: 1, claimUntil: f.clock.now().toISOString() }, occurredAt: f.clock.now() },
      { seasonId: f.seasonId, kind: 'death_star_impact', refId: 'impact', subjectPlanetId: planetId, payload: { planetName: 'Kestrel', outcome: 'FIRST_STRIKE', capturable: true }, occurredAt: f.clock.now() },
      { seasonId: f.seasonId, kind: 'control_transfer', refId: 'control', subjectPlanetId: planetId, payload: identity, occurredAt: f.clock.now() },
    ]);

    const page = chroniclePageSchema.parse(await get('/api/chronicle'));
    expect(new Set(page.events.map((event) => event.kind))).toEqual(new Set([
      'isotope_exhausted',
      'wreck_formed',
      'wreck_exhausted',
      'dominion_leader',
      'season_act',
      'neutral_claim',
      'death_star_impact',
      'control_transfer',
    ]));
    expect(JSON.stringify(page.events.find((event) => event.kind === 'isotope_exhausted')))
      .not.toContain('asteroidIndex');
  });

  it('POST /api/chat/messages and /api/chat/read parse', async () => {
    const sent = chatPostSchema.parse(await post('/api/chat/messages', { content: 'hello galaxy' }));
    expect(sent.message.self).toBe(true);
    const marked = chatReadSchema.parse(await post('/api/chat/read', { messageId: sent.message.id }));
    expect(marked.ok).toBe(true);
  });

  it('POST /api/rival parses', async () => {
    const parsed = rivalSetSchema.parse(await post('/api/rival', { planetId: f.planetIds[1] }));
    expect(parsed.rivalPlanetId).toBe(f.planetIds[1]);
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
    const parsed = buildSchema.parse(await post('/api/planet/build', { hull: 'DART', count: 2 }));
    expect(parsed.built).toBe(2);
  });

  it('POST /api/planet/research parses', async () => {
    f.clock.advance(42 * 60);
    const parsed = researchCompleteSchema.parse(
      await post('/api/planet/research', { projectId: 'ISOTOPE_SPECTROMETRY' }),
    );
    expect(parsed.projectId).toBe('ISOTOPE_SPECTROMETRY');
  });

  it('refuses to cancel a commander research commitment', async () => {
    const placed = researchCompleteSchema.parse(
      await post('/api/planet/research', { projectId: 'DEUTERIUM_SYNTHESIS' }),
    );
    const order = placed.planet.researchQueue?.[0];
    if (!order) throw new Error('research contract setup created no order');

    const planetId = f.planetIds[0]!;
    for (const url of [
      `/api/planet/research-orders/${order.id}/cancel`,
      `/api/planets/${planetId}/research-orders/${order.id}/cancel`,
    ]) {
      const response = await app.inject({
        method: 'POST',
        url,
        headers: auth,
        payload: {},
      });
      expect(response.statusCode, url).toBe(409);
      expect(response.json<{ error?: string }>().error, url)
        .toBe('RESEARCH_CANNOT_BE_CANCELLED');
    }
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
      await post('/api/fleet/launch', { targetPlanetId: theirs, fleet: { DART: 4 } }),
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

  it('POST /api/fleet/transfer parses with a full origin view and pending flight', async () => {
    const [origin, , colony] = f.planetIds as [string, string, string];
    await f.db.update(planets)
      .set({ controllerPlayerId: f.playerIds[0], kind: 'COLONY' })
      .where(eq(planets.id, colony));
    await f.db.update(units).set({ ownerPlayerId: f.playerIds[0] }).where(eq(units.planetId, colony));

    const parsed = movementLaunchSchema.parse(await post('/api/fleet/transfer', {
      originPlanetId: origin,
      targetPlanetId: colony,
      fleet: { DART: 1 },
      cargo: { alloy: 0, crystal: 0, deuterium: 0 },
    }));
    expect(parsed.pending.some((thread) => thread.id === parsed.missionId)).toBe(true);
    expect(parsed.planet.planet.id).toBe(origin);
  });

  it('POST /api/fleet/settle parses the shared movement contract', async () => {
    const [origin, , target] = f.planetIds as [string, string, string];
    await f.db.update(planets)
      .set({ controllerPlayerId: null, kind: 'NEUTRAL' })
      .where(eq(planets.id, target));
    await f.db.update(units).set({ ownerPlayerId: null }).where(eq(units.planetId, target));
    await f.db.insert(neutralPlanetState).values({
      planetId: target,
      tier: 1,
      profileSeed: 7,
      claimUntil: new Date(f.clock.now().getTime() + 30 * 60_000),
      nextReinforcementAt: null,
      economyAnchorAt: f.clock.now(),
    });

    const parsed = movementLaunchSchema.parse(await post('/api/fleet/settle', {
      originPlanetId: origin,
      targetPlanetId: target,
    }));
    expect(parsed.pending.some((thread) => thread.id === parsed.missionId)).toBe(true);
  });

  it('POST Death Star build and launch routes parse their exact contracts', async () => {
    const [origin, target] = f.planetIds as [string, string];
    await setLevel(f.db, origin, 'CORE', DEATH_STAR.requiredCore);
    await setLevel(f.db, origin, 'SHIPYARD', DEATH_STAR.requiredShipyard);
    await f.db.update(planets)
      .set({ alloy: 100_000, crystal: 50_000, deuterium: 10_000 })
      .where(eq(planets.id, origin));
    await giveResearch(f.db, origin, 'ISOTOPE_SPECTROMETRY');
    await giveResearch(f.db, origin, 'GRAVITIC_CHARGES');
    await giveResearch(f.db, origin, 'DEATH_STAR_PROTOCOL');
    const built = deathStarBuildSchema.parse(
      await post(`/api/planets/${origin}/death-star/build`, {}),
    );
    expect(built.planet.strategic?.status).toBe('BUILDING');

    await f.db.update(strategicAssets)
      .set({ status: 'READY', readyAt: f.clock.now(), remainingSeconds: 0 })
      .where(eq(strategicAssets.id, built.assetId));
    await f.db.update(planets).set({ kind: 'COLONY' }).where(eq(planets.id, target));
    const launched = deathStarLaunchSchema.parse(await post('/api/death-star/launch', {
      originPlanetId: origin,
      targetPlanetId: target,
    }));
    expect(launched.pending.some((thread) => thread.id === launched.missionId)).toBe(true);
  });

  /**
   * THE ROUTE T10 NEVER WIRED. T12.
   *
   * `buildInterceptor` shipped complete, tested and unreachable: no route, no
   * client method, no control. The research that authorises it is buyable from the
   * research menu now, so a commander could pay 33,000 for a permission to build a
   * thing with no door — which is worse than not having the defence at all.
   */
  it('POST interceptor build parses its exact contract', async () => {
    const [origin] = f.planetIds as [string];
    await f.db.update(planets)
      .set({ alloy: 100_000, crystal: 50_000, deuterium: 10_000 })
      .where(eq(planets.id, origin));
    await giveSatellite(f.db, origin, 'UPLINK');
    await giveInstrument(f.db, origin, 'RADAR', ANTI_STRATEGIC.requiredRadar);
    await giveResearch(f.db, origin, ANTI_STRATEGIC.requiredResearch);

    const built = interceptorBuildSchema.parse(
      await post(`/api/planets/${origin}/interceptor/build`, {}),
    );
    expect(built.planet.interceptor?.status).toBe('BUILDING');
    // And the weapon slot stays empty: two assets, two keys, never one.
    expect(built.planet.strategic ?? null).toBeNull();
  });

  it('refuses an interceptor the commander has not researched', async () => {
    const [origin] = f.planetIds as [string];
    await f.db.update(planets)
      .set({ alloy: 100_000, crystal: 50_000, deuterium: 10_000 })
      .where(eq(planets.id, origin));
    await giveSatellite(f.db, origin, 'UPLINK');
    await giveInstrument(f.db, origin, 'RADAR', ANTI_STRATEGIC.requiredRadar);

    const res = await app.inject({
      method: 'POST',
      url: `/api/planets/${origin}/interceptor/build`,
      headers: auth,
      payload: {},
    });
    expect(res.statusCode).toBe(403);
    expect(res.json<{ error?: string }>().error).toBe('INTERCEPTOR_LOCKED');
  });

  /**
   * THE ROUTE ACCEPTS EXACTLY WHAT THE GAME HAS, AND NOTHING WAS TYPED TWICE.
   *
   * Every id list on `routes/planet.ts` was hand-written beside a generated enum in
   * `packages/rules`, and three of them had fallen behind — so the server answered
   * 400 to things it fully implements:
   *
   *   · the HANGAR, which is the fleet ceiling the whole of T4 is built on
   *   · the DEUTERIUM_PLANT, the only steady source of fuel
   *   · eleven of the fifteen research projects
   *
   * Zod threw at the boundary, which is a 400 and looks like a malformed request
   * rather than a missing case. Nothing typechecked it: a `z.enum` of string literals
   * is valid TypeScript whatever it omits.
   */
  describe('the route boundary knows every id the rules have', () => {
    it('accepts every building', async () => {
      const [planetId] = f.planetIds as [string];
      for (const type of BUILDING_IDS) {
        const res = await app.inject({
          method: 'POST',
          url: `/api/planets/${planetId}/upgrade`,
          headers: auth,
          payload: { type },
        });
        // Any game refusal is fine — a 400 from the parser is not.
        expect(res.json<{ error?: string }>().error, type).not.toBe('BAD_REQUEST');
      }
    });

    it('accepts every research project', async () => {
      const [planetId] = f.planetIds as [string];
      for (const projectId of RESEARCH_PROJECT_IDS) {
        const res = await app.inject({
          method: 'POST',
          url: `/api/planets/${planetId}/research`,
          headers: auth,
          payload: { projectId },
        });
        expect(res.json<{ error?: string }>().error, projectId).not.toBe('BAD_REQUEST');
      }
    });

    it('accepts every hull the yard builds', async () => {
      const [planetId] = f.planetIds as [string];
      for (const hull of Object.keys(HULLS)) {
        const res = await app.inject({
          method: 'POST',
          url: `/api/planets/${planetId}/build`,
          headers: auth,
          payload: { hull, count: 1 },
        });
        expect(res.json<{ error?: string }>().error, hull).not.toBe('BAD_REQUEST');
      }
    });

    it('accepts every instrument and satellite', async () => {
      const [planetId] = f.planetIds as [string];
      for (const type of INSTRUMENT_IDS) {
        const res = await app.inject({
          method: 'POST', url: `/api/planets/${planetId}/instrument`, headers: auth, payload: { type },
        });
        expect(res.json<{ error?: string }>().error, type).not.toBe('BAD_REQUEST');
      }
      for (const type of SATELLITE_IDS) {
        const res = await app.inject({
          method: 'POST', url: `/api/planets/${planetId}/satellite`, headers: auth, payload: { type },
        });
        expect(res.json<{ error?: string }>().error, type).not.toBe('BAD_REQUEST');
      }
    });
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
    f.clock.advance(42 * 60);
    const cases: { url: string; body: Record<string, unknown> }[] = [
      { url: '/api/planet/upgrade', body: { type: 'VAULT' } },
      { url: '/api/planet/build', body: { hull: 'DART', count: 1 } },
      { url: '/api/planet/research', body: { projectId: 'ISOTOPE_SPECTROMETRY' } },
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

    const activePlanet = planetSchema.parse(await get('/api/planet'));
    const construction = activePlanet.queues?.CONSTRUCTION ?? [];
    const first = construction[0];
    if (!first) throw new Error('contract setup did not create a construction order');
    const cancelled = buildCancelSchema.parse(
      await post(`/api/planet/build-orders/${first.id}/cancel`, {}),
    );
    expect(cancelled.planet).toEqual(planetSchema.parse(await get('/api/planet')));

    const planetId = f.planetIds[0]!;
    await grant(f.db, planetId, 10_000, 5_000);
    const placed = upgradeSchema.parse(
      await post(`/api/planets/${planetId}/upgrade`, { type: 'VAULT' }),
    );
    const order = placed.planet.queues?.CONSTRUCTION.at(-1);
    if (!order) throw new Error('multi-world contract setup did not create an order');
    const cancelledById = buildCancelSchema.parse(
      await post(`/api/planets/${planetId}/build-orders/${order.id}/cancel`, {}),
    );
    expect(cancelledById.planet).toEqual(
      planetSchema.parse(await get(`/api/planets/${planetId}`)),
    );
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

    /**
     * AND EVERY CHAIN SAYS HOW LONG IT REMEMBERS. The card for the follow bonus
     * reads `scope` to decide whether "Taken" means this galaxy or for ever, and
     * the field is optional on the client so an older server costs one plain
     * sentence rather than an empty panel — which is exactly the shape that could
     * go dark without this line: the server could stop sending it, everything
     * would parse, and the card would quietly start saying the wrong thing.
     */
    for (const chain of parsed.chains) {
      expect(chain.scope, `${chain.id} sent no scope`).toBe(
        REWARD_CHAINS.find((c) => c.id === chain.id)?.scope,
      );
    }
    expect(parsed.chains.find((c) => c.id === 'SOCIAL')?.scope).toBe('account');
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
    const launch = await launchAttack(f.db, mine, theirs, { DART: 6 }, f.clock);

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
    /**
     * THE CAP, NOT THE RAID'S OWN LENGTH — because this planet was already down.
     * `applyDisruption` refreshes rather than stacks and clamps to
     * `maxPendingMinutes`, so a second raid of the evening reports the ceiling.
     * The two constants used to be the same number, which is why this assertion
     * could not previously tell which one it was reading.
     */
    expect(payload.disruptedMinutes, 'the works were knocked down and nobody said so')
      .toBe(DISRUPTION.maxPendingMinutes);

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
    await giveSatellite(f.db, theirs, 'UPLINK');
    await giveInstrument(f.db, theirs, 'RADAR', 5);
    await grant(f.db, theirs, 60_000, 20_000);
    // Rich means tall, and tall means out of the tier band (D49). This test is
    // about what a notification SAYS, so put the world back in one band.
    await levelWorld(f.db, f.planetIds);
    const departAt = f.clock.now();
    const launch = await launchAttack(f.db, mine, theirs, { DART: 12, COURIER: 2 }, f.clock);
    /*
      HALFWAY THROUGH THE FLIGHT, DERIVED — NOT A FLAT MINUTE OUT.

      `onRadarWarning` refuses to speak once the fleet is over the target
      (`remaining <= 0`: a warning that arrives with the fleet is noise), and the
      event is not due before the crossing it was scheduled for. A fixed
      `arriveAt - 60s` therefore has to sit inside a flight that is longer than a
      minute, and `seedWorld`'s worlds are 150 units apart — 0.900 min at D152's
      speeds, so that instant moved to before the fleet had launched and
      `incoming_fleet` was never written. The midpoint is inside the window at any
      spacing and at any future speed.
    */
    f.clock.set(new Date((departAt.getTime() + launch.arriveAt.getTime()) / 2));
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

    await exposeMineableAsteroid();
    const field = miningSchema.parse(await get('/api/mining'));
    const rock = field.asteroids.find((a) => a.oreRemaining > 0);
    expect(rock, 'no rock to mine in the contract fixture').toBeDefined();

    const run = await launchMining(f.db, mine, rock!.id, 2, f.clock);
    f.clock.set(run.arriveAt);
    await worker.tick();
    /**
     * ADVANCE TO THE STORED `homeAt`, NEVER BY THE OUTBOUND FLIGHT.
     *
     * This read `run.flightMinutes + 1`, which quietly assumed the trip back takes
     * the same as the trip out. D117 made it three times longer, so the clock
     * stopped short of the return and no notification had been written yet. The
     * row is the authority on when the craft lands — it is what schedules the
     * event — so reading it is both correct and immune to the next change.
     */
    const [turned] = await f.db.select().from(miningRuns).where(eq(miningRuns.id, run.runId));
    f.clock.set(new Date(turned!.homeAt!.getTime() + 1_000));
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
