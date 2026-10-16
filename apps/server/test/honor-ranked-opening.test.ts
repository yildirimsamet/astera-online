import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { honorCommitments, honorEvents, honorObservations, honorSeasons, honorTotals, planets, players, seasons, shards } from '../src/db/schema.js';
import { openHonorRanking } from '../src/services/honorActivation.js';
import { emptyHonorState, replayHonor, type HonorEvidence } from '../src/services/honorAccounting.js';
import { commitHonor, monumentHonorCommitment, worldHonorCommitment } from '../src/services/honorCommitment.js';
import { prepareHonorSeason, settleHonor } from '../src/services/honorLedger.js';
import { honorOwnerReference, observeHonorOwner } from '../src/services/honorReference.js';
import { readHonorReceipts } from '../src/services/honorReports.js';
import { sealHonor } from '../src/services/honorSeason.js';
import { lockSeason } from '../src/services/planet.js';
import { giveUnits, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

afterAll(async () => { await (await testDb()).close(); });

describe.each([3, 4] as const)('announced Honor v%s opening after invisible observation', version => {
  let f: Fixture;
  beforeEach(async () => {
    f = await seedWorld(2, 7719);
    for (const id of f.planetIds) { await setLevel(f.db, id, 'CORE', 9); await giveUnits(f.db, id, { DART: 30 }); }
    await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'SHADOW', f.clock, version));
    f.clock.advance(2 * 24 * 60);
  });
  const open = (apply = false, seasonId = f.seasonId) => openHonorRanking(f.db, { seasonId, clock: f.clock, apply });
  const evidence = (over: Partial<HonorEvidence> = {}): HonorEvidence => ({
    source: 'WORLD', id: randomUUID(), at: f.clock.now().getTime(), eligible: true,
    attack: [{ id: f.playerIds[0]!, tier: 3, navy: 100_000, weight: 100_000, civilianWeight: 0, loss: 0, combatLoss: 0, lootLost: 0 }],
    defence: [{ id: f.playerIds[1]!, tier: 3, navy: 100_000, weight: 100_000, civilianWeight: 0, loss: 1000, combatLoss: 1000, lootLost: 0 }],
    relations: [{ a: f.playerIds[0]!, b: f.playerIds[1]!, related: false }], ...over,
  });
  const settle = (value: HonorEvidence) => f.db.transaction(tx => settleHonor(tx, f.seasonId, value));
  const snapshot = async () => ({ config: await f.db.select().from(honorSeasons),
    events: await f.db.select().from(honorEvents), totals: await f.db.select().from(honorTotals),
    observations: await f.db.select().from(honorObservations), commitments: await f.db.select().from(honorCommitments),
    players: await f.db.select().from(players), planets: await f.db.select().from(planets), seasons: await f.db.select().from(seasons) });
  const receipt = (e: HonorEvidence) => f.db.transaction(tx => readHonorReceipts(tx, f.playerIds[0]!, [e]));

  it('previews without changing observations, invisible points or game rows', async () => {
    await settle(evidence());
    const before = await snapshot();
    expect(await open()).toMatchObject({ status: 'READY', applied: false, mode: 'ACTIVE',
      shadowEvents: 1, startsAt: f.clock.now(), commanders: 2 });
    expect(await snapshot()).toEqual(before);
  });

  it('resets all competitive state but preserves every trial event, reference and game counter', async () => {
    const trial = evidence();
    await settle(trial);
    await settle(evidence({ id: randomUUID(), at: trial.at + 1, attack: [{ ...trial.attack[0]!, tier: 4, navy: 200_000 }] }));
    f.clock.set(new Date(trial.at + 2));
    const before = await snapshot();
    expect(before.config[0]!.state.pairs.length).toBeGreaterThan(0);
    expect(before.config[0]!.state.repeats.length).toBeGreaterThan(0);
    expect(before.config[0]!.state.retaliations.length).toBeGreaterThan(0);
    expect(await open(true)).toMatchObject({ applied: true, status: 'READY' });
    const after = await snapshot();
    expect(after.config[0]).toMatchObject({ mode: 'ACTIVE', rankedAt: f.clock.now(),
      state: emptyHonorState(), createdAt: before.config[0]!.createdAt,
      catalogue: before.config[0]!.catalogue, shieldCatalogue: before.config[0]!.shieldCatalogue });
    expect(after.events).toEqual(before.events);
    expect(after.events.every(row => !row.ranked)).toBe(true);
    expect(after.totals).toHaveLength(0);
    expect(after.observations).toEqual(before.observations);
    for (const key of ['players', 'planets', 'seasons', 'commitments'] as const) expect(after[key]).toEqual(before[key]);
    expect(await receipt(trial)).toEqual(new Map());
    expect(await settle(trial)).toEqual({ status: 'DISABLED' });
    expect(await f.db.select().from(honorTotals)).toHaveLength(0);
  });

  it('preserves the observed Core peak and 24h navy peak across opening', async () => {
    f.clock.advance(-30);
    await setLevel(f.db, f.planetIds[0]!, 'CORE', 12);
    await giveUnits(f.db, f.planetIds[0]!, { DART: 120 });
    await f.db.transaction(tx => observeHonorOwner(tx, f.playerIds[0]!, f.clock.now()));
    f.clock.advance(30);
    await setLevel(f.db, f.planetIds[0]!, 'CORE', 6);
    await giveUnits(f.db, f.planetIds[0]!, { DART: 10 });
    const expected = await honorOwnerReference(f.db, f.seasonId, f.playerIds[0]!, f.clock.now());
    await open(true);
    expect(await honorOwnerReference(f.db, f.seasonId, f.playerIds[0]!, f.clock.now())).toEqual(expected);
    expect(expected.tier).toBe(4);
    const committed = await f.db.transaction(tx => commitHonor(tx, { seasonId: f.seasonId, source: 'WORLD', id: randomUUID(),
      attack: [f.playerIds[0]!], defence: [f.playerIds[1]!], at: f.clock.now(), adminUsernames: new Set() }));
    expect(committed!.attack[0]).toMatchObject(expected);
  });

  it('late ranked replay rebuilds only the new race, even when old trial has the exact opening millisecond', async () => {
    const trial = evidence(); await settle(trial); await open(true);
    const first = evidence({ at: trial.at + 1 }), later = evidence({ at: trial.at + 2 });
    await settle(later); await settle(first);
    const { events: expectedEvents, ...expected } = replayHonor([first, later], version);
    expect(expectedEvents).toHaveLength(2);
    expect((await f.db.select().from(honorSeasons))[0]!.state).toEqual(expected);
    const ranked = (await f.db.select().from(honorEvents)).filter(row => row.ranked);
    expect(ranked).toHaveLength(2);
    expect(await receipt(trial)).toEqual(new Map());
    expect((await receipt(first)).size).toBe(1);
  });

  it('retries/concurrent operators never reset freshly earned ranked points', async () => {
    const results = await Promise.all([open(true), open(true)]);
    expect(results.filter(row => row.applied)).toHaveLength(1);
    const event = evidence(); await settle(event);
    const before = await snapshot(); f.clock.advance(1);
    for (const apply of [false, true]) expect(await open(apply)).toMatchObject({ status: 'ALREADY_ACTIVE', applied: false,
      startsAt: before.config[0]!.rankedAt });
    expect(await snapshot()).toEqual(before);
  });

  it.each(['WORLD', 'CLAN_WAR', 'MONUMENT'] as const)('exempts a pre-opening %s commitment even at an equal timestamp', async source => {
    const id = randomUUID();
    await f.db.transaction(tx => commitHonor(tx, { seasonId: f.seasonId, source, id,
      attack: [f.playerIds[0]!], defence: [f.playerIds[1]!], at: f.clock.now(), adminUsernames: new Set() }));
    await open(true);
    expect((await f.db.select().from(honorSeasons))[0]!.legacySources).toContain(`${source}:${id}`);
    expect(await f.db.transaction(tx => source === 'MONUMENT'
      ? monumentHonorCommitment(tx, { seasonId: f.seasonId, sourceId: id, defence: [f.playerIds[1]!], at: f.clock.now(), adminUsernames: new Set() })
      : worldHonorCommitment(tx, { seasonId: f.seasonId, source, missionId: id, host: f.playerIds[1]!, supporters: [], adminUsernames: new Set() }))).toBeNull();
    // The same identifier in another source namespace is never exempted.
    const other = source === 'WORLD' ? 'CLAN_WAR' : 'WORLD';
    await expect(f.db.transaction(tx => worldHonorCommitment(tx, { seasonId: f.seasonId, source: other,
      missionId: id, host: f.playerIds[1]!, supporters: [], adminUsernames: new Set() }))).rejects.toThrow('Missing Honor attack commitment');
  });

  it('requires a complete 24-hour observation window and rejects unsupported/candidate policies', async () => {
    const [config] = await f.db.select().from(honorSeasons);
    f.clock.set(new Date(config!.createdAt.getTime() + 86_400_000 - 1));
    await expect(open(true)).rejects.toThrow('24 hours');
    f.clock.advance(1);
    await f.db.update(honorSeasons).set({ version: 2 });
    await expect(open(true)).rejects.toThrow('Candidate Honor');
    await f.db.update(honorSeasons).set({ version: 999 });
    await expect(open(true)).rejects.toThrow('Unsupported frozen Honor version');
    expect((await f.db.select().from(honorSeasons))[0]!.mode).toBe('SHADOW');
  });

  it('accepts the exact 24-hour boundary and refuses missing observation history without partial reset', async () => {
    const [config] = await f.db.select().from(honorSeasons);
    f.clock.set(new Date(config!.createdAt.getTime() + 86_400_000));
    expect(await open()).toMatchObject({ status: 'READY' });
    await settle(evidence());
    await f.db.delete(honorObservations).where(eq(honorObservations.playerId, f.playerIds[1]!));
    const before = await snapshot();
    await expect(open(true)).rejects.toThrow('Missing Honor reference history');
    expect(await snapshot()).toEqual(before);
  });

  it.each(['frozen', 'closed', 'ended', 'future', 'waiting', 'sealed', 'absent'] as const)('refuses %s without writes', async kind => {
    const now = f.clock.now();
    if (kind === 'waiting') {
      const [season] = await f.db.select().from(seasons);
      await f.db.update(shards).set({ role: 'WAITING' }).where(eq(shards.id, season!.shardId));
    } else if (kind === 'sealed') await f.db.update(honorSeasons).set({ closedAt: now });
    else if (kind === 'absent') await f.db.delete(honorSeasons);
    else await f.db.update(seasons).set(kind === 'frozen' ? { status: 'frozen' }
      : kind === 'closed' ? { closedAt: now, endReason: 'SCHEDULED_END' }
      : kind === 'ended' ? { endsAt: now } : { startsAt: new Date(now.getTime() + 1) });
    const before = await snapshot();
    for (const apply of [false, true]) await expect(open(apply)).rejects.toThrow();
    expect(await snapshot()).toEqual(before);
  });

  it('rejects malformed/missing season identifiers and backdated evidence', async () => {
    await expect(open(true, randomUUID())).rejects.toThrow('An open main season is required');
    await expect(open(true, 'EU-1')).rejects.toThrow();
    await open(true);
    await expect(settle(evidence({ at: f.clock.now().getTime() - 1 }))).rejects.toThrow('before ranked opening');
    expect(await f.db.select().from(honorTotals)).toHaveLength(0);
  });

  it('read-only preview works behind a gameplay SHARE lock; opening must wait for it', async () => {
    let finished = false;
    let pending: ReturnType<typeof open> | undefined;
    await f.db.transaction(async tx => {
      await lockSeason(tx, f.seasonId);
      expect(await open(false)).toMatchObject({ status: 'READY' });
      pending = open(true).then(result => { finished = true; return result; });
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(finished).toBe(false);
    });
    expect(await pending).toMatchObject({ applied: true });
  }, 10_000);

  it('season rewards ignore shadow history when the ranked race has no positive score', async () => {
    await settle(evidence()); await open(true);
    const rewards = await f.db.transaction(tx => sealHonor(tx, { seasonId: f.seasonId,
      at: f.clock.now(), humanPlayerIds: f.playerIds }));
    expect(rewards!.every(row => row.reward.alloy === 0 && row.reward.crystal === 0 && row.reward.deuterium === 0)).toBe(true);
  });

  it('cannot seal a ranked competition at a timestamp before its visible opening', async () => {
    await open(true);
    const before = await snapshot();
    await expect(f.db.transaction(tx => sealHonor(tx, { seasonId: f.seasonId,
      at: new Date(f.clock.now().getTime() - 1), humanPlayerIds: f.playerIds })))
      .rejects.toThrow('Invalid Honor season boundary');
    expect(await snapshot()).toEqual(before);
  });

  it('rolls points, current sampling and the flight boundary back together if publication fails', async () => {
    await settle(evidence());
    await giveUnits(f.db, f.planetIds[0]!, { DART: 40 });
    const before = await snapshot();
    await f.db.execute(sql`CREATE FUNCTION honor_opening_test_failure() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'opening failure'; END $$`);
    await f.db.execute(sql`CREATE TRIGGER honor_opening_test_failure BEFORE UPDATE OF mode ON honor_seasons
      FOR EACH ROW WHEN (OLD.mode = 'SHADOW' AND NEW.mode = 'ACTIVE') EXECUTE FUNCTION honor_opening_test_failure()`);
    try {
      await expect(open(true)).rejects.toThrow();
      expect(await snapshot()).toEqual(before);
    } finally {
      await f.db.execute(sql`DROP TRIGGER honor_opening_test_failure ON honor_seasons`);
      await f.db.execute(sql`DROP FUNCTION honor_opening_test_failure()`);
    }
    expect(await open(true)).toMatchObject({ applied: true });
  });

  it('the migration keeps pre-existing ACTIVE history ranked and SHADOW history private without changing scores', async () => {
    const trial = evidence(); await settle(trial);
    await f.db.update(honorEvents).set({ ranked: true });
    const before = await snapshot();
    const updates = readFileSync(new URL('../drizzle/0167_honor_ranked_opening.sql', import.meta.url), 'utf8')
      .split('--> statement-breakpoint').map(part => part.trim()).filter(part => part.startsWith('UPDATE'));
    expect(updates).toHaveLength(2);
    for (const update of updates) await f.db.execute(sql.raw(update));
    expect((await f.db.select().from(honorEvents))[0]!.ranked).toBe(false);
    expect((await f.db.select().from(honorSeasons))[0]!.rankedAt).toBeNull();
    expect(await f.db.select().from(honorTotals)).toEqual(before.totals);
    await f.db.update(honorSeasons).set({ mode: 'ACTIVE', rankedAt: null });
    await f.db.update(honorEvents).set({ ranked: true });
    for (const update of updates) await f.db.execute(sql.raw(update));
    expect((await f.db.select().from(honorEvents))[0]!.ranked).toBe(true);
    expect((await f.db.select().from(honorSeasons))[0]!.rankedAt).toEqual(before.config[0]!.createdAt);
    expect(await f.db.select().from(honorTotals)).toEqual(before.totals);
    expect((await f.db.select().from(honorSeasons))[0]!.state).toEqual(before.config[0]!.state);
  });

  it('treats every pre-opening SHADOW event as trial even if an older writer used the column default', async () => {
    const trial = evidence(); await settle(trial);
    await f.db.update(honorEvents).set({ ranked: true });
    const [before] = await f.db.select().from(honorEvents);
    expect(await open(false)).toMatchObject({ shadowEvents: 1 });
    await open(true);
    expect((await f.db.select().from(honorEvents))[0]).toEqual({ ...before, ranked: false });
    expect(await receipt(trial)).toEqual(new Map());
    expect(await settle(trial)).toEqual({ status: 'DISABLED' });
    expect(await f.db.select().from(honorTotals)).toHaveLength(0);
  });
});
