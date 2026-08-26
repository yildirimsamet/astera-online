import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { accounts, planets, players, satellites } from '../src/db/schema.js';
import { FixedClock } from '../src/clock.js';
import { bootstrapServers } from '../src/services/servers.js';
import { testDb, testEnv, truncateAll, type Fixture } from './helpers.js';

const silent = pino({ level: 'silent' });
const START = new Date('2026-03-01T00:00:00.000Z');

interface PreviewWorld {
  id: string;
  name: string;
  owner: string;
  position: { x: number; y: number; z: number };
  coreTier: number;
  coreLevel: number;
  satellites: string[];
  shielded: boolean;
  isSelf: boolean;
  kind: 'CAPITAL' | 'COLONY' | 'NEUTRAL';
  isOwned?: boolean;
  isCapital?: boolean;
  clan?: { id: string; name: string; tag: string };
  dominionRank?: 1 | 2 | 3;
}

interface Preview {
  season: {
    seasonId: string;
    shard: string;
    shardName: string;
    seed: number;
    status: string;
    startsAt: string;
    endsAt: string;
    playerCap: number;
    players: number;
  };
  galaxy: { you: { planetId: string; playerId: string }; planets: PreviewWorld[] };
  traffic: { contacts: unknown[] };
  reserved: {
    id: string;
    name: string;
    slotIndex: number;
    position: { x: number; y: number; z: number };
  };
  shard: { code: string; name: string; planets: number; capacity: number; online: number };
}

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

/**
 * THE GALAXY BEFORE YOU HAVE AN ACCOUNT. D56.
 *
 * Two claims are load-bearing and everything here exists to hold them: this
 * endpoint TAKES NOTHING — no account, no player, no planet and above all no seat
 * in a galaxy that admits only three hundred commanders — and it SAYS NOTHING a signed-in player would
 * not already be told about everybody else.
 */
