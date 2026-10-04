import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { MOBILE_HULLS, MONUMENT_CAPACITY, distance, hangarLoad, missionFuel, type Fleet } from '@astera/rules';
import { clanMemberships, clans, hpRadiationSources, monuments, monumentShipLots, monumentWaves, notifications, planets, players, scheduledEvents, seasons, units } from '../src/db/schema.js';
import { quoteMonument, sendMonument } from '../src/services/monument.js';
import { advanceMonument } from '../src/services/monumentArrival.js';
import { readMonuments } from '../src/services/monumentView.js';
import { recomputePlayerWealth, totalUnitsOf } from '../src/services/planet.js';
import { baysInUse } from '../src/services/flight.js';
import { giveUnits, grant, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

let f: Fixture;
let target: typeof monuments.$inferSelect;
const input = (owner = 0, fleet: Fleet = { DART: 2, COURIER: 1 }, purpose: 'ATTACK' | 'REINFORCE' = 'ATTACK') => ({
  senderPlayerId: f.playerIds[owner]!, originPlanetId: f.planetIds[owner]!, monumentId: target.id,
  fleet, purpose, acknowledgeShieldLoss: true, clock: f.clock,
});
const send = (owner = 0, fleet?: Fleet, purpose?: 'ATTACK' | 'REINFORCE') => f.db.transaction((tx) => sendMonument(tx, input(owner, fleet, purpose)));
const quote = (owner = 0, fleet?: Fleet, purpose?: 'ATTACK' | 'REINFORCE') => f.db.transaction((tx) => quoteMonument(tx, input(owner, fleet, purpose)));
async function park(owner = 0, fleet: Fleet = { DART: 1 }, status: 'HOLD' | 'OUTBOUND' = 'HOLD') {
  const id = randomUUID();
  await f.db.insert(monumentWaves).values({
    id, seasonId: f.seasonId, monumentId: target.id, playerId: f.playerIds[owner]!, originPlanetId: f.planetIds[owner]!,
    unitLocation: `monument:${id}`, purpose: 'REINFORCE', sentFleet: fleet, tech: {}, route: [], fuelPaid: 0, status,
    heldAt: status === 'HOLD' ? f.clock.now() : null, sentAt: f.clock.now(), radiationSettledAt: f.clock.now(),
    arriveAt: status === 'HOLD' ? null : new Date(f.clock.now().getTime() + 60_000), reservedBulk: status === 'HOLD' ? 0 : hangarLoad(fleet),
  });
  const entries = MOBILE_HULLS.flatMap((hull) => (fleet[hull] ?? 0) > 0 ? [{ hull, count: fleet[hull]! }] : []);
  await f.db.insert(monumentShipLots).values(entries.map(({ hull, count }) => ({ waveId: id, hull, count, damageBp: 0, remainderBp: 0, deuterium: 0 })));
  await f.db.insert(units).values(entries.map(({ hull, count }) => ({ planetId: f.planetIds[owner]!, ownerPlayerId: f.playerIds[owner]!, location: `monument:${id}`, hull, count })));
  if (status === 'HOLD') await f.db.update(monuments).set({ controllerPlayerId: f.playerIds[owner]!, garrison: {} }).where(eq(monuments.id, target.id));
  return id;
}
async function clan() {
  const [row] = await f.db.insert(clans).values({ seasonId: f.seasonId, name: 'Monument Pact', nameKey: 'monument pact', tag: 'MP', level: 1, createdAt: f.clock.now() }).returning();
  for (let owner = 0; owner < 3; owner += 1) {
    await f.db.insert(clanMemberships).values({ seasonId: f.seasonId, clanId: row!.id, playerId: f.playerIds[owner]!, slot: owner,
      role: owner === 0 ? 'LEADER' : 'MEMBER', joinedAt: f.clock.now(), matureAt: f.clock.now(), aidPolicyChangedAt: f.clock.now() });
  }
  await f.db.update(monuments).set({ controllerPlayerId: null, controllerClanId: row!.id, garrison: {} }).where(eq(monuments.id, target.id));
  return row!.id;
}
beforeEach(async () => {
  f = await seedWorld(3, 20_261_003);
  for (const planetId of f.planetIds) {
    await setLevel(f.db, planetId, 'CORE', 6);
    await setLevel(f.db, planetId, 'HANGAR', 10);
    await grant(f.db, planetId, 100_000, 100_000);
    await giveUnits(f.db, planetId, { DART: 10, COURIER: 4 });
  }
  const [created] = await f.db.insert(monuments).values({ seasonId: f.seasonId, ordinal: 1, x: 6000, y: 0, z: 0,
    capacity: MONUMENT_CAPACITY, productionPerMinute: 60, garrison: { CITADEL: 2 }, settledAt: f.clock.now() }).returning();
  target = created!;
});
afterAll(async () => { await (await testDb()).close(); });

describe('monument quote and dispatch', () => {
  it('books the paid fuel in Wealth while ships retain their original owner', async () => {
    const initial = await f.db.transaction((tx) => recomputePlayerWealth(tx, f.playerIds[0]!));
    const sent = await send();
    expect((await f.db.select().from(players).where(eq(players.id, f.playerIds[0]!)))[0]?.wealth).toBe(initial - sent.quote.fuel);
  });
  it('moves actual owned ships into a wave, keeps personal hangar population and prepays both legs once', async () => {
    const request = input();
    const [before] = await f.db.select().from(planets).where(eq(planets.id, request.originPlanetId));
    const population = await totalUnitsOf(f.db, request.originPlanetId);
    const q = await quote();
    expect(q.fuel).toBe(missionFuel(request.fleet, distance(before!, target), 2));
    expect(q.room.reserved).toBe(0);
    const sent = await send();
    expect(sent.wave).toMatchObject({ status: 'OUTBOUND', purpose: 'ATTACK', reservedBulk: 0, fuelPaid: q.fuel,
      sentFleet: request.fleet, playerId: request.senderPlayerId, originPlanetId: request.originPlanetId });
    expect(sent.wave.arriveAt!.toISOString()).toBe(q.arriveAt);
    expect(sent.wave.route).toEqual([{ from: { x: before!.x, y: before!.y, z: before!.z }, to: { x: target.x, y: target.y, z: target.z },
      startMs: f.clock.now().getTime(), endMs: sent.wave.arriveAt!.getTime() }]);
    expect(await totalUnitsOf(f.db, request.originPlanetId)).toEqual(population);
    const parked = await f.db.select().from(units).where(eq(units.location, sent.wave.unitLocation));
    expect(Object.fromEntries(parked.map((row) => [row.hull, row.count]))).toEqual(request.fleet);
    expect(parked.every((row) => row.ownerPlayerId === request.senderPlayerId && row.planetId === request.originPlanetId)).toBe(true);
    const [after] = await f.db.select().from(planets).where(eq(planets.id, request.originPlanetId));
    expect(before!.deuterium - after!.deuterium).toBeCloseTo(q.fuel, 6);
    expect(await baysInUse(f.db, request.originPlanetId)).toBe(1);
    const events = await f.db.select().from(scheduledEvents).where(eq(scheduledEvents.refId, sent.wave.id));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: 'monument_arrival', resolveAt: sent.wave.arriveAt, payload: { generation: 0 } });
    const lots = await f.db.select().from(monumentShipLots).where(eq(monumentShipLots.waveId, sent.wave.id));
    expect(lots.every((lot) => lot.damageBp === 0 && lot.remainderBp === 0 && lot.deuterium === 0)).toBe(true);
  });

  it('allows a hostile fleet larger than target capacity without a friendly reservation', async () => {
    await f.db.update(monuments).set({ capacity: 3 }).where(eq(monuments.id, target.id));
    const result = await send(0, { DART: 4 });
    expect(result.wave.reservedBulk).toBe(0);
    expect(hangarLoad(result.wave.sentFleet)).toBeGreaterThan(3);
  });

  it('allows cargo-only friendly reinforcement and reserves its real bulk', async () => {
    await park();
    const q = await quote(0, { COURIER: 1 }, 'REINFORCE');
    const sent = await send(0, { COURIER: 1 }, 'REINFORCE');
    expect(sent.wave.reservedBulk).toBe(hangarLoad({ COURIER: 1 }));
    expect(q.room.used).toBe(hangarLoad({ DART: 1 }));
  });

  it('keeps future defensive reservations out of every hostile quote field', async () => {
    await park(1);
    await park(1, { CITADEL: 5 }, 'OUTBOUND');
    const hostile = await quote();
    expect(hostile.room).toEqual({ used: 3, reserved: 0, total: MONUMENT_CAPACITY, after: 3 });
    const friendly = await quote(1, { DART: 1 }, 'REINFORCE');
    expect(friendly.room.reserved).toBe(hangarLoad({ CITADEL: 5 }));
    expect(friendly.room.after).toBe(3 + hangarLoad({ CITADEL: 5 }) + 3);
  });

  it('predicts the first HOLD loss using the damage actually carried through the outbound leg', async () => {
    await f.db.update(seasons).set({ rulesetVersion: 16 }).where(eq(seasons.id, f.seasonId));
    await park(0, { CITADEL: 1 });
    await giveUnits(f.db, f.planetIds[0]!, { CITADEL: 1 });
    await f.db.update(planets).set({ x: 3500, y: 0, z: 0 }).where(eq(planets.id, f.planetIds[0]!));
    await f.db.insert(hpRadiationSources).values({ seasonId: f.seasonId, anchorKind: 'MONUMENT', anchorId: target.id,
      x: target.x, y: target.y, z: target.z, radius: 1000, mode: 'EMIT', intensityHpPerMinute: 4, activeFrom: f.clock.now() });
    const sent = await send(0, { CITADEL: 1 }, 'REINFORCE');
    expect(sent.quote.outboundForecast.doseHp).toBeGreaterThan(0);
    f.clock.set(sent.wave.arriveAt!);
    await f.db.transaction((tx) => advanceMonument(tx, { monumentId: target.id, at: f.clock.now() }));
    const actual = await f.db.transaction((tx) => readMonuments(tx, { playerId: f.playerIds[0]!, seasonId: f.seasonId,
      at: f.clock.now(), adminUsernames: [] }, target.id));
    const held = actual.waves.find((wave) => wave.id === sent.wave.id);
    expect(held?.status).toBe('HOLD');
    expect(sent.quote.holdForecast?.nextLossAt).toBe(held?.nextLossAt);
  });

  it('serializes two origins competing for the same final friendly capacity', async () => {
    await park(0);
    await clan();
    await f.db.update(monuments).set({ capacity: 6 }).where(eq(monuments.id, target.id));
    const results = await Promise.allSettled([send(1, { DART: 1 }, 'REINFORCE'), send(2, { DART: 1 }, 'REINFORCE')]);
    expect(results.filter((row) => row.status === 'fulfilled')).toHaveLength(1);
    const rejection = results.find((row) => row.status === 'rejected');
    expect(rejection?.status === 'rejected' ? rejection.reason : undefined).toMatchObject({ code: 'MONUMENT_CAPACITY_FULL' });
    const waves = await f.db.select().from(monumentWaves).where(eq(monumentWaves.status, 'OUTBOUND'));
    expect(waves.reduce((n, row) => n + row.reservedBulk, 0)).toBe(3);
  });

  it('serializes two launches spending the same home ships', async () => {
    const results = await Promise.allSettled([send(0, { DART: 8 }), send(0, { DART: 8 })]);
    expect(results.filter((row) => row.status === 'fulfilled')).toHaveLength(1);
    const rejection = results.find((row) => row.status === 'rejected');
    expect(rejection?.status === 'rejected' ? rejection.reason : undefined).toMatchObject({ code: 'NOT_ENOUGH_SHIPS' });
    const [home] = await f.db.select().from(units).where(and(eq(units.planetId, f.planetIds[0]!), eq(units.location, 'home'), eq(units.hull, 'DART')));
    expect(home?.count).toBe(2);
  });

  it('warns every actual HOLD owner at hostile launch and omits private composition from notices', async () => {
    await park(1);
    await park(2);
    // The fixture’s shared defence belongs to a clan; the attacker stays outside it.
    const [defenceClan] = await f.db.insert(clans).values({ seasonId: f.seasonId, name: 'Defender Pact', nameKey: 'defender pact', tag: 'DP', level: 1, createdAt: f.clock.now() }).returning();
    for (const owner of [1, 2]) await f.db.insert(clanMemberships).values({ seasonId: f.seasonId, clanId: defenceClan!.id,
      playerId: f.playerIds[owner]!, slot: owner, joinedAt: f.clock.now(), matureAt: f.clock.now(), aidPolicyChangedAt: f.clock.now() });
    await f.db.update(monuments).set({ controllerPlayerId: null, controllerClanId: defenceClan!.id }).where(eq(monuments.id, target.id));
    await park(1, { DART: 1 }, 'OUTBOUND');
    const sent = await send();
    const told = await f.db.select().from(notifications).where(eq(notifications.refId, sent.wave.id));
    expect(told.map((row) => row.playerId).sort()).toEqual([f.playerIds[1], f.playerIds[2]].sort());
    expect(told.every((row) => row.kind === 'monument_inbound')).toBe(true);
    for (const row of told) expect(Object.keys(row.payload).sort()).toEqual(['arriveAt', 'monumentId', 'monumentOrdinal', 'targetKind', 'waveId']);
  });

  it('warns the new holder about an attack that was already in flight before capture', async () => {
    await f.db.update(monuments).set({ garrison: {} }).where(eq(monuments.id, target.id));
    await f.db.update(planets).set({ x: 0 }).where(eq(planets.id, f.planetIds[0]!));
    await f.db.update(planets).set({ x: 5990 }).where(eq(planets.id, f.planetIds[1]!));
    const inbound = await send(0, { DART: 2 });
    const capture = await send(1, { DART: 2 });
    expect(capture.wave.arriveAt!.getTime()).toBeLessThan(inbound.wave.arriveAt!.getTime());
    f.clock.set(new Date(capture.wave.arriveAt!.getTime() + 1_000));
    await f.db.transaction((tx) => advanceMonument(tx, { monumentId: target.id, at: f.clock.now() }));
    const notices = await f.db.select().from(notifications).where(and(eq(notifications.kind, 'monument_inbound'), eq(notifications.playerId, f.playerIds[1]!)));
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({ refId: inbound.wave.id, payload: { monumentId: target.id, waveId: inbound.wave.id } });
  });

  it('requires accepted own shield loss for PvP, skips target planet shields and never drops a shield in quote', async () => {
    await park(1);
    const until = new Date(f.clock.now().getTime() + 60_000);
    await f.db.update(players).set({ newcomerShieldUntil: until }).where(eq(players.id, f.playerIds[0]!));
    await f.db.update(players).set({ newcomerShieldUntil: until }).where(eq(players.id, f.playerIds[1]!));
    const request = { ...input(), acknowledgeShieldLoss: false };
    const q = await f.db.transaction((tx) => quoteMonument(tx, request));
    expect(q.shieldWouldDrop).toBe(true);
    expect((await f.db.select().from(players).where(eq(players.id, f.playerIds[0]!)))[0]?.newcomerShieldUntil).toEqual(until);
    await expect(f.db.transaction((tx) => sendMonument(tx, request))).rejects.toMatchObject({ code: 'SHIELD_WOULD_DROP' });
    await send();
    expect((await f.db.select().from(players).where(eq(players.id, f.playerIds[0]!)))[0]?.newcomerShieldUntil).toBeNull();
    expect((await f.db.select().from(players).where(eq(players.id, f.playerIds[1]!)))[0]?.newcomerShieldUntil).toEqual(until);
  });

  it('requires shield acknowledgement for neutral attacks and friendly reinforcement', async () => {
    const until = new Date(f.clock.now().getTime() + 60_000);
    await f.db.update(players).set({ newcomerShieldUntil: until }).where(eq(players.id, f.playerIds[0]!));
    await expect(f.db.transaction((tx) => sendMonument(tx, { ...input(), acknowledgeShieldLoss: false })))
      .rejects.toMatchObject({ code: 'SHIELD_WOULD_DROP' });
    expect((await f.db.select().from(players).where(eq(players.id, f.playerIds[0]!)))[0]?.newcomerShieldUntil).toEqual(until);
    await send();
    expect((await f.db.select().from(players).where(eq(players.id, f.playerIds[0]!)))[0]?.newcomerShieldUntil).toBeNull();
    await park(0);
    const secondUntil = new Date(f.clock.now().getTime() + 60_000);
    await f.db.update(players).set({ newcomerShieldUntil: secondUntil }).where(eq(players.id, f.playerIds[0]!));
    await expect(f.db.transaction((tx) => sendMonument(tx, { ...input(0, { COURIER: 1 }, 'REINFORCE'), acknowledgeShieldLoss: false })))
      .rejects.toMatchObject({ code: 'SHIELD_WOULD_DROP' });
    await send(0, { COURIER: 1 }, 'REINFORCE');
    expect((await f.db.select().from(players).where(eq(players.id, f.playerIds[0]!)))[0]?.newcomerShieldUntil).toBeNull();
  });

  it('requires and consumes the sender shield acknowledgement for every monument dispatch', async () => {
    const until = new Date(f.clock.now().getTime() + 60_000);
    await f.db.update(players).set({ newcomerShieldUntil: until }).where(eq(players.id, f.playerIds[0]!));
    await expect(f.db.transaction((tx) => sendMonument(tx, { ...input(0, { DART: 1 }), acknowledgeShieldLoss: false })))
      .rejects.toMatchObject({ code: 'SHIELD_WOULD_DROP' });
    expect((await f.db.select().from(players).where(eq(players.id, f.playerIds[0]!)))[0]?.newcomerShieldUntil).toEqual(until);
    await send(0, { DART: 1 });
    expect((await f.db.select().from(players).where(eq(players.id, f.playerIds[0]!)))[0]?.newcomerShieldUntil).toBeNull();
  });

  it('refuses a foreign origin, friendly fire and reinforcement to a hostile target', async () => {
    await expect(f.db.transaction((tx) => sendMonument(tx, { ...input(), originPlanetId: f.planetIds[1]! }))).rejects.toMatchObject({ code: 'PLANET_NOT_OWNED' });
    await park();
    await expect(send()).rejects.toMatchObject({ code: 'MONUMENT_FRIENDLY_FIRE' });
    await expect(send(1, { DART: 1 }, 'REINFORCE')).rejects.toMatchObject({ code: 'MONUMENT_NOT_FRIENDLY' });
    await clan();
    await expect(send(1)).rejects.toMatchObject({ code: 'MONUMENT_FRIENDLY_FIRE' });
  });

  it.each([{ DART: -1 }, { DART: 1.5 }, { PROSPECTOR: 1 }, { BASTION: 1 }, {}, { UNKNOWN: 1 }])('rejects malformed or forbidden fleet %j before moving units', async (fleet) => {
    await expect(send(0, fleet)).rejects.toMatchObject({ code: 'BAD_FLEET' });
    expect(await f.db.select().from(monumentWaves)).toHaveLength(0);
  });

  it('refuses insufficient fuel, all occupied ordinary bays and a closed season', async () => {
    await f.db.update(planets).set({ deuterium: 0 }).where(eq(planets.id, f.planetIds[0]!));
    await expect(send()).rejects.toMatchObject({ code: 'INSUFFICIENT_FUEL' });
    await grant(f.db, f.planetIds[0]!, 100_000, 100_000);
    for (let n = 0; n < 3; n += 1) await park(0, { DART: 1 }, 'OUTBOUND');
    // CORE 1 has one ordinary bay. Existing parked waves must be counted.
    await setLevel(f.db, f.planetIds[0]!, 'CORE', 1);
    await expect(send(0, { DART: 1 }, 'REINFORCE')).rejects.toMatchObject({ code: 'NO_FREE_BAY' });
    await f.db.update(seasons).set({ status: 'frozen' }).where(eq(seasons.id, f.seasonId));
    await expect(send()).rejects.toMatchObject({ code: 'SEASON_FROZEN' });
  });

  it('refuses a launch whose monument arrival would be after the season cutoff', async () => {
    await f.db.update(seasons).set({ endsAt: new Date(f.clock.now().getTime() + 60_000) }).where(eq(seasons.id, f.seasonId));
    await expect(send()).rejects.toMatchObject({ code: 'SEASON_ENDS_BEFORE_RETURN' });
    expect(await f.db.select().from(monumentWaves)).toEqual([]);
  });

  it('rolls back ships, fuel, shield loss, events and notices when the enclosing action fails', async () => {
    await park(1);
    const [before] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!));
    const population = await f.db.select().from(units).where(eq(units.planetId, f.planetIds[0]!));
    await expect(f.db.transaction(async (tx) => {
      await sendMonument(tx, input());
      throw new Error('caller rollback');
    })).rejects.toThrow('caller rollback');
    expect(await f.db.select().from(units).where(eq(units.planetId, f.planetIds[0]!))).toEqual(population);
    expect((await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!)))[0]?.deuterium).toBe(before!.deuterium);
    expect(await f.db.select().from(monumentWaves).where(eq(monumentWaves.status, 'OUTBOUND'))).toHaveLength(0);
    expect(await f.db.select().from(notifications).where(eq(notifications.kind, 'monument_inbound'))).toHaveLength(0);
  });
});
