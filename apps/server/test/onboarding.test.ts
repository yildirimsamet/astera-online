import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { OPENING_BONUS, PLANET_START, START, upgradeCost, HULLS } from '@astera/rules';
import { buildApp } from '../src/app.js';
import { accounts, buildOrders, missions, planets, players, units } from '../src/db/schema.js';
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
    queues: {
      CONSTRUCTION: {
        kind: string; subject: string; count: number; startedAt: string; finishesAt: string;
      }[];
      YARD: {
        kind: string; subject: string; count: number; startedAt: string; finishesAt: string;
      }[];
    };
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
  const OPENING = () => [
    { kind: 'upgrade', building: 'CORE' },
    { kind: 'upgrade', building: 'REFINERY' },
    { kind: 'upgrade', building: 'EXTRACTOR' },
    { kind: 'build', hull: 'DART', count: 2 },
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
    expect(START.alloy - three.alloy).toBe(HULLS.DART.alloy * 2);
    expect(HULLS.DART.crystal).toBe(0);
    expect(HULLS.DART.minShipyard).toBe(0);
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

    const body = (await claim({
      username: 'kaptan',
      password: 'correct-horse-battery',
      intents: OPENING(),
    })).json<Claim>();

    expect(body.applied.every((a) => a.ok)).toBe(true);
    expect(body.planet.buildings.CORE).toBe(1);
    expect(body.planet.buildings.REFINERY).toBe(1);
    expect(body.planet.buildings.EXTRACTOR).toBe(1);
    expect(body.planet.queues.CONSTRUCTION.map((order) => order.subject))
      .toEqual(['CORE', 'REFINERY', 'EXTRACTOR']);
    expect(body.planet.queues.YARD).toMatchObject([
      { kind: 'HULL', subject: 'DART', count: 2 },
    ]);
    const constructionFinishes = body.planet.queues.CONSTRUCTION
      .map((order) => new Date(order.finishesAt).getTime());
    expect(constructionFinishes[0]).toBeLessThan(constructionFinishes[1]!);
    expect(constructionFinishes[1]).toBeLessThan(constructionFinishes[2]!);
    expect(body.planet.queues.CONSTRUCTION[1]?.startedAt)
      .toBe(body.planet.queues.CONSTRUCTION[0]?.finishesAt);
    expect(body.planet.queues.CONSTRUCTION[2]?.startedAt)
      .toBe(body.planet.queues.CONSTRUCTION[1]?.finishesAt);
    expect(body.planet.queues.YARD[0]?.startedAt)
      .toBe(body.planet.queues.CONSTRUCTION[0]?.startedAt);
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
    expect(flying).toHaveLength(0);

    const stored = await db.select().from(buildOrders)
      .where(eq(buildOrders.planetId, body.placement.planetId));
    expect(stored).toHaveLength(4);
    expect(stored.every((order) => order.status === 'BUILDING')).toBe(true);
  });

  it('leaves the first session with paid work pending and no hull granted early', async () => {
    await openWorld();

    const body = (await claim({
      username: 'kaptan',
      password: 'correct-horse-battery',
      intents: OPENING(),
    })).json<Claim>();

    const rows = await db
      .select()
      .from(units)
      .where(eq(units.planetId, body.placement.planetId));

    expect(rows.reduce((n, row) => n + row.count, 0)).toBe(0);
    expect(body.planet.queues.YARD).toMatchObject([
      { kind: 'HULL', subject: 'DART', count: 2 },
    ]);
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
    expect(await db.select().from(planets).where(eq(planets.kind, 'CAPITAL'))).toHaveLength(1);
  });

  /**
   * A cached old client may still append the former launch intent. The real queue
   * means those hulls do not exist yet; the claim must keep the valid commitments
   * and report that final legacy step rather than manufacturing the fleet.
   */
  it('reports the refused step and stops, rather than failing the whole claim', async () => {
    await openWorld();
    const target = await neighbour();

    const body = (await claim({
      username: 'kaptan',
      password: 'correct-horse-battery',
      intents: [
        ...OPENING(),
        { kind: 'launch', targetPlanetId: target.planetId, fleet: { DART: 2 } },
      ],
    })).json<Claim>();

    expect(body.applied.slice(0, 4).every((a) => a.ok)).toBe(true);
    expect(body.applied[4]).toMatchObject({
      kind: 'launch', ok: false, error: 'NOT_ENOUGH_SHIPS',
    });
    expect(body.planet.queues.CONSTRUCTION).toHaveLength(3);
    expect(body.planet.queues.YARD).toHaveLength(1);
  });

  it('skips the rest of a chain once one link is refused', async () => {
    await openWorld();

    const body = (await claim({
      username: 'kaptan',
      password: 'correct-horse-battery',
      intents: [
        { kind: 'upgrade', building: 'REFINERY' },
        { kind: 'upgrade', building: 'CORE' },
        { kind: 'build', hull: 'DART', count: 1 },
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
    await neighbour();
    const payload = {
      username: 'kaptan',
      password: 'correct-horse-battery',
      intents: OPENING(),
    };

    const first = await claim(payload);
    expect(first.statusCode).toBe(200);
    const second = await claim(payload);
    expect(second.statusCode).toBe(200);

    const body = second.json<Claim>();
    expect(await db.select().from(accounts)).toHaveLength(2); // the neighbour and this one
    expect(await db.select().from(players)).toHaveLength(2);
    expect(body.planet.buildings.CORE).toBe(1);
    expect(body.applied.every((a) => !a.ok && a.error === 'ALREADY_OPENED')).toBe(true);

    const queued = await db.select().from(buildOrders)
      .where(eq(buildOrders.planetId, body.placement.planetId));
    expect(queued).toHaveLength(4);
  });

  it('serializes two simultaneous retries into one complete opening', async () => {
    await openWorld();
    const payload = {
      username: 'simul_claim',
      password: 'correct-horse-battery',
      intents: OPENING(),
    };

    const [first, second] = await Promise.all([claim(payload), claim(payload)]);

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    const bodies = [first.json<Claim>(), second.json<Claim>()];
    expect(bodies.some((body) => body.applied.every((step) => step.ok))).toBe(true);
    expect(bodies.some((body) => body.applied.every(
      (step) => !step.ok && step.error === 'ALREADY_OPENED',
    ))).toBe(true);
    const rows = await db.select().from(buildOrders);
    expect(rows).toHaveLength(4);
    expect(rows.filter((row) => row.queue === 'CONSTRUCTION').map((row) => row.subject).sort())
      .toEqual(['CORE', 'EXTRACTOR', 'REFINERY']);
    expect(rows.filter((row) => row.queue === 'YARD')).toMatchObject([
      { subject: 'DART', count: 2 },
    ]);
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
   * Construction is full with the three taught orders, but Yard still has room.
   * Prove the cushion creates a real fifth decision through the ordinary endpoint,
   * rather than merely comparing it with a price in this test.
   */
  it('leaves a freshly onboarded commander able to act', async () => {
    await openWorld();

    const body = (await claim({
      username: 'kaptan',
      password: 'correct-horse-battery',
      intents: OPENING(),
    })).json<Claim>();

    const action = await app.inject({
      method: 'POST',
      url: '/api/planet/build',
      headers: { authorization: `Bearer ${body.accessToken}` },
      payload: { hull: 'DART', count: 1 },
    });
    expect(action.statusCode).toBe(200);
    const queued = await db.select().from(buildOrders)
      .where(eq(buildOrders.planetId, body.placement.planetId));
    expect(queued.filter((order) => order.queue === 'YARD')).toHaveLength(2);
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
          fleet: { DART: 1 },
        },
      ],
    })).json<Claim>();

    expect(body.applied[0]?.ok).toBe(true);
    expect(body.applied[1]?.ok).toBe(false);
    expect(body.planet.buildings.CORE).toBe(1);
    expect(body.planet.queues.CONSTRUCTION).toHaveLength(1);
    expect(await db.select().from(planets).where(eq(planets.kind, 'CAPITAL'))).toHaveLength(1);
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
