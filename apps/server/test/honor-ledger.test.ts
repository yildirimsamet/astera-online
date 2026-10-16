import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { seedWorld, testDb, type Fixture } from './helpers.js';
import { honorEvents, honorObservations, honorSeasons, honorTotals, players, seasons, shards } from '../src/db/schema.js';
import { prepareHonorSeason, settleHonor } from '../src/services/honorLedger.js';
import type { HonorEvidence } from '../src/services/honorAccounting.js';
import { honorTargetPreview } from '../src/services/honorTarget.js';
import * as streamBus from '../src/stream/bus.js';
import { giveUnits, setLevel } from './helpers.js';

describe('durable independent Honor journal', () => {
  let f: Fixture;
  beforeEach(async () => { f = await seedWorld(2, 7719); });
  afterAll(async () => { const { close } = await testDb(); await close(); });
  const evidence = (over: Partial<HonorEvidence> = {}): HonorEvidence => {
    const a = f.playerIds[0]!, d = f.playerIds[1]!;
    return { source: 'WORLD', id: randomUUID(), at: f.clock.now().getTime(), eligible: true,
      attack: [{ id: a, tier: 3, navy: 100_000, weight: 100_000, civilianWeight: 0, loss: 0, combatLoss: 0, lootLost: 0 }],
      defence: [{ id: d, tier: 3, navy: 100_000, weight: 100_000, civilianWeight: 0, loss: 1000, combatLoss: 1000, lootLost: 0 }],
      relations: [{ a, b: d, related: false }], ...over };
  };
  const enable = () => f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'SHADOW', f.clock));
  const settle = (e: HonorEvidence) => f.db.transaction(tx => settleHonor(tx, f.seasonId, e));

  it('initialises real existing owners once, so a newly enabled season has usable target guidance', async () => {
    for (const id of f.planetIds) await setLevel(f.db, id, 'CORE', 9);
    for (const id of f.planetIds) await giveUnits(f.db, id, { DART: 10 });
    await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'ACTIVE', f.clock));
    const observations = await f.db.select().from(honorObservations);
    expect(observations).toHaveLength(2);
    expect(observations.every(row => row.at.getTime() === f.clock.now().getTime() && row.coreTier === 3 && row.navy > 0)).toBe(true);
    expect(await honorTargetPreview(f.db, f.playerIds[0]!, f.planetIds[1]!, f.clock, new Set()))
      .toMatchObject({ enabled: true, eligible: true, kind: 'PEER', militaryReturn: 'FULL' });
    await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'ACTIVE', f.clock));
    expect(await f.db.select().from(honorObservations)).toEqual(observations);
    expect(await f.db.select().from(honorTotals)).toHaveLength(0);
    expect(await f.db.select().from(honorEvents)).toHaveLength(0);
  });

  it('rolls initial samples back atomically and concurrent activation creates them only once', async () => {
    await expect(f.db.transaction(async tx => {
      await prepareHonorSeason(tx, f.seasonId, 'ACTIVE', f.clock);
      throw new Error('activation failed');
    })).rejects.toThrow('activation failed');
    expect(await f.db.select().from(honorSeasons)).toHaveLength(0);
    expect(await f.db.select().from(honorObservations)).toHaveLength(0);
    await Promise.all([f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'ACTIVE', f.clock)),
      f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'ACTIVE', f.clock))]);
    expect(await f.db.select().from(honorSeasons)).toHaveLength(1);
    expect(await f.db.select().from(honorObservations)).toHaveLength(2);
  });

  it('starts existing-season shadow history now without inventing pre-activation references', async () => {
    const past = f.clock.now();
    f.clock.advance(1);
    await enable();
    const { honorOwnerReference } = await import('../src/services/honorReference.js');
    await expect(honorOwnerReference(f.db, f.seasonId, f.playerIds[0]!, past)).rejects.toThrow('Missing Honor reference history');
    expect(await honorOwnerReference(f.db, f.seasonId, f.playerIds[0]!, f.clock.now()))
      .toMatchObject({ tier: 1, navy: 0 });
  });

  it('publishes the first visible receipt to both participants, even without a gameplay notification, but not on retry', async () => {
    await f.db.transaction(tx=>prepareHonorSeason(tx,f.seasonId,'ACTIVE',f.clock));
    const e=evidence();
    const spy=vi.spyOn(streamBus,'publish');
    try {
      await settle(e);
      expect(spy.mock.calls.filter(row=>row[2]==='private:honor').map(row=>row[1]).sort()).toEqual([...f.playerIds].sort());
      spy.mockClear();await settle(e);
      expect(spy.mock.calls.filter(row=>row[2]==='private:honor')).toHaveLength(0);
    } finally {spy.mockRestore();}
  });

  it('legacy seasons write no Honor, and creating shadow state does not activate a live score', async () => {
    expect(await settle(evidence())).toEqual({ status: 'DISABLED' });
    expect(await f.db.select().from(honorEvents)).toHaveLength(0);
    await enable();
    const [config] = await f.db.select().from(honorSeasons).where(eq(honorSeasons.seasonId, f.seasonId));
    expect(config?.mode).toBe('SHADOW');
    expect(config?.version).toBe(3);
  });

  it('books both sides and pair state atomically without changing Dominion counters', async () => {
    await enable();
    const before = await f.db.select().from(players);
    const e = evidence();
    expect((await settle(e)).status).toBe('APPLIED');
    expect(await f.db.select().from(players)).toEqual(before);
    expect(await f.db.select().from(honorEvents)).toHaveLength(1);
    const totals = await f.db.select().from(honorTotals);
    expect(totals.find(r => r.playerId === f.playerIds[0])?.score).toBe(995_024);
    expect(totals.find(r => r.playerId === f.playerIds[1])?.score).toBe(0);
  });

  it('concurrent duplicate deliveries award exactly once and return the same receipt', async () => {
    await enable(); const e = evidence();
    const results = await Promise.all([settle(e), settle(e)]);
    expect(results.map(r => r.status).sort()).toEqual(['APPLIED', 'REPLAYED']);
    expect(await f.db.select().from(honorEvents)).toHaveLength(1);
    const [total] = await f.db.select().from(honorTotals).where(eq(honorTotals.playerId, f.playerIds[0]!));
    expect(total?.score).toBe(995_024);
  });

  it('serialises different concurrent battles sharing the same pair without losing credit', async () => {
    await enable(); const first = evidence(), second = evidence({ at: first.at + 1 });
    await Promise.all([settle(first), settle(second)]);
    expect(await f.db.select().from(honorEvents)).toHaveLength(2);
    const [total] = await f.db.select().from(honorTotals).where(eq(honorTotals.playerId, f.playerIds[0]!));
    expect(total?.score).toBe(1_980_198);
  });

  it('conflicting repeated source evidence fails without mutating any projection', async () => {
    await enable(); const e = evidence(); await settle(e);
    const before = await f.db.select().from(honorTotals);
    await expect(settle({ ...e, eligible: false })).rejects.toThrow('Conflicting Honor');
    expect(await f.db.select().from(honorTotals)).toEqual(before);
  });

  it('accepts a replay whose equivalent participant and relationship query order changed', async () => {
    await enable();
    const e = evidence();
    const owner = e.attack[0]!;
    e.attack = [{ ...owner, weight: 40_000 }, { ...owner, weight: 60_000 }];
    await settle(e);
    const replay = await settle({ ...e, attack: [...e.attack].reverse(), relations: [...e.relations].reverse() });
    expect(replay.status).toBe('REPLAYED');
    expect(await f.db.select().from(honorEvents)).toHaveLength(1);
  });

  it('a later failure rolls back source, pair budget and personal scores together', async () => {
    await enable();
    await expect(f.db.transaction(async tx => {
      await settleHonor(tx, f.seasonId, evidence()); throw new Error('later write failed');
    })).rejects.toThrow('later write failed');
    expect(await f.db.select().from(honorEvents)).toHaveLength(0);
    expect(await f.db.select().from(honorTotals)).toHaveLength(0);
  });

  it('a delayed event rebuilds earlier receipts and final totals in effective order', async () => {
    await enable(); const first = evidence(), second = evidence({ at: first.at + 1 });
    await settle(second);
    expect((await settle(first)).status).toBe('REBUILT');
    const [total] = await f.db.select().from(honorTotals).where(eq(honorTotals.playerId, f.playerIds[0]!));
    expect(total?.score).toBe(1_980_198);
    const [early] = await f.db.select().from(honorEvents).where(eq(honorEvents.sourceId, first.id));
    const [late] = await f.db.select().from(honorEvents).where(eq(honorEvents.sourceId, second.id));
    expect(early?.outcome.attack.total).toBe(995_024);
    expect(late?.outcome.attack.total).toBe(985_174);
    const replay = await settle(second);
    expect(replay.status).toBe('REPLAYED');
    if (replay.status !== 'DISABLED') expect(replay.receipt.attack.total).toBe(985_174);
  });

  it('sources with identical ids remain distinct; canonical evidence ignores object property order', async () => {
    await enable(); const first = evidence(); await settle(first);
    const { id, ...rest } = first;
    expect((await settle({ ...rest, id })).status).toBe('REPLAYED');
    await settle({ ...first, source: 'MONUMENT', at: first.at + 1 });
    expect(await f.db.select().from(honorEvents)).toHaveLength(2);
  });

  it('rejects wrong season identities, missing relationships and out-of-season timestamps', async () => {
    await enable(); const first = evidence();
    await expect(settle({ ...first, at: 0 })).rejects.toThrow();
    await expect(settle({ ...first, relations: [] })).rejects.toThrow();
    await expect(settle({ ...first, attack: [{ ...first.attack[0]!, id: randomUUID() }] })).rejects.toThrow();
    expect(await f.db.select().from(honorEvents)).toHaveLength(0);
  });

  it('a sealed season cannot take a fresh event but still permits exact replay', async () => {
    await enable(); const first = evidence(); await settle(first);
    await f.db.update(honorSeasons).set({ closedAt: f.clock.now() }).where(eq(honorSeasons.seasonId, f.seasonId));
    expect((await settle(first)).status).toBe('REPLAYED');
    await expect(settle(evidence())).rejects.toThrow('sealed');
    expect(await f.db.select().from(honorEvents).where(and(eq(honorEvents.seasonId, f.seasonId), eq(honorEvents.sourceId, first.id)))).toHaveLength(1);
  });
  it('hashes selected target order canonically and refuses a changed target exemption on replay', async () => {
    await enable();
    const first = { ...evidence(), selectedDefenders: [f.playerIds[1]!, 'departed-target'] };
    await settle(first);
    expect((await settle({ ...first, selectedDefenders: [...first.selectedDefenders].reverse() })).status).toBe('REPLAYED');
    await expect(settle({ ...first, selectedDefenders: [] })).rejects.toThrow('Conflicting Honor');
  });
  it('refuses ranked activation in a waiting galaxy or a completed season', async () => {
    const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    await f.db.update(shards).set({ role: 'WAITING' }).where(eq(shards.id, season!.shardId));
    await expect(f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'ACTIVE', f.clock))).rejects.toThrow('main galaxy');
    expect(await f.db.select().from(honorSeasons)).toHaveLength(0);
    await f.db.update(shards).set({ role: 'MAIN' }).where(eq(shards.id, season!.shardId));
    await f.db.update(seasons).set({ status: 'frozen' }).where(eq(seasons.id, f.seasonId));
    await expect(f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'ACTIVE', f.clock))).rejects.toThrow('live season');
    expect(await f.db.select().from(honorSeasons)).toHaveLength(0);
  });
});
