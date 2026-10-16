import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, expect, it } from 'vitest';
import { honorEvents, honorSeasons, honorTotals, planets, scheduledEvents, seasons, strategicAssets, units } from '../src/db/schema.js';
import { prepareHonorSeason } from '../src/services/honorLedger.js';
import { openHonorRanking } from '../src/services/honorActivation.js';
import { launchDeathStar } from '../src/services/strategic.js';
import { launchRadiationBomb, resolveRadiationBomb } from '../src/services/radiationBomb.js';
import { settlePlanetRadiationAt } from '../src/services/planetRadiation.js';
import { onMissionArrival } from '../src/worker/handlers.js';
import { giveInstrument, giveSatellite, giveUnits, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

let f: Fixture;
beforeEach(async () => {
  f = await seedWorld(2, 7719);
  await f.db.update(seasons).set({ rulesetVersion: 18, radiationBombStartsAt: f.clock.now() });
  for (const id of f.planetIds) {
    await setLevel(f.db, id, 'CORE', 13);
    await setLevel(f.db, id, 'SHIPYARD', 5);
    await giveUnits(f.db, id, { PIKE: 500, THORN: 100 });
    await f.db.update(planets).set({ alloy: 500_000, crystal: 500_000, deuterium: 500_000 }).where(eq(planets.id, id));
  }
  await giveInstrument(f.db, f.planetIds[1]!, 'AEGIS', 1);
  await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'SHADOW', f.clock, 4));
  f.clock.advance(2 * 24 * 60);
});
afterAll(async () => { await (await testDb()).close(); });
const open = () => openHonorRanking(f.db, { seasonId: f.seasonId, clock: f.clock, apply: true });
const stock = (type: 'DEATH_STAR' | 'RADIATION_BOMB_L1') => f.db.insert(strategicAssets).values({
  planetId: f.planetIds[0]!, type, status: 'READY', startedAt: f.clock.now(), remainingSeconds: 0,
});
const bomb = () => launchRadiationBomb(f.db, { playerId: f.playerIds[0]!, originPlanetId: f.planetIds[0]!,
  target: { kind: 'PLANET', id: f.planetIds[1]! }, level: 1, key: randomUUID(), acknowledgeShieldLoss: true, clock: f.clock });

it.each([
  { after: false, intercepted: false }, { after: true, intercepted: false },
  { after: false, intercepted: true }, { after: true, intercepted: true },
])('EMP after=$after intercepted=$intercepted is separated at the identical millisecond', async ({ after, intercepted }) => {
  await stock('DEATH_STAR');
  if (intercepted) {
    await giveSatellite(f.db, f.planetIds[1]!, 'UPLINK');
    await giveInstrument(f.db, f.planetIds[1]!, 'RADAR', 5);
    await f.db.insert(strategicAssets).values({ planetId: f.planetIds[1]!, type: 'INTERCEPTOR',
      status: 'READY', startedAt: f.clock.now(), remainingSeconds: 0 });
  }
  if (after) await open();
  const sent = await launchDeathStar(f.db, f.planetIds[0]!, f.planetIds[1]!, f.clock);
  if (!after) await open();
  f.clock.set(sent.arriveAt);
  const [event] = await f.db.select().from(scheduledEvents).where(and(eq(scheduledEvents.refId, sent.missionId), eq(scheduledEvents.kind, 'mission_arrival')));
  if (!event) throw new Error('Missing EMP arrival');
  await onMissionArrival({ db: f.db, clock: f.clock }, event);
  await onMissionArrival({ db: f.db, clock: f.clock }, event);
  const rows = await f.db.select().from(honorEvents);
  expect(rows).toHaveLength(after ? 1 : 0);
  if (after) {
    expect(rows[0]).toMatchObject({ ranked: true, sourceId: sent.missionId,
      source: intercepted ? 'STRATEGIC_INTERCEPTION' : 'STRATEGIC_IMPACT' });
    if (intercepted) {
      expect(rows[0]!.outcome.attack.total).toBeLessThan(0);
      expect(rows[0]!.outcome.defence.total).toBeGreaterThan(0);
    } else expect(rows[0]!.outcome.attack.total).toBeGreaterThan(0);
  }
  if (intercepted) {
    const assets = await f.db.select().from(strategicAssets);
    expect(assets.filter(row => row.status === 'CONSUMED')).toHaveLength(2);
    expect(assets.every(row => row.missionId === sent.missionId)).toBe(true);
  }
});

it.each(['OUTBOUND', 'HIT', 'NEW'] as const)('radiation %s at opening preserves physical damage but only new launches earn ranked Honor', async status => {
  await stock('RADIATION_BOMB_L1');
  // Remove Aegis shelter so the observed radiation interval contains real damage.
  await f.db.update(planets).set({ shield: 0 }).where(eq(planets.id, f.planetIds[1]!));
  if (status === 'NEW') await open();
  const sent = await bomb();
  if (status === 'OUTBOUND') await open();
  f.clock.set(new Date(sent.arriveAt));
  await resolveRadiationBomb(f.db, sent.flightId, f.clock);
  if (status === 'HIT') await open();
  f.clock.advance(1);
  await f.db.transaction(tx => settlePlanetRadiationAt(tx, f.planetIds[1]!, f.clock.now()));
  const rows = await f.db.select().from(honorEvents);
  const physical = await f.db.select().from(units).where(and(eq(units.planetId, f.planetIds[1]!), eq(units.location, 'home')));
  expect(physical.some(row => row.damage.length > 0)).toBe(true);
  const total = (await f.db.select().from(honorTotals)).reduce((sum, row) => sum + row.score, 0);
  if (status === 'NEW') {
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every(row => row.ranked)).toBe(true);
    expect(total).toBeGreaterThan(0);
  } else {
    expect(total).toBe(0);
    expect(rows.every(row => !row.ranked)).toBe(true);
    expect((await f.db.select().from(honorSeasons))[0]?.legacySources).toContain(`STRATEGIC_IMPACT:bomb:${sent.flightId}`);
  }
});
