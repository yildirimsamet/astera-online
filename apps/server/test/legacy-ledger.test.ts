import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { accounts, legacyActivityDays, legacyAwards, legacyFacts, legacyProfiles, seasons } from '../src/db/schema.js';
import {
  ensureLegacyProfile, recordLegacyFact, recordLegacyMonumentInterval,
  refreshLegacyAwards, legacyProgress, equipLegacyShowcase, equipLegacyTitle,
  recordLegacyActivity, registerLegacyParticipation,
} from '../src/services/legacy.js';
import { legacyCollectionView } from '../src/services/legacyView.js';
import { createSeason } from '../src/services/season.js';
import { commitLegacyAttack, settleLegacyAttack } from '../src/services/legacyEvents.js';
import { seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

const DAY = 86_400_000;
let f: Fixture;
let accountId: string;
const atDay = (day: number) => new Date(Date.UTC(2026, 0, 1) + day * DAY);

beforeEach(async () => {
  f = await seedWorld(2, 7301);
  accountId = f.accountIds[0]!;
  f.clock.set(atDay(12));
});
afterAll(async () => { await (await testDb()).close(); });

const fact = (sourceKey: string, amount = 1, origin: 'EVENT' | 'RESTORED' | 'ARCHIVE' = 'EVENT', day = 1) => f.db.transaction(tx =>
  recordLegacyFact(tx, { accountId, seasonId: f.seasonId, metric: 'PROBES', sourceKey, amount, at: atDay(day), origin }));
const awards = () => f.db.select().from(legacyAwards).where(and(eq(legacyAwards.accountId, accountId), eq(legacyAwards.definitionId, 'deep-sight')));
const refresh = () => f.db.transaction(tx => refreshLegacyAwards(tx, accountId, f.clock.now()));

describe('persistent cosmetic legacy journal', () => {
  it('creates one opaque profile per account under concurrent requests', async () => {
    const profiles = await Promise.all([ensureLegacyProfile(f.db, accountId), ensureLegacyProfile(f.db, accountId)]);
    expect(profiles[0].publicId).toBe(profiles[1].publicId);
    expect(profiles[0].publicId).not.toBe(accountId);
    expect(await f.db.select().from(legacyProfiles).where(eq(legacyProfiles.accountId, accountId))).toHaveLength(1);
  });

  it('records a concurrent redelivery once and retains all crossed tiers under concurrent evaluation', async () => {
    await Promise.all([fact('flight:one', 100), fact('flight:one', 100)]);
    await Promise.all([refresh(), refresh()]);
    expect(await f.db.select().from(legacyFacts).where(eq(legacyFacts.accountId, accountId))).toHaveLength(1);
    expect((await awards()).map(row => row.tier).sort()).toEqual([1, 2]);
    expect((await legacyProgress(f.db, accountId, f.clock.now())).find(row => row.id === 'deep-sight')?.progress).toBe(100);
  });

  it('evaluates a live receipt inside the gameplay transaction only when it can cross a goal', async () => {
    const profile = () => f.db.select().from(legacyProfiles).where(eq(legacyProfiles.accountId, accountId));
    // Nine probes cross nothing: the hot path never re-reads the whole journal for them.
    for (let probe = 0; probe < 9; probe++) await fact(`flight:${String(probe)}`);
    expect(await profile()).toHaveLength(0);
    expect(await awards()).toHaveLength(0);
    // The tenth is the first goal, granted in the same transaction as the launch.
    await fact('flight:9');
    expect((await awards()).map(row => row.tier)).toEqual([1]);
    // A batch that jumps several goals at once is evaluated once and keeps every crossed tier.
    await fact('flight:batch', 95);
    expect((await awards()).map(row => row.tier).sort()).toEqual([1, 2]);
    expect((await legacyProgress(f.db, accountId, f.clock.now())).find(row => row.id === 'deep-sight')?.progress).toBe(105);
  });

  it('reclassifies an existing award without replacing its identity, evidence, dates or showcase', async () => {
    await fact('classification:probes', 100);
    const before = (await awards()).find(row => row.tier === 2)!;
    await equipLegacyShowcase(f.db, accountId, [before.id]);
    await f.db.update(legacyAwards).set({ rarity: 'LEGENDARY' }).where(eq(legacyAwards.id, before.id));
    const profile = await ensureLegacyProfile(f.db, accountId);
    expect((await legacyCollectionView(f.db, profile.publicId, 48)).awards.find(row => row.id === before.id)?.rarity).toBe('RARE');
    await refresh();
    const after = (await awards()).find(row => row.id === before.id)!;
    expect(after).toEqual({ ...before, rarity: 'RARE' });
    await expect(equipLegacyShowcase(f.db, accountId, [before.id])).resolves.toBeUndefined();
  });

  it('merges an archive with restored originals while immediately adding genuinely new actions', async () => {
    await fact('flight:one', 30);
    await fact('archive:probes', 100, 'ARCHIVE');
    await fact('flight:two', 20, 'RESTORED');
    await refresh();
    expect((await legacyProgress(f.db, accountId, f.clock.now())).find(row => row.id === 'deep-sight')?.progress).toBe(100);
    await fact('flight:three', 20, 'EVENT', 2);
    expect((await legacyProgress(f.db, accountId, f.clock.now())).find(row => row.id === 'deep-sight')?.progress).toBe(120);
    // A later full snapshot includes the new work but cannot credit it a second time.
    await fact('archive:probes:final', 120, 'ARCHIVE', 3);
    await fact('flight:one', 30, 'RESTORED');
    expect((await legacyProgress(f.db, accountId, f.clock.now())).find(row => row.id === 'deep-sight')?.progress).toBe(120);
    expect(await awards()).toHaveLength(2);
  });

  it('does not add a delayed original event on top of an archive that already includes it', async () => {
    await fact('archive:sealed', 100, 'ARCHIVE', 5);
    await fact('late:old-event', 10, 'EVENT', 2);
    expect((await legacyProgress(f.db, accountId, f.clock.now())).find(row => row.id === 'deep-sight')?.progress).toBe(100);
    await fact('new:work', 20, 'EVENT', 6);
    expect((await legacyProgress(f.db, accountId, f.clock.now())).find(row => row.id === 'deep-sight')?.progress).toBe(120);
  });

  it('refuses contradictory evidence under an already-consumed source identity', async () => {
    await fact('flight:one', 1);
    await expect(fact('flight:one', 100)).rejects.toMatchObject({ code: 'LEGACY_EVIDENCE_CONFLICT' });
  });

  it('does not count evidence from beyond the requested observation instant', async () => {
    await f.db.transaction(tx => recordLegacyFact(tx, { accountId, seasonId: f.seasonId, metric: 'PROBES',
      sourceKey: 'future', amount: 10, at: atDay(13) }));
    expect((await legacyProgress(f.db, accountId, atDay(12))).find(row => row.id === 'deep-sight')?.progress).toBe(0);
  });

  it('does not revoke later valid awards when an older worker event arrives late', async () => {
    await f.db.transaction(tx => recordLegacyFact(tx, { accountId, seasonId: f.seasonId, metric: 'PROBES',
      sourceKey: 'recent', amount: 100, at: atDay(10) }));
    await f.db.transaction(tx => recordLegacyFact(tx, { accountId, seasonId: f.seasonId, metric: 'DEATH_STAR_LAUNCHES',
      sourceKey: 'old:delivery', amount: 1, at: atDay(2) }));
    expect((await awards()).filter(row => row.revokedAt === null)).toHaveLength(2);
  });

  it('combines distinct active days across a same-cycle galaxy transfer, without duplicating a season memento', async () => {
    const { season: other } = await createSeason(f.db, { seed: 7302, shardCode: 'LEGACY-TRANSFER', startsAt: atDay(0), days: 14 });
    await f.db.transaction(async tx => {
      await registerLegacyParticipation(tx, accountId, f.seasonId, atDay(0));
      await registerLegacyParticipation(tx, accountId, other.id, atDay(7));
      await tx.insert(legacyActivityDays).values(Array.from({ length: 12 }, (_, day) => ({ accountId,
        seasonId: day < 7 ? f.seasonId : other.id, day, firstActionAt: atDay(day) })));
    });
    await f.db.update(seasons).set({ status: 'frozen', closedAt: atDay(14), endReason: 'SCHEDULED_END' });
    f.clock.set(atDay(14));
    await refresh();
    const rows = await f.db.select().from(legacyAwards).where(eq(legacyAwards.accountId, accountId));
    expect(rows.filter(row => row.definitionId === 'loyal-commander')).toHaveLength(1);
    expect(rows.filter(row => row.definitionId === 'season-memento')).toHaveLength(1);
    expect((await legacyProgress(f.db, accountId, f.clock.now())).find(row => row.id === 'loyal-commander')?.progress).toBe(1);
  });

  it('awards a calendar-year pin for actual play, rather than account age or an undated cross-year archive', async () => {
    await f.db.update(accounts).set({ createdAt: new Date('2020-01-01T00:00:00Z') }).where(eq(accounts.id, accountId));
    await refresh();
    expect(await f.db.select().from(legacyAwards).where(eq(legacyAwards.accountId, accountId))).toHaveLength(0);
    await f.db.transaction(tx => recordLegacyActivity(tx, f.playerIds[0]!, atDay(3)));
    await refresh();
    const rows = await f.db.select().from(legacyAwards).where(eq(legacyAwards.accountId, accountId));
    expect(rows.filter(row => row.definitionId === 'year-of-service').map(row => row.edition)).toEqual(['year:2026']);
  });

  it('does not invent a play year from an undated archive that straddles New Year', async () => {
    const { season } = await createSeason(f.db, { seed: 7303, shardCode: 'LEGACY-OLD',
      startsAt: new Date('2025-12-25T00:00:00Z'), days: 14 });
    await f.db.update(seasons).set({ status: 'frozen', closedAt: season.endsAt, endReason: 'SCHEDULED_END' }).where(eq(seasons.id, season.id));
    await f.db.transaction(tx => recordLegacyFact(tx, { accountId, seasonId: season.id, metric: 'SHIPS_BUILT:DART',
      sourceKey: 'archive:ships', origin: 'ARCHIVE', dateKnown: false, amount: 100, at: season.endsAt }));
    await refresh();
    const rows = await f.db.select().from(legacyAwards).where(eq(legacyAwards.accountId, accountId));
    expect(rows.filter(row => row.definitionId === 'year-of-service')).toHaveLength(0);
    expect(rows.find(row => row.definitionId === 'shipwright-dart')?.earnedAt).toBeNull();
  });

  it('keeps unknown historical dates local to their metric and uses the proven action date when restoring another award', async () => {
    await f.db.transaction(async tx => {
      await recordLegacyFact(tx, { accountId, seasonId: f.seasonId, metric: 'SHIPS_BUILT:DART',
        sourceKey: 'archive:ships', origin: 'ARCHIVE', dateKnown: false, amount: 100, at: atDay(1) });
      await recordLegacyFact(tx, { accountId, seasonId: f.seasonId, metric: 'PROBES',
        sourceKey: 'restored:probes', origin: 'RESTORED', amount: 10, at: atDay(2) });
      await recordLegacyActivity(tx, f.playerIds[0]!, atDay(3));
    });
    const rows = await f.db.select().from(legacyAwards).where(eq(legacyAwards.accountId, accountId));
    expect(rows.find(row => row.definitionId === 'shipwright-dart')?.earnedAt).toBeNull();
    expect(rows.find(row => row.definitionId === 'deep-sight')?.earnedAt).toEqual(atDay(2));
    expect(rows.find(row => row.definitionId === 'deep-sight')?.sourceSeasonId).toBe(f.seasonId);
    expect(rows.find(row => row.definitionId === 'shipwright-dart')?.sourceSeasonId).toBe(f.seasonId);
    expect(rows.find(row => row.definitionId === 'year-of-service')?.earnedAt).toEqual(atDay(3));
  });

  it('does not turn an offline New Year production completion into a year of actual play', async () => {
    const { season } = await createSeason(f.db, { seed: 7304, shardCode: 'LEGACY-NEW-YEAR',
      startsAt: new Date('2025-12-25T00:00:00Z'), days: 14 });
    await f.db.update(seasons).set({ status: 'frozen', closedAt: season.endsAt, endReason: 'SCHEDULED_END' }).where(eq(seasons.id, season.id));
    await f.db.insert(legacyActivityDays).values({ accountId, seasonId: season.id, day: 5,
      firstActionAt: new Date('2025-12-30T00:00:00Z') });
    await f.db.transaction(tx => recordLegacyFact(tx, { accountId, seasonId: season.id, metric: 'SHIPS_BUILT:DART',
      sourceKey: 'build:new-year', amount: 100, at: new Date('2026-01-02T00:00:00Z') }));
    await refresh();
    const rows = await f.db.select().from(legacyAwards).where(eq(legacyAwards.accountId, accountId));
    expect(rows.filter(row => row.definitionId === 'year-of-service').map(row => row.edition)).toEqual(['year:2025']);
  });

  it('compares attack tiers at launch and counts only an actual later engagement', async () => {
    await setLevel(f.db, f.planetIds[1]!, 'CORE', 5);
    await f.db.transaction(tx => commitLegacyAttack(tx, { seasonId: f.seasonId, sourceKey: 'world:raid-one',
      attackers: [f.playerIds[0]!], defenders: [f.playerIds[1]!], at: atDay(1) }));
    await refresh();
    expect((await legacyProgress(f.db, accountId, f.clock.now())).find(row => row.id === 'troublemaker')?.progress).toBe(0);
    await setLevel(f.db, f.planetIds[0]!, 'CORE', 15);
    await setLevel(f.db, f.planetIds[1]!, 'CORE', 1);
    const settle = () => f.db.transaction(tx => settleLegacyAttack(tx, { seasonId: f.seasonId,
      sourceKey: 'world:raid-one', defenders: [f.playerIds[1]!], at: atDay(2) }));
    await settle();
    await settle();
    await refresh();
    expect((await legacyProgress(f.db, accountId, f.clock.now())).find(row => row.id === 'troublemaker')?.progress).toBe(1);
  });

  it('does not credit an intended higher-tier opponent when the world belongs to someone else at engagement', async () => {
    await setLevel(f.db, f.planetIds[1]!, 'CORE', 5);
    await f.db.transaction(tx => commitLegacyAttack(tx, { seasonId: f.seasonId, sourceKey: 'world:changed',
      attackers: [f.playerIds[0]!], defenders: [f.playerIds[1]!], at: atDay(1) }));
    await f.db.transaction(tx => settleLegacyAttack(tx, { seasonId: f.seasonId, sourceKey: 'world:changed',
      defenders: [f.playerIds[0]!], at: atDay(2) }));
    await refresh();
    expect((await legacyProgress(f.db, accountId, f.clock.now())).find(row => row.id === 'troublemaker')?.progress).toBe(0);
  });

  it('excludes every fact of a season closed before twelve days and admits the exact boundary', async () => {
    await fact('flight:one', 100);
    await f.db.update(seasons).set({ status: 'frozen', closedAt: atDay(12 - 1 / DAY), endReason: 'FORCED_WIPE' }).where(eq(seasons.id, f.seasonId));
    await refresh();
    expect((await awards()).filter(row => row.revokedAt === null)).toHaveLength(0);
    expect((await legacyProgress(f.db, accountId, f.clock.now())).find(row => row.id === 'deep-sight')?.progress).toBe(0);
    await f.db.update(seasons).set({ closedAt: atDay(12) }).where(eq(seasons.id, f.seasonId));
    await refresh();
    expect((await awards()).filter(row => row.revokedAt === null)).toHaveLength(2);
  });

  it('awards a live milestone immediately and reverses only invalidated contributions if the season closes too early', async () => {
    await fact('flight:one', 10);
    f.clock.set(atDay(1));
    await refresh();
    expect((await awards()).filter(row => row.revokedAt === null)).toHaveLength(1);
    await f.db.update(seasons).set({ status: 'frozen', closedAt: atDay(11), endReason: 'FORCED_WIPE' }).where(eq(seasons.id, f.seasonId));
    f.clock.set(atDay(11));
    await refresh();
    expect((await awards()).filter(row => row.revokedAt === null)).toHaveLength(0);
    expect((await awards())[0]?.revocationReason).toBe('INELIGIBLE');
  });

  it('unions personal monument intervals across targets, redeliveries and subsecond chunks', async () => {
    const base = atDay(2).getTime();
    const interval = (sourceKey: string, from: number, to: number) => f.db.transaction(tx => recordLegacyMonumentInterval(tx, {
      accountId, seasonId: f.seasonId, sourceKey, from: new Date(base + from), to: new Date(base + to),
    }));
    await interval('wave:first', 0, 3_600_000);
    await interval('wave:second', 1_800_000, 5_400_500);
    await interval('wave:first', 0, 3_600_000);
    await interval('wave:third', 5_400_500, 5_401_000);
    await f.db.transaction(tx => recordLegacyMonumentInterval(tx, { accountId: f.accountIds[1]!, seasonId: f.seasonId,
      sourceKey: 'wave:someone-else', from: atDay(1), to: atDay(10) }));
    const progress = await legacyProgress(f.db, accountId, f.clock.now());
    expect(progress.find(row => row.id === 'monument-warden')?.progress).toBe(5_401);
  });

  it('rolls the journal and automatic award changes back with the gameplay transaction', async () => {
    await expect(f.db.transaction(async tx => {
      await recordLegacyFact(tx, { accountId, seasonId: f.seasonId, metric: 'PROBES', sourceKey: 'failed', amount: 10, at: atDay(12) });
      throw new Error('gameplay failed');
    })).rejects.toThrow('gameplay failed');
    await refresh();
    expect(await awards()).toHaveLength(0);
    expect(await f.db.select().from(legacyFacts)).toHaveLength(0);
  });

  it('rejects invalid counters and evidence outside its season without persisting anything', async () => {
    for (const amount of [0, -1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      await expect(fact('invalid', amount)).rejects.toThrow();
    }
    await expect(f.db.transaction(tx => recordLegacyFact(tx, { accountId, seasonId: f.seasonId, metric: 'PROBES',
      sourceKey: 'too-late', amount: 1, at: atDay(15) }))).rejects.toThrow();
    expect(await f.db.select().from(legacyFacts)).toHaveLength(0);
  });

  it('does not extend the playable season just because its freeze ran late', async () => {
    await f.db.update(seasons).set({ status: 'frozen', closedAt: atDay(20), endReason: 'SCHEDULED_END' }).where(eq(seasons.id, f.seasonId));
    await expect(fact('after:planned-end', 1, 'EVENT', 15)).rejects.toMatchObject({ code: 'LEGACY_EVIDENCE_INVALID' });
  });

  it('keeps title and showcase ownership on the server and allows removing a selected item', async () => {
    await fact('flight:one', 100);
    await refresh();
    const owned = await awards();
    const one = owned.find(row => row.tier === 1)!;
    const two = owned.find(row => row.tier === 2)!;
    await equipLegacyShowcase(f.db, accountId, [one.id, two.id]);
    await equipLegacyTitle(f.db, accountId, two.id);
    await expect(equipLegacyShowcase(f.db, f.accountIds[1]!, [one.id])).rejects.toMatchObject({ status: 403 });
    await expect(equipLegacyTitle(f.db, f.accountIds[1]!, one.id)).rejects.toMatchObject({ status: 403 });
    await expect(equipLegacyShowcase(f.db, accountId, [one.id, one.id])).rejects.toThrow();
    await expect(equipLegacyShowcase(f.db, accountId, Array.from({ length: 7 }, () => one.id))).rejects.toThrow();
    await equipLegacyShowcase(f.db, accountId, []);
    await equipLegacyTitle(f.db, accountId, null);
    const [profile] = await f.db.select().from(legacyProfiles).where(eq(legacyProfiles.accountId, accountId));
    expect(profile?.activeTitleAwardId).toBeNull();
  });

  it('erases personal legacy evidence with the account', async () => {
    await fact('flight:one', 100);
    await refresh();
    const award = (await awards())[0]!;
    await equipLegacyShowcase(f.db, accountId, [award.id]);
    await equipLegacyTitle(f.db, accountId, award.id);
    // The existing erasure path also deletes the seasonal world before its account.
    const { deleteAccount } = await import('../src/services/accountDeletion.js');
    const [account] = await f.db.select().from(accounts).where(eq(accounts.id, accountId));
    await deleteAccount(f.db, f.clock, account!.displayName);
    expect(await f.db.select().from(legacyFacts).where(eq(legacyFacts.accountId, accountId))).toHaveLength(0);
    expect(await awards()).toHaveLength(0);
  });
});
