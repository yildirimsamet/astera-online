import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import { players, satellites } from '../src/db/schema.js';
import { launchAttack } from '../src/services/mission.js';
import { assignWatch } from '../src/services/intel.js';
import {
  giveInstrument,
  giveUnits,
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
     * while its LEVEL never was. The argument for it is that a raider who cannot
     * tell an armoured world from a bare one is not making a decision; the reason
     * it is a boolean and not a number is that the level is what decides the raid.
     */
    expect(keys.sort()).toEqual(
      ['coreTier', 'fleet', 'id', 'isSelf', 'name', 'owner', 'position', 'satellites', 'shielded'].sort(),
    );
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
    await giveInstrument(f.db, theirs, 'AEGIS', LEVEL);

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

    const res = await app.inject({ method: 'GET', url: '/api/leaderboard', headers: auth });
    const body = res.json<{
      ladder: { rank: number; playerId: string; dominion: number }[];
      you: { rank: number; dominion: number } | null;
    }>();

    expect(body.ladder[0]!.playerId).toBe(f.playerIds[1]!);
    expect(body.ladder[0]!.dominion).toBe(4000);
    expect(body.ladder.map((e) => e.rank)).toEqual([1, 2, 3]);
    expect(body.you!.dominion).toBe(-700);
  });

  it('a player who has never fought sits at exactly zero', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/leaderboard', headers: auth });
    const body = res.json<{ you: { dominion: number } }>();
    expect(body.you.dominion).toBe(0);
  });
});
