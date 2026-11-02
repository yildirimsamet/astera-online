import { and, eq, isNull } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, expect, it, vi } from 'vitest';
import { legacyProfileSchema, legacyCollectionSchema, legacyAwardDetailSchema } from '../../web/src/api/legacySchemas.js';
import { botProfiles, legacyActivityDays, legacyAwards, legacyShowcaseSlots } from '../src/db/schema.js';
import { ensureLegacyProfile, equipLegacyShowcase, recordLegacyFact, refreshLegacyAwards, revokeLegacyAward } from '../src/services/legacy.js';
import { legacyAwardView, legacyCollectionView, legacyProfileView } from '../src/services/legacyView.js';
import { bootstrapLegacyBatch } from '../src/services/legacyBootstrap.js';
import { botLegacyPieces } from '../src/services/bots/legacy.js';
import { addBot } from '../src/services/bots/roster.js';
import { seedWorld, testDb, type Fixture } from './helpers.js';

let f: Fixture;
afterEach(() => { vi.unstubAllEnvs(); });
beforeEach(async () => { f = await seedWorld(2, 7352); });
afterAll(async () => { await (await testDb()).close(); });
const refresh = (id: string) => f.db.transaction(tx => refreshLegacyAwards(tx, id, f.clock.now()));
const awards = (id: string) => f.db.select().from(legacyAwards).where(and(eq(legacyAwards.accountId, id), isNull(legacyAwards.revokedAt)));

it('gives a newly created commander two or three distinct ordinary pieces and equips them immediately', async () => {
  const bot = await addBot(f.db, 'Mavi Deniz', f.clock);
  const rows = await awards(bot.accountId);
  expect(rows.length).toBeGreaterThanOrEqual(2);
  expect(rows.length).toBeLessThanOrEqual(3);
  expect(new Set(rows.map(row => row.definitionId)).size).toBe(rows.length);
  expect(rows.every(row => row.tier === 1 && row.rarity === 'COMMON')).toBe(true);
  expect(rows.every(row => !['honor-podium', 'dominion-podium', 'astera-supporter', 'show-off'].includes(row.definitionId))).toBe(true);
  expect((await f.db.select().from(legacyShowcaseSlots).where(eq(legacyShowcaseSlots.accountId, bot.accountId))).map(row => row.awardId).sort())
    .toEqual(rows.map(row => row.id).sort());
  await refresh(bot.accountId);
  expect((await awards(bot.accountId)).map(row => row.id).sort()).toEqual(rows.map(row => row.id).sort());
});

it('backfills existing accounts, preserves the choice across concurrent refreshes and exposes only the normal public contract', async () => {
  const id = f.accountIds[0]!;
  await f.db.insert(botProfiles).values({ accountId: id, ordinal: 0, persona: 'BALANCED', createdAt: f.clock.now(), nextActionAt: f.clock.now() });
  await bootstrapLegacyBatch(f.db, { scope: 'accounts', at: f.clock.now(), limit: 24, apply: true });
  const before = await awards(id);
  expect(before.length).toBeGreaterThanOrEqual(2);
  expect(before.length).toBeLessThanOrEqual(3);
  await Promise.all([refresh(id), refresh(id)]);
  expect(await awards(id)).toEqual(before);
  const profile = await ensureLegacyProfile(f.db, id);
  const view = legacyProfileSchema.parse(await legacyProfileView(f.db, profile.publicId, f.accountIds[1]!));
  expect(view.showcase).toHaveLength(before.length);
  const collection = legacyCollectionSchema.parse(await legacyCollectionView(f.db, profile.publicId, 24));
  expect(collection.awards).toHaveLength(before.length);
  legacyAwardDetailSchema.parse(await legacyAwardView(f.db, profile.publicId, before[0]!.id));
  expect(JSON.stringify(view)).not.toMatch(/bot|evidence|sourceKey/i);
  await equipLegacyShowcase(f.db, id, [before[0]!.id]);
  await refresh(id);
  expect((await f.db.select().from(legacyShowcaseSlots).where(eq(legacyShowcaseSlots.accountId, id))).map(row => row.awardId)).toEqual([before[0]!.id]);
  await equipLegacyShowcase(f.db, id, []);
  await refresh(id);
  expect(await f.db.select().from(legacyShowcaseSlots).where(eq(legacyShowcaseSlots.accountId, id))).toHaveLength(0);
});

