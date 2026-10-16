import {randomUUID} from 'node:crypto';
import {eq} from 'drizzle-orm';
import {afterAll,beforeEach,expect,it} from 'vitest';
import {honorEvents,honorSeasons,monuments,monumentShipLots,monumentWaves,planets,seasons,strategicAssets,units} from '../src/db/schema.js';
import {prepareHonorSeason} from '../src/services/honorLedger.js';
import {launchRadiationBomb,resolveRadiationBomb} from '../src/services/radiationBomb.js';
import {settleMonument} from '../src/services/monument.js';
import {readBattleReports} from '../src/services/reports.js';
import {giveUnits,grant,seedWorld,setLevel,testDb,type Fixture} from './helpers.js';
let f:Fixture;
let targetId:string;
beforeEach(async()=>{
  f=await seedWorld(3,7719);
  await f.db.update(seasons).set({rulesetVersion:18,radiationBombStartsAt:f.clock.now()});
  for(const id of f.planetIds){
    await grant(f.db,id,500000,500000);await setLevel(f.db,id,'CORE',12);await setLevel(f.db,id,'SHIPYARD',5);
    await f.db.update(planets).set({deuterium:500000}).where(eq(planets.id,id));
    await giveUnits(f.db,id,{PIKE:500});
  }
  const [target]=await f.db.insert(monuments).values({seasonId:f.seasonId,ordinal:1,x:1000,y:0,z:0,
    capacity:100000,productionPerMinute:3,garrison:{},garrisonTemplate:{},controllerPlayerId:f.playerIds[1]!,settledAt:f.clock.now()}).returning();
  targetId=target!.id;
  await f.db.insert(strategicAssets).values({planetId:f.planetIds[0]!,type:'RADIATION_BOMB_L1',status:'READY',startedAt:f.clock.now(),remainingSeconds:0});
});
afterAll(async()=>{await(await testDb()).close();});
async function holding(owner:number,count=50){
  const id=randomUUID(),playerId=f.playerIds[owner]!;
  await f.db.insert(monumentWaves).values({id,seasonId:f.seasonId,monumentId:targetId,playerId,originPlanetId:f.planetIds[owner]!,
    unitLocation:`monument:${id}`,purpose:'ATTACK',sentFleet:{PIKE:count},tech:{},route:[],status:'HOLD',sentAt:f.clock.now(),heldAt:f.clock.now(),radiationSettledAt:f.clock.now(),fuelPaid:0});
  await f.db.insert(monumentShipLots).values({waveId:id,hull:'PIKE',count,damageBp:0,remainderBp:0,deuterium:0});
  await f.db.insert(units).values({planetId:f.planetIds[owner]!,ownerPlayerId:playerId,location:`monument:${id}`,hull:'PIKE',count});
}
async function hit(beforeImpact?:()=>Promise<void>){
  await f.db.transaction(tx=>prepareHonorSeason(tx,f.seasonId,'SHADOW',f.clock,4));
  const sent=await launchRadiationBomb(f.db,{playerId:f.playerIds[0]!,originPlanetId:f.planetIds[0]!,target:{kind:'MONUMENT',id:targetId},
    level:1,key:randomUUID(),acknowledgeShieldLoss:true,clock:f.clock});
  f.clock.set(new Date(sent.arriveAt));if(beforeImpact) await beforeImpact();await resolveRadiationBomb(f.db,sent.flightId,f.clock);return sent;
}
it('attributes actual monument damage cumulatively to one bomb across multiple waves of the same owner',async()=>{
  await holding(1);await holding(1);
  const sent=await hit();f.clock.advance(1);
  await f.db.transaction(tx=>settleMonument(tx,{monumentId:targetId,clock:f.clock}));
  const entries=await f.db.select().from(honorEvents);
  expect(entries.length).toBeGreaterThan(0);
  expect(entries.reduce((sum,row)=>sum+row.outcome.attack.total,0)).toBeGreaterThan(0);
  expect(entries.reduce((sum,row)=>sum+row.outcome.attack.total,0)).toBeLessThanOrEqual(2500000);
  expect(entries.every(row=>row.evidence.defence.length===1&&row.evidence.attackKey===`bomb:${sent.flightId}`)).toBe(true);
  await f.db.transaction(tx=>settleMonument(tx,{monumentId:targetId,clock:f.clock}));
  expect(await f.db.select().from(honorEvents)).toEqual(entries);
  const [config]=await f.db.select().from(honorSeasons);
  await f.db.update(honorSeasons).set({mode:'ACTIVE',rankedAt:config!.createdAt});await f.db.update(honorEvents).set({ranked:true});
  const defender=await readBattleReports(f.db,f.playerIds[1]!);
  expect(defender.reports.some(row=>row.kind==='STRATEGIC'&&row.missionId===`bomb:${sent.flightId}`&&row.radiation?.monumentOrdinal===1)).toBe(true);
  expect((await readBattleReports(f.db,f.playerIds[2]!)).reports).toHaveLength(0);
});
it('does not invent a selected player victim or grant NPC radiation kills Honor',async()=>{
  await f.db.update(monuments).set({controllerPlayerId:null,garrison:{PIKE:50},garrisonTemplate:{PIKE:50}}).where(eq(monuments.id,targetId));
  await hit();f.clock.advance(60);
  await f.db.transaction(tx=>settleMonument(tx,{monumentId:targetId,clock:f.clock}));
  expect(await f.db.select().from(honorEvents)).toHaveLength(0);
});

it('lets a genuinely affected late holder read the impact without inheriting older private reports or Honor',async()=>{
  await holding(1);
  const sent=await hit(async()=>{
    await f.db.transaction(tx=>settleMonument(tx,{monumentId:targetId,clock:f.clock}));
    await holding(2);
  });
  const reports=await readBattleReports(f.db,f.playerIds[2]!);
  expect(reports.reports.some(row=>row.kind==='STRATEGIC'&&row.missionId===`bomb:${sent.flightId}`)).toBe(true);
});
