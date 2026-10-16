import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, expect, it } from 'vitest';
import { HULLS } from '@astera/rules';
import { hpRadiationSources, monuments, monumentShipLots, monumentWaves, notifications, planets, players, seasons, strategicAssets, units } from '../src/db/schema.js';
import { buildRadiationBomb, launchRadiationBomb, resolveRadiationBomb } from '../src/services/radiationBomb.js';
import { settleMonument } from '../src/services/monument.js';
import { advanceMonument } from '../src/services/monumentArrival.js';
import { hpRadiationForGalaxy, hpSourcesForSeason } from '../src/services/radiationSources.js';
import { grant, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

let f: Fixture;
let monument: typeof monuments.$inferSelect;
beforeEach(async () => {
  f = await seedWorld(2);
  await f.db.update(seasons).set({ radiationBombStartsAt: f.clock.now(), rulesetVersion: 18 }).where(eq(seasons.id, f.seasonId));
  await f.db.update(players).set({ newcomerShieldUntil: null, recoveryShieldUntil: null });
  await setLevel(f.db, f.planetIds[0]!, 'CORE', 13);
  await setLevel(f.db, f.planetIds[0]!, 'SHIPYARD', 5);
  await grant(f.db, f.planetIds[0]!, 500000, 500000);
  await f.db.update(planets).set({ deuterium: 500000 }).where(eq(planets.id, f.planetIds[0]!));
  const [target] = await f.db.insert(monuments).values({ seasonId: f.seasonId, ordinal: 1, x: 1000, y: 0, z: 0,
    capacity: 100000, productionPerMinute: 3, garrison: { CITADEL: 2 }, garrisonTemplate: { CITADEL: 2 }, settledAt: f.clock.now() }).returning();
  monument = target!;
  await f.db.insert(hpRadiationSources).values({ seasonId: f.seasonId, anchorKind: 'MONUMENT', anchorId: monument.id,
    x: 1000, y: 0, z: 0, radius: 1, intensityHpPerMinute: 12.5, radiationLevel: 2, mode: 'EMIT', activeFrom: f.clock.now() });
});
afterAll(async () => { await (await testDb()).close(); });
async function hit() {
  const built = await buildRadiationBomb(f.db, f.planetIds[0]!, 1, f.clock, f.playerIds[0]);
  await f.db.update(strategicAssets).set({ status: 'READY' }).where(eq(strategicAssets.id, built.assetId));
  const sent = await launchRadiationBomb(f.db, { playerId: f.playerIds[0]!, originPlanetId: f.planetIds[0]!,
    target: { kind: 'MONUMENT', id: monument.id }, level: 1, key: randomUUID(), clock: f.clock });
  f.clock.set(new Date(sent.arriveAt));
  await resolveRadiationBomb(f.db, sent.flightId, f.clock);
  return sent;
}

it('bounds radiation reads to relevant target history and omits entity bombs from ordinary flight reads', async () => {
  const sent = await hit();
  const from = new Date(sent.arriveAt);
  const until = new Date(from.getTime() + 60000);
  expect(await hpSourcesForSeason(f.db, f.seasonId, { from, until, targets: [] })).toHaveLength(1);
  expect(await hpSourcesForSeason(f.db, f.seasonId, { from, until,
    targets: [{ kind: 'PLANET', id: f.planetIds[0]! }] })).toHaveLength(1);
  expect(await hpSourcesForSeason(f.db, f.seasonId, { from, until,
    targets: [{ kind: 'MONUMENT', id: monument.id }] })).toHaveLength(2);
  const ended = new Date(from.getTime() + 30 * 60000);
  expect(await hpSourcesForSeason(f.db, f.seasonId, { from: ended, until: new Date(ended.getTime() + 60000),
    targets: [{ kind: 'MONUMENT', id: monument.id }] })).toHaveLength(1);
  expect(await hpSourcesForSeason(f.db, f.seasonId)).toHaveLength(2);
  expect(await hpRadiationForGalaxy(f.db, f.seasonId, ended)).toHaveLength(1);
});

it('retains NPC immunity to the natural cloud, but bomb exposure damages its real garrison once', async () => {
  f.clock.advance(10);
  await f.db.transaction(tx => settleMonument(tx, { monumentId: monument.id, clock: f.clock }));
  const [natural] = await f.db.select().from(monuments).where(eq(monuments.id, monument.id));
  expect(natural!.garrisonDamage).toEqual([]);
  await hit();
  f.clock.advance(1);
  await f.db.transaction(tx => settleMonument(tx, { monumentId: monument.id, clock: f.clock }));
  await f.db.transaction(tx => settleMonument(tx, { monumentId: monument.id, clock: f.clock }));
  const [damaged] = await f.db.select().from(monuments).where(eq(monuments.id, monument.id));
  expect(damaged!.garrison).toEqual({ CITADEL: 2 });
  expect(damaged!.garrisonDamage[0]!.damageBp + damaged!.garrisonDamage[0]!.remainderBp!)
    .toBeCloseTo(9 / HULLS.CITADEL.hp * 10000);
  expect(damaged!.garrisonTemplate).toEqual(monument.garrisonTemplate);
});

it('keeps an authored shelter effective against bomb radiation for NPCs without applying natural emitter damage', async () => {
  await hit();
  await f.db.insert(hpRadiationSources).values({ seasonId: f.seasonId, anchorKind: 'MONUMENT', anchorId: monument.id,
    x: monument.x, y: monument.y, z: monument.z, radius: 1, mode: 'SHELTER', intensityHpPerMinute: 0,
    activeFrom: f.clock.now() });
  f.clock.advance(10);
  await f.db.transaction(tx => settleMonument(tx, { monumentId: monument.id, clock: f.clock }));
  const [npc] = await f.db.select().from(monuments).where(eq(monuments.id, monument.id));
  expect(npc!.garrison).toEqual({ CITADEL: 2 });
  expect(npc!.garrisonDamage).toEqual([]);
});

it('kills a weak NPC garrison and arms the existing respawn rule, without a kill reward or death report', async () => {
  await f.db.update(monuments).set({ garrison: { DART: 2 }, garrisonTemplate: { DART: 2 } }).where(eq(monuments.id, monument.id));
  const sent = await hit();
  f.clock.advance(10);
  await f.db.transaction(tx => settleMonument(tx, { monumentId: monument.id, clock: f.clock }));
  const [dead] = await f.db.select().from(monuments).where(eq(monuments.id, monument.id));
  expect(dead!.garrison).toEqual({});
  expect(dead!.garrisonDamage).toEqual([]);
  expect(dead!.emptySince!.getTime()).toBeCloseTo(new Date(sent.arriveAt).getTime() + HULLS.DART.hp / 9 * 60000, -1);
  expect((await f.db.select().from(notifications)).filter(row => row.kind === 'radiation_lost')).toHaveLength(0);
});

it.each(['CITADEL', 'DART'] as const)('charges a late NPC respawn only from its real birth, including a second death (%s)', async hull => {
  const sent = await hit();
  const birth = new Date(new Date(sent.arriveAt).getTime() + 10 * 60000);
  await f.db.update(monuments).set({ garrison: {}, garrisonDamage: [], garrisonTemplate: { [hull]: 2 },
    emptySince: new Date(birth.getTime() - 86400000) }).where(eq(monuments.id, monument.id));
  f.clock.set(new Date(birth.getTime() + 10 * 60000));
  await f.db.transaction(tx => advanceMonument(tx, { monumentId: monument.id, at: f.clock.now() }));
  const [npc] = await f.db.select().from(monuments).where(eq(monuments.id, monument.id));
  if (hull === 'DART') {
    expect(npc!.garrison).toEqual({});
    expect(npc!.emptySince!.getTime()).toBeCloseTo(birth.getTime() + HULLS.DART.hp / 9 * 60000, -1);
    f.clock.set(new Date(birth.getTime() + 3 * 86400000));
    await f.db.transaction(tx => advanceMonument(tx, { monumentId: monument.id, at: f.clock.now() }));
    const [later] = await f.db.select().from(monuments).where(eq(monuments.id, monument.id));
    expect(later!.garrison).toEqual({ DART: 2 });
    expect(later!.garrisonDamage).toEqual([]);
    expect(later!.emptySince).toBeNull();
  } else {
    expect(npc!.garrison).toEqual({ CITADEL: 2 });
    expect(npc!.garrisonDamage).toHaveLength(1);
    expect(npc!.garrisonDamage[0]!.damageBp + (npc!.garrisonDamage[0]!.remainderBp ?? 0))
      .toBeCloseTo(90 / HULLS.CITADEL.hp * 10000);
  }
});

it('does not irradiate an NPC respawn born exactly when the bomb’s half-hour window ends', async () => {
  const sent = await hit();
  const birth = new Date(new Date(sent.arriveAt).getTime() + 30 * 60000);
  await f.db.update(monuments).set({ garrison: {}, garrisonDamage: [], garrisonTemplate: { DART: 2 },
    emptySince: new Date(birth.getTime() - 86400000) }).where(eq(monuments.id, monument.id));
  f.clock.set(new Date(birth.getTime() + 10 * 60000));
  await f.db.transaction(tx => advanceMonument(tx, { monumentId: monument.id, at: f.clock.now() }));
  const [npc] = await f.db.select().from(monuments).where(eq(monuments.id, monument.id));
  expect(npc!.garrison).toEqual({ DART: 2 });
  expect(npc!.garrisonDamage).toEqual([]);
  expect(npc!.emptySince).toBeNull();
});

it('silently removes player cohorts killed by stacked monument radiation after the single impact notice', async () => {
  const id = randomUUID();
  await f.db.insert(monumentWaves).values({ id, seasonId: f.seasonId, monumentId: monument.id,
    playerId: f.playerIds[1]!, originPlanetId: f.planetIds[1]!, unitLocation: `monument:${id}`,
    purpose: 'ATTACK', sentFleet: { DART: 1 }, tech: {}, route: [], fuelPaid: 0,
    status: 'HOLD', sentAt: f.clock.now(), heldAt: f.clock.now(), radiationSettledAt: f.clock.now() });
  await f.db.insert(monumentShipLots).values({ waveId: id, hull: 'DART', count: 1, damageBp: 9990, remainderBp: 0, deuterium: 0 });
  await f.db.insert(units).values({ planetId: f.planetIds[1]!, ownerPlayerId: f.playerIds[1]!,
    location: `monument:${id}`, hull: 'DART', count: 1 });
  await hit();
  f.clock.advance(10);
  await f.db.transaction(tx => settleMonument(tx, { monumentId: monument.id, clock: f.clock }));
  const [wave] = await f.db.select().from(monumentWaves).where(eq(monumentWaves.id, id));
  expect(wave!.status).toBe('LOST');
  expect(await f.db.select().from(notifications).where(eq(notifications.kind, 'radiation_lost'))).toHaveLength(0);
  expect(await f.db.select().from(notifications).where(eq(notifications.kind, 'radiation_bomb_result'))).toHaveLength(1);
});

it('does not let a later recall or settlement advance a monument past an unresolved bomb impact', async () => {
  const built=await buildRadiationBomb(f.db,f.planetIds[0]!,1,f.clock,f.playerIds[0]);
  await f.db.update(strategicAssets).set({status:'READY'}).where(eq(strategicAssets.id,built.assetId));
  const sent=await launchRadiationBomb(f.db,{playerId:f.playerIds[0]!,originPlanetId:f.planetIds[0]!,
    target:{kind:'MONUMENT',id:monument.id},level:1,key:randomUUID(),clock:f.clock});
  const before=(await f.db.select().from(monuments).where(eq(monuments.id,monument.id)))[0];
  f.clock.set(new Date(new Date(sent.arriveAt).getTime()+60000));
  await expect(f.db.transaction(tx=>settleMonument(tx,{monumentId:monument.id,clock:f.clock})))
    .rejects.toMatchObject({code:'RADIATION_IMPACT_PENDING'});
  expect((await f.db.select().from(monuments).where(eq(monuments.id,monument.id)))[0]).toEqual(before);
  await resolveRadiationBomb(f.db,sent.flightId,f.clock);
  await f.db.transaction(tx=>settleMonument(tx,{monumentId:monument.id,clock:f.clock}));
  expect((await f.db.select().from(monuments).where(eq(monuments.id,monument.id)))[0]!.garrisonDamage).toHaveLength(1);
});
