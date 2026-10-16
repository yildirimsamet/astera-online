import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { honorCommitments, honorEvents, honorObservations, honorSeasons, honorTotals, missions, planets, players, seasons, shards } from '../src/db/schema.js';
import { activateHonorShadow } from '../src/services/honorActivation.js';
import { prepareHonorSeason } from '../src/services/honorLedger.js';
import { launchAttack } from '../src/services/mission.js';
import { lockSeason } from '../src/services/planet.js';
import { giveUnits, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

describe('operational Honor shadow activation', () => {
  let f: Fixture;
  beforeEach(async () => {
    f = await seedWorld(2, 24017);
    await setLevel(f.db, f.planetIds[0]!, 'CORE', 6);
    await giveUnits(f.db, f.planetIds[0]!, { DART: 20 });
    f.clock.advance(250);
  });
  afterAll(async () => { await (await testDb()).close(); });
  const activate = (apply = false, seasonId = f.seasonId) => activateHonorShadow(f.db, { seasonId, apply, clock: f.clock });
  const unchanged = async () => ({
    seasons: await f.db.select().from(seasons), players: await f.db.select().from(players), planets: await f.db.select().from(planets),
    config: await f.db.select().from(honorSeasons), samples: await f.db.select().from(honorObservations),
    commitments: await f.db.select().from(honorCommitments), events: await f.db.select().from(honorEvents), totals: await f.db.select().from(honorTotals),
  });

  it('previews the precise open season and existing attack count with no database writes', async () => {
    await launchAttack(f.db, f.planetIds[0]!, f.planetIds[1]!, { DART: 5 }, f.clock);
    const before = await unchanged();
    expect(await activate()).toMatchObject({ status: 'READY', applied: false, seasonId: f.seasonId,
      mode: 'SHADOW', version: 4, startsAt: f.clock.now(), commanders: 2, preactivationAttacks: { world: 1, clanWar: 0, monument: 0 } });
    expect(await unchanged()).toEqual(before);
  });

  it('applies once and preserves the exact immutable boundary on later previews and retries', async () => {
    const raid = await launchAttack(f.db, f.planetIds[0]!, f.planetIds[1]!, { DART: 5 }, f.clock);
    const at = f.clock.now();
    expect(await activate(true)).toMatchObject({ status: 'READY', applied: true, startsAt: at });
    expect(await f.db.select().from(honorObservations)).toHaveLength(2);
    const before = await unchanged();
    f.clock.advance(1);
    for (const apply of [false, true]) expect(await activate(apply)).toMatchObject({ status: 'ALREADY_ENABLED', applied: false, startsAt: at });
    expect(await unchanged()).toEqual(before);
    expect((await f.db.select().from(honorSeasons))[0]?.legacySources).toEqual([`WORLD:${raid.missionId}`]);
    expect((await f.db.select().from(missions))[0]?.status).toBe('in_flight');
  });

  it('serialises two real activations without duplicate observations', async () => {
    const results = await Promise.all([activate(true), activate(true)]);
    expect(results.filter(row => row.applied)).toHaveLength(1);
    expect(results.filter(row => row.status === 'ALREADY_ENABLED')).toHaveLength(1);
    expect(await f.db.select().from(honorSeasons)).toHaveLength(1);
    expect(await f.db.select().from(honorObservations)).toHaveLength(2);
  });

  it.each([1, 3] as const)('never upgrades an existing frozen v%s shadow configuration', async version => {
    await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'SHADOW', f.clock, version));
    const before = await unchanged();
    for (const apply of [false, true]) expect(await activate(apply)).toMatchObject({ status: 'ALREADY_ENABLED', applied: false, version });
    expect(await unchanged()).toEqual(before);
  });

  it('can inspect an explicitly prepared candidate without adopting it as the default', async () => {
    await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'SHADOW', f.clock, 2));
    const before = await unchanged();
    expect(await activate(false)).toMatchObject({ status: 'ALREADY_ENABLED', applied: false, version: 2 });
    expect(await activate(true)).toMatchObject({ status: 'ALREADY_ENABLED', applied: false, version: 2 });
    expect(await unchanged()).toEqual(before);
  });

  it('keeps preview read-only even while another transaction holds the gameplay season lock', async () => {
    await f.db.transaction(async tx => {
      await lockSeason(tx, f.seasonId);
      expect(await activate(false)).toMatchObject({ applied: false, status: 'READY' });
      expect(await tx.select().from(honorSeasons)).toHaveLength(0);
    });
  });

  it.each(['frozen', 'closed', 'ended', 'future'] as const)('refuses %s seasons without writes', async kind => {
    const now = f.clock.now();
    await f.db.update(seasons).set(kind === 'frozen' ? { status: 'frozen' }
      : kind === 'closed' ? { closedAt: now, endReason: 'SCHEDULED_END' }
      : kind === 'ended' ? { endsAt: now }
      : { startsAt: new Date(now.getTime() + 1) }).where(eq(seasons.id, f.seasonId));
    const before = await unchanged();
    for (const apply of [false, true]) await expect(activate(apply)).rejects.toThrow('An open main season is required');
    expect(await unchanged()).toEqual(before);
  });

  it('refuses missing or malformed season identities', async () => {
    await expect(activate(false, randomUUID())).rejects.toThrow('An open main season is required');
    await expect(activate(false, 'EU-1')).rejects.toThrow();
    expect(await f.db.select().from(honorSeasons)).toHaveLength(0);
  });

  it('never turns an active Honor season into shadow', async () => {
    const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    f.clock.set(season!.startsAt);
    await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'ACTIVE', f.clock));
    const before = await unchanged();
    for (const apply of [false, true]) await expect(activate(apply)).rejects.toThrow('Honor season configuration is immutable');
    expect(await unchanged()).toEqual(before);
  });

  it('refuses a sealed or unsupported shadow catalogue without overwriting evidence', async () => {
    await activate(true);
    await f.db.update(honorSeasons).set({ closedAt: f.clock.now() });
    for (const apply of [false, true]) await expect(activate(apply)).rejects.toThrow('Honor season is sealed');
    await f.db.update(honorSeasons).set({ closedAt: null, version: 999 });
    for (const apply of [false, true]) await expect(activate(apply)).rejects.toThrow('Unsupported frozen Honor version');
    expect((await f.db.select().from(honorSeasons))[0]?.version).toBe(999);
  });

  it('does not enable competitive history in Silent Space', async () => {
    const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    await f.db.update(shards).set({ role: 'WAITING' }).where(eq(shards.id, season!.shardId));
    await expect(activate(true)).rejects.toThrow('An open main season is required');
    expect(await f.db.select().from(honorSeasons)).toHaveLength(0);
  });

  it('an apply waits behind a real gameplay season lock', async () => {
    await f.db.transaction(async gameplay => {
      await lockSeason(gameplay, f.seasonId);
      await expect(f.db.transaction(async tx => {
        await tx.execute(sql`set local lock_timeout = '100ms'`);
        // The preparation service used by activation obeys this exact barrier.
        await prepareHonorSeason(tx, f.seasonId, 'SHADOW', f.clock);
      })).rejects.toMatchObject({ cause: { code: '55P03' } });
      expect(await gameplay.select().from(honorSeasons).where(and(eq(honorSeasons.seasonId, f.seasonId)))).toHaveLength(0);
    });
  });
});
