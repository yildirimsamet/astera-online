import { randomUUID } from 'node:crypto';
import { afterAll, expect, it } from 'vitest';
import { honorEvents, honorSeasons } from '../src/db/schema.js';
import { prepareHonorSeason, honorEvidenceHash } from '../src/services/honorLedger.js';
import { advanceHonor, emptyHonorState, type HonorEvidence } from '../src/services/honorAccounting.js';
import { readHonorReceipts } from '../src/services/honorReports.js';
import { seedWorld, testDb } from './helpers.js';
import { honorReceiptSchema } from '../../web/src/api/schemas.js';
afterAll(async () => { await (await testDb()).close(); });
it('a visible tactical receipt explains real preparation without claiming permanent military casualties', async () => {
  const f = await seedWorld(2,7719);
  await f.db.transaction(tx => prepareHonorSeason(tx,f.seasonId,'SHADOW',f.clock,4));
  const m = (id:string) => ({id,tier:4,navy:100000,weight:100000,civilianWeight:0,loss:0,combatLoss:0,lootLost:0});
  const e:HonorEvidence = {source:'STRATEGIC_IMPACT',id:randomUUID(),at:f.clock.now().getTime(),eligible:true,
    attack:[m(f.playerIds[0]!)],defence:[m(f.playerIds[1]!)],relations:[{a:f.playerIds[0]!,b:f.playerIds[1]!,related:false}],
    tactical:[{actor:f.playerIds[0]!,enemy:f.playerIds[1]!,base:1000000,pressureFifths:40000}]};
  const outcome = advanceHonor(emptyHonorState(),e,4).event;
  // Reader fixture for the future ACTIVE projection; no candidate writer is enabled.
  await f.db.update(honorSeasons).set({mode:'ACTIVE',rankedAt:f.clock.now()});
  await f.db.insert(honorEvents).values({seasonId:f.seasonId,source:e.source,sourceId:e.id,at:f.clock.now(),ranked:true,
    evidence:e,evidenceHash:honorEvidenceHash(e,4),outcome});
  const receipts = await f.db.transaction(tx => readHonorReceipts(tx,f.playerIds[0]!,[e]));
  const receipt = receipts.values().next().value;
  expect(receipt?.reason).toBe('TACTICAL');
  expect(receipt?.breakdown?.tactical).toBe(true);
  expect(honorReceiptSchema.parse(receipt)).toMatchObject({reason:'TACTICAL'});
  expect(JSON.stringify(receipt)).not.toMatch(/navy|armedMicros|allMicros/);
});
it('aggregates a radiation bomb receipt across intervals without exposing raw HP or double-counting participants', async () => {
  const f = await seedWorld(3,7719);
  await f.db.transaction(tx => prepareHonorSeason(tx,f.seasonId,'SHADOW',f.clock,4));
  const m = (id:string) => ({id,tier:4,navy:100000,weight:100000,civilianWeight:0,loss:0,combatLoss:0,lootLost:0});
  const e:HonorEvidence = {source:'STRATEGIC_IMPACT',id:'slice:one',at:f.clock.now().getTime(),eligible:true,
    attack:[m(f.playerIds[0]!)],defence:[m(f.playerIds[1]!)],relations:[{a:f.playerIds[0]!,b:f.playerIds[1]!,related:false}],
    attackKey:'bomb:one',tacticalCap:{id:'bomb:one',limit:2500000},
    tactical:[{actor:f.playerIds[0]!,enemy:f.playerIds[1]!,base:1000000,pressureFifths:40000}]};
  const second = {...e,id:'slice:two',at:e.at+1};
  const a = advanceHonor(emptyHonorState(),e,4), b = advanceHonor(a.state,second,4);
  await f.db.update(honorSeasons).set({mode:'ACTIVE',rankedAt:f.clock.now()});
  await f.db.insert(honorEvents).values([e,second].map((row,index)=>({seasonId:f.seasonId,source:row.source,sourceId:row.id,
    at:new Date(row.at),ranked:true,evidence:row,evidenceHash:honorEvidenceHash(row,4),outcome:index===0?a.event:b.event})));
  const {readRadiationHonorReceipts} = await import('../src/services/honorReports.js');
  const receipts = await f.db.transaction(tx=>readRadiationHonorReceipts(tx,f.playerIds[0]!,['one']));
  expect(receipts.get('one')).toMatchObject({delta:a.event.attack.total+b.event.attack.total,reason:'TACTICAL',breakdown:{participants:1,tactical:true}});
  expect((await f.db.transaction(tx=>readRadiationHonorReceipts(tx,f.playerIds[2]!,['one']))).size).toBe(0);
  const {ensureWaitingSeason}=await import('../src/services/waitingServers.js');
  const {transferCommander}=await import('../src/services/commanderTransfer.js');
  const waiting=await ensureWaitingSeason(f.db,f.seasonId,f.clock);
  expect((await transferCommander(f.db,f.playerIds[0]!,waiting!.id,f.clock,undefined,{ownerRequested:true})).status).toBe('MOVED');
  expect(await f.db.transaction(tx=>readRadiationHonorReceipts(tx,f.playerIds[0]!,['one']))).toEqual(receipts);
});
it('never exposes private military-reference proportions to a tactical defender', async () => {
  const f = await seedWorld(3,7719);
  await f.db.transaction(tx=>prepareHonorSeason(tx,f.seasonId,'SHADOW',f.clock,4));
  const m = (id:string,navy=100000) => ({id,tier:4,navy,weight:navy,civilianWeight:0,loss:0,combatLoss:0,lootLost:0});
  const e:HonorEvidence = {source:'STRATEGIC_IMPACT',id:randomUUID(),at:f.clock.now().getTime(),eligible:true,
    attack:[m(f.playerIds[0]!)],defence:[m(f.playerIds[1]!,23000),m(f.playerIds[2]!,77000)],
    relations:f.playerIds.slice(1).map(b=>({a:f.playerIds[0]!,b,related:false})),
    tactical:[{actor:f.playerIds[0]!,enemy:f.playerIds[1]!,base:1000000,pressureFifths:40000}]};
  const outcome=advanceHonor(emptyHonorState(),e,4).event;
  await f.db.update(honorSeasons).set({mode:'ACTIVE',rankedAt:f.clock.now()});
  await f.db.insert(honorEvents).values({seasonId:f.seasonId,source:e.source,sourceId:e.id,at:f.clock.now(),ranked:true,
    evidence:e,evidenceHash:honorEvidenceHash(e,4),outcome});
  const result=await f.db.transaction(tx=>readHonorReceipts(tx,f.playerIds[1]!,[e]));
  expect(result.values().next().value).toMatchObject({delta:0,reason:'SHARED_SIDE'});
  expect(result.values().next().value?.breakdown).toBeUndefined();
});
