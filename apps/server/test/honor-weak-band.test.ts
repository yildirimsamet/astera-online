import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { honorCommitments, honorSeasons } from '../src/db/schema.js';
import { commitHonor, honorCommitmentSchema } from '../src/services/honorCommitment.js';
import { honorBattleEvidence } from '../src/services/honorBattleEvidence.js';
import { honorEvidenceSchema, honorStateSchema, replayHonor, type HonorEvidence } from '../src/services/honorAccounting.js';
import { honorEvidenceHash, prepareHonorSeason, settleHonor } from '../src/services/honorLedger.js';
import { readHonorReceipts } from '../src/services/honorReports.js';
import { strategicHonorEvidence } from '../src/services/honorStrategic.js';
import { honorTargetPreview } from '../src/services/honorTarget.js';
import { launchAttack } from '../src/services/mission.js';
import { giveUnits, fuelUp, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

afterAll(async () => { await (await testDb()).close(); });

// Owner 2026-10-30: a lower-tier target is weak only below 75 % of the attacker's
// navy. Frozen at dispatch so historical battles keep their original result.
describe('weak-target navy band frozen with Honor dispatch', () => {
  let f: Fixture;
  beforeEach(async () => {
    f = await seedWorld(3, 7719);
    await setLevel(f.db, f.planetIds[0]!, 'CORE', 10); // tier 4
    await setLevel(f.db, f.planetIds[1]!, 'CORE', 9); // tier 3
    await setLevel(f.db, f.planetIds[2]!, 'CORE', 13); // tier 5: no galaxy-leader exception
    await giveUnits(f.db, f.planetIds[0]!, { DART: 100 });
    await giveUnits(f.db, f.planetIds[1]!, { DART: 80 });
    await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'SHADOW', f.clock, 4));
    await f.db.update(honorSeasons).set({ mode: 'ACTIVE', rankedAt: f.clock.now() });
  });
  const preview = () => honorTargetPreview(f.db, f.playerIds[0]!, f.planetIds[1]!, f.clock, new Set());
  const request = () => ({ seasonId: f.seasonId, source: 'WORLD' as const, id: randomUUID(),
    attack: [f.playerIds[0]!], defence: [f.playerIds[1]!], at: f.clock.now(), adminUsernames: new Set<string>() });

  it('previews a near-equal lower tier as a peer and a much smaller one as weak', async () => {
    expect(await preview()).toMatchObject({ kind: 'PEER', militaryReturn: 'FULL' });
    await giveUnits(f.db, f.planetIds[0]!, { DART: 120 }); // 80 / 120 < 75 %
    expect(await preview()).toMatchObject({ kind: 'WEAK' });
  });

  it('freezes the band on the actual raid and keeps it on retry', async () => {
    await fuelUp(f.db, f.planetIds[0]!);
    const launch = await launchAttack(f.db, f.planetIds[0]!, f.planetIds[1]!, { DART: 5 }, f.clock);
    const [row] = await f.db.select().from(honorCommitments).where(eq(honorCommitments.sourceId, launch.missionId));
    expect(row?.snapshot).toMatchObject({ weakNavyBand: 75 });
    expect(await f.db.transaction(tx => commitHonor(tx, { ...request(), id: launch.missionId }))).toEqual(row!.snapshot);
  });

  it('carries the band into military and strategic evidence; legacy evidence keeps the old sanction', async () => {
    const frozen = await f.db.transaction(tx => commitHonor(tx, request()));
    if (!frozen) throw new Error('Missing commitment');
    const [config] = await f.db.select().from(honorSeasons);
    const stack = (id: string, losses: number) => ({ id, sent: { DART: 5 }, active: { DART: 5 },
      losses: { DART: losses }, rebuilt: {}, lootLost: { alloy: 0, crystal: 0, deuterium: 0 }, defenceNavy: frozen.defence[0]!.navy });
    const military = honorBattleEvidence({ catalogue: config!.catalogue, commitment: frozen,
      source: 'WORLD', id: 'military', at: frozen.at + 1,
      attack: [stack(f.playerIds[0]!, 1)], defence: [stack(f.playerIds[1]!, 4)] });
    const strategic = strategicHonorEvidence(frozen, 'strategic', new Date(frozen.at + 2));
    expect(military).toMatchObject({ weakNavyBand: 75 });
    expect(strategic).toMatchObject({ weakNavyBand: 75 });
    const result = replayHonor([military], 4);
    expect(result.events[0]!.pool.attack.exposures[0]!.bullying).toBe(false);
    expect(result.events[0]!.attack.total).toBeGreaterThan(0);
    const { weakNavyBand: _band, ...legacy } = honorEvidenceSchema.parse(military);
    expect(replayHonor([legacy], 4).events[0]!.pool.attack.exposures[0]!.bullying).toBe(true);
    expect(replayHonor([legacy], 4).events[0]!.pool.defence).toEqual(result.events[0]!.pool.defence);
  });

  it('keeps the digest of historical evidence unchanged', () => {
    const legacy: HonorEvidence = { source: 'WORLD', id: 'old', at: 1, eligible: true,
      attack: [{ id: 'A', tier: 4, navy: 100, weight: 100, civilianWeight: 0, loss: 0, combatLoss: 0, lootLost: 0 }],
      defence: [{ id: 'D', tier: 3, navy: 80, weight: 80, civilianWeight: 0, loss: 10, combatLoss: 10, lootLost: 0 }],
      relations: [{ a: 'A', b: 'D', related: false }] };
    expect(honorEvidenceSchema.parse(legacy)).not.toHaveProperty('weakNavyBand');
    expect(honorEvidenceHash(legacy, 4)).toBe(honorEvidenceHash(honorEvidenceSchema.parse(legacy), 4));
    expect(honorEvidenceHash({ ...legacy, weakNavyBand: 75 }, 4)).not.toBe(honorEvidenceHash(legacy, 4));
  });

  it('rejects malformed bands in commitments and evidence', () => {
    const base = { version: 4, at: 1, referenceOrder: 0, eligible: true,
      attack: [{ id: 'A', tier: 4, navy: 100 }], defence: [{ id: 'D', tier: 3, navy: 80 }],
      relations: [{ a: 'A', b: 'D', related: false }] };
    expect(honorCommitmentSchema.parse(base)).not.toHaveProperty('weakNavyBand');
    for (const weakNavyBand of [0, 50, 74, 76, 100, '75', null]) {
      expect(() => honorCommitmentSchema.parse({ ...base, weakNavyBand })).toThrow();
    }
  });

  it('mentions a retaliation right only where it can neutralise a weak-target sanction', async () => {
    const [config] = await f.db.select().from(honorSeasons);
    const state = honorStateSchema.parse(config!.state);
    await f.db.update(honorSeasons).set({ state: { ...state, retaliations: [{ holder: f.playerIds[0]!,
      opponent: f.playerIds[1]!, at: f.clock.now().getTime() - 1000, remaining: 5000, sourceKey: '["WORLD","x"]' }] } });
    expect(await preview()).toMatchObject({ kind: 'PEER', retaliation: false });
    await giveUnits(f.db, f.planetIds[0]!, { DART: 120 }); // 80 / 120 < 75 %
    expect(await preview()).toMatchObject({ kind: 'WEAK', retaliation: true });
  });
});

