import { readFileSync } from 'node:fs';
import { ACADEMY_STEPS, COMMUNITY_POLICY_VERSION, PLANET_START, START_BUILDINGS, sensorReach } from '@astera/rules';
import { eq, sql } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp, type BuiltApp } from '../src/app.js';
import { accounts, buildings, buildOrders, legacyParticipation, planets, players, rewardGrants, satellites, seasons, shards, units } from '../src/db/schema.js';
import { registerAccount } from '../src/services/account.js';
import { instrumentLevels } from '../src/services/intel.js';
import { joinSeason } from '../src/services/player.js';
import { readPlanetSnapshot } from '../src/services/planet.js';
import { reclaimIdleSeats } from '../src/services/reclaim.js';
import { rewardsView } from '../src/services/rewards.js';
import { createSeason } from '../src/services/season.js';
import { wipeAllServers } from '../src/services/servers.js';
import { planetClaimSchema } from '../../web/src/api/schemas.js';
import { makeAccount, seedWorld, testDb, testEnv, type Fixture } from './helpers.js';

const password = 'first-season-correct-password';
const fleet = { DART: 3, WARDEN: 1, PROSPECTOR: 1, COURIER: 1 };
let f: Fixture;
let app: BuiltApp | undefined;
beforeEach(async () => { f = await seedWorld(0); });
afterEach(async () => { await app?.close(); app = undefined; });
afterAll(async () => { await (await testDb()).close(); });

const register = (name = 'FirstSeason', shield = true) => registerAccount(f.db, { username: name, password }, shield, f.clock.now());
const readWorld = (planetId: string) => f.db.transaction(tx => readPlanetSnapshot(tx, planetId, f.clock));
const started = async (accountId: string) => {
  const [row] = await f.db.select({ at: accounts.firstSeasonStartedAt }).from(accounts).where(eq(accounts.id, accountId));
  return row?.at;
};
async function expectPackage(planetId: string) {
  const world = await readWorld(planetId);
  expect(world.buildings).toEqual({ CORE: 3, REFINERY: 2, EXTRACTOR: 2, VAULT: 1, SHIPYARD: 1, HANGAR: 1, DEUTERIUM_PLANT: 0 });
  expect(world).toMatchObject({ alloy: 1500, crystal: 1000, deuterium: 50, bufferAlloy: 84, bufferCrystal: 36, bufferDeuterium: 0 });
  expect(world.homeFleet).toEqual(fleet);
  expect(world.effectiveInstruments).toMatchObject({ TELESCOPE: 3, RADAR: 2, AEGIS: 1 });
  expect(world.orbit).toEqual(['UPLINK']);
  expect(await f.db.select().from(buildOrders).where(eq(buildOrders.planetId, planetId))).toEqual([]);
  const [epoch] = await f.db.execute<{ reach: number }>(sql`select reach from sensor_epochs where planet_id = ${planetId} and ends_at is null`);
  expect(epoch?.reach).toBe(sensorReach(3));
}

