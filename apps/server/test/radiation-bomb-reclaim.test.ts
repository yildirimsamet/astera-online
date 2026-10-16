import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, expect, it } from 'vitest';
import { HULLS, SERVERS } from '@astera/rules';
import { accounts, hpRadiationSources, planets, players, radiationBombFlights, seasons, strategicAssets } from '../src/db/schema.js';
import { buildRadiationBomb, launchRadiationBomb, resolveRadiationBomb } from '../src/services/radiationBomb.js';
import { deleteAccount } from '../src/services/accountDeletion.js';
import { readHomeHealth } from '../src/services/homeHealth.js';
import { loadLocked } from '../src/services/planet.js';
import { landHpShips } from '../src/services/shipDamage.js';
import { reclaimIdleSeats } from '../src/services/reclaim.js';
import { bombInterceptionLeg, interceptRadiationBomb } from '../src/services/radiationBombInterception.js';
import { firstShotSince } from '../src/services/strategicInterception.js';
import { giveInstrument, giveSatellite, giveUnits, grant, placeAt, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

let f: Fixture;
beforeEach(async () => {
  f = await seedWorld(2);
  await f.db.update(seasons).set({ rulesetVersion: 18, radiationBombStartsAt: f.clock.now() }).where(eq(seasons.id, f.seasonId));
  await f.db.update(players).set({ newcomerShieldUntil: null, recoveryShieldUntil: null });
  for (const id of f.planetIds) {
    await setLevel(f.db, id, 'CORE', 13);
    await setLevel(f.db, id, 'SHIPYARD', 5);
    await grant(f.db, id, 500000, 500000);
    await f.db.update(planets).set({ deuterium: 500000 }).where(eq(planets.id, id));
  }
});
afterAll(async () => { await (await testDb()).close(); });

async function launch() {
  const built = await buildRadiationBomb(f.db, f.planetIds[0]!, 1, f.clock, f.playerIds[0]);
  await f.db.update(strategicAssets).set({ status: 'READY' }).where(eq(strategicAssets.id, built.assetId));
  return launchRadiationBomb(f.db, { playerId: f.playerIds[0]!, originPlanetId: f.planetIds[0]!,
    level: 1, target: { kind: 'PLANET', id: f.planetIds[1]! }, key: randomUUID(), clock: f.clock });
}
async function remove(index: number) {
  const [account] = await f.db.select().from(accounts).where(eq(accounts.id, f.accountIds[index]!));
  if (!account) throw new Error('Missing deletion fixture account');
  return deleteAccount(f.db, f.clock, account.username);
}

it.each([0, 1])('refuses deletion of commander %i while a real bomb still references their world', async index => {
  await launch();
  await expect(remove(index)).rejects.toMatchObject({ code: 'WORLD_BUSY' });
  expect(await f.db.select().from(radiationBombFlights)).toHaveLength(1);
});

it.each([0, 1])('keeps commander %i until an intercepted bomb physically collides', async index => {
  await placeAt(f.db, f.planetIds[0]!, { x: 5000 });
  await placeAt(f.db, f.planetIds[1]!, { x: 0 });
  await giveSatellite(f.db, f.planetIds[1]!, 'UPLINK');
  await giveInstrument(f.db, f.planetIds[1]!, 'RADAR', 3);
  await f.db.insert(strategicAssets).values({ planetId: f.planetIds[1]!, type: 'INTERCEPTOR',
    status: 'READY', startedAt: f.clock.now(), readyAt: f.clock.now(), remainingSeconds: 0 });
  const sent = await launch();
  const [flight] = await f.db.select().from(radiationBombFlights).where(eq(radiationBombFlights.id, sent.flightId));
  const shot = await f.db.transaction(async tx => {
    const leg = await bombInterceptionLeg(tx, flight!);
    if (!leg) throw new Error('Missing interception fixture leg');
    return firstShotSince(leg, f.clock.now());
  });
  if (!shot) throw new Error('Missing interception fixture crossing');
  f.clock.set(shot.at);
  expect(await f.db.transaction(tx => interceptRadiationBomb(tx, flight!, f.clock.now()))).toBe(true);
  await expect(remove(index)).rejects.toMatchObject({ code: 'WORLD_BUSY' });
});

it('defers an idle target while airborne and safely reclaims it after impact', async () => {
  const old = new Date(f.clock.now().getTime() - (SERVERS.idleDays + 1) * 86400000);
  await f.db.update(players).set({ lastActiveAt: old, joinedAt: old }).where(eq(players.id, f.playerIds[1]!));
  const sent = await launch();
  expect(await reclaimIdleSeats(f.db, f.clock)).toEqual({ reclaimed: [], deferred: 1, failed: 0 });
  f.clock.set(new Date(sent.arriveAt));
  await resolveRadiationBomb(f.db, sent.flightId, f.clock);
  const result = await reclaimIdleSeats(f.db, f.clock);
  expect(result.reclaimed).toHaveLength(1);
  expect(result.failed).toBe(0);
  expect(await f.db.select().from(radiationBombFlights)).toHaveLength(0);
});

it('deletes a terminal attacker without erasing the target dose or its delayed-arrival history', async () => {
  const home = f.planetIds[1]!;
  await giveUnits(f.db, home, { CITADEL: 1 });
  const sent = await launch();
  const impact = new Date(sent.arriveAt);
  f.clock.set(impact);
  await resolveRadiationBomb(f.db, sent.flightId, f.clock);
  await remove(0);
  expect(await f.db.select().from(radiationBombFlights)).toHaveLength(0);
  const [source] = await f.db.select().from(hpRadiationSources);
  expect(source).toMatchObject({ origin: 'BOMB', bombFlightId: null, anchorId: home, intensityHpPerMinute: 9 });
  f.clock.advance(2);
  await f.db.transaction(tx => loadLocked(tx, home, f.clock));
  expect((await readHomeHealth(f.db, home)).damage[0]!.damageBp).toBe(Math.floor(18 / HULLS.CITADEL.hp * 10000));
  await f.db.transaction(tx => landHpShips(tx, { planetId: home, ownerPlayerId: f.playerIds[1]!,
    fleet: { CITADEL: 1 }, damage: [], at: f.clock.now(), radiationAt: new Date(impact.getTime() + 30000) }));
  const expected = 13.5 / HULLS.CITADEL.hp * 10000;
  expect((await readHomeHealth(f.db, home)).damage.some(lot =>
    Math.abs(lot.damageBp + (lot.remainderBp ?? 0) - expected) < 1e-6)).toBe(true);
});

it('removes terminal flight references when deleting their target without deleting the attacker', async () => {
  const sent = await launch();
  f.clock.set(new Date(sent.arriveAt));
  await resolveRadiationBomb(f.db, sent.flightId, f.clock);
  await remove(1);
  expect(await f.db.select().from(radiationBombFlights)).toHaveLength(0);
  expect(await f.db.select().from(hpRadiationSources)).toHaveLength(0);
  expect(await f.db.select().from(players).where(eq(players.id, f.playerIds[0]!))).toHaveLength(1);
});
