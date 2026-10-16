import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, expect, it } from 'vitest';
import { hpRadiationSources, planets, players, radiationBombFlights, scheduledEvents, seasons, strategicAssets } from '../src/db/schema.js';
import { buildRadiationBomb, launchRadiationBomb } from '../src/services/radiationBomb.js';
import { transferCommander } from '../src/services/commanderTransfer.js';
import { ensureWaitingSeason } from '../src/services/waitingServers.js';
import { strandedFlightCount, sweepStranded } from '../src/worker/abandon.js';
import { grant, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

let f: Fixture;
beforeEach(async () => {
  f = await seedWorld(2);
  await f.db.update(seasons).set({ rulesetVersion: 18, radiationBombStartsAt: f.clock.now() }).where(eq(seasons.id, f.seasonId));
  await f.db.update(players).set({ newcomerShieldUntil: null, recoveryShieldUntil: null });
  for (const id of f.planetIds) {
    await setLevel(f.db, id, 'CORE', 13); await setLevel(f.db, id, 'SHIPYARD', 5);
    await grant(f.db, id, 500000, 500000);
    await f.db.update(planets).set({ deuterium: 500000 }).where(eq(planets.id, id));
  }
});
afterAll(async () => { await (await testDb()).close(); });
async function launch() {
  const built = await buildRadiationBomb(f.db, f.planetIds[0]!, 1, f.clock, f.playerIds[0]);
  await f.db.update(strategicAssets).set({ status: 'READY' }).where(eq(strategicAssets.id, built.assetId));
  return launchRadiationBomb(f.db, { playerId: f.playerIds[0]!, originPlanetId: f.planetIds[0]!,
    target: { kind: 'PLANET', id: f.planetIds[1]! }, level: 1, key: randomUUID(), clock: f.clock });
}
it('does not move a target world to another galaxy while an inbound bomb still references it', async () => {
  await launch();
  const waiting = await ensureWaitingSeason(f.db, f.seasonId, f.clock);
  expect((await transferCommander(f.db, f.playerIds[1]!, waiting!.id, f.clock, undefined, { ownerRequested: true })).status).toBe('FLIGHT');
});
it('keeps a radiated world in its galaxy until its active effect ends', async () => {
  const waiting = await ensureWaitingSeason(f.db, f.seasonId, f.clock);
  await f.db.insert(hpRadiationSources).values({ seasonId: f.seasonId, anchorKind: 'PLANET', anchorId: f.planetIds[1]!,
    x: 0, y: 0, z: 0, radius: 1, intensityHpPerMinute: 9, mode: 'EMIT', activeFrom: f.clock.now(),
    activeUntil: new Date(f.clock.now().getTime() + 60000) });
  expect((await transferCommander(f.db, f.playerIds[1]!, waiting!.id, f.clock, undefined, { ownerRequested: true })).status).toBe('EFFECT');
});
it('detects a lost arrival event and restores deterministic impact instead of refunding or stranding a launched missile', async () => {
  const sent = await launch();
  await f.db.delete(scheduledEvents).where(and(eq(scheduledEvents.refId, sent.flightId), eq(scheduledEvents.kind, 'radiation_bomb_arrival')));
  f.clock.set(new Date(new Date(sent.arriveAt).getTime() + 6 * 60000));
  expect(await strandedFlightCount(f.db, f.clock.now())).toBe(1);
  expect(await sweepStranded(f.db, f.clock)).toBe(1);
  expect((await f.db.select().from(radiationBombFlights).where(eq(radiationBombFlights.id, sent.flightId)))[0]!.status).toBe('HIT');
  expect(await strandedFlightCount(f.db, f.clock.now())).toBe(0);
});

it('seals bomb impacts due before a forced season boundary and keeps frozen home health unchanged afterwards', async () => {
  const { forceSeasonEnd } = await import('../src/worker/handlers.js');
  const { giveUnits } = await import('./helpers.js');
  const { readHomeHealth } = await import('../src/services/homeHealth.js');
  const { readPlanetSnapshot } = await import('../src/services/planet.js');
  await giveUnits(f.db, f.planetIds[1]!, { CITADEL: 1 });
  const sent = await launch();
  f.clock.set(new Date(new Date(sent.arriveAt).getTime() + 60000));
  await forceSeasonEnd({ db: f.db, clock: f.clock }, f.seasonId);
  const before = await readHomeHealth(f.db, f.planetIds[1]!);
  expect(before.damage).toHaveLength(1);
  f.clock.advance(10);
  const after = await f.db.transaction(tx => readPlanetSnapshot(tx, f.planetIds[1]!, f.clock), { accessMode: 'read only' });
  expect(after.homeDamage).toEqual(before.damage);
});

it('wipes bomb flight references before their targets and assets, preserving the existing seasonal wipe', async () => {
  const { wipeAllServers } = await import('../src/services/servers.js');
  const { forceSeasonEnd } = await import('../src/worker/handlers.js');
  const { resolveRadiationBomb } = await import('../src/services/radiationBomb.js');
  const sent = await launch();
  f.clock.set(new Date(sent.arriveAt));
  await resolveRadiationBomb(f.db, sent.flightId, f.clock);
  await forceSeasonEnd({ db: f.db, clock: f.clock }, f.seasonId);
  await expect(wipeAllServers(f.db, f.clock, { count: 1, capacity: 2, seedBase: 7719 })).resolves.toMatchObject({ playersCleared: 2 });
  expect(await f.db.select().from(radiationBombFlights)).toHaveLength(0);
});