describe('one first-season opening per account', () => {
  it.each([undefined, 0, 13, ACADEMY_STEPS.length])('gives the same real package for legacy step %s or direct entry', async step => {
    const account = await register();
    const joined = await joinSeason(f.db, account.id, f.seasonId, f.clock, step);
    await expectPackage(joined.planetId);
    expect(await started(account.id)).toEqual(f.clock.now());
    const [world] = await f.db.select().from(planets).where(eq(planets.id, joined.planetId));
    expect(world).toMatchObject({ academyStep: null, builtEver: {}, seasonTelemetry: { shipsBuilt: {} } });
    expect(await f.db.select().from(rewardGrants)).toEqual([]);
    const rewards = await rewardsView(f.db, joined.planetId, f.clock);
    for (const id of ['PIRATE', 'MINE', 'RAID', 'SHIPS'] as const) {
      expect(rewards.chains.find(chain => chain.id === id)?.progress).toBe(0);
    }
    expect(rewards.chains.find(chain => chain.id === 'CORE')?.tiers.find(tier => tier.goal === 3)?.state).toBe('claimable');
  });

  it('is independent of the first-game shield feature flag', async () => {
    const account = await register('ShieldDisabled', false);
    const joined = await joinSeason(f.db, account.id, f.seasonId, f.clock);
    await expectPackage(joined.planetId);
    const [player] = await f.db.select().from(players).where(eq(players.id, joined.playerId));
    expect(player?.newcomerShieldUntil?.getTime()).toBe(f.clock.now().getTime() + 24 * 3_600_000);
  });

  it('does not replenish spent resources, lost ships or removed hardware on retries', async () => {
    const account = await register();
    const joined = await joinSeason(f.db, account.id, f.seasonId, f.clock);
    await f.db.update(planets).set({ alloy: 17, crystal: 8, deuterium: 1 }).where(eq(planets.id, joined.planetId));
    await f.db.delete(units).where(eq(units.planetId, joined.planetId));
    await f.db.delete(satellites).where(eq(satellites.planetId, joined.planetId));
    expect(await joinSeason(f.db, account.id, f.seasonId, f.clock, ACADEMY_STEPS.length)).toEqual(joined);
    const [world] = await f.db.select().from(planets).where(eq(planets.id, joined.planetId));
    expect(world).toMatchObject({ alloy: 17, crystal: 8, deuterium: 1 });
    expect(await f.db.select().from(units)).toEqual([]);
    expect(await f.db.select().from(satellites)).toEqual([]);
  });

  it('serializes concurrent first joins into one world and one package', async () => {
    const account = await register();
    const results = await Promise.all(Array.from({ length: 4 }, () => joinSeason(f.db, account.id, f.seasonId, f.clock)));
    expect(new Set(results.map(row => row.planetId)).size).toBe(1);
    await expectPackage(results[0]!.planetId);
    expect(await f.db.select().from(units)).toHaveLength(4);
  });

  it('does not duplicate the package when two galaxies race for the account', async () => {
    const account = await register();
    const other = await createSeason(f.db, { shardCode: 'EU-2', seed: 31, startsAt: f.clock.now(), playerCap: 6 });
    const results = await Promise.allSettled([f.seasonId, other.season.id].map(id => joinSeason(f.db, account.id, id, f.clock)));
    expect(results.filter(row => row.status === 'fulfilled')).toHaveLength(1);
    const [world] = await f.db.select().from(planets).where(eq(planets.kind, 'CAPITAL'));
    await expectPackage(world!.id);
    expect(await f.db.select().from(units).where(eq(units.planetId, world!.id))).toHaveLength(4);
  });

  it('recognizes a legacy join recorded after migration but before the new server takes over', async () => {
    const account = await register();
    // The old server writes participation but does not know the new account column.
    await f.db.insert(legacyParticipation).values({ accountId: account.id, seasonId: f.seasonId, joinedAt: f.clock.now() });
    const joined = await joinSeason(f.db, account.id, f.seasonId, f.clock, ACADEMY_STEPS.length);
    const world = await readWorld(joined.planetId);
    expect(world.buildings).toEqual(START_BUILDINGS);
    expect(world.homeFleet).toEqual({});
    expect(await started(account.id)).not.toBeNull();
  });

  it.each(['capital', 'hardware'])('rolls back the whole package if creating its %s fails', async stage => {
    const account = await register();
    await f.db.execute(stage === 'capital'
      ? sql`alter table planets add constraint first_season_test_reject check (false) not valid`
      : sql`alter table satellites add constraint first_season_test_reject check (type <> 'RADAR') not valid`);
    try {
      await expect(joinSeason(f.db, account.id, f.seasonId, f.clock)).rejects.toThrow();
      expect(await started(account.id)).toBeNull();
      expect(await f.db.select().from(players)).toEqual([]);
    } finally {
      await f.db.execute(stage === 'capital'
        ? sql`alter table planets drop constraint first_season_test_reject`
        : sql`alter table satellites drop constraint first_season_test_reject`);
    }
    await expectPackage((await joinSeason(f.db, account.id, f.seasonId, f.clock)).planetId);
  });

  it('does not spend the entitlement when the galaxy is full', async () => {
    const account = await register();
    const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    await f.db.update(shards).set({ playerCap: 0 }).where(eq(shards.id, season!.shardId));
    await expect(joinSeason(f.db, account.id, f.seasonId, f.clock)).rejects.toMatchObject({ code: 'SHARD_FULL' });
    expect(await started(account.id)).toBeNull();
  });

  it.each(['within season', 'at season end'])('uses the time after waiting for the account lock: %s', async boundary => {
    const account = await register();
    const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    let release: () => void = () => undefined;
    let ready: () => void = () => undefined;
    const released = new Promise<void>(resolve => { release = resolve; });
    const acquired = new Promise<void>(resolve => { ready = resolve; });
    const holding = f.db.transaction(async tx => {
      await tx.select({ id: accounts.id }).from(accounts).where(eq(accounts.id, account.id)).for('update');
      ready();
      await released;
    });
    await acquired;
    const attempt = Promise.allSettled([joinSeason(f.db, account.id, f.seasonId, f.clock)]);
    try {
      await vi.waitFor(async () => {
        const [state] = await f.db.execute<{ waiting: boolean }>(sql`
          select exists(select 1 from pg_stat_activity where datname = current_database()
            and wait_event_type = 'Lock' and query like '%first_season_started_at%') as waiting
        `);
        expect(state?.waiting).toBe(true);
      }, { timeout: 5000 });
      f.clock.set(boundary === 'at season end' ? season!.endsAt : new Date(f.clock.now().getTime() + 7 * 60_000));
    } finally {
      release();
      await holding;
    }
    const [result] = await attempt;
    if (boundary === 'at season end') {
      expect(result).toMatchObject({ status: 'rejected', reason: { code: 'SEASON_ENDED' } });
      expect(await started(account.id)).toBeNull();
      expect(await f.db.select().from(players)).toEqual([]);
      const [unchanged] = await f.db.select().from(accounts).where(eq(accounts.id, account.id));
      expect(unchanged?.firstGameShieldAvailable).toBe(true);
    } else {
      expect(result.status).toBe('fulfilled');
      const [player] = await f.db.select().from(players).where(eq(players.accountId, account.id));
      expect(player?.joinedAt).toEqual(f.clock.now());
      expect(player?.newcomerShieldUntil?.getTime()).toBe(f.clock.now().getTime() + 72 * 3_600_000);
      expect(await started(account.id)).toEqual(f.clock.now());
    }
  });

  it.each([undefined, 0, ACADEMY_STEPS.length])('never grants a package again after a season wipe, even with step %s', async step => {
    const account = await register();
    await joinSeason(f.db, account.id, f.seasonId, f.clock);
    await f.db.update(seasons).set({ status: 'frozen' }).where(eq(seasons.id, f.seasonId));
    await wipeAllServers(f.db, f.clock, { count: 1, capacity: 6, seedBase: 6000 });
    const [next] = await f.db.select().from(seasons).where(eq(seasons.status, 'live'));
    const joined = await joinSeason(f.db, account.id, next!.id, f.clock, step);
    const world = await readWorld(joined.planetId);
    expect(world.buildings).toEqual(START_BUILDINGS);
    expect(world).toMatchObject(PLANET_START);
    expect(world.homeFleet).toEqual({});
    expect(world.instruments).toEqual({});
    expect(await f.db.select().from(buildOrders)).toEqual([]);
    expect(await f.db.select().from(rewardGrants)).toEqual([]);
    const [player] = await f.db.select().from(players).where(eq(players.id, joined.playerId));
    expect(player?.newcomerShieldUntil?.getTime()).toBe(f.clock.now().getTime() + 24 * 3_600_000);
  });

  it('does not renew the gift after the original world and player are reclaimed', async () => {
    const account = await register();
    await joinSeason(f.db, account.id, f.seasonId, f.clock);
    const firstAt = await started(account.id);
    f.clock.advance(1);
    const reclaimed = await reclaimIdleSeats(f.db, f.clock, 1000);
    expect(reclaimed.failed).toBe(0);
    expect(reclaimed.reclaimed).toHaveLength(1);
    expect(await f.db.select().from(players)).toEqual([]);
    const joined = await joinSeason(f.db, account.id, f.seasonId, f.clock, ACADEMY_STEPS.length);
    const world = await readWorld(joined.planetId);
    expect(world.buildings).toEqual(START_BUILDINGS);
    expect(world.homeFleet).toEqual({});
    expect(await started(account.id)).toEqual(firstAt);
  });

  it.each(['/api/onboarding/claim', '/api/native/onboarding/claim'])('uses the package for the current FlightSchool claim at %s', async path => {
    app = buildApp({ db: f.db, clock: f.clock, env: testEnv({ NATIVE_AUTH_ENABLED: 'true' }), logger: pino({ level: 'silent' }) });
    await app.app.ready();
    const response = await app.app.inject({ method: 'POST', url: path, payload: {
      username: 'SchoolPilot', password, intents: [], communityPolicyVersion: COMMUNITY_POLICY_VERSION,
    } });
    expect(response.statusCode, response.body).toBe(200);
    const body = planetClaimSchema.parse(response.json<unknown>());
    await expectPackage(body.placement.planetId);
    expect(body.applied).toEqual([]);
  });

  it('keeps the first package intact when an old client sends paid opening intents', async () => {
    app = buildApp({ db: f.db, clock: f.clock, env: testEnv(), logger: pino({ level: 'silent' }) });
    const response = await app.app.inject({ method: 'POST', url: '/api/onboarding/claim', payload: {
      username: 'OldSchoolPilot', password, communityPolicyVersion: COMMUNITY_POLICY_VERSION,
      intents: [{ kind: 'upgrade', building: 'CORE' }, { kind: 'build', hull: 'DART', count: 2 }],
    } });
    expect(response.statusCode, response.body).toBe(200);
    const body = planetClaimSchema.parse(response.json<unknown>());
    await expectPackage(body.placement.planetId);
    expect(body.applied.every(row => !row.ok && row.error === 'ALREADY_OPENED')).toBe(true);
  });

  it('keeps the existing server-seat checkpoint even when its account has never joined', async () => {
    const account = await register('ServerSeat', false);
    const joined = await joinSeason(f.db, account.id, f.seasonId, f.clock, ACADEMY_STEPS.length, 'SERVER');
    const world = await readWorld(joined.planetId);
    expect(world.buildings.CORE).toBe(2);
    expect((await instrumentLevels(f.db, [joined.planetId])).get(joined.planetId)?.TELESCOPE).toBe(1);
    expect(await f.db.select().from(buildOrders)).toHaveLength(1);
  });
});

