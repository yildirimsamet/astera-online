import { readFileSync } from 'node:fs';
import { eq, sql } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { accounts, players, seasons, shards } from '../src/db/schema.js';
import { registerAccount } from '../src/services/account.js';
import { joinSeason } from '../src/services/player.js';
import { launchAttack } from '../src/services/mission.js';
import { createSeason } from '../src/services/season.js';
import { wipeAllServers } from '../src/services/servers.js';
import { giveUnits, grant, levelWorld, makeAccount, seedWorld, setLevel, testDb, testEnv, type Fixture } from './helpers.js';

const HOUR = 3_600_000;
const PASSWORD = 'correct-horse-battery';
const silent = pino({ level: 'silent' });

afterAll(async () => { await (await testDb()).close(); });

describe('one first-game shield per new human account', () => {
  let f: Fixture;
  beforeEach(async () => { f = await seedWorld(0); });

  const register = (enabled = true) => registerAccount(f.db, {
    username: 'FirstPilot', password: PASSWORD,
  }, enabled);
  const available = async (accountId: string) => {
    const [row] = await f.db.select().from(accounts).where(eq(accounts.id, accountId));
    return row?.firstGameShieldAvailable;
  };
  const until = async (playerId: string) => {
    const [row] = await f.db.select().from(players).where(eq(players.id, playerId));
    return row?.newcomerShieldUntil?.getTime();
  };

  it('grants 72 hours on the first successful join and consumes the account entitlement', async () => {
    const account = await register();
    const joined = await joinSeason(f.db, account.id, f.seasonId, f.clock);
    expect(await until(joined.playerId)).toBe(f.clock.now().getTime() + 72 * HOUR);
    expect(await available(account.id)).toBe(false);
  });

  it('keeps existing accounts and legacy inserts at 24 hours', async () => {
    const account = await makeAccount(f.db, 'ExistingPilot');
    const joined = await joinSeason(f.db, account.id, f.seasonId, f.clock);
    expect(await until(joined.playerId)).toBe(f.clock.now().getTime() + 24 * HOUR);
    expect(await available(account.id)).toBe(false);
  });

  it('blocks raids after 24 hours and still requires consent to surrender a three-day shield', async () => {
    f = await seedWorld(1);
    const account = await register();
    const joined = await joinSeason(f.db, account.id, f.seasonId, f.clock);
    const otherWorld = f.planetIds[0]!;
    for (const world of [otherWorld, joined.planetId]) {
      await setLevel(f.db, world, 'CORE', 6);
      await giveUnits(f.db, world, { DART: 40 });
      await grant(f.db, world, 60_000, 6_000);
    }
    await levelWorld(f.db, [otherWorld, joined.planetId]);
    f.clock.advance(30 * 60);
    await expect(launchAttack(f.db, otherWorld, joined.planetId, { DART: 10 }, f.clock))
      .rejects.toMatchObject({ code: 'NEWCOMER_SHIELDED' });
    await expect(launchAttack(f.db, joined.planetId, otherWorld, { DART: 10 }, f.clock))
      .rejects.toMatchObject({ code: 'SHIELD_WOULD_DROP' });
    expect(await until(joined.playerId)).toBeDefined();
    await launchAttack(f.db, joined.planetId, otherWorld, { DART: 10 }, f.clock, undefined, true);
    expect(await until(joined.playerId)).toBeUndefined();
    expect(await available(account.id)).toBe(false);
  });

  it('does not renew or extend the shield on an idempotent retry', async () => {
    const account = await register();
    const joined = await joinSeason(f.db, account.id, f.seasonId, f.clock);
    const original = await until(joined.playerId);
    f.clock.advance(30 * 60);
    const retried = await joinSeason(f.db, account.id, f.seasonId, f.clock);
    expect(retried.playerId).toBe(joined.playerId);
    expect(await until(retried.playerId)).toBe(original);
  });

  it('retains the consumed entitlement across a season wipe and grants 24 hours next time', async () => {
    const account = await register();
    await joinSeason(f.db, account.id, f.seasonId, f.clock);
    await f.db.update(seasons).set({ status: 'frozen' }).where(eq(seasons.id, f.seasonId));
    await wipeAllServers(f.db, f.clock, { count: 1, capacity: 6, seedBase: 6000 });
    const [next] = await f.db.select().from(seasons).where(eq(seasons.status, 'live'));
    expect(next).toBeDefined();
    const joined = await joinSeason(f.db, account.id, next!.id, f.clock);
    expect(await until(joined.playerId)).toBe(f.clock.now().getTime() + 24 * HOUR);
    expect(await available(account.id)).toBe(false);
  });

  it('gives concurrent same-galaxy requests the same 72-hour shield', async () => {
    const account = await register();
    const results = await Promise.all(Array.from({ length: 8 }, () =>
      joinSeason(f.db, account.id, f.seasonId, f.clock)));
    expect(new Set(results.map((result) => result.playerId)).size).toBe(1);
    expect(await until(results[0]!.playerId)).toBe(f.clock.now().getTime() + 72 * HOUR);
    expect(await available(account.id)).toBe(false);
  });

  it('atomically consumes the entitlement when two galaxies race for the same account', async () => {
    const account = await register();
    const { season: other } = await createSeason(f.db, {
      days: 14, shardCode: 'OTHER', seed: 5000, startsAt: f.clock.now(), playerCap: 6,
      rulesetVersion: 1,
    });
    const results = await Promise.allSettled([f.seasonId, other.id].map((seasonId) =>
      joinSeason(f.db, account.id, seasonId, f.clock)));
    const wins = results.filter((result) => result.status === 'fulfilled');
    expect(wins).toHaveLength(1);
    expect(results.find((result) => result.status === 'rejected')).toMatchObject({
      reason: { code: 'ALREADY_PLACED' },
    });
    const [player] = await f.db.select().from(players).where(eq(players.accountId, account.id));
    expect(await until(player!.id)).toBe(f.clock.now().getTime() + 72 * HOUR);
    expect(await available(account.id)).toBe(false);
  });

  it('keeps the entitlement when the galaxy is full or the season is ended', async () => {
    const account = await register();
    const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    await f.db.update(shards).set({ playerCap: 0 }).where(eq(shards.id, season!.shardId));
    await expect(joinSeason(f.db, account.id, f.seasonId, f.clock))
      .rejects.toMatchObject({ code: 'SHARD_FULL' });
    expect(await available(account.id)).toBe(true);
    await f.db.update(shards).set({ playerCap: 60 }).where(eq(shards.id, season!.shardId));
    await f.db.update(seasons).set({ status: 'frozen' }).where(eq(seasons.id, f.seasonId));
    await expect(joinSeason(f.db, account.id, f.seasonId, f.clock))
      .rejects.toMatchObject({ code: 'SEASON_ENDED' });
    expect(await available(account.id)).toBe(true);
    await f.db.update(seasons).set({ status: 'live' }).where(eq(seasons.id, f.seasonId));
    const joined = await joinSeason(f.db, account.id, f.seasonId, f.clock);
    expect(await until(joined.playerId)).toBe(f.clock.now().getTime() + 72 * HOUR);
  });

  it('rolls back the entitlement if capital creation fails after it was claimed', async () => {
    const account = await register();
    // An actual database failure after the account UPDATE and player INSERT.
    await f.db.execute(sql`ALTER TABLE planets ADD CONSTRAINT first_game_test_reject CHECK (false) NOT VALID`);
    try {
      await expect(joinSeason(f.db, account.id, f.seasonId, f.clock)).rejects.toThrow();
      expect(await available(account.id)).toBe(true);
      expect(await f.db.select().from(players).where(eq(players.accountId, account.id))).toHaveLength(0);
    } finally {
      await f.db.execute(sql`ALTER TABLE planets DROP CONSTRAINT first_game_test_reject`);
    }
    const joined = await joinSeason(f.db, account.id, f.seasonId, f.clock);
    expect(await until(joined.playerId)).toBe(f.clock.now().getTime() + 72 * HOUR);
  });

  it('keeps server-controlled bot seats on the ordinary 24-hour shield', async () => {
    const account = await makeAccount(f.db, 'ServerPilot');
    const joined = await joinSeason(f.db, account.id, f.seasonId, f.clock, undefined, 'SERVER');
    expect(await until(joined.playerId)).toBe(f.clock.now().getTime() + 24 * HOUR);
  });

  it.each(['register', 'claim'] as const)('gates new eligibility in the %s HTTP path', async (path) => {
    for (const enabled of [false, true]) {
      const { app, close } = buildApp({
        env: testEnv({ FIRST_GAME_SHIELD_ENABLED: String(enabled) }), clock: f.clock,
        logger: silent, db: f.db,
      });
      try {
        const response = await app.inject({
          method: 'POST', url: path === 'register' ? '/api/auth/register' : '/api/onboarding/claim',
          payload: {
            username: `Pilot${String(enabled)}`, password: PASSWORD, step: 0,
            // Untrusted input cannot change the server's activation setting.
            ...(path === 'register' ? { firstGameShieldAvailable: !enabled } : {}),
          },
        });
        expect(response.statusCode).toBe(200);
        const body = response.json<{ accountId: string }>();
        const joined = await joinSeason(f.db, body.accountId, f.seasonId, f.clock);
        expect(await until(joined.playerId)).toBe(f.clock.now().getTime() + (enabled ? 72 : 24) * HOUR);
        expect(await available(body.accountId)).toBe(false);
      } finally { await close(); }
    }
  });

  it('honours an already-granted entitlement even on a replica with registration disabled', async () => {
    const account = await register();
    const { app, close } = buildApp({
      env: testEnv({ FIRST_GAME_SHIELD_ENABLED: 'false' }), clock: f.clock,
      logger: silent, db: f.db,
    });
    try {
      const response = await app.inject({
        method: 'POST', url: '/api/onboarding/claim',
        payload: { username: account.username, password: PASSWORD, step: 0 },
      });
      expect(response.statusCode).toBe(200);
      const [player] = await f.db.select().from(players).where(eq(players.accountId, account.id));
      expect(await until(player!.id)).toBe(f.clock.now().getTime() + 72 * HOUR);
      expect(await available(account.id)).toBe(false);
    } finally { await close(); }
  });

  it('migrates pre-existing accounts without awarding or changing a shield', async () => {
    const account = await makeAccount(f.db, 'PreMigration');
    const joined = await joinSeason(f.db, account.id, f.seasonId, f.clock);
    const originalUntil = await until(joined.playerId);
    class Rollback extends Error {}
    const migration = new URL('../drizzle/0142_first_game_shield.sql', import.meta.url);
    await expect(f.db.transaction(async (tx) => {
      await tx.execute(sql`ALTER TABLE accounts DROP COLUMN first_game_shield_available`);
      for (const statement of readFileSync(migration, 'utf8').split('--> statement-breakpoint')) {
        if (statement.trim()) await tx.execute(sql.raw(statement));
      }
      const [row] = await tx.select().from(accounts).where(eq(accounts.id, account.id));
      expect(row?.firstGameShieldAvailable).toBe(false);
      const [legacy] = await tx.insert(accounts).values({
        username: 'LegacyWriter', displayName: 'LegacyWriter', passwordHash: 'fixture-only',
      }).returning();
      expect(legacy?.firstGameShieldAvailable).toBe(false);
      const [player] = await tx.select().from(players).where(eq(players.id, joined.playerId));
      expect(player?.newcomerShieldUntil?.getTime()).toBe(originalUntil);
      throw new Rollback();
    })).rejects.toBeInstanceOf(Rollback);
  });
});
