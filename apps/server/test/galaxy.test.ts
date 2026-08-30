import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import { accounts, players, satellites } from '../src/db/schema.js';
import { launchAttack } from '../src/services/mission.js';
import { assignWatch } from '../src/services/intel.js';
import { createSeason } from '../src/services/season.js';
import { joinSeason } from '../src/services/player.js';
import { publishShard } from '../src/stream/bus.js';
import {
  giveInstrument,
  giveSatellite,
  giveUnits,
  makeAccount,
  placeAt,
  seedWorld,
  setLevel,
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

interface GalaxyPlanet {
  id: string;
  name: string;
  owner: string;
  position: { x: number; y: number; z: number };
  coreTier: number;
  satellites: string[];
  shielded: boolean;
  isSelf: boolean;
  /** How much of this world the caller has earned. D127. */
  intel?: 'RESOLVED' | 'REMEMBERED' | 'UNKNOWN';
  dominionRank?: 1 | 2 | 3;
  fleet?: { status: string; staleMinutes: number; etaMinutes: number | null; clarity: string };
}

// The database pool is shared across every describe in this file, so it is torn
// down at FILE scope. An afterAll inside a describe would close it out from under
// the describes that follow.
afterAll(async () => {
  const { close } = await testDb();
  await close();
});

/**
 * THE ANTI-CHEAT ASSERTION.
 *
 * The roadmap's acceptance criterion for this phase is that a modified client
 * cannot read a field it was not entitled to — **verified against the API response
 * shape, not the UI**. Everything below asserts on raw JSON for that reason.
 */
describe('GET /api/galaxy — fog enforced in the response', () => {
  let f: Fixture;
  let app: FastifyInstance;
  let close: () => Promise<void>;
  let auth: { authorization: string };
  let mine: string;
  let theirs: string;

  beforeEach(async () => {
    f = await seedWorld(3);
    [mine, theirs] = f.planetIds as [string, string];
    await setLevel(f.db, mine, 'CORE', 8);
    await giveSatellite(f.db, mine, 'UPLINK');

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

  const galaxy = async (): Promise<GalaxyPlanet[]> => {
    const res = await app.inject({ method: 'GET', url: '/api/galaxy', headers: auth });
    expect(res.statusCode).toBe(200);
    return res.json<{ planets: GalaxyPlanet[] }>().planets;
  };

  const giveTelescope = async (planetId: string, level: number): Promise<void> => {
    await f.db
      .insert(satellites)
      .values({ planetId, slot: 0, type: 'TELESCOPE', level })
      .onConflictDoUpdate({
        target: [satellites.planetId, satellites.slot],
        set: { type: 'TELESCOPE', level },
      });
  };

  it('lists every planet in the season with public detail only', async () => {
    const planets = await galaxy();
    expect(planets).toHaveLength(3);
    for (const p of planets) {
      expect(p.id).toBeTruthy();
      expect(p.owner).toBeTruthy();
      expect(p.position.x).toBeTypeOf('number');
      expect(p.coreTier).toBeGreaterThanOrEqual(1);
    }
  });

  it('publishes exact Dominion rank only for the three podium commanders', async () => {
    for (const [index, score] of [900, 600, 300].entries()) {
      await f.db.update(players).set({ dominionTaken: score, dominionLost: 0 })
        .where(eq(players.id, f.playerIds[index]!));
    }
    const planets = await galaxy();
    expect(f.playerIds.map((playerId) => {
      const planetId = f.planetIds[f.playerIds.indexOf(playerId)];
      return planets.find((planet) => planet.id === planetId)?.dominionRank;
    })).toEqual([1, 2, 3]);
  });

  it('uses the account display name, including Turkish İ, never players.name', async () => {
    await f.db.update(accounts).set({ displayName: 'İzci' }).where(eq(accounts.id, f.accountIds[1]!));
    await f.db.update(players).set({ name: 'STALE-SEASON-NAME' }).where(eq(players.id, f.playerIds[1]!));

    const target = (await galaxy()).find((p) => p.id === theirs)!;
    expect(target.owner).toBe('İzci');
    expect(JSON.stringify(target)).not.toContain('STALE-SEASON-NAME');
  });

  it('single-flights the shared floor and invalidates it on the committed shard event', async () => {
    await galaxy();
    await galaxy();
    expect(app.projections.status().publicGalaxy).toMatchObject({ misses: 1, hits: 1 });
    expect(app.projections.status().commander).toMatchObject({ misses: 1, hits: 1 });

    await f.db.transaction(async (tx) => {
      await tx
        .update(accounts)
        .set({ displayName: 'Yeni Kumandan' })
        .where(eq(accounts.id, f.accountIds[1]!));
      await publishShard(tx, f.seasonId, 'world');
    });
    await vi.waitFor(() => {
      expect(app.projections.status().publicGalaxy.invalidations).toBe(1);
      expect(app.projections.status().commander.invalidations).toBe(1);
    });

    const target = (await galaxy()).find((planet) => planet.id === theirs);
    expect(target?.owner).toBe('Yeni Kumandan');
    expect(app.projections.status().publicGalaxy.misses).toBe(2);
    expect(app.projections.status().commander.misses).toBe(2);
  });

  it('invalidates the shared floor when a new commander takes a seat', async () => {
    expect(await galaxy()).toHaveLength(3);
    const newcomer = await makeAccount(f.db, 'Newcomer');
    await joinSeason(f.db, newcomer.id, f.seasonId, f.clock);

    await vi.waitFor(() => {
      expect(app.projections.status().publicGalaxy.invalidations).toBe(1);
    });
    expect(await galaxy()).toHaveLength(4);
  });

  it('shares only the public floor; ownership and telescope fog stay caller-local', async () => {
    await giveTelescope(mine, 2);
    await assignWatch(f.db, mine, theirs, 0, f.clock);

    const first = await galaxy();
    const tokens = new TokenService('test-secret-that-is-long-enough', 15, 30);
    const secondAuth = {
      authorization: `Bearer ${await tokens.issueAccess(f.accountIds[1]!)}`,
    };
    const secondResponse = await app.inject({
      method: 'GET',
      url: '/api/galaxy',
      headers: secondAuth,
    });
    expect(secondResponse.statusCode).toBe(200);
    const second = secondResponse.json<{ planets: GalaxyPlanet[] }>().planets;

    expect(first.find((planet) => planet.id === theirs)?.fleet).toBeDefined();
    expect(second.find((planet) => planet.id === mine)).not.toHaveProperty('fleet');
    expect(first.find((planet) => planet.id === mine)).toMatchObject({ isSelf: true, isOwned: true });
    expect(second.find((planet) => planet.id === theirs)).toMatchObject({ isSelf: true, isOwned: true });
    expect(app.projections.status().publicGalaxy).toMatchObject({ misses: 1, hits: 1 });
  });

  it('does not throw away the galaxy projection for an unrelated chat event', async () => {
    await galaxy();
    const delivered = app.bus.status().delivered;
    await publishShard(f.db, f.seasonId, 'chat');
    await vi.waitFor(() => {
      expect(app.bus.status().delivered).toBeGreaterThan(delivered);
    });
    await galaxy();
    expect(app.projections.status().publicGalaxy).toMatchObject({
      misses: 1,
      hits: 1,
      invalidations: 0,
    });
  });

  it('a planet you are not watching has NO fleet key at all', async () => {
    // Their fleet is genuinely away — the truth exists, it is just not yours.
    await giveUnits(f.db, theirs, { WASP: 30 });
    f.clock.advance(SETTLED_MINUTES);
    await launchAttack(f.db, theirs, mine, { WASP: 30 }, f.clock);

    const target = (await galaxy()).find((p) => p.id === theirs)!;
    // Not "UNKNOWN" — absent. There is nothing in the payload to unhide.
    expect(target).not.toHaveProperty('fleet');
    expect(JSON.stringify(target)).not.toContain('AWAY');
  });

  it('a planet you ARE watching carries the reading you earned', async () => {
    await giveTelescope(mine, 2);
    await assignWatch(f.db, mine, theirs, 0, f.clock);

    const target = (await galaxy()).find((p) => p.id === theirs)!;
    expect(target.fleet).toBeDefined();
    expect(target.fleet!.status).toBe('HOME');
    expect(target.fleet!.clarity).toBe('FULL');
  });

  it('a Veil that outmatches your telescope yields UNKNOWN, never the truth', async () => {
    await giveTelescope(mine, 1);
    await setLevel(f.db, theirs, 'CORE', 3);
    await f.db
      .insert(satellites)
      .values({ planetId: theirs, slot: 0, type: 'VEIL', level: 3 })
      .onConflictDoUpdate({
        target: [satellites.planetId, satellites.slot],
        set: { type: 'VEIL', level: 3 },
      });
    await assignWatch(f.db, mine, theirs, 0, f.clock);

    await giveUnits(f.db, theirs, { WASP: 30 });
    f.clock.advance(SETTLED_MINUTES);
    await launchAttack(f.db, theirs, mine, { WASP: 30 }, f.clock);

    const target = (await galaxy()).find((p) => p.id === theirs)!;
    expect(target.fleet!.status).toBe('UNKNOWN');
    expect(target.fleet!.etaMinutes).toBeNull();
    expect(JSON.stringify(target)).not.toContain('AWAY');
  });

  it('watching one planet does not leak anything about a third', async () => {
    const third = f.planetIds[2]!;
    await giveTelescope(mine, 1);
    await assignWatch(f.db, mine, theirs, 0, f.clock);

    const planets = await galaxy();
    expect(planets.find((p) => p.id === theirs)!.fleet).toBeDefined();
    expect(planets.find((p) => p.id === third)!).not.toHaveProperty('fleet');
  });

  /**
   * D15 — hardware is public, readings are not.
   *
   * The line these hold is the difference between "that world has an Aegis",
   * which is a shape anyone can see from outside and which makes deterrence a
   * real strategy, and "that world's shield is 4,000", which decides whether a
   * raid pays and therefore has to be bought with a probe.
   */
  /**
   * WHAT IS IN ORBIT IS PUBLIC; WHAT IS ON THE GROUND IS NOT. D15, narrowed by D25.
   *
   * A satellite is a body anyone can see holding station beside a world. The four
   * ground instruments are not: whether a world can watch you, and whether it can
   * tell you are looking, is exactly what the information game is about, and
   * publishing it would answer for free the question a probe is sold to answer.
   */
  it('publishes what a planet has in orbit', async () => {
    await f.db.insert(satellites).values({ planetId: theirs, slot: 1, type: 'FOUNDRY', level: 1 });
    await f.db.insert(satellites).values({ planetId: theirs, slot: 2, type: 'BEACON', level: 1 });

    const planets = await galaxy();
    const target = planets.find((p) => p.id === theirs);
    expect(target?.satellites).toEqual(expect.arrayContaining(['FOUNDRY', 'BEACON']));
  });

  it('never publishes a ground instrument, however many are built', async () => {
    await giveTelescope(theirs, 3);
    await f.db.insert(satellites).values({ planetId: theirs, slot: 4, type: 'AEGIS', level: 5 });

    const planets = await galaxy();
    const target = planets.find((p) => p.id === theirs);
    expect(target?.satellites).not.toContain('TELESCOPE');
    expect(target?.satellites).not.toContain('AEGIS');
  });

  it('never publishes a satellite level, only its presence', async () => {
    await f.db.insert(satellites).values({ planetId: theirs, slot: 1, type: 'FOUNDRY', level: 1 });

    const res = await app.inject({ method: 'GET', url: '/api/galaxy', headers: auth });
    const body = res.body;
    // The whole payload, not just the parsed shape: a level smuggled in under any
    // key at all would still be a level anyone could read.
    expect(body).not.toMatch(/"level"/);
    const target = res.json<{ planets: GalaxyPlanet[] }>().planets.find((p) => p.id === theirs);
    for (const entry of target?.satellites ?? []) expect(entry).toBeTypeOf('string');
  });

  it('reports no hardware for a planet that has installed none', async () => {
    const planets = await galaxy();
    const bare = planets.find((p) => p.id === f.planetIds[2]);
    expect(bare?.satellites).toEqual([]);
  });

  it('exposes development as a coarse tier, never the exact Core level', async () => {
    await setLevel(f.db, theirs, 'CORE', 11);
    const target = (await galaxy()).find((p) => p.id === theirs)!;
    expect(target.coreTier).toBe(4); // ceil(11 / 3)
    expect(JSON.stringify(target)).not.toContain('"11"');
    expect(target).not.toHaveProperty('alloy');
    expect(target).not.toHaveProperty('crystal');
    expect(target).not.toHaveProperty('shield');
  });

  it('never exposes another planet\'s stock, shield or unit counts', async () => {
    await giveTelescope(mine, 3);
    await assignWatch(f.db, mine, theirs, 0, f.clock);

    const target = (await galaxy()).find((p) => p.id === theirs)!;
    const keys = Object.keys(target);
    /**
     * An allowlist, not a denylist: anything new in this payload has to be argued
     * for here first.
     *
     * `satellites` is D15 and carries types only. `shielded` is D25 and is a
     * BOOLEAN — the Aegis moved to the ground and out of the orbit list, and a
     * dome is a physical object anyone can see, so its presence stayed public
     * while its LEVEL never was.
     *
     * NONE OF IT IS PUBLIC ANY MORE — this world is RESOLVED. D127. Every field
     * below is now something the caller EARNED, either live through a Telescope in
     * reach or frozen through a probe; the fixture puts a telescope on this target,
     * so the full shape is the right expectation. What an unearned world carries is
     * asserted in `intel-states.test.ts`, and it is two fields.
     */
    expect(keys.sort()).toEqual(
      [
        'controller', 'coreLevel', 'coreTier', 'fleet', 'id', 'intel', 'isCapital', 'isOwned',
        'isSelf', 'kind', 'name', 'owner', 'position', 'satellites', 'shielded', 'state',
        'dominionRank',
      ].sort(),
    );
    expect(target.intel).toBe('RESOLVED');
  });

  /**
   * D25. The Aegis left the public orbit list when it moved to the ground, and a
   * shield dome is the one thing about it that stays visible. Both halves matter
   * and they pull in opposite directions, so both are asserted here: the FACT is
   * published, and the LEVEL still is not.
   */
  it('publishes that a world is shielded, and never how strongly', async () => {
    const before = (await galaxy()).find((p) => p.id === theirs)!;
    expect(before.shielded).toBe(false);
    // An Aegis is not a satellite any more, so it must not appear in orbit either.
    expect(before.satellites).not.toContain('AEGIS');

    const LEVEL = 7;
    // The helper writes fixture state directly rather than going through the
    // production service, so publish the public change it deliberately bypasses.
    await giveInstrument(f.db, theirs, 'AEGIS', LEVEL);
    await publishShard(f.db, f.seasonId, 'world');
    await vi.waitFor(() => {
      expect(app.projections.status().publicGalaxy.invalidations).toBe(1);
    });

    const after = (await galaxy()).find((p) => p.id === theirs)!;
    expect(after.shielded).toBe(true);
    expect(after.satellites).not.toContain('AEGIS');
    /**
     * The level is what decides the raid, and no field carries it. Checked against
     * the parsed values rather than the JSON text, because a uuid contains digits
     * and a substring search on the serialised payload passes or fails at random.
     */
    expect(Object.values(after)).not.toContain(LEVEL);
    expect(after.coreTier).not.toBe(LEVEL);
  });

  it('requires authentication', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/galaxy' });
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/leaderboard', () => {
  let f: Fixture;
  let app: FastifyInstance;
  let close: () => Promise<void>;
  let auth: { authorization: string };

  beforeEach(async () => {
    f = await seedWorld(3);
    const built = buildApp({ env: testEnv(), logger: silent, db: f.db, clock: f.clock });
    app = built.app;
    close = built.close;
    await app.ready();
    const tokens = new TokenService('test-secret-that-is-long-enough', 15, 30);
    auth = { authorization: `Bearer ${await tokens.issueAccess(f.accountIds[0]!)}` };
  });

  afterEach(async () => {
    await close();
  });

  it('ranks by Dominion, descending, and tells you where you stand', async () => {
    await f.db
      .update(players)
      .set({ dominionTaken: 5000, dominionLost: 1000 })
      .where(eq(players.id, f.playerIds[1]!));
    await f.db
      .update(players)
      .set({ dominionTaken: 200, dominionLost: 900 })
      .where(eq(players.id, f.playerIds[0]!));
    // Keep both rival capitals outside the caller's free 500-unit sight. The
    // fixture's ordinary 150-unit spacing intentionally makes nearby traffic busy.
    await placeAt(f.db, f.planetIds[1]!, { x: 3_000 });
    await placeAt(f.db, f.planetIds[2]!, { x: -3_000 });

    const res = await app.inject({ method: 'GET', url: '/api/leaderboard', headers: auth });
    const body = res.json<{
      ladder: { rank: number; playerId: string; score: number; planetId?: string; coreTier?: number }[];
      you: { rank: number; score: number; planetId?: string; coreTier?: number } | null;
    }>();

    expect(body.ladder[0]!.playerId).toBe(f.playerIds[1]!);
    expect(body.ladder[0]!.score).toBe(4000);
    // Rank and identity are public; an unseen rival's capital and development are not.
    expect(body.ladder[0]).not.toHaveProperty('planetId');
    expect(body.ladder[0]).not.toHaveProperty('coreTier');
    expect(body.ladder.map((e) => e.rank)).toEqual([1, 2, 3]);
    expect(body.you!.score).toBe(-700);
    expect(body.you!.planetId).toBe(f.planetIds[0]!);
    expect(body.you!.coreTier).toBeGreaterThan(0);
  });

  it('a player who has never fought sits at exactly zero', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/leaderboard', headers: auth });
    const body = res.json<{ you: { score: number } }>();
    expect(body.you.score).toBe(0);
  });

  it('uses the canonical account display name on the ladder', async () => {
    await f.db.update(accounts).set({ displayName: 'İzci' }).where(eq(accounts.id, f.accountIds[0]!));
    await f.db.update(players).set({ name: 'STALE-SEASON-NAME' }).where(eq(players.id, f.playerIds[0]!));
    const res = await app.inject({ method: 'GET', url: '/api/leaderboard', headers: auth });
    const body = res.json<{ you: { username: string } }>();
    expect(body.you.username).toBe('İzci');
  });

  it('breaks score ties by join time and then player id', async () => {
    const same = new Date('2026-01-01T00:00:00.000Z');
    await f.db.update(players).set({ joinedAt: same, dominionTaken: 100, dominionLost: 0 });
    const res = await app.inject({ method: 'GET', url: '/api/leaderboard', headers: auth });
    const rows = res.json<{ ladder: { playerId: string; score: number }[] }>().ladder;
    expect(rows.every((row) => row.score === 100)).toBe(true);
    expect(rows.map((row) => row.playerId)).toEqual([...f.playerIds].sort());
  });

  it('never includes a commander from another galaxy', async () => {
    const other = await createSeason(f.db, {
      shardCode: 'EU-LADDER-OTHER', seed: 8128, startsAt: f.clock.now(), playerCap: 5,
    });
    const account = await makeAccount(f.db, 'Elsewhere');
    const joined = await joinSeason(f.db, account.id, other.season.id, f.clock);
    await f.db.update(players).set({ dominionTaken: 1_000_000 }).where(eq(players.id, joined.playerId));

    const res = await app.inject({ method: 'GET', url: '/api/leaderboard', headers: auth });
    const rows = res.json<{ ladder: { playerId: string }[] }>().ladder;
    expect(rows.map((row) => row.playerId)).not.toContain(joined.playerId);
    expect(rows).toHaveLength(3);
  });
});
