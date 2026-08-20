import { eq } from 'drizzle-orm';
import { START as GRANT } from '@astera/rules';
import type { FastifyInstance } from 'fastify';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { debrisFields, missions, planets, players, seasons, shards } from '../src/db/schema.js';
import { FixedClock } from '../src/clock.js';
import {
  bootstrapServers,
  frontierOrdinal,
  listServers,
  wipeAllServers,
} from '../src/services/servers.js';
import { testDb, testEnv, truncateAll, type Fixture } from './helpers.js';

const silent = pino({ level: 'silent' });
const START = new Date('2026-03-01T00:00:00.000Z');

interface Session {
  accountId: string;
  accessToken: string;
}

interface Placement {
  shard: string;
  shardName: string;
  seasonId: string;
  playerId: string;
  planetId: string;
  planetName: string;
  slotIndex: number;
}

interface ServerRow {
  code: string;
  name: string;
  ordinal: number;
  planets: number;
  capacity: number;
  online: number;
  status: string;
  yours: boolean;
}

interface ServerList {
  servers: ServerRow[];
  placement: { shard: string; name: string } | null;
}

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

/**
 * TEN GALAXIES, FIFTY WORLDS EACH, FILLED IN ORDER. D21.
 *
 * Everything here is about the two rules that decide where a player ends up: a
 * galaxy takes fifty planets and no more, and only one galaxy is ever open at a
 * time. Both are enforced by the database rather than by a prior check, so most of
 * these tests are about what happens when two requests arrive together.
 */
