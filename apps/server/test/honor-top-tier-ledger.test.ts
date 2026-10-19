import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { honorEvents, honorSeasons, honorTotals } from '../src/db/schema.js';
import { replayHonor, type HonorEvidence } from '../src/services/honorAccounting.js';
import { honorEvidenceHash, prepareHonorSeason, settleHonor } from '../src/services/honorLedger.js';
import { readHonorReceipts } from '../src/services/honorReports.js';
import { seedWorld, testDb, type Fixture } from './helpers.js';

describe('top-tier terms in the durable Honor journal and reports', () => {
  let f: Fixture;
  beforeEach(async () => {
    f = await seedWorld(2, 7719);
    await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'SHADOW', f.clock, 4));
    await f.db.update(honorSeasons).set({ mode: 'ACTIVE', rankedAt: f.clock.now() });
  });
  afterAll(async () => { await (await testDb()).close(); });

  const event = (id: string, offset: number, top?: number): HonorEvidence => ({
    source: 'WORLD', id, at: f.clock.now().getTime() + offset, eligible: true,
    ...(top === undefined ? {} : { galaxyTopTier: top }),
    attack: [{ id: f.playerIds[0]!, tier: 8, navy: 100_000, weight: 100_000,
      civilianWeight: 0, loss: 0, combatLoss: 0, lootLost: 0 }],
    defence: [{ id: f.playerIds[1]!, tier: 7, navy: 99_000, weight: 100_000,
      civilianWeight: 0, loss: 1000, combatLoss: 1000, lootLost: 0 }],
    relations: [{ a: f.playerIds[0]!, b: f.playerIds[1]!, related: false }],
  });
  const settle = (e: HonorEvidence) => f.db.transaction(tx => settleHonor(tx, f.seasonId, e));

  it('rebuilds late mixed-era events without reclassifying old battles or their visible reason', async () => {
    const legacy = event('legacy', 1), late = event('late', 3, 8), delayed = event('delayed', 2, 8);
    await settle(legacy);
    const [saved] = await f.db.select().from(honorEvents);
    await settle(late);
    expect((await settle(delayed)).status).toBe('REBUILT');
    const entries = await f.db.select().from(honorEvents);
    const old = entries.find(row => row.sourceId === legacy.id)!;
    expect(old.evidenceHash).toBe(saved!.evidenceHash);
    expect(old.evidence).toEqual(saved!.evidence);
    expect(old.outcome).toEqual(saved!.outcome);
    const expected = replayHonor([legacy, delayed, late], 4);
    const totals = await f.db.select().from(honorTotals);
    for (const row of expected.totals) expect(totals.find(total => total.playerId === row.actor)?.score).toBe(row.score);
    const receipts = await f.db.transaction(tx => readHonorReceipts(tx, f.playerIds[0]!, [legacy, delayed, late]));
    expect(receipts.get(JSON.stringify(['WORLD', legacy.id])))
      .toMatchObject({ reason: 'WEAK_TARGET', breakdown: { weakTargetDebit: true } });
    for (const e of [delayed, late]) {
      const receipt = receipts.get(JSON.stringify(['WORLD', e.id]));
      expect(receipt).toMatchObject({ reason: 'COMBAT', breakdown: { weakTargetDebit: false } });
      expect(receipt!.delta).toBeGreaterThan(0);
    }
  });

  it('settles concurrent successes once and rejects a retry that changes the frozen galaxy maximum', async () => {
    const a = event('a', 1, 8), b = event('b', 1, 8);
    const initial = await Promise.allSettled([settle(a), settle(b)]);
    expect(initial.every(row => row.status === 'fulfilled')).toBe(true);
    const expected = replayHonor([a, b], 4);
    const before = await f.db.select().from(honorEvents);
    expect(before).toHaveLength(2);
    for (const row of before) expect(row.outcome).toEqual(expected.events.find(e => e.key === JSON.stringify(['WORLD', row.sourceId])));
    const retries = await Promise.allSettled([settle(a), settle(b)]);
    expect(retries.every(row => row.status === 'fulfilled' && row.value.status === 'REPLAYED')).toBe(true);
    await expect(settle({ ...a, galaxyTopTier: 9 })).rejects.toThrow('Conflicting Honor source replay');
    expect(await f.db.select().from(honorEvents)).toEqual(before);
  });

  it('does not persist a partial new-policy settlement when the source transaction rolls back', async () => {
    await expect(f.db.transaction(async tx => {
      await settleHonor(tx, f.seasonId, event('rollback', 1, 8));
      throw new Error('battle rollback');
    })).rejects.toThrow('battle rollback');
    expect(await f.db.select().from(honorEvents)).toHaveLength(0);
    expect(await f.db.select().from(honorTotals)).toHaveLength(0);
    const [config] = await f.db.select().from(honorSeasons).where(eq(honorSeasons.seasonId, f.seasonId));
    expect(config!.state.totals).toHaveLength(0);
  });

  it('leaves absent historical terms absent in canonical evidence but binds a new frozen term into its hash', () => {
    const legacy = event('hash', 1);
    expect(honorEvidenceHash(legacy, 4)).toBe(honorEvidenceHash({ ...legacy, galaxyTopTier: undefined }, 4));
    expect(honorEvidenceHash(legacy, 4)).not.toBe(honorEvidenceHash({ ...legacy, galaxyTopTier: 8 }, 4));
    expect(honorEvidenceHash({ ...legacy, galaxyTopTier: 8 }, 4))
      .not.toBe(honorEvidenceHash({ ...legacy, galaxyTopTier: 9 }, 4));
  });
});