it('does not seed ordinary players or restore an administratively revoked piece', async () => {
  await refresh(f.accountIds[0]!);
  expect(await awards(f.accountIds[0]!)).toHaveLength(0);
  const bot = await addBot(f.db, 'Kutup Yıldızı', f.clock);
  const before = await awards(bot.accountId);
  await revokeLegacyAward(f.db, f.accountIds[0]!, before[0]!.id, 'operator correction', f.clock.now());
  await refresh(bot.accountId);
  expect(await awards(bot.accountId)).toHaveLength(before.length - 1);
});


it('varies the initial count and combination between accounts while retaining each choice', () => {
  const choices = Array.from({ length: 32 }, (_, index) => botLegacyPieces(String(index)).map(row => row.id));
  expect(new Set(choices.map(row => row.length))).toEqual(new Set([2, 3]));
  expect(new Set(choices.map(row => row.join(','))).size).toBeGreaterThan(10);
  for (let index = 0; index < choices.length; index++) {
    expect(botLegacyPieces(String(index)).map(row => row.id)).toEqual(choices[index]);
  }
});


it.each([false, true])('initializes an existing collection once and preserves its chosen shelf (occupied=%s)', async occupied => {
  const id = f.accountIds[0]!;
  for (const definition of botLegacyPieces(id)) {
    if (definition.scope === 'YEAR') {
      await f.db.insert(legacyActivityDays).values({ accountId: id, seasonId: f.seasonId, day: 0, firstActionAt: f.clock.now() });
    } else {
      await f.db.transaction(tx => recordLegacyFact(tx, { accountId: id, seasonId: f.seasonId,
        metric: definition.metric, amount: definition.goals[0]!, sourceKey: `earned:${definition.id}`, at: f.clock.now() }));
    }
  }
  await refresh(id);
  const before = await awards(id);
  expect(before.length).toBeGreaterThanOrEqual(botLegacyPieces(id).length);
  if (occupied) await equipLegacyShowcase(f.db, id, [before[0]!.id]);
  await f.db.insert(botProfiles).values({ accountId: id, ordinal: 0, persona: 'BALANCED', createdAt: f.clock.now(), nextActionAt: f.clock.now() });
  await refresh(id);
  expect(await f.db.select().from(legacyShowcaseSlots).where(eq(legacyShowcaseSlots.accountId, id))).toHaveLength(occupied ? 1 : botLegacyPieces(id).length);
  await equipLegacyShowcase(f.db, id, []);
  await refresh(id);
  expect(await f.db.select().from(legacyShowcaseSlots).where(eq(legacyShowcaseSlots.accountId, id))).toHaveLength(0);
});


it('defers the initial grant while old writers are being replaced, then initializes after activation', async () => {
  vi.stubEnv('BOT_LEGACY_ENABLED', 'false');
  const bot = await addBot(f.db, 'Yeni Ufuk', f.clock);
  await refresh(bot.accountId);
  expect(await awards(bot.accountId)).toHaveLength(0);
  vi.stubEnv('BOT_LEGACY_ENABLED', 'true');
  await refresh(bot.accountId);
  expect((await awards(bot.accountId)).length).toBeGreaterThanOrEqual(2);
  expect((await f.db.select().from(legacyShowcaseSlots).where(eq(legacyShowcaseSlots.accountId, bot.accountId))).length).toBeGreaterThanOrEqual(2);
  const granted = (await awards(bot.accountId)).map(row => row.id);
  vi.stubEnv('BOT_LEGACY_ENABLED', 'false');
  await refresh(bot.accountId);
  expect((await awards(bot.accountId)).map(row => row.id)).toEqual(granted);
});
