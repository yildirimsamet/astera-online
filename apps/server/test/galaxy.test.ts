import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ABUSE } from '@blindspace/rules';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import { players, satellites } from '../src/db/schema.js';
import { launchAttack } from '../src/services/mission.js';
import { assignWatch } from '../src/services/intel.js';
import { giveUnits, seedWorld, setLevel, testDb, testEnv, type Fixture } from './helpers.js';

const silent = pino({ level: 'silent' });

interface GalaxyPlanet {
  id: string;
  name: string;
  owner: string;
  position: { x: number; y: number; z: number };
  coreTier: number;
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
    f.clock.advance(ABUSE.graceMinutes + 10);
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
    f.clock.advance(ABUSE.graceMinutes + 10);
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
    expect(keys.sort()).toEqual(
      ['coreTier', 'fleet', 'id', 'isSelf', 'name', 'owner', 'position'].sort(),
    );
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