it('migrates played accounts but leaves an existing never-seated account eligible', async () => {
  const active = await makeAccount(f.db, 'Active');
  const archived = await makeAccount(f.db, 'Archived');
  const receipt = await makeAccount(f.db, 'Receipt');
  const lifetime = await makeAccount(f.db, 'Lifetime');
  await f.db.update(accounts).set({ lifetime: { seasons: 1 } }).where(eq(accounts.id, lifetime.id));
  const unplayed = await register('NeverSeated', false);
  const joined = await joinSeason(f.db, active.id, f.seasonId, f.clock);
  await f.db.insert(legacyParticipation).values({ accountId: receipt.id, seasonId: f.seasonId, joinedAt: f.clock.now() });
  await f.db.execute(sql`insert into season_results (cycle_id, season_id, account_id, final_rank, dominion, title, recap, created_at)
    select cycle_id, id, ${archived.id}, 1, 0, 'Commander', '{}', ${f.clock.now().toISOString()} from seasons where id = ${f.seasonId}`);
  class Rollback extends Error {}
  await expect(f.db.transaction(async tx => {
    await tx.execute(sql`alter table accounts drop column first_season_started_at`);
    const migration = readFileSync(new URL('../drizzle/0227_first_season_start.sql', import.meta.url), 'utf8');
    for (const statement of migration.split('--> statement-breakpoint')) await tx.execute(sql.raw(statement));
    const rows = await tx.execute<{ id: string; started: boolean }>(sql`select id, first_season_started_at is not null as started from accounts`);
    expect(new Map(rows.map(row => [row.id, row.started]))).toEqual(new Map([
      [active.id, true], [archived.id, true], [receipt.id, true], [lifetime.id, true], [unplayed.id, false],
    ]));
    const [core] = await tx.select().from(buildings).where(eq(buildings.planetId, joined.planetId));
    expect(core).toBeDefined();
    throw new Rollback();
  })).rejects.toBeInstanceOf(Rollback);
});
