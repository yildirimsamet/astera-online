import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { OPENING_BONUS, PLANET_START, START, upgradeCost, HULLS } from '@astera/rules';
import { buildApp } from '../src/app.js';
import { accounts, buildings, missions, planets, players, units } from '../src/db/schema.js';
import { FixedClock } from '../src/clock.js';
import { bootstrapServers } from '../src/services/servers.js';
import { testDb, testEnv, truncateAll, type Fixture } from './helpers.js';

const silent = pino({ level: 'silent' });
const START_AT = new Date('2026-03-01T00:00:00.000Z');

interface Applied {
  kind: string;
  ok: boolean;
  error?: string;
}

interface Claim {
  accountId: string;
  username: string;
  displayName: string;
  accessToken: string;
  placement: { shard: string; shardName: string; planetId: string; planetName: string };
  applied: Applied[];
  planet: {
    planet: { alloy: number; crystal: number; name: string };
    buildings: Record<string, number>;
  };
}

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

/**
 * THE CLAIM: A REHEARSAL BECOMES A SEASON. D56.
 *
 * One call has to do four things that were four calls — make an account, take a
 * seat, replay an opening and open a session — and it has to survive being sent
 * twice by a phone that never heard the first answer.
 */
describe('onboarding claim', () => {
  let db: Fixture['db'];
  let app: FastifyInstance;
  let close: () => Promise<void>;
  let clock: FixedClock;
  let seq = 0;

  beforeEach(async () => {
    ({ db } = await testDb());
    await truncateAll(db);
    clock = new FixedClock(START_AT);
    const built = buildApp({ env: testEnv(), clock, logger: silent, db });
    app = built.app;
    close = built.close;
    await app.ready();
  });

  afterEach(async () => {
    await close();
  });

  const openWorld = (capacity = 6) =>
    bootstrapServers(db, clock, { count: 2, capacity, seedBase: 1000 });

  /** Somebody already living in the galaxy, to be a neighbour and a target. */
  const neighbour = async (): Promise<{ planetId: string }> => {
    seq += 1;
    const reg = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: `neighbour${String(seq)}`, password: 'correct-horse-battery' },
    });
    const who = reg.json<{ accessToken: string }>();
    const res = await app.inject({
      method: 'POST',
      url: '/api/servers/EU-1/join',
      headers: { authorization: `Bearer ${who.accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    return res.json<{ planetId: string }>();
  };

  const claim = (payload: Record<string, unknown>) =>
    app.inject({ method: 'POST', url: '/api/onboarding/claim', payload });

  /**
   * THE SCRIPTED OPENING, which is not a script the interface invented — it is the
   * only order the rules permit. Nothing may exceed the Command Core, so the Core
   * is first and the other two follow; what is left over is exactly two Wasps.
   */
  const OPENING = (targetPlanetId: string) => [
    { kind: 'upgrade', building: 'CORE' },
    { kind: 'upgrade', building: 'REFINERY' },
    { kind: 'upgrade', building: 'EXTRACTOR' },
    { kind: 'build', hull: 'WASP', count: 2 },
    { kind: 'launch', targetPlanetId, fleet: { WASP: 2 } },
  ];

  /* ── the arithmetic the whole rehearsal stands on ─────────── */

  /**
   * D22/D29 SAY THE OPENING GRANT IS DERIVED ARITHMETIC, and the rehearsal teaches
   * it as such — "your crystal is gone, exactly, and that is not a coincidence".
   * If a balance change ever makes that sentence false, this fails here rather
   * than in front of a new player halfway through their first ninety seconds.
   */
  it('is exactly affordable: three upgrades spend all the crystal, and the rest is two Wasps', () => {
    const step = upgradeCost(1);
    const three = { alloy: step.alloy * 3, crystal: step.crystal * 3 };

    expect(three.crystal).toBe(START.crystal);
    expect(START.alloy - three.alloy).toBe(HULLS.WASP.alloy * 2);
    expect(HULLS.WASP.crystal).toBe(0);
    expect(HULLS.WASP.minShipyard).toBe(0);
  });

  /* ── the happy path ───────────────────────────────────────── */

  it('makes an account, takes a seat and answers with the planet', async () => {
    await openWorld();

    const res = await claim({ username: 'kaptan', password: 'correct-horse-battery' });
    expect(res.statusCode).toBe(200);
    const body = res.json<Claim>();

    expect(body.username).toBe('kaptan');
    expect(body.accessToken).not.toBe('');
    expect(body.placement.shard).toBe('EU-1');
    expect(body.placement.planetName).not.toBe('');
    expect(body.planet.planet.alloy).toBe(PLANET_START.alloy);
    expect(await db.select().from(players)).toHaveLength(1);
  });

  it('replays the whole opening, and the planet ends where the rehearsal said it would', async () => {
    await openWorld();
    const target = await neighbour();

    const body = (await claim({
      username: 'kaptan',
      password: 'correct-horse-battery',
      intents: OPENING(target.planetId),
    })).json<Claim>();

    expect(body.applied.every((a) => a.ok)).toBe(true);
    expect(body.planet.buildings.CORE).toBe(2);
    expect(body.planet.buildings.REFINERY).toBe(2);
    expect(body.planet.buildings.EXTRACTOR).toBe(2);
    /**
         * THE ARITHMETIC GRANT IS SPENT TO THE LAST UNIT — that is the lesson the
         * beat teaches, and it still holds. WHAT IS LEFT IS THE CUSHION, exactly
         * (D58): the opening costs `START` and a new world is created with `START`
         * plus `OPENING_BONUS`, so a commander who has just finished onboarding
         * stands on a planet with something to spend rather than nothing to press.
         *
         * Asserted as the constant rather than as 1000/500, so that moving the
         * cushion moves this test with it and moving it by ACCIDENT does not.
         */
    expect(body.planet.planet.alloy).toBe(OPENING_BONUS.alloy);
    expect(body.planet.planet.crystal).toBe(OPENING_BONUS.crystal);

    const flying = await db
      .select()
      .from(missions)
      .where(eq(missions.originPlanetId, body.placement.planetId));
    expect(flying).toHaveLength(1);
    expect(flying[0]?.status).toBe('in_flight');
  });

  /**
   * Design Law #6: every session ends with something in flight. The onboarding's
   * whole shape exists to make the FIRST one end that way.
   */
  it('leaves the first session with a fleet in the air', async () => {
    await openWorld();
    const target = await neighbour();

    const body = (await claim({
      username: 'kaptan',
      password: 'correct-horse-battery',
      intents: OPENING(target.planetId),
    })).json<Claim>();

    const rows = await db
      .select()
      .from(units)
      .where(eq(units.planetId, body.placement.planetId));

    // Still owned by the planet — and demonstrably not defending it. The `home`
    // row is emptied rather than deleted, so the count is what to read.
    const home = rows.filter((r) => r.location === 'home').reduce((n, r) => n + r.count, 0);
    const away = rows.filter((r) => r.location !== 'home').reduce((n, r) => n + r.count, 0);
    expect(home).toBe(0);
    expect(away).toBe(2);
  });

  /* ── a refusal must not cost the player their account ─────── */

  it('keeps the account and the planet when a replayed step is refused', async () => {
    await openWorld();

    const body = (await claim({
      username: 'kaptan',
      password: 'correct-horse-battery',
      // No Core first, so the Refinery cannot pass it.
      intents: [{ kind: 'upgrade', building: 'REFINERY' }],
    })).json<Claim>();

    expect(body.applied[0]?.ok).toBe(false);
    expect(body.applied[0]?.error).toBe('CORE_CEILING');
    expect(body.accessToken).not.toBe('');
    expect(await db.select().from(planets)).toHaveLength(1);
  });

  /**
   * A target can cross out of the tier band, or fill its bash limit, in the two
   * minutes somebody spends choosing a password. The steps before it still stand.
   */
  it('reports the refused step and stops, rather than failing the whole claim', async () => {
    await openWorld();
    const target = await neighbour();
    // Raise the neighbour out of the ±2 tier band: Core 10 is tier 4 against a
    // fresh planet's tier 1.
    await db
      .update(buildings)
      .set({ level: 10 })
      .where(eq(buildings.planetId, target.planetId));

    const body = (await claim({
      username: 'kaptan',
      password: 'correct-horse-battery',
      intents: OPENING(target.planetId),
    })).json<Claim>();

    expect(body.applied.slice(0, 4).every((a) => a.ok)).toBe(true);
    expect(body.applied[4]).toMatchObject({ kind: 'launch', ok: false, error: 'TIER_BAND' });
    // The ships were still built; they are at home waiting for a target.
    expect(body.planet.buildings.CORE).toBe(2);
  });

  it('skips the rest of a chain once one link is refused', async () => {
    await openWorld();

    const body = (await claim({
      username: 'kaptan',
      password: 'correct-horse-battery',
      intents: [
        { kind: 'upgrade', building: 'REFINERY' },
        { kind: 'upgrade', building: 'CORE' },
        { kind: 'build', hull: 'WASP', count: 1 },
      ],
    })).json<Claim>();

    expect(body.applied.map((a) => a.error)).toEqual(['CORE_CEILING', 'SKIPPED', 'SKIPPED']);
    expect(body.planet.buildings.CORE).toBe(1);
  });

  /* ── sent twice ───────────────────────────────────────────── */

  /**
   * A PHONE RETRIES. The naive version answers the second attempt with
   * USERNAME_TAKEN — telling a player the name they just made belongs to somebody
   * else — or worse, raises the Core twice.
   */
  it('is idempotent: the same claim twice makes one account, one planet, one opening', async () => {
    await openWorld();
    const target = await neighbour();
    const payload = {
      username: 'kaptan',
      password: 'correct-horse-battery',
      intents: OPENING(target.planetId),
    };

    const first = await claim(payload);
    expect(first.statusCode).toBe(200);
    const second = await claim(payload);
    expect(second.statusCode).toBe(200);

    const body = second.json<Claim>();
    expect(await db.select().from(accounts)).toHaveLength(2); // the neighbour and this one
    expect(await db.select().from(players)).toHaveLength(2);
    expect(body.planet.buildings.CORE).toBe(2);
    expect(body.applied.every((a) => !a.ok && a.error === 'ALREADY_OPENED')).toBe(true);

    const flying = await db
      .select()
      .from(missions)
      .where(eq(missions.originPlanetId, body.placement.planetId));
    expect(flying).toHaveLength(1);
  });

  it('still refuses a name that belongs to somebody else', async () => {
    await openWorld();
    await claim({ username: 'kaptan', password: 'correct-horse-battery' });

    const res = await claim({ username: 'kaptan', password: 'a-different-password' });
    expect(res.statusCode).toBe(409);
    expect(res.json<{ error: string }>().error).toBe('USERNAME_TAKEN');
  });

  /* ── the frontier is re-read, never taken from the client ─── */

  it('follows the frontier at claim time, even if the galaxy filled during the rehearsal', async () => {
    await bootstrapServers(db, clock, { count: 2, capacity: 1, seedBase: 1000 });
    await neighbour(); // fills EU-1

    const body = (await claim({
      username: 'kaptan',
      password: 'correct-horse-battery',
    })).json<Claim>();

    expect(body.placement.shard).toBe('EU-2');
  });

  /**
   * TWO STRANGERS FINISH THEIR REHEARSALS ON THE SAME SECOND, and there is one
   * seat left. The frontier rule is enforced by the database, not by a check, so
   * this is a real race rather than a theoretical one — and the loser must land in
   * the next galaxy along with an account, not on an error page having lost two
   * minutes.
   */
  it('seats two simultaneous claims without losing either of them', async () => {
    await bootstrapServers(db, clock, { count: 2, capacity: 1, seedBase: 1000 });

    const [first, second] = await Promise.all([
      claim({ username: 'racer_one', password: 'correct-horse-battery' }),
      claim({ username: 'racer_two', password: 'correct-horse-battery' }),
    ]);

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);

    const shards = [first.json<Claim>().placement.shard, second.json<Claim>().placement.shard];
    expect(new Set(shards)).toEqual(new Set(['EU-1', 'EU-2']));
    expect(await db.select().from(players)).toHaveLength(2);
  });

  /**
   * THE POINT OF THE CUSHION, ASSERTED AS A CONSEQUENCE RATHER THAN AS A NUMBER.
   *
   * The complaint it answers was precise: onboarding ends with the grant spent to
   * the last crystal, both Wasps gone, and a flight forty minutes out — so a
   * commander who has just been persuaded to make an account has nothing at all to
   * press. This checks the thing that actually matters at that moment: that what
   * is left is enough to DO something with.
   *
   * The two things reachable at that point are a fourth building level and a
   * Shipyard, so those are what it prices. If a future balance pass makes the
   * cushion too small to buy either, this fails here rather than in front of the
   * next fifty players.
   */
  it('leaves a freshly onboarded commander able to act', async () => {
    await openWorld();
    const target = await neighbour();

    const body = (await claim({
      username: 'kaptan',
      password: 'correct-horse-battery',
      intents: OPENING(target.planetId),
    })).json<Claim>();

    const left = { alloy: body.planet.planet.alloy, crystal: body.planet.planet.crystal };

    // A fourth level on any of the three buildings the opening raised to L2.
    const nextLevel = upgradeCost(2);
    expect(left.alloy).toBeGreaterThanOrEqual(nextLevel.alloy);
    expect(left.crystal).toBeGreaterThanOrEqual(nextLevel.crystal);

    // Or the first building the opening never touches, which is what unlocks
    // every hull beyond the Wasp.
    const firstNewBuilding = upgradeCost(0);
    expect(left.alloy).toBeGreaterThanOrEqual(firstNewBuilding.alloy);

    // And a replacement for a Wasp, since both of the opening's are in the air.
    expect(left.alloy).toBeGreaterThanOrEqual(HULLS.WASP.alloy);
  });

  /** Nothing to replay is a real claim, not a malformed one. */
  it('takes a claim with no intents at all', async () => {
    await openWorld();

    const body = (await claim({ username: 'kaptan', password: 'correct-horse-battery' })).json<Claim>();

    expect(body.applied).toEqual([]);
    expect(body.planet.planet.alloy).toBe(PLANET_START.alloy);
  });

  /**
   * A target can be gone by the time the password is typed — the world wiped, the
   * galaxy rolled. The step reports and the account stands.
   */
  it('reports a launch at a world that no longer exists, and keeps the planet', async () => {
    await openWorld();

    const body = (await claim({
      username: 'kaptan',
      password: 'correct-horse-battery',
      intents: [
        { kind: 'upgrade', building: 'CORE' },
        {
          kind: 'launch',
          targetPlanetId: '00000000-0000-4000-8000-000000000000',
          fleet: { WASP: 1 },
        },
      ],
    })).json<Claim>();

    expect(body.applied[0]?.ok).toBe(true);
    expect(body.applied[1]?.ok).toBe(false);
    expect(body.planet.buildings.CORE).toBe(2);
    expect(await db.select().from(planets)).toHaveLength(1);
  });

  it('refuses a malformed intent at the boundary rather than part-way through', async () => {
    await openWorld();

    const res = await claim({
      username: 'kaptan',
      password: 'correct-horse-battery',
      intents: [{ kind: 'build', hull: 'DREADNOUGHT', count: 1 }],
    });

    expect(res.statusCode).toBe(400);
    expect(await db.select().from(accounts)).toHaveLength(0);
  });

  /** The credential rules are the same ones the front door enforces. */
  it('refuses a name or a password the rules do not allow', async () => {
    await openWorld();

    expect((await claim({ username: 'ab', password: 'correct-horse-battery' })).statusCode).toBe(400);
    expect((await claim({ username: 'kaptan', password: 'short' })).statusCode).toBe(400);
    expect((await claim({ username: 'admin', password: 'correct-horse-battery' })).statusCode).toBe(400);
    expect(await db.select().from(accounts)).toHaveLength(0);
  });

  it('refuses an oversized intent list rather than running it', async () => {
    await openWorld();

    const res = await claim({
      username: 'kaptan',
      password: 'correct-horse-battery',
      intents: Array.from({ length: 13 }, () => ({ kind: 'upgrade', building: 'CORE' })),
    });

    expect(res.statusCode).toBe(400);
  });
});
