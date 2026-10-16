import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prepareHonorSeason, settleHonor } from '../src/services/honorLedger.js';
import { readHonorReceipts } from '../src/services/honorReports.js';
import { seedWorld, testDb, type Fixture } from './helpers.js';
import type { HonorEvidence } from '../src/services/honorAccounting.js';

describe('player-visible Honor receipts', () => {
  let f: Fixture;
  beforeEach(async () => { f = await seedWorld(3, 7719); });
  afterAll(async () => { await (await testDb()).close(); });
  const event = (over: Partial<HonorEvidence> = {}): HonorEvidence => ({
    source: 'WORLD', id: randomUUID(), at: f.clock.now().getTime(), eligible: true,
    attack: [{ id: f.playerIds[0]!, tier: 3, navy: 100_000, weight: 100_000, civilianWeight: 0, loss: 0, combatLoss: 0, lootLost: 0 }],
    defence: [{ id: f.playerIds[1]!, tier: 3, navy: 100_000, weight: 100_000, civilianWeight: 0, loss: 1000, combatLoss: 1000, lootLost: 0 }],
    relations: [{ a: f.playerIds[0]!, b: f.playerIds[1]!, related: false }], ...over,
  });
  const book = async (e: HonorEvidence, mode: 'ACTIVE' | 'SHADOW' = 'ACTIVE', version: 1 | 3 = 3) => {
    await f.db.transaction(async tx => { await prepareHonorSeason(tx, f.seasonId, mode, f.clock, version); await settleHonor(tx, f.seasonId, e); });
  };
  const read = (e: HonorEvidence, playerId = f.playerIds[0]!) => f.db.transaction(tx => readHonorReceipts(tx, playerId, [e]));

  it('publishes only the reader’s credited share, without private military references', async () => {
    const e = event(); await book(e);
    const receipts = await read(e);
    expect(receipts.get(JSON.stringify([e.source, e.id]))).toMatchObject({ delta: 995_024, reason: 'COMBAT' });
    expect(JSON.stringify([...receipts])).not.toMatch(/navy|tier|accountId|weight|evidence/);
    expect((await read(e, f.playerIds[1])).get(JSON.stringify([e.source, e.id]))).toMatchObject({ delta: 0, reason: 'NO_GAIN' });
    expect((await read(e, f.playerIds[2])).size).toBe(0);
  });

  it('keeps shadow and missing historical receipts absent instead of inventing zero', async () => {
    const e = event(); await book(e, 'SHADOW');
    expect((await read(e)).size).toBe(0);
    expect((await read({ ...e, id: randomUUID() })).size).toBe(0);
  });

  it('explains the weak-target debit and preserves the innocent defender’s zero', async () => {
    const base = event(); const e = event({ attack: [{ ...base.attack[0]!, tier: 4, navy: 200_000 }] });
    await book(e);
    expect((await read(e)).get(JSON.stringify([e.source, e.id]))).toMatchObject({ delta: -250_000, reason: 'WEAK_TARGET' });
    expect((await read(e, f.playerIds[1])).get(JSON.stringify([e.source, e.id]))?.delta).toBe(0);
  });

  it('reports an explicit changed-target exclusion without a fabricated combat result', async () => {
    const e = event({ eligible: false, exclusion: 'TARGET_CHANGED' }); await book(e);
    expect((await read(e)).get(JSON.stringify([e.source, e.id]))).toEqual({ delta: 0, reason: 'TARGET_CHANGED' });
  });

  it('reads rebuilt credits rather than stale per-battle copies', async () => {
    const early = event(), late = event({ at: early.at + 1 });
    await book(late);
    await f.db.transaction(tx => settleHonor(tx, f.seasonId, early));
    expect((await read(late)).get(JSON.stringify([late.source, late.id]))?.delta).toBe(985_174);
  });
  it('preserves historical shared-side reports without relabelling old positive credit', async () => {
    const base = event();
    const e = event({ attack: [{ ...base.attack[0]!, weight: 100 }, { ...base.attack[0]!, id: f.playerIds[2]!, weight: 300 }],
      relations: [f.playerIds[0]!, f.playerIds[2]!].map(a => ({ a, b: f.playerIds[1]!, related: false })) });
    await book(e, 'ACTIVE', 1);
    const first = (await read(e)).get(JSON.stringify([e.source, e.id]));
    const second = (await read(e, f.playerIds[2])).get(JSON.stringify([e.source, e.id]));
    expect(first).toMatchObject({ breakdown: { participants: 2, contributionPpm: 250_000,
      militaryDamage: 1000, permanentLoss: 0, rawTeamDelta: 1_000_000 } });
    expect(second).toMatchObject({ breakdown: { participants: 2, contributionPpm: 750_000 } });
    expect(first?.breakdown?.teamDelta).toBe((first?.delta ?? 0) + (second?.delta ?? 0));
    expect(second?.breakdown?.teamDelta).toBe(first?.breakdown?.teamDelta);
  });
  it('does not hide a weak-target debit inside a net-positive common result', async () => {
    const base = event();
    const e = event({ defence: [{ ...base.defence[0]!, loss: 10_000, combatLoss: 10_000 },
      { ...base.defence[0]!, id: f.playerIds[2]!, tier: 2, navy: 20_000, loss: 100, combatLoss: 100 }],
      relations: [f.playerIds[1]!, f.playerIds[2]!].map(b => ({ a: f.playerIds[0]!, b, related: false })) });
    await book(e);
    const receipt = (await read(e)).get(JSON.stringify([e.source, e.id]));
    expect(receipt?.delta).toBeGreaterThan(0);
    expect(receipt?.breakdown?.weakTargetDebit).toBe(true);
  });
  it('does not describe unselected weak support as bullying after the approved exemption', async () => {
    const base = event();
    const e = event({ selectedDefenders: [f.playerIds[1]!], defence: [{ ...base.defence[0]!, loss: 1000, combatLoss: 1000 },
      { ...base.defence[0]!, id: f.playerIds[2]!, tier: 2, navy: 20_000, loss: 1000, combatLoss: 1000 }],
      relations: [f.playerIds[1]!, f.playerIds[2]!].map(b => ({ a: f.playerIds[0]!, b, related: false })) });
    await book(e);
    expect((await read(e)).get(JSON.stringify([e.source, e.id])))
      .toMatchObject({ reason: 'COMBAT', breakdown: { weakTargetDebit: false } });
  });


it('keeps an already earned battle receipt readable when its owner moves to Silent Space',async()=>{
  const f=await seedWorld(2,7719);
  await f.db.transaction(tx=>prepareHonorSeason(tx,f.seasonId,'ACTIVE',f.clock));
  const m=(id:string,loss=0)=>({id,tier:3,navy:100000,weight:100000,civilianWeight:0,loss,combatLoss:loss,lootLost:0});
  const e:HonorEvidence={source:'WORLD',id:randomUUID(),at:f.clock.now().getTime(),eligible:true,
    attack:[m(f.playerIds[0]!)],defence:[m(f.playerIds[1]!,1000)],relations:[{a:f.playerIds[0]!,b:f.playerIds[1]!,related:false}]};
  await f.db.transaction(tx=>settleHonor(tx,f.seasonId,e));
  const before=await f.db.transaction(tx=>readHonorReceipts(tx,f.playerIds[0]!,[e]));
  const {ensureWaitingSeason}=await import('../src/services/waitingServers.js');
  const {transferCommander}=await import('../src/services/commanderTransfer.js');
  const waiting=await ensureWaitingSeason(f.db,f.seasonId,f.clock);
  expect((await transferCommander(f.db,f.playerIds[0]!,waiting!.id,f.clock,undefined,{ownerRequested:true})).status).toBe('MOVED');
  expect(await f.db.transaction(tx=>readHonorReceipts(tx,f.playerIds[0]!,[e]))).toEqual(before);
});

});