describe('Honor receipts name the military band behind a zero', () => {
  let f: Fixture;
  beforeEach(async () => { f = await seedWorld(3, 7719); });
  const event = (defenceNavy: number, combatLoss: number): HonorEvidence => ({
    source: 'WORLD', id: randomUUID(), at: f.clock.now().getTime(), eligible: true, weakNavyBand: 75,
    attack: [{ id: f.playerIds[0]!, tier: 3, navy: 37_097, weight: 29_321, civilianWeight: 0, loss: 0, combatLoss: 0, lootLost: 0 }],
    defence: [{ id: f.playerIds[1]!, tier: 4, navy: defenceNavy, defenceNavy, weight: 7_044, civilianWeight: 0,
      loss: combatLoss, combatLoss, lootLost: 7_174 }],
    relations: [{ a: f.playerIds[0]!, b: f.playerIds[1]!, related: false }],
  });
  const book = async (e: HonorEvidence) => {
    await f.db.transaction(async tx => { await prepareHonorSeason(tx, f.seasonId, 'ACTIVE', f.clock, 4); await settleHonor(tx, f.seasonId, e); });
  };
  const read = async (e: HonorEvidence, playerId = f.playerIds[0]!) =>
    (await f.db.transaction(tx => readHonorReceipts(tx, playerId, [e]))).get(JSON.stringify([e.source, e.id]));

  it('explains that a genuine kill against a much smaller navy pays nothing', async () => {
    const e = event(8_052, 1_800); await book(e);
    expect(await read(e)).toMatchObject({ delta: 0, reason: 'NO_GAIN', breakdown: { militaryDamage: 1_800, militaryReturn: 'NONE' } });
  });

  it('names a reduced band beside a positive result', async () => {
    const e = event(18_549, 1_800); await book(e);
    expect(await read(e)).toMatchObject({ reason: 'COMBAT', breakdown: { militaryReturn: 'HALF' } });
    expect((await read(e))!.delta).toBeGreaterThan(0);
  });

  it('omits the band where the reason already explains the result', async () => {
    const related = event(18_549, 1_800);
    related.relations = [{ a: f.playerIds[0]!, b: f.playerIds[1]!, related: true }];
    await book(related);
    expect(await read(related)).toMatchObject({ reason: 'RELATED' });
    expect((await read(related))!.breakdown).not.toHaveProperty('militaryReturn');
  });

  it('omits the band when nothing armed was destroyed', async () => {
    const e = event(8_052, 0); await book(e);
    expect((await read(e))!.breakdown).not.toHaveProperty('militaryReturn');
  });

  it('omits the band for a defender that destroyed nothing, and never exposes navy figures', async () => {
    const e = event(8_052, 1_800); await book(e);
    const receipt = await read(e, f.playerIds[1]);
    expect(receipt!.breakdown).not.toHaveProperty('militaryReturn');
    expect(JSON.stringify(receipt)).not.toMatch(/navy|tier|weight|evidence/);
  });
});
