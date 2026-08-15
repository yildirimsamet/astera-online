import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { planets, players } from '../src/db/schema.js';
import { createSeason } from '../src/services/season.js';
import { testDb, testEnv, truncateAll, type Fixture } from './helpers.js';

const silent = pino({ level: 'silent' });
const SHARD = 'EU-JOIN-TEST';

interface Guest {
  accountId: string;
  accessToken: string;
}

interface JoinResponse {
  seasonId: string;
  playerId: string;
  planetId: string;
  planetName: string;
  slotIndex: number;
}

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

/**
 * The onboarding path.
 *
 * Every other suite arranges a world by calling `joinSeason` directly. Nothing
 * asserted that a real player could reach a planet over HTTP — and until this
 * route existed, none could: the whole game was live, tested, and unreachable.
 */
describe('onboarding — guest to planet', () => {
  let db: Fixture['db'];
  let app: FastifyInstance;
  let close: () => Promise<void>;

  beforeEach(async () => {
    ({ db } = await testDb());
    await truncateAll(db);
    const built = buildApp({ env: testEnv({ SHARD_CODE: SHARD }), logger: silent, db });
    app = built.app;
    close = built.close;
    await app.ready();
  });

  afterEach(async () => {
    await close();
  });

  const openGalaxy = async (cap = 60): Promise<void> => {
    await createSeason(db, {
      shardCode: SHARD,
      seed: 9182,
      startsAt: new Date('2026-03-01T00:00:00.000Z'),
      playerCap: cap,
    });
  };

  const guest = async (): Promise<Guest> => {
    const res = await app.inject({ method: 'POST', url: '/api/auth/guest', payload: {} });
    expect(res.statusCode).toBe(200);
    return res.json<Guest>();
  };

  const join = async (who: Guest) =>
    app.inject({
      method: 'POST',
      url: '/api/season/join',
      headers: { authorization: `Bearer ${who.accessToken}` },
    });

  it('takes a cold account from sign-in to standing on its own planet', async () => {
    await openGalaxy();
    const me = await guest();

    const joined = await join(me);
    expect(joined.statusCode).toBe(200);
    const placement = joined.json<JoinResponse>();
    expect(placement.planetName).not.toBe('');

    const planet = await app.inject({
      method: 'GET',
      url: '/api/planet',
      headers: { authorization: `Bearer ${me.accessToken}` },
    });
    expect(planet.statusCode).toBe(200);
    const body = planet.json<{ planet: { id: string; name: string }; fleet: Record<string, number> }>();
    expect(body.planet.id).toBe(placement.planetId);
    // The starting fleet is the whole tutorial: planet, fleet, attack.
    expect(body.fleet.WASP).toBe(12);
  });

  it('says no galaxy is open rather than failing as a server fault', async () => {
    const me = await guest();
    const res = await join(me);
    expect(res.statusCode).toBe(404);
    expect(res.json<{ error: string }>().error).toBe('NO_SEASON');
  });

  it('lands a returning player on the same planet, never a second one', async () => {
    await openGalaxy();
    const me = await guest();

    const first = (await join(me)).json<JoinResponse>();
    const second = (await join(me)).json<JoinResponse>();

    expect(second.planetId).toBe(first.planetId);
    const owned = await db.select().from(players).where(eq(players.accountId, me.accountId));
    expect(owned).toHaveLength(1);
  });

  it('creates exactly one player when two joins race', async () => {
    await openGalaxy();
    const me = await guest();

    const [a, b] = await Promise.all([join(me), join(me)]);

    expect([a.statusCode, b.statusCode]).toEqual([200, 200]);
    expect(a.json<JoinResponse>().planetId).toBe(b.json<JoinResponse>().planetId);
    const owned = await db.select().from(players).where(eq(players.accountId, me.accountId));
    expect(owned).toHaveLength(1);
    const worlds = await db.select().from(planets);
    expect(worlds).toHaveLength(1);
  });

  it('refuses the newcomer once the shard is full', async () => {
    await openGalaxy(1);
    const first = await guest();
    expect((await join(first)).statusCode).toBe(200);

    const late = await guest();
    const res = await join(late);
    expect(res.statusCode).toBe(409);
    expect(res.json<{ error: string }>().error).toBe('SHARD_FULL');
  });

  it('will not place an unauthenticated caller', async () => {
    await openGalaxy();
    const res = await app.inject({ method: 'POST', url: '/api/season/join' });
    expect(res.statusCode).toBe(401);
  });

  it('reports the season clock and how full the galaxy is', async () => {
    await openGalaxy(60);
    const me = await guest();
    await join(me);

    const res = await app.inject({
      method: 'GET',
      url: '/api/season',
      headers: { authorization: `Bearer ${me.accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{
      shard: string;
      status: string;
      players: number;
      playerCap: number;
      endsAt: string;
      startsAt: string;
    }>();
    expect(body.shard).toBe(SHARD);
    expect(body.status).toBe('live');
    expect(body.players).toBe(1);
    expect(body.playerCap).toBe(60);
    expect(new Date(body.endsAt).getTime()).toBeGreaterThan(new Date(body.startsAt).getTime());
  });
});
