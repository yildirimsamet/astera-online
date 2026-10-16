import { eq } from 'drizzle-orm';
import { afterAll, expect, it } from 'vitest';
import { missions, radiationBombFlights, strategicAssets } from '../src/db/schema.js';
import { pendingHonorLegacySources } from '../src/services/honorLedger.js';
import { activateHonorShadow } from '../src/services/honorActivation.js';
import { seedWorld, testDb } from './helpers.js';
afterAll(async () => { await (await testDb()).close(); });
it('identifies both flying weapons and an already active radiation source before ranked opening', async () => {
  const f = await seedWorld(2,7719);
  const [mission] = await f.db.insert(missions).values({ seasonId: f.seasonId, kind: 'death_star',
    ownerPlayerId: f.playerIds[0]!, originPlanetId: f.planetIds[0]!, targetPlanetId: f.planetIds[1]!,
    fleet: {}, fuelPaid: 0, distance: 1, departAt: f.clock.now(), arriveAt: new Date(f.clock.now().getTime()+60000) }).returning();
  const [asset] = await f.db.insert(strategicAssets).values({ planetId: f.planetIds[0]!, type: 'RADIATION_BOMB_L1',
    status:'CONSUMED', startedAt:f.clock.now(), remainingSeconds:0 }).returning();
  const [bomb] = await f.db.insert(radiationBombFlights).values({ seasonId:f.seasonId, assetId:asset!.id,
    ownerPlayerId:f.playerIds[0]!, originPlanetId:f.planetIds[0]!, targetKind:'PLANET', targetPlanetId:f.planetIds[1]!,
    level:1,status:'HIT',departAt:new Date(f.clock.now().getTime()-60000),arriveAt:f.clock.now(),resolvedAt:f.clock.now(),
    originPosition:{x:0,y:0,z:0},targetPosition:{x:1,y:0,z:0} }).returning();
  const keys = await f.db.transaction(tx => pendingHonorLegacySources(tx,f.seasonId));
  expect(keys).toContain(`STRATEGIC_IMPACT:${mission!.id}`);
  expect(keys).toContain(`STRATEGIC_IMPACT:bomb:${bomb!.id}`);
  await f.db.update(missions).set({status:'resolved'}).where(eq(missions.id,mission!.id));
  f.clock.advance(1);
  await expect(activateHonorShadow(f.db,{seasonId:f.seasonId,clock:f.clock,apply:true})).resolves.toMatchObject({applied:true});
});
