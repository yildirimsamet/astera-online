import { afterAll, beforeEach, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { MONUMENT_SEASON_DEFAULTS, distance, monumentMotion, motionPositionAt, interpolatePosition } from '@astera/rules';
import { seedWorld, setLevel, grant, giveUnits, testDb, type Fixture } from './helpers.js';
import { monuments, monumentWaves, seasons } from '../src/db/schema.js';
import { sendMonument } from '../src/services/monument.js';
import { advanceMonument } from '../src/services/monumentArrival.js';
import { recallMonument } from '../src/services/monumentMovement.js';

let f:Fixture;
let target:typeof monuments.$inferSelect;
let epoch:number;
beforeEach(async()=>{
  f=await seedWorld(1,20261012);
  epoch=f.clock.now().getTime();
  await f.db.update(seasons).set({rulesetVersion:17}).where(eq(seasons.id,f.seasonId));
  await setLevel(f.db,f.planetIds[0]!,'CORE',6);
  await setLevel(f.db,f.planetIds[0]!,'HANGAR',10);
  await grant(f.db,f.planetIds[0]!,100000,100000);
  await giveUnits(f.db,f.planetIds[0]!,{RAMPART:2});
  const [row]=await f.db.insert(monuments).values({seasonId:f.seasonId,ordinal:1,...MONUMENT_SEASON_DEFAULTS.positions[0]!,capacity:100000,productionPerMinute:3,garrison:{},settledAt:f.clock.now()}).returning();
  target=row!;
});
afterAll(async()=>{await(await testDb()).close();});
const send=()=>f.db.transaction(tx=>sendMonument(tx,{senderPlayerId:f.playerIds[0]!,originPlanetId:f.planetIds[0]!,monumentId:target.id,fleet:{RAMPART:2},purpose:'ATTACK',acknowledgeShieldLoss:true,clock:f.clock}));
it('persists the future meeting point instead of the current monument point',async()=>{
  f.clock.advance(120);
  const sent=await send();
  const leg=sent.wave.route[0]!;
  expect(distance(leg.to,motionPositionAt(monumentMotion(target,epoch),leg.endMs))).toBeLessThan(1e-5);
  expect(distance(leg.to,target)).toBeGreaterThan(100);
});
it('recalls a hold from the actual departure position after delayed arrival processing',async()=>{
  const sent=await send();
  const at=new Date(sent.wave.arriveAt!.getTime()+30*60_000);
  f.clock.set(at);
  await f.db.transaction(tx=>advanceMonument(tx,{monumentId:target.id,at}));
  const [hold]=await f.db.select().from(monumentWaves).where(eq(monumentWaves.id,sent.wave.id));
  expect(hold!.status).toBe('HOLD');
  const returned=await f.db.transaction(tx=>recallMonument(tx,{playerId:f.playerIds[0]!,waveId:sent.wave.id,all:true,clock:f.clock}));
  expect(returned).toBeDefined();
  const [row]=await f.db.select().from(monumentWaves).where(eq(monumentWaves.id,sent.wave.id));
  expect(distance(row!.route[0]!.from,motionPositionAt(monumentMotion(target,epoch),at.getTime()))).toBeLessThan(1e-5);
});
it('turns an outbound leg without jumping to the moving target',async()=>{
  const sent=await send(),leg=sent.wave.route[0]!;
  const turn=Math.floor((leg.startMs+leg.endMs)/2);
  f.clock.set(new Date(turn));
  await f.db.transaction(tx=>recallMonument(tx,{playerId:f.playerIds[0]!,waveId:sent.wave.id,all:true,clock:f.clock}));
  const [row]=await f.db.select().from(monumentWaves).where(eq(monumentWaves.id,sent.wave.id));
  expect(distance(row!.route[0]!.from,interpolatePosition(leg.from,leg.to,leg.startMs,leg.endMs,turn))).toBeLessThan(1e-5);
});