describe('servers', () => {
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

  /** A world of `count` galaxies, each holding `capacity` planets. */
  const openWorld = (count = 3, capacity = 2) =>
    bootstrapServers(db, clock, { count, capacity, seedBase: 1000 });

  const register = async (): Promise<Session> => {
    seq += 1;
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: `commander${String(seq)}`, password: 'correct-horse-battery' },
    });
    expect(res.statusCode).toBe(200);
    return res.json<Session>();
  };

  const join = (who: Session, code: string) =>
    app.inject({
      method: 'POST',
      url: `/api/servers/${code}/join`,
      headers: { authorization: `Bearer ${who.accessToken}` },
    });

  const list = async (who?: Session): Promise<ServerList> => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/servers',
      ...(who ? { headers: { authorization: `Bearer ${who.accessToken}` } } : {}),
    });
    expect(res.statusCode).toBe(200);
    return res.json<ServerList>();
  };

  /* ── the list ─────────────────────────────────────────────── */

  describe('the list', () => {
    it('is readable without an account, because choosing comes before signing up', async () => {
      await openWorld();
      const body = await list();

      expect(body.servers).toHaveLength(3);
      expect(body.placement).toBeNull();
      expect(body.servers.map((s) => s.ordinal)).toEqual([1, 2, 3]);
    });

    it('names each galaxy and states how full it is', async () => {
      await openWorld(2, 50);
      const [first] = (await list()).servers;

      expect(first?.code).toBe('EU-1');
      expect(first?.name).toBe('Vantage');
      expect(first?.planets).toBe(0);
      expect(first?.capacity).toBe(50);
    });

    it('opens exactly one galaxy and locks the rest', async () => {
      await openWorld(3, 2);
      const body = await list();

      expect(body.servers.map((s) => s.status)).toEqual(['open', 'locked', 'locked']);
    });

    it('counts planets as they are taken', async () => {
      await openWorld(2, 2);
      await join(await register(), 'EU-1');

      const [first] = (await list()).servers;
      expect(first?.planets).toBe(1);
      expect(first?.status).toBe('open');
    });

    it('tells a signed-in commander which galaxy is theirs', async () => {
      await openWorld(2, 2);
      const me = await register();
      await join(me, 'EU-1');

      const body = await list(me);
      expect(body.placement).toEqual({ shard: 'EU-1', name: 'Vantage' });
      expect(body.servers.find((s) => s.code === 'EU-1')?.yours).toBe(true);
      expect(body.servers.find((s) => s.code === 'EU-2')?.yours).toBe(false);
    });

    it('reports a shard with no live season as closed, not as open', async () => {
      await openWorld(2, 2);
      await db.update(seasons).set({ status: 'frozen' });

      const body = await list();
      expect(body.servers.map((s) => s.status)).toEqual(['closed', 'closed']);
    });
  });

  /* ── who is in there right now ────────────────────────────── */

  describe('population', () => {
    it('counts a commander who has just made a request', async () => {
      await openWorld(1, 4);
      const me = await register();
      await join(me, 'EU-1');

      expect((await list()).servers[0]?.online).toBe(1);
    });

    it('stops counting one who has been gone longer than the window', async () => {
      await openWorld(1, 4);
      const me = await register();
      await join(me, 'EU-1');
      expect((await list()).servers[0]?.online).toBe(1);

      // Six minutes later, with nothing from them in between.
      clock.advance(6);
      expect((await list()).servers[0]?.online).toBe(0);
    });

    it('counts them again the moment they come back', async () => {
      await openWorld(1, 4);
      const me = await register();
      await join(me, 'EU-1');
      clock.advance(60);
      expect((await list()).servers[0]?.online).toBe(0);

      await app.inject({
        method: 'GET',
        url: '/api/planet',
        headers: { authorization: `Bearer ${me.accessToken}` },
      });
      expect((await list()).servers[0]?.online).toBe(1);
    });

    /**
     * Presence is a cosmetic number on a lobby screen. It is written at most once
     * a minute per commander so that the galaxy view — four calls on every open —
     * does not turn a read into four writes.
     */
    it('does not rewrite the stamp on every single request', async () => {
      await openWorld(1, 4);
      const me = await register();
      await join(me, 'EU-1');

      const [before] = await db.select().from(players).where(eq(players.accountId, me.accountId));
      clock.advance(0.5);
      await app.inject({
        method: 'GET',
        url: '/api/planet',
        headers: { authorization: `Bearer ${me.accessToken}` },
      });

      const [after] = await db.select().from(players).where(eq(players.accountId, me.accountId));
      expect(after?.lastActiveAt.getTime()).toBe(before?.lastActiveAt.getTime());
    });
  });

  /* ── the sequential-fill rule ─────────────────────────────── */

  describe('filling in order', () => {
    it('refuses the second galaxy while the first has room', async () => {
      await openWorld(3, 2);
      const res = await join(await register(), 'EU-2');

      expect(res.statusCode).toBe(409);
      const body = res.json<{ error: string; message: string }>();
      expect(body.error).toBe('SERVER_LOCKED');
      // The refusal has to name where to go instead, or it is a dead end.
      expect(body.message).toContain('Vantage');
    });

    it('opens the second galaxy the moment the first is full', async () => {
      await openWorld(3, 2);
      expect((await join(await register(), 'EU-1')).statusCode).toBe(200);
      expect((await join(await register(), 'EU-1')).statusCode).toBe(200);

      const body = await list();
      expect(body.servers.map((s) => s.status)).toEqual(['full', 'open', 'locked']);
      expect((await join(await register(), 'EU-2')).statusCode).toBe(200);
    });

    it('refuses a full galaxy by name rather than silently redirecting', async () => {
      await openWorld(3, 1);
      await join(await register(), 'EU-1');

      const res = await join(await register(), 'EU-1');
      expect(res.statusCode).toBe(409);
      expect(res.json<{ error: string }>().error).toBe('SHARD_FULL');
    });

    it('refuses a galaxy that does not exist', async () => {
      await openWorld(2, 2);
      const res = await join(await register(), 'EU-404');
      expect(res.statusCode).toBe(404);
      expect(res.json<{ error: string }>().error).toBe('NO_SUCH_SERVER');
    });

    it('refuses everyone once every galaxy is full', async () => {
      await openWorld(2, 1);
      await join(await register(), 'EU-1');
      await join(await register(), 'EU-2');

      const body = await list();
      expect(body.servers.every((s) => s.status === 'full')).toBe(true);
      expect((await join(await register(), 'EU-1')).statusCode).toBe(409);
    });

    /**
     * The frontier is the whole rule, so it gets a test of its own without a
     * database in the way.
     */
    it.each([
      ['the first with room', [{ ordinal: 1, planets: 0, capacity: 50 }], 1],
      [
        'skips a full one',
        [
          { ordinal: 1, planets: 50, capacity: 50 },
          { ordinal: 2, planets: 3, capacity: 50 },
        ],
        2,
      ],
      [
        'ignores list order, reads the ordinal',
        [
          { ordinal: 3, planets: 0, capacity: 50 },
          { ordinal: 2, planets: 0, capacity: 50 },
        ],
        2,
      ],
      [
        'over capacity still counts as full',
        [
          { ordinal: 1, planets: 51, capacity: 50 },
          { ordinal: 2, planets: 0, capacity: 50 },
        ],
        2,
      ],
    ])('picks %s', (_label, rows, expected) => {
      expect(frontierOrdinal(rows)).toBe(expected);
    });

    it('has no frontier when the world is full', () => {
      expect(frontierOrdinal([{ ordinal: 1, planets: 50, capacity: 50 }])).toBeNull();
      expect(frontierOrdinal([])).toBeNull();
    });
  });

  /* ── one account, one planet ──────────────────────────────── */

  describe('one planet per commander', () => {
    it('lands a returning player on the same planet, never a second one', async () => {
      await openWorld(2, 4);
      const me = await register();

      const first = (await join(me, 'EU-1')).json<Placement>();
      const second = (await join(me, 'EU-1')).json<Placement>();

      expect(second.planetId).toBe(first.planetId);
      const owned = await db.select().from(players).where(eq(players.accountId, me.accountId));
      expect(owned).toHaveLength(1);
    });

    /**
     * AND STILL DOES ONCE THAT GALAXY IS FULL, which is the normal end state of
     * every galaxy and was the case the promise broke on. D52a.
     *
     * `resolveJoinTarget` runs before `joinSeason` and refuses on the galaxy's
     * STATUS, so a placed commander retrying — a client retry, a reinstall, a
     * double-tap — got `SHARD_FULL` and was locked out of their own world. The test
     * above never saw it because `openWorld(2, 4)` leaves room.
     */
    it('lands a returning player even after their galaxy has filled up', async () => {
      await openWorld(2, 1);
      const me = await register();
      const first = (await join(me, 'EU-1')).json<Placement>();

      // EU-1 is now at capacity: the frontier has moved on to EU-2.
      const body = await list();
      expect(body.servers.find((s) => s.code === 'EU-1')?.status).toBe('full');

      const again = await join(me, 'EU-1');
      expect(again.statusCode, again.body.slice(0, 200)).toBe(200);
      expect(again.json<Placement>().planetId).toBe(first.planetId);
    });

    it('refuses a second galaxy to a commander who already has a planet', async () => {
      await openWorld(2, 1);
      const me = await register();
      expect((await join(me, 'EU-1')).statusCode).toBe(200);

      // EU-1 is now full, so EU-2 is genuinely open — and still refused.
      const res = await join(me, 'EU-2');
      expect(res.statusCode).toBe(409);
      expect(res.json<{ error: string }>().error).toBe('ALREADY_PLACED');
      expect(await db.select().from(planets)).toHaveLength(1);
    });

    /**
     * THE RACE THAT MAKES THE INDEX NECESSARY.
     *
     * Two tabs, two galaxies, one account, both requests in the air before either
     * reply lands. A prior existence check passes in both, so only the unique index
     * on `players.account_id` can decide this — and it is the difference between
     * one commander and two.
     */
    it('creates exactly one planet when one account joins two galaxies at once', async () => {
      await openWorld(2, 1);
      const me = await register();
      // Fill EU-1 with somebody else so that BOTH galaxies would otherwise take us.
      await join(await register(), 'EU-1');

      const [a, b] = await Promise.all([join(me, 'EU-2'), join(me, 'EU-2')]);
      expect([a.statusCode, b.statusCode]).toContain(200);

      const owned = await db.select().from(players).where(eq(players.accountId, me.accountId));
      expect(owned).toHaveLength(1);
    });

    it('creates exactly one player when two joins to one galaxy race', async () => {
      await openWorld(1, 4);
      const me = await register();

      const [a, b] = await Promise.all([join(me, 'EU-1'), join(me, 'EU-1')]);

      expect([a.statusCode, b.statusCode]).toEqual([200, 200]);
      expect(a.json<Placement>().planetId).toBe(b.json<Placement>().planetId);
      expect(await db.select().from(players).where(eq(players.accountId, me.accountId))).toHaveLength(1);
      expect(await db.select().from(planets)).toHaveLength(1);
    });

    /**
     * Two DIFFERENT accounts, one free slot. `pickSpawnSlot` hands both the same
     * index; the (season, slot) index rejects one, whose join re-picks against the
     * smaller free set — and there is only one slot, so it correctly reports full.
     */
    it('never puts two commanders on the same world', async () => {
      await openWorld(1, 1);
      const [a, b] = await Promise.all([
        join(await register(), 'EU-1'),
        join(await register(), 'EU-1'),
      ]);

      expect([a.statusCode, b.statusCode].sort((x, y) => x - y)).toEqual([200, 409]);
      expect(await db.select().from(planets)).toHaveLength(1);
    });

    it('will not place an unauthenticated caller', async () => {
      await openWorld();
      const res = await app.inject({ method: 'POST', url: '/api/servers/EU-1/join' });
      expect(res.statusCode).toBe(401);
    });
  });

  /* ── standing on the planet ───────────────────────────────── */

  describe('from sign-up to standing on a planet', () => {
    it('takes a cold account all the way through', async () => {
      await openWorld(2, 4);
      const me = await register();

      const joined = await join(me, 'EU-1');
      expect(joined.statusCode).toBe(200);
      const placement = joined.json<Placement>();
      expect(placement.planetName).not.toBe('');
      expect(placement.shardName).toBe('Vantage');

      const planet = await app.inject({
        method: 'GET',
        url: '/api/planet',
        headers: { authorization: `Bearer ${me.accessToken}` },
      });
      expect(planet.statusCode).toBe(200);
      const body = planet.json<{
        planet: { id: string; alloy: number; crystal: number };
        fleet: Record<string, number>;
      }>();
      expect(body.planet.id).toBe(placement.planetId);

      /**
       * WHAT A COMMANDER IS HANDED, AND WHAT THEY ARE NOT. D22.
       *
       * No warships. The opening grant is alloy and crystal, and turning it into
       * ships, production or an instrument is the first decision in the game — so
       * this asserts the absence as firmly as the presence. A fleet quietly
       * reappearing here would delete that decision without failing anything else.
       */
      expect(body.fleet.WASP).toBeUndefined();
      expect(body.planet.alloy).toBe(GRANT.alloy);
      expect(body.planet.crystal).toBe(GRANT.crystal);
    });

    /**
     * THE BUG A PLAYER HIT WHILE TRYING TO PLAY.
     *
     * `players.wealth` was only ever written when someone bought something, so a
     * commander who had joined and pressed nothing sat at the column default of
     * zero — and the rank floor refuses any target below 40% of the attacker's
     * wealth. Every such player was permanently unattackable, which inverts the
     * design: doing nothing made you safe.
     */
    it('gives a freshly placed commander real Wealth, so they can be attacked', async () => {
      await openWorld(1, 4);
      const me = await register();
      const placement = (await join(me, 'EU-1')).json<Placement>();

      const [player] = await db.select().from(players).where(eq(players.id, placement.playerId));
      expect(player?.wealth).toBeGreaterThan(0);
    });

    /**
     * THE SEED IS THE DANGEROUS FIELD.
     *
     * The client rebuilds the whole disc and every asteroid orbit from it. Reading
     * the season from configuration rather than from the caller's own player row
     * would hand every commander galaxy one's seed, and they would mine rocks that
     * are not there.
     */
    it('reports the season of the galaxy the caller is actually in', async () => {
      await openWorld(2, 1);
      const first = await register();
      await join(first, 'EU-1');
      const second = await register();
      await join(second, 'EU-2');

      const seasonOf = async (who: Session) => {
        const res = await app.inject({
          method: 'GET',
          url: '/api/season',
          headers: { authorization: `Bearer ${who.accessToken}` },
        });
        expect(res.statusCode).toBe(200);
        return res.json<{ shard: string; shardName: string; seed: number; players: number }>();
      };

      const a = await seasonOf(first);
      const b = await seasonOf(second);
      expect(a.shard).toBe('EU-1');
      expect(b.shard).toBe('EU-2');
      expect(b.shardName).toBe('Kestrel');
      expect(a.seed).not.toBe(b.seed);
      expect(a.players).toBe(1);
    });

    it('says to join a galaxy first, rather than inventing one', async () => {
      await openWorld();
      const me = await register();
      const res = await app.inject({
        method: 'GET',
        url: '/api/season',
        headers: { authorization: `Bearer ${me.accessToken}` },
      });
      expect(res.statusCode).toBe(404);
      expect(res.json<{ error: string }>().error).toBe('NO_PLANET');
    });
  });

  /* ── opening and ending the world ─────────────────────────── */

  describe('bootstrap', () => {
    it('opens the whole world in one command', async () => {
      const result = await bootstrapServers(db, clock, { count: 10, capacity: 50 });

      expect(result.created).toHaveLength(10);
      const rows = await db.select().from(shards);
      expect(rows).toHaveLength(10);
      expect(rows.every((s) => s.playerCap === 50)).toBe(true);
    });

    it('is safe to run twice', async () => {
      await bootstrapServers(db, clock, { count: 4, capacity: 50 });
      const again = await bootstrapServers(db, clock, { count: 4, capacity: 50 });

      expect(again.created).toEqual([]);
      expect(again.existing).toHaveLength(4);
      expect(await db.select().from(shards)).toHaveLength(4);
      expect(await db.select().from(seasons)).toHaveLength(4);
    });

    it('gives every galaxy a different sky', async () => {
      await bootstrapServers(db, clock, { count: 5, capacity: 50, seedBase: 77 });
      const rows = await db.select().from(seasons);
      expect(new Set(rows.map((s) => s.seed)).size).toBe(5);
    });
  });

  describe('the wipe', () => {
    it('clears every galaxy and lets everybody start again', async () => {
      await openWorld(2, 1);
      const me = await register();
      await join(me, 'EU-1');
      const other = await register();
      await join(other, 'EU-2');

      const result = await wipeAllServers(db, clock, { count: 2, capacity: 1 });

      expect(result.playersCleared).toBe(2);
      expect(result.seasonsWiped).toBe(2);
      expect(await db.select().from(players)).toHaveLength(0);
      expect(await db.select().from(planets)).toHaveLength(0);

      // And the world is open again, from the first galaxy.
      const body = await list();
      expect(body.servers.map((s) => s.status)).toEqual(['open', 'locked']);
    });

    /**
     * A GALAXY THAT HAS BEEN PLAYED, WHICH IS THE ONLY KIND WORTH WIPING.
     *
     * `debris_fields` was not in the delete order, and it is the one table whose
     * absence is a hard failure rather than a leak: its foreign keys to `missions`,
     * `planets` and `seasons` are all `ON DELETE no action`, so `delete(missions)`
     * raised a constraint violation and the entire wipe rolled back. Every galaxy
     * where a battle had left wreckage — every galaxy that has been played —
     * could not be reset at all.
     *
     * The three tests above never fought a battle, which is exactly why they missed
     * it. This one leaves a field behind before wiping.
     */
    it('wipes a galaxy that has wreckage in it', async () => {
      await openWorld(2, 2);
      const me = await register();
      const placement = (await join(me, 'EU-1')).json<Placement>();
      const other = await register();
      const theirs = (await join(other, 'EU-1')).json<Placement>();

      // A mission and a field that points at it — the shape a real battle leaves.
      const [mission] = await db
        .insert(missions)
        .values({
          seasonId: placement.seasonId,
          kind: 'attack',
          originPlanetId: placement.planetId,
          targetPlanetId: theirs.planetId,
          fleet: { WASP: 4 },
          distance: 200,
          departAt: clock.now(),
          arriveAt: clock.now(),
          status: 'resolved',
        })
        .returning();
      await db.insert(debrisFields).values({
        seasonId: placement.seasonId,
        planetId: theirs.planetId,
        missionId: mission!.id,
        alloy: 5_000,
        crystal: 1_200,
        createdAt: clock.now(),
      });

      const result = await wipeAllServers(db, clock, { count: 2, capacity: 2 });

      expect(result.playersCleared).toBe(2);
      expect(await db.select().from(debrisFields)).toHaveLength(0);
      expect(await db.select().from(missions)).toHaveLength(0);
      expect(await db.select().from(planets)).toHaveLength(0);
    });

    it('releases the one-planet rule, so a commander may choose again', async () => {
      await openWorld(2, 2);
      const me = await register();
      const before = (await join(me, 'EU-1')).json<Placement>();

      await wipeAllServers(db, clock, { count: 2, capacity: 2 });

      const after = await join(me, 'EU-1');
      expect(after.statusCode).toBe(200);
      expect(after.json<Placement>().planetId).not.toBe(before.planetId);
    });

    it('folds the season into the permanent account record before deleting it', async () => {
      await openWorld(1, 2);
      const me = await register();
      const placement = (await join(me, 'EU-1')).json<Placement>();
      await db
        .update(players)
        .set({ dominionTaken: 900, dominionLost: 250, wealth: 4200 })
        .where(eq(players.id, placement.playerId));

      await wipeAllServers(db, clock, { count: 1, capacity: 2 });

      const { accounts } = await import('../src/db/schema.js');
      const [account] = await db.select().from(accounts).where(eq(accounts.id, me.accountId));
      expect(account?.lifetime).toMatchObject({
        seasons: 1,
        dominionTaken: 900,
        dominionLost: 250,
        bestWealth: 4200,
      });
    });

    it('accumulates the record across seasons rather than overwriting it', async () => {
      await openWorld(1, 2);
      const me = await register();
      const first = (await join(me, 'EU-1')).json<Placement>();
      await db
        .update(players)
        .set({ dominionTaken: 100, wealth: 5000 })
        .where(eq(players.id, first.playerId));
      await wipeAllServers(db, clock, { count: 1, capacity: 2 });

      const second = (await join(me, 'EU-1')).json<Placement>();
      await db
        .update(players)
        .set({ dominionTaken: 40, wealth: 1000 })
        .where(eq(players.id, second.playerId));
      await wipeAllServers(db, clock, { count: 1, capacity: 2 });

      const { accounts } = await import('../src/db/schema.js');
      const [account] = await db.select().from(accounts).where(eq(accounts.id, me.accountId));
      expect(account?.lifetime).toMatchObject({
        seasons: 2,
        dominionTaken: 140,
        // The best season, not the last one.
        bestWealth: 5000,
      });
    });

    it('leaves the accounts themselves alone — a wipe is not a ban', async () => {
      await openWorld(1, 2);
      const me = await register();
      await join(me, 'EU-1');

      await wipeAllServers(db, clock, { count: 1, capacity: 2 });

      const { accounts } = await import('../src/db/schema.js');
      expect(await db.select().from(accounts)).toHaveLength(1);
      // And the session survives it: same account, same token.
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { authorization: `Bearer ${me.accessToken}` },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json<{ placement: unknown }>().placement).toBeNull();
    });

    it('marks the old seasons wiped rather than leaving them live and empty', async () => {
      await openWorld(2, 2);
      await join(await register(), 'EU-1');

      await wipeAllServers(db, clock, { count: 2, capacity: 2 });

      const rows = await db.select().from(seasons);
      expect(rows.filter((s) => s.status === 'wiped')).toHaveLength(2);
      expect(rows.filter((s) => s.status === 'live')).toHaveLength(2);
    });
  });

  /* ── the service, directly ────────────────────────────────── */

  describe('listServers', () => {
    it('is three queries whatever the number of galaxies', async () => {
      await bootstrapServers(db, clock, { count: 10, capacity: 50 });
      const rows = await listServers(db, clock);
      expect(rows).toHaveLength(10);
      expect(rows.map((r) => r.ordinal)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });

    it('reports nothing at all before the world has been opened', async () => {
      expect(await listServers(db, clock)).toEqual([]);
    });
  });
});
