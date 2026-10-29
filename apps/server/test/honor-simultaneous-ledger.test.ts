import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { honorCommitments, honorEvents, honorSeasons, honorTotals } from '../src/db/schema.js';
import { openHonorRanking } from '../src/services/honorActivation.js';
import { prepareHonorSeason, settleHonor } from '../src/services/honorLedger.js';
import { deferHonor } from '../src/services/honorDeferred.js';
import { sealHonor } from '../src/services/honorSeason.js';
import { commitHonor, worldHonorCommitment, monumentHonorCommitment } from '../src/services/honorCommitment.js';
import type { HonorEvidence } from '../src/services/honorAccounting.js';
import { seedWorld, testDb, type Fixture } from './helpers.js';

describe('candidate simultaneous accounting in a real shadow journal', () => {
  let f: Fixture;
  beforeEach(async () => { f = await seedWorld(2, 24017); });
  afterAll(async () => { await (await testDb()).close(); });
  const enable = (version: 1 | 2 | 4 = 2) => f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'SHADOW', f.clock, version));
  const event = (id: string, reverse = false, weak = false, loss = 100000, at = f.clock.now().getTime()): HonorEvidence => {
    const a = f.playerIds[reverse ? 1 : 0]!, d = f.playerIds[reverse ? 0 : 1]!;
    const member = (id: string, tier = 3, navy = 100000) => ({ id, tier, navy, weight: 10000,
      civilianWeight: 0, loss: 0, combatLoss: 0, lootLost: 0 });
    return { source: 'WORLD', id, at, eligible: true, attack: [member(a)],
      defence: [{ ...member(d, weak ? 2 : 3, weak ? 50000 : 100000), loss, combatLoss: loss }],
      relations: [{ a, b: d, related: false }] };
  };
  const settle = (e: HonorEvidence) => f.db.transaction(tx => settleHonor(tx, f.seasonId, e));
  const score = async (index: number) => (await f.db.select().from(honorTotals)
    .where(eq(honorTotals.playerId, f.playerIds[index]!)))[0]?.score ?? 0;

  it.each([false, true])('gives equivalent simultaneous opposing successes equal shares, reversed insert: %s', async reverse => {
    await enable();
    const rows = [event('a'), event('z', true)];
    if (reverse) rows.reverse();
    await settle(rows[0]!);
    expect((await settle(rows[1]!)).status).toBe('REBUILT');
    expect(await score(0)).toBe(50_000_000);
    expect(await score(1)).toBe(50_000_000);
    const events = await f.db.select().from(honorEvents);
    expect(events).toHaveLength(2);
    expect(events.every(row => row.outcome.attack.total === 50_000_000)).toBe(true);
  });

  it('settles real concurrent delivery, retry and a conflicting retry atomically', async () => {
    await enable();
    const a = event('a'), b = event('z', true);
    await Promise.all([settle(a), settle(b)]);
    expect(await score(0)).toBe(50_000_000);
    expect(await score(1)).toBe(50_000_000);
    const before = await f.db.select().from(honorEvents);
    await Promise.all([settle(a), settle(b)]);
    expect(await f.db.select().from(honorEvents)).toEqual(before);
    await expect(settle({ ...a, eligible: false })).rejects.toThrow('Conflicting Honor source replay');
    expect(await f.db.select().from(honorEvents)).toEqual(before);
  });

  it.each([false, true])('removes lucky source ordering from unequal weak pressure, reversed id: %s', async reverse => {
    await enable();
    await settle(event(reverse ? 'z' : 'a', false, true, 1000));
    await settle(event(reverse ? 'a' : 'z', false, true, 10000));
    expect(await score(0)).toBe(-3_437_500);
    expect(await score(1)).toBe(0);
    const [config] = await f.db.select().from(honorSeasons);
    expect(config?.state.repeats).toHaveLength(2);
    await settle(event('later', false, true, 1000, f.clock.now().getTime() + 1));
    expect(await score(0)).toBe(-3_937_500);
  });

  it('rebuilds later dependent credits when an earlier simultaneous opponent arrives late', async () => {
    await enable();
    const at = f.clock.now().getTime();
    await settle(event('a'));
    await settle(event('later', false, false, 100000, at + 1));
    await settle(event('z', true));
    expect(await score(0)).toBe(70_000_000);
    expect(await score(1)).toBe(50_000_000);
    const [later] = (await f.db.select().from(honorEvents)).filter(row => row.sourceId === 'later');
    expect(later?.outcome.attack.total).toBe(20_000_000);
  });

  it('flushes the simultaneous closing group before sealing and awards no candidate prizes', async () => {
    await enable();
    const rewards = await f.db.transaction(async tx => {
      deferHonor(tx, f.seasonId, event('a'));
      deferHonor(tx, f.seasonId, event('z', true));
      return sealHonor(tx, { seasonId: f.seasonId, at: f.clock.now(), playerIds: f.playerIds });
    });
    expect(rewards).toBeNull();
    expect(await score(0)).toBe(50_000_000);
    expect(await score(1)).toBe(50_000_000);
    expect((await f.db.select().from(honorSeasons))[0]?.closedAt).toEqual(f.clock.now());
    expect((await settle(event('a'))).status).toBe('REPLAYED');
    await expect(settle(event('new'))).rejects.toThrow('Honor season is sealed');
  });

  it('freezes and parses version-2 launch intentions without silently changing an existing catalogue', async () => {
    await enable();
    await f.db.transaction(tx => commitHonor(tx, { seasonId: f.seasonId, source: 'WORLD', id: 'actual-intent',
      attack: [f.playerIds[0]!], defence: [f.playerIds[1]!], at: f.clock.now(), adminUsernames: new Set() }));
    expect((await f.db.select().from(honorCommitments))[0]?.snapshot.version).toBe(2);
    await expect(enable(1)).rejects.toThrow('Honor season configuration is immutable');
  });

  it('keeps version 1 accounting and the default catalogue unchanged', async () => {
    await enable(1);
    await settle(event('a'));
    expect((await settle(event('z', true))).status).toBe('APPLIED');
    expect(await score(0)).toBe(66_666_666);
    expect(await score(1)).toBe(33_333_334);
    expect((await f.db.select().from(honorSeasons))[0]?.version).toBe(1);
  });

  it.each(['WORLD', 'MONUMENT'] as const)('refuses a launch contract from another frozen policy, source %s', async source => {
    await enable();
    const input = { seasonId: f.seasonId, source, id: 'version-conflict',
      attack: [f.playerIds[0]!], defence: [f.playerIds[1]!], at: f.clock.now(), adminUsernames: new Set<string>() };
    const frozen = await f.db.transaction(tx => commitHonor(tx, input));
    await f.db.update(honorCommitments).set({ snapshot: { ...frozen!, version: 1 } });
    await expect(f.db.transaction(tx => commitHonor(tx, input))).rejects.toThrow('Conflicting Honor commitment version');
    if (source === 'WORLD') await expect(f.db.transaction(tx => worldHonorCommitment(tx, {
      seasonId: f.seasonId, missionId: input.id, host: f.playerIds[1]!, supporters: [], adminUsernames: new Set() })))
      .rejects.toThrow('Conflicting Honor commitment version');
    else await expect(f.db.transaction(tx => monumentHonorCommitment(tx, {
      seasonId: f.seasonId, sourceId: input.id, defence: input.defence, at: f.clock.now(), adminUsernames: new Set() })))
      .rejects.toThrow('Conflicting Honor commitment version');
    expect(await f.db.select().from(honorEvents)).toHaveLength(0);
  });

  it.each([false, true])('v4 keeps same-time grouping before and after ranked opening, reverse %s', async reverse => {
    await enable(4);
    const events = [event('a'), event('z', true)];
    if (reverse) events.reverse();
    await settle(events[0]!);
    expect((await settle(events[1]!)).status).toBe('REBUILT');
    expect(await score(0)).toBe(50_000_000);
    expect(await score(1)).toBe(50_000_000);
    f.clock.advance(2 * 24 * 60);
    await openHonorRanking(f.db, { seasonId: f.seasonId, clock: f.clock, apply: true });
    expect(await f.db.select().from(honorTotals)).toHaveLength(0);
    const ranked = [event('ranked-a'), event('ranked-z', true)];
    if (reverse) ranked.reverse();
    await settle(ranked[0]!);
    expect((await settle(ranked[1]!)).status).toBe('REBUILT');
    expect(await score(0)).toBe(50_000_000);
    expect(await score(1)).toBe(50_000_000);
    expect((await f.db.select().from(honorEvents)).filter(row => row.ranked)).toHaveLength(2);
  });

  it('cannot accidentally announce the unfinished candidate as an ACTIVE season rule', async () => {
    await expect(f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'ACTIVE', f.clock, 2)))
      .rejects.toThrow('Candidate Honor requires shadow mode');
    expect(await f.db.select().from(honorSeasons)).toHaveLength(0);
  });
});