describe('preview', () => {
  let db: Fixture['db'];
  let app: FastifyInstance;
  let close: () => Promise<void>;
  let clock: FixedClock;
  let seq = 0;

  beforeEach(async () => {
    ({ db } = await testDb());
    await truncateAll(db);
    clock = new FixedClock(START);
    const built = buildApp({ env: testEnv(), clock, logger: silent, db });
    app = built.app;
    close = built.close;
    await app.ready();
  });

  afterEach(async () => {
    await close();
  });

  const openWorld = (count = 3, capacity = 4) =>
    bootstrapServers(db, clock, { count, capacity, seedBase: 1000 });

  const register = async () => {
    seq += 1;
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: `commander${String(seq)}`, password: 'correct-horse-battery' },
    });
    expect(res.statusCode).toBe(200);
    return res.json<{ accessToken: string }>();
  };

  const join = async (code: string) => {
    const who = await register();
    const res = await app.inject({
      method: 'POST',
      url: `/api/servers/${code}/join`,
      headers: { authorization: `Bearer ${who.accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    return res.json<{ planetId: string; planetName: string; slotIndex: number }>();
  };

  const preview = async (): Promise<Preview> => {
    const res = await app.inject({ method: 'GET', url: '/api/preview' });
    expect(res.statusCode).toBe(200);
    return res.json<Preview>();
  };

  /* ── it costs nothing ─────────────────────────────────────── */

  it('is readable with no account at all', async () => {
    await openWorld();
    const body = await preview();

    expect(body.shard.code).toBe('EU-1');
    expect(body.season.seed).toBeTypeOf('number');
  });

  /**
   * THE WHOLE REASON THE REHEARSAL IS A REHEARSAL.
   *
   * A galaxy admits three hundred commanders and fills strictly in order, and that rule is the
   * only mitigation the empty-shard risk has. If looking cost a seat, a hundred
   * visitors who never came back would close Vantage.
   */
  it('takes no seat, no account and no planet', async () => {
    await openWorld();

    for (let i = 0; i < 5; i++) await preview();

    expect(await db.select().from(accounts)).toHaveLength(0);
    expect(await db.select().from(players)).toHaveLength(0);
    expect(await db.select().from(planets).where(eq(planets.kind, 'CAPITAL'))).toHaveLength(0);
  });

  it('refuses when every galaxy is full, rather than rehearsing something unclaimable', async () => {
    await openWorld(1, 1);
    await join('EU-1');

    const res = await app.inject({ method: 'GET', url: '/api/preview' });
    expect(res.statusCode).toBe(409);
    expect(res.json<{ error: string }>().error).toBe('NO_FRONTIER');
  });

  /* ── it points at the galaxy the claim will enter ─────────── */

  it('follows the frontier rather than offering a choice', async () => {
    await openWorld(3, 1);
    expect((await preview()).shard.code).toBe('EU-1');

    await join('EU-1');
    expect((await preview()).shard.code).toBe('EU-2');
  });

  /**
   * The visitor is shown the world they are about to be given, by name. A preview
   * that says `Vesper-31` for a planet that turns out to be `Marrow-31` is the
   * interface contradicting itself at the one moment it is asking to be trusted.
   */
  it('names the reserved world exactly as the join will name it', async () => {
    await openWorld(1, 4);
    const shown = (await preview()).reserved;

    const taken = await join('EU-1');

    expect(taken.slotIndex).toBe(shown.slotIndex);
    expect(taken.planetName).toBe(shown.name);
  });

  it('draws the reserved world among the real ones, at tier 1', async () => {
    await openWorld(1, 4);
    await join('EU-1');

    const body = await preview();
    const self = body.galaxy.planets.filter((p) => p.isSelf);

    expect(self).toHaveLength(1);
    expect(self[0]?.id).toBe(body.reserved.id);
    expect(self[0]?.name).toBe(body.reserved.name);
    // A fresh planet holds a Command Core at level 1, so the tier band the
    // rehearsal lights up is the band the claim will actually accept.
    expect(self[0]?.coreTier).toBe(1);
    expect(body.galaxy.you.planetId).toBe(body.reserved.id);
    // One real commander plus the fixed 51-world neutral pool.
    expect(body.galaxy.planets.filter((p) => !p.isSelf)).toHaveLength(52);
  });

  it('carries the real commanders, by name and position', async () => {
    await openWorld(1, 4);
    const first = await join('EU-1');

    const [row] = await db.select().from(planets).where(eq(planets.id, first.planetId));
    const world = (await preview()).galaxy.planets.find((p) => p.id === first.planetId);

    expect(world?.name).toBe(row?.name);
    expect(world?.owner).not.toBe('');
    expect(world?.position.x).toBeCloseTo(row?.x ?? 0);
  });

  /* ── it says nothing private ──────────────────────────────── */

  /**
   * THE FOG'S FLOOR, ASSERTED BY KEY SET RATHER THAN BY SAMPLE.
   *
   * Checking that today's private fields are absent only ever tests the fields
   * somebody thought of. An exact key set fails the moment a column is added to
   * `publicWorlds`, which is the only way this endpoint can quietly start leaking:
   * it is unauthenticated, so nothing downstream will refuse the request that
   * reads it.
   */
  it('publishes exactly the public shape and nothing else', async () => {
    await openWorld(1, 4);
    await join('EU-1');
    await join('EU-1');

    for (const world of (await preview()).galaxy.planets) {
      expect(Object.keys(world).sort()).toEqual([
        /**
         * The optional keys are listed off the world's own content rather than
         * asserted flat, and that is not a weakening. A shape test whose expected
         * list is a constant fails on DATA — `clan` appears the moment anybody in
         * the frontier galaxy founds one, and `dominionRank` the moment anybody
         * reaches the podium — which is a test that goes red for the wrong reason
         * and gets edited until it guards nothing. Each world is still held to an
         * EXACT key set; what varies is which set it belongs to.
         */
        ...(world.clan ? ['clan'] : []),
        'controller',
        'coreLevel',
        'coreTier',
        ...(world.dominionRank ? ['dominionRank'] : []),
        'id',
        ...(world.isSelf ? ['isCapital', 'isOwned'] : []),
        'isSelf',
        'kind',
        'name',
        ...(world.kind === 'NEUTRAL' ? ['neutral'] : []),
        'owner',
        'position',
        'satellites',
        'shielded',
        'state',
      ].sort());
    }
  });

  /**
   * A fleet reading is EARNED with a telescope, and there is nobody here to have
   * earned one. `/api/galaxy` attaches it; this must never grow the key.
   */
  it('never carries a fleet reading, which is the one thing /api/galaxy adds', async () => {
    await openWorld(1, 4);
    await join('EU-1');

    for (const world of (await preview()).galaxy.planets) {
      expect(world).not.toHaveProperty('fleet');
    }
  });

  /**
   * Hardware in orbit is public — it is a physical object the disc draws — and a
   * dome reads as a dome. What must never appear is a LEVEL (D15).
   */
  it('publishes satellite types and a shield boolean, never a level', async () => {
    await openWorld(1, 4);
    const first = await join('EU-1');
    await db
      .insert(satellites)
      .values([
        { planetId: first.planetId, slot: 0, type: 'FOUNDRY', level: 4 },
        // The Aegis is a ground instrument (D25); it shares this table and must
        // read as a dome without publishing what is behind it.
        { planetId: first.planetId, slot: 1, type: 'AEGIS', level: 3 },
      ]);

    const world = (await preview()).galaxy.planets.find((p) => p.id === first.planetId);

    expect(world?.satellites).toEqual(['FOUNDRY']);
    expect(world?.shielded).toBe(true);
    expect(JSON.stringify(world)).not.toContain('level');
  });

  /* ── the disc is alive ────────────────────────────────────── */

  it('carries the traffic, so one payload and a clock keep the disc moving', async () => {
    await openWorld(1, 4);
    await join('EU-1');

    expect((await preview()).traffic.contacts).toEqual([]);
  });

  it('hands over the seed and the season clock the disc is rebuilt from', async () => {
    await openWorld(1, 4);
    const body = await preview();

    expect(body.season.playerCap).toBe(4);
    expect(new Date(body.season.endsAt).getTime()).toBeGreaterThan(
      new Date(body.season.startsAt).getTime(),
    );
    expect(body.season.status).toBe('live');
  });
});
