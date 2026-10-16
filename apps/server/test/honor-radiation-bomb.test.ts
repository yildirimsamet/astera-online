import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, expect, it } from 'vitest';
import { honorEvents, planets, seasons, strategicAssets, units } from '../src/db/schema.js';
import { prepareHonorSeason } from '../src/services/honorLedger.js';
import { launchRadiationBomb, resolveRadiationBomb } from '../src/services/radiationBomb.js';
import { settlePlanetRadiationAt } from '../src/services/planetRadiation.js';
import { giveUnits, grant, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';
let f: Fixture;
beforeEach(async () => {
  f = await seedWorld(2, 7719);
  await f.db.update(seasons).set({ rulesetVersion: 18, radiationBombStartsAt: f.clock.now() });
  for (const id of f.planetIds) {
    await setLevel(f.db, id, 'CORE', 12); await setLevel(f.db, id, 'SHIPYARD', 5);
    await grant(f.db, id, 500000, 500000);
    await f.db.update(planets).set({ deuterium: 500000 }).where(eq(planets.id, id));
    await setLevel(f.db, id, 'CORE', 12);
    await giveUnits(f.db, id, { PIKE: 500 });
  }
  await f.db.insert(strategicAssets).values({ planetId: f.planetIds[0]!, type: 'RADIATION_BOMB_L1', status: 'READY',
    startedAt: f.clock.now(), remainingSeconds: 0 });
  await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'SHADOW', f.clock, 4));
  f.clock.advance(250);
});
afterAll(async () => { await (await testDb()).close(); });
async function hit() {
  const sent = await launchRadiationBomb(f.db, { playerId: f.playerIds[0]!, originPlanetId: f.planetIds[0]!,
    target: { kind: 'PLANET', id: f.planetIds[1]! }, level: 1, key: randomUUID(), acknowledgeShieldLoss: true, clock: f.clock });
  f.clock.set(new Date(sent.arriveAt)); await resolveRadiationBomb(f.db, sent.flightId, f.clock);
  return sent;
}
it('credits real new radiation damage in small capped increments, without requiring a kill or repeat payment', async () => {
  const sent = await hit();
  expect(await f.db.select().from(honorEvents)).toHaveLength(0);
  f.clock.advance(1);
  await f.db.transaction(tx => settlePlanetRadiationAt(tx, f.planetIds[1]!, f.clock.now()));
  const first = await f.db.select().from(honorEvents);
  expect(first.length).toBeGreaterThan(0);
  expect(first.reduce((sum, r) => sum + r.outcome.attack.total, 0)).toBeGreaterThan(0);
  expect(first.every(r => r.evidence.defence.every(d => d.loss === 0))).toBe(true);
  await f.db.transaction(tx => settlePlanetRadiationAt(tx, f.planetIds[1]!, f.clock.now()));
  expect(await f.db.select().from(honorEvents)).toEqual(first);
  f.clock.advance(59);
  await f.db.transaction(tx => settlePlanetRadiationAt(tx, f.planetIds[1]!, f.clock.now()));
  const all = await f.db.select().from(honorEvents);
  expect(all.reduce((sum, r) => sum + r.outcome.attack.total, 0)).toBeLessThanOrEqual(2_500_000);
  expect(all.every(r => r.evidence.tacticalCap?.id === `bomb:${sent.flightId}`)).toBe(true);
});
it('does not award empty-target impact and penalises real weak-target radiation pressure', async () => {
  await setLevel(f.db, f.planetIds[0]!, 'CORE', 15);
  await hit();
  f.clock.advance(1);
  await f.db.transaction(tx => settlePlanetRadiationAt(tx, f.planetIds[1]!, f.clock.now()));
  expect((await f.db.select().from(honorEvents)).reduce((sum,r) => sum+r.outcome.attack.total,0)).toBeLessThan(0);
});
it('empty or civilian-only target cannot provide positive military credit', async () => {
  await f.db.delete(units).where(and(eq(units.planetId, f.planetIds[1]!), eq(units.location, 'home')));
  await hit(); f.clock.advance(1);
  await f.db.transaction(tx => settlePlanetRadiationAt(tx, f.planetIds[1]!, f.clock.now()));
  expect((await f.db.select().from(honorEvents)).every(r => r.outcome.attack.total <= 0)).toBe(true);
});
it('a real interceptor stops radiation entirely and earns only its actual defensive interception credit', async () => {
  const { giveInstrument, giveSatellite } = await import('./helpers.js');
  await giveSatellite(f.db, f.planetIds[1]!, 'UPLINK');
  await giveInstrument(f.db, f.planetIds[1]!, 'RADAR', 5);
  await f.db.insert(strategicAssets).values({ planetId: f.planetIds[1]!, type: 'INTERCEPTOR', status: 'READY',
    startedAt: f.clock.now(), remainingSeconds: 0 });
  const sent = await hit();
  const [entry] = await f.db.select().from(honorEvents);
  expect(entry?.source).toBe('STRATEGIC_INTERCEPTION');
  expect(entry?.sourceId).toBe(`bomb:${sent.flightId}`);
  expect(entry?.outcome.attack.total).toBe(-13_400_000);
  expect(entry?.outcome.defence.total).toBeGreaterThan(0);
  expect(entry?.evidence.defence[0]?.loss).toBe(0);
});
it('a lingering bomb cannot stall the victim health writer after its attacker moves to Silent Space', async () => {
  await hit();
  const { ensureWaitingSeason } = await import('../src/services/waitingServers.js');
  const { transferCommander } = await import('../src/services/commanderTransfer.js');
  const waiting = await ensureWaitingSeason(f.db, f.seasonId, f.clock);
  expect((await transferCommander(f.db, f.playerIds[0]!, waiting!.id, f.clock, undefined, { ownerRequested: true })).status).toBe('MOVED');
  f.clock.advance(1);
  await expect(f.db.transaction(tx => settlePlanetRadiationAt(tx, f.planetIds[1]!, f.clock.now())))
    .resolves.toMatchObject({ settledAt: f.clock.now() });
  const wounded = await f.db.select().from(units).where(and(eq(units.planetId, f.planetIds[1]!), eq(units.location, 'home')));
  expect(wounded.some(row => row.damage.length > 0)).toBe(true);
  const entries = await f.db.select().from(honorEvents);
  expect(entries.length).toBeGreaterThan(0);
  expect(entries.every(row => row.seasonId === f.seasonId)).toBe(true);
});
it('provides an authorised radiation report and its cumulative Honor receipt through the client contract', async () => {
  const sent = await hit(); f.clock.advance(1);
  await f.db.transaction(tx=>settlePlanetRadiationAt(tx,f.planetIds[1]!,f.clock.now()));
  const {honorSeasons} = await import('../src/db/schema.js');
  // Exercise the reader's future ACTIVE projection, preserving candidate writer guards.
  await f.db.update(honorSeasons).set({mode:'ACTIVE',rankedAt:(await f.db.select().from(honorSeasons))[0]!.createdAt});
  await f.db.update(honorEvents).set({ranked:true});
  const {readBattleReports} = await import('../src/services/reports.js');
  const {reportsSchema} = await import('../../web/src/api/schemas.js');
  const result = reportsSchema.parse(await readBattleReports(f.db,f.playerIds[0]!));
  const report = result.reports.find(row=>row.kind==='STRATEGIC' && row.missionId===`bomb:${sent.flightId}`);
  expect(report?.kind).toBe('STRATEGIC');
  if (report?.kind!=='STRATEGIC') throw new Error('Missing radiation report');
  expect(report.radiation?.level).toBe(1);
  expect(report.honor?.delta).toBeGreaterThan(0);
  expect(report.honor?.reason).toBe('TACTICAL');
  expect(JSON.stringify(report)).not.toMatch(/armedMicros|allMicros|navy/);
  const {ensureWaitingSeason}=await import('../src/services/waitingServers.js');
  const {transferCommander}=await import('../src/services/commanderTransfer.js');
  const waiting=await ensureWaitingSeason(f.db,f.seasonId,f.clock);
  expect((await transferCommander(f.db,f.playerIds[0]!,waiting!.id,f.clock,undefined,{ownerRequested:true})).status).toBe('MOVED');
  const after=reportsSchema.parse(await readBattleReports(f.db,f.playerIds[0]!));
  expect(after.reports.find(row=>row.kind==='STRATEGIC'&&row.missionId===`bomb:${sent.flightId}`)).toEqual({...report,opponentPlanetId:null,yourPlanetId:null});
});
