import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { MOBILE_HULLS, MONUMENT_CAPACITY, MULTI_WORLD, allocateMonumentDominion, fleetValue, hangarLoad, type Fleet } from '@astera/rules';
import { clanMemberships, clans, hpRadiationSources, monumentBattles, monumentBattleParticipants, monuments, monumentShipLots, monumentWaves, notifications, planets, players, seasons, units } from '../src/db/schema.js';
import { resolveMonumentArrival } from '../src/services/monumentArrival.js';
import { lockMonument, settleMonument } from '../src/services/monument.js';
import { assertDominionLedgers } from '../src/services/dominion.js';
import { totalUnitsOf } from '../src/services/planet.js';
import { seedWorld, testDb, type Fixture } from './helpers.js';

let f: Fixture;
let m: typeof monuments.$inferSelect;
let start: number;
const at = (minutes: number) => new Date(start + minutes * 60_000);
async function wave(owner: number, fleet: Fleet, options: { eta?: number; hold?: boolean; cargo?: number; damageBp?: number; remainderBp?: number; purpose?: 'ATTACK' | 'REINFORCE'; id?: string } = {}) {
  const id = options.id ?? randomUUID();
  const origin = (await f.db.select().from(planets).where(eq(planets.id, f.planetIds[owner]!)))[0]!;
  const eta = at(options.eta ?? 1);
  const [row] = await f.db.insert(monumentWaves).values({ id, seasonId: f.seasonId, monumentId: m.id,
    playerId: f.playerIds[owner]!, originPlanetId: origin.id, unitLocation: `monument:${id}`, purpose: options.purpose ?? 'ATTACK',
    sentFleet: fleet, tech: {}, route: [{ from: { x: origin.x, y: origin.y, z: origin.z }, to: { x: m.x, y: m.y, z: m.z }, startMs: start, endMs: eta.getTime() }],
    status: options.hold ? 'HOLD' : 'OUTBOUND', arriveAt: options.hold ? null : eta, heldAt: options.hold ? at(0) : null,
    sentAt: at(0), radiationSettledAt: at(0), fuelPaid: 0,
    reservedBulk: options.purpose === 'REINFORCE' ? hangarLoad(fleet) : 0,
  }).returning();
  for (const hull of MOBILE_HULLS) {
    const count = fleet[hull] ?? 0;
    if (count === 0) continue;
    await f.db.insert(monumentShipLots).values({ waveId: id, hull, count, damageBp: options.damageBp ?? 0,
      remainderBp: options.remainderBp ?? 0, deuterium: hull === 'COURIER' ? options.cargo ?? 0 : 0 });
    await f.db.insert(units).values({ planetId: origin.id, ownerPlayerId: row!.playerId, location: row!.unitLocation, hull, count });
  }
  return row!;
}
async function clan(owners: number[]) {
  const [row] = await f.db.insert(clans).values({ seasonId: f.seasonId, name: 'Arrival Pact', nameKey: 'arrival pact', tag: 'AP', level: 1, createdAt: at(0) }).returning();
  for (const [slot, owner] of owners.entries()) await f.db.insert(clanMemberships).values({ seasonId: f.seasonId, clanId: row!.id,
    playerId: f.playerIds[owner]!, slot, role: slot === 0 ? 'LEADER' : 'MEMBER', joinedAt: at(0), matureAt: at(0), aidPolicyChangedAt: at(0) });
  return row!.id;
}
const arrive = (row: typeof monumentWaves.$inferSelect, date = row.arriveAt!) => f.db.transaction((tx) => resolveMonumentArrival(tx, {
  waveId: row.id, generation: row.generation, at: date, adminUsernames: [],
}));
beforeEach(async () => {
  f = await seedWorld(3, 20_261_003);
  start = f.clock.now().getTime();
  await f.db.update(seasons).set({ rulesetVersion: MULTI_WORLD.shipDamageRulesetVersion }).where(eq(seasons.id, f.seasonId));
  m = (await f.db.insert(monuments).values({ seasonId: f.seasonId, ordinal: 1, x: 6000, y: 0, z: 0,
    capacity: MONUMENT_CAPACITY, productionPerMinute: 60, garrison: { DART: 1 }, garrisonTemplate: { DART: 1 }, settledAt: at(0) }).returning())[0]!;
});
afterAll(async () => { await (await testDb()).close(); });

describe('chronological monument arrivals and physical battle settlement', () => {
  it('defeats neutral ships without Dominion and captures for the actual owner’s clan', async () => {
    const clanId = await clan([0]);
    const attacker = await wave(0, { CATACLYSM: 20, COURIER: 2 });
    await arrive(attacker);
    expect((await f.db.select().from(monuments))[0]).toMatchObject({ controllerClanId: clanId, controllerPlayerId: null, garrison: {}, emptySince: null });
    expect((await f.db.select().from(monumentWaves))[0]).toMatchObject({ status: 'HOLD', heldAt: at(1), reservedBulk: 0 });
    expect((await f.db.select().from(monumentBattles))[0]).toMatchObject({ eligible: false, transfer: 0, createdAt: at(1) });
    expect((await f.db.select().from(players))[0]?.dominionTaken).toBe(0);
  });

  it('does not let cargo-only attackers capture an empty monument', async () => {
    await f.db.update(monuments).set({ garrison: {} }).where(eq(monuments.id, m.id));
    const attacker = await wave(0, { COURIER: 2 }, { cargo: 0.125 });
    await arrive(attacker);
    expect((await f.db.select().from(monuments))[0]?.controllerPlayerId).toBeNull();
    expect((await f.db.select().from(monumentWaves))[0]).toMatchObject({ status: 'RETURNING', returnReason: 'DEFEAT' });
    expect((await f.db.select().from(monumentShipLots))[0]?.deuterium).toBe(0.125);
  });

  it('joins friendly HOLD without healing or producing retroactive cargo income', async () => {
    await f.db.update(monuments).set({ garrison: {}, controllerPlayerId: f.playerIds[0]! }).where(eq(monuments.id, m.id));
    await wave(0, { DART: 1, COURIER: 1 }, { hold: true });
    const incoming = await wave(0, { DART: 1, COURIER: 1 }, { eta: 2, purpose: 'REINFORCE', damageBp: 2000, remainderBp: 0.5 });
    await arrive(incoming);
    const lots = await f.db.select().from(monumentShipLots).where(eq(monumentShipLots.waveId, incoming.id));
    expect(lots.every((lot) => lot.damageBp === 2000 && lot.remainderBp === 0.5 && lot.deuterium === 0)).toBe(true);
    expect(await f.db.select().from(monumentBattles)).toHaveLength(0);
    const heldCargo = await f.db.select().from(monumentShipLots).where(eq(monumentShipLots.hull, 'COURIER'));
    expect(heldCargo.reduce((sum, lot) => sum + lot.deuterium, 0)).toBeCloseTo(120);
  });

  it('warns a newly arrived holder about an already outbound hostile attack exactly once', async () => {
    const clanId = await clan([0, 1]);
    await f.db.update(monuments).set({ garrison: {}, controllerClanId: clanId }).where(eq(monuments.id, m.id));
    await wave(0, { DART: 1 }, { hold: true });
    const hostile = await wave(2, { DART: 1 }, { eta: 10 });
    const incoming = await wave(1, { DART: 1 }, { eta: 2, purpose: 'REINFORCE' });
    await arrive(incoming);
    await arrive(incoming);
    const notices = await f.db.select().from(notifications).where(eq(notifications.refId, hostile.id));
    expect(notices.filter((notice) => notice.playerId === f.playerIds[1])).toMatchObject([
      { kind: 'monument_inbound', payload: { waveId: hostile.id, arriveAt: hostile.arriveAt!.toISOString() } },
    ]);
    expect(notices.filter((notice) => notice.playerId === f.playerIds[1])).toHaveLength(1);
    expect(JSON.stringify(notices)).not.toContain('DART');
  });

  it('keeps earlier HOLD ships when a friendly arrival cannot fit', async () => {
    await f.db.update(monuments).set({ capacity: hangarLoad({ DART: 1 }), garrison: {} }).where(eq(monuments.id, m.id));
    const existing = await wave(0, { DART: 1 }, { hold: true });
    const clanId = await clan([0, 1]);
    await f.db.update(monuments).set({ controllerPlayerId: null, controllerClanId: clanId }).where(eq(monuments.id, m.id));
    const incoming = await wave(1, { DART: 2 }, { eta: 2, purpose: 'REINFORCE' });

    await arrive(incoming);

    const [existingAfter] = await f.db.select().from(monumentWaves).where(eq(monumentWaves.id, existing.id));
    const [incomingAfter] = await f.db.select().from(monumentWaves).where(eq(monumentWaves.id, incoming.id));
    expect(existingAfter).toMatchObject({ status: 'HOLD', returnReason: null });
    expect(incomingAfter).toMatchObject({ status: 'RETURNING', returnReason: 'CAPACITY' });
    const existingUnits = await f.db.select().from(units).where(eq(units.location, existingAfter!.unitLocation));
    expect(existingUnits).toMatchObject([{ hull: 'DART', count: 1 }]);
    await arrive(incoming);
    const notices = await f.db.select().from(notifications).where(eq(notifications.refId, incoming.id));
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({ kind: 'monument_returning', playerId: incoming.playerId, createdAt: incoming.arriveAt,
      payload: { targetKind: 'MONUMENT', monumentId: m.id, reason: 'CAPACITY', craft: 2, arriveAt: incomingAfter!.arriveAt!.toISOString() } });
  });

  it('returns a friendly reinforcement whose target changed control, instead of turning it into an attack', async () => {
    await f.db.update(monuments).set({ garrison: {}, controllerPlayerId: f.playerIds[1]! }).where(eq(monuments.id, m.id));
    await wave(1, { DART: 1 }, { hold: true });
    const incoming = await wave(0, { CATACLYSM: 10 }, { purpose: 'REINFORCE' });
    await arrive(incoming);
    const [stored] = await f.db.select().from(monumentWaves).where(eq(monumentWaves.id, incoming.id));
    expect(stored).toMatchObject({ status: 'RETURNING', returnReason: 'CONTROL_CHANGED' });
    expect(await f.db.select().from(monumentBattles)).toHaveLength(0);
    expect((await f.db.select().from(monuments))[0]?.controllerPlayerId).toBe(f.playerIds[1]);
  });

  it('uses the whole attacking wing in battle before selecting capacity and returns only its excess', async () => {
    await f.db.update(monuments).set({ capacity: 6, garrison: {} }).where(eq(monuments.id, m.id));
    const attacker = await wave(0, { DART: 4, COURIER: 2 });
    const population = await totalUnitsOf(f.db, attacker.originPlanetId);
    await arrive(attacker);
    expect((await f.db.select().from(monumentBattles))[0]?.attackerFleet).toEqual(attacker.sentFleet);
    const waves = await f.db.select().from(monumentWaves);
    expect(waves.filter((row) => row.status === 'HOLD')).toHaveLength(1);
    expect(waves.find((row) => row.status === 'RETURNING')?.returnReason).toBe('CAPACITY');
    const [held] = waves.filter((row) => row.status === 'HOLD');
    const heldUnits = await f.db.select().from(units).where(eq(units.location, held!.unitLocation));
    expect(hangarLoad(Object.fromEntries(heldUnits.map((row) => [row.hull, row.count])))).toBeLessThanOrEqual(6);
    expect(await totalUnitsOf(f.db, attacker.originPlanetId)).toEqual(population);
  });

  it('distributes normal PvP Dominion with cargo and Collector values on the zero-power defence, including annihilated owners', async () => {
    const clanId = await clan([1, 2]);
    await f.db.update(monuments).set({ garrison: {}, controllerClanId: clanId }).where(eq(monuments.id, m.id));
    await wave(1, { COURIER: 2 }, { hold: true, cargo: 400.75 });
    await wave(2, { GARBAGE_COLLECTOR: 1 }, { hold: true });
    const attacker = await wave(0, { CATACLYSM: 30, COURIER: 2 });
    await arrive(attacker);
    const [battle] = await f.db.select().from(monumentBattles);
    expect(battle?.eligible).toBe(true);
    expect(battle!.transfer).toBe(fleetValue({ COURIER: 2, GARBAGE_COLLECTOR: 1 }) + Math.round(400.75));
    const participants = await f.db.select().from(monumentBattleParticipants);
    expect(participants).toHaveLength(3);
    expect(participants.reduce((sum, row) => sum + row.dominionDelta, 0)).toBe(0);
    const expected = allocateMonumentDominion(-battle!.transfer, [
      { playerId: f.playerIds[1]!, fleet: { COURIER: 2 } }, { playerId: f.playerIds[2]!, fleet: { GARBAGE_COLLECTOR: 1 } },
    ]);
    for (const share of expected) expect(participants.find((row) => row.playerId === share.playerId)?.dominionDelta).toBe(share.delta);
    expect(participants.filter((row) => row.side === 'DEFENCE').every((row) => Object.values(row.survivors).every((count) => count === 0))).toBe(true);
    const cargo = await f.db.select().from(monumentShipLots).where(and(eq(monumentShipLots.waveId, attacker.id), eq(monumentShipLots.hull, 'COURIER')));
    expect(cargo.reduce((sum, lot) => sum + lot.deuterium, 0)).toBeCloseTo(400.75);
    const roster = await f.db.select().from(players);
    expect(() => { assertDominionLedgers(roster.map((row) => ({ playerId: row.id, taken: row.dominionTaken, lost: row.dominionLost })), [], MULTI_WORLD.shipDamageRulesetVersion,
      participants.map((row) => ({ playerId: row.playerId, delta: row.dominionDelta }))); }).not.toThrow();
    const [scoredClan] = await f.db.select().from(clans);
    expect(scoredClan?.dominionLost).toBe(battle!.transfer);
  });

  it('keeps the defender’s control and exact surviving wounds when the attack fails', async () => {
    await f.db.update(monuments).set({ garrison: {}, controllerPlayerId: f.playerIds[1]! }).where(eq(monuments.id, m.id));
    const defender = await wave(1, { CITADEL: 10 }, { hold: true, damageBp: 1000, remainderBp: 0.75 });
    const attacker = await wave(0, { DART: 1 });
    await arrive(attacker);
    expect((await f.db.select().from(monuments))[0]?.controllerPlayerId).toBe(defender.playerId);
    expect((await f.db.select().from(monumentWaves).where(eq(monumentWaves.id, attacker.id)))[0]?.status).toBe('LOST');
    const survivors = await f.db.select().from(monumentShipLots).where(eq(monumentShipLots.waveId, defender.id));
    expect(survivors.every((lot) => lot.damageBp + lot.remainderBp >= 1000.75)).toBe(true);
  });

  it('resolves an older arrival first and pays production only over the actual HOLD intervals', async () => {
    await clan([0, 1]);
    await f.db.update(monuments).set({ garrison: {} }).where(eq(monuments.id, m.id));
    const first = await wave(0, { DART: 1, COURIER: 1 }, { eta: 1 });
    const second = await wave(1, { DART: 1, COURIER: 1 }, { eta: 2 });
    await arrive(second);
    const cargo = await f.db.select().from(monumentShipLots).where(eq(monumentShipLots.hull, 'COURIER'));
    expect(cargo.find((lot) => lot.waveId === first.id)?.deuterium).toBeCloseTo(60);
    expect(cargo.find((lot) => lot.waveId === second.id)?.deuterium).toBe(0);
    f.clock.set(at(3));
    await f.db.transaction((tx) => settleMonument(tx, { monumentId: m.id, clock: f.clock }));
    const after = await f.db.select().from(monumentShipLots).where(eq(monumentShipLots.hull, 'COURIER'));
    expect(after.find((lot) => lot.waveId === first.id)?.deuterium).toBeCloseTo(90);
    expect(after.find((lot) => lot.waveId === second.id)?.deuterium).toBeCloseTo(30);
  });

  it('keeps independent enemy arrivals separate even at the same ETA, in stable wave-id order', async () => {
    await f.db.update(monuments).set({ garrison: {} }).where(eq(monuments.id, m.id));
    const first = await wave(0, { CITADEL: 10 }, { id: '00000000-0000-4000-8000-000000000001' });
    const second = await wave(1, { DART: 1 }, { id: '00000000-0000-4000-8000-000000000002' });
    await arrive(second);
    const reports = await f.db.select().from(monumentBattles);
    expect(reports).toHaveLength(2);
    expect(reports.find((row) => row.triggerWaveId === first.id)?.attackerFleet).toEqual(first.sentFleet);
    expect(reports.find((row) => row.triggerWaveId === second.id)?.attackerFleet).toEqual(second.sentFleet);
    expect((await f.db.select().from(monuments))[0]?.controllerPlayerId).toBe(first.playerId);
  });

  it('uses the true arrival time after a worker outage, with post-arrival production paid only once', async () => {
    await f.db.update(monuments).set({ garrison: {} }).where(eq(monuments.id, m.id));
    const attacker = await wave(0, { DART: 1, COURIER: 1 });
    await arrive(attacker, at(3));
    expect((await f.db.select().from(monumentBattles))[0]?.createdAt).toEqual(at(1));
    const cargo = (await f.db.select().from(monumentShipLots).where(eq(monumentShipLots.hull, 'COURIER')))[0]!;
    expect(cargo.deuterium).toBeCloseTo(120);
    await arrive(attacker, at(3));
    expect((await f.db.select().from(monumentShipLots).where(eq(monumentShipLots.hull, 'COURIER')))[0]?.deuterium).toBe(cargo.deuterium);
  });

  it('claims an arrival once under a real PostgreSQL race and ignores stale generations', async () => {
    const attacker = await wave(0, { CATACLYSM: 20 });
    await f.db.transaction((tx) => resolveMonumentArrival(tx, { waveId: attacker.id, generation: 9, at: at(1), adminUsernames: [] }));
    expect(await f.db.select().from(monumentBattles)).toHaveLength(0);
    const results = await Promise.allSettled([arrive(attacker), arrive(attacker)]);
    expect(results.filter((row) => row.status === 'rejected')).toEqual([]);
    expect(await f.db.select().from(monumentBattles)).toHaveLength(1);
  });

  it('cannot arrive early and loses a wholly irradiated outbound wave before any battle or score', async () => {
    const attacker = await wave(0, { DART: 1 });
    await arrive(attacker, at(0));
    expect(await f.db.select().from(monumentBattles)).toHaveLength(0);
    await f.db.insert(hpRadiationSources).values({ seasonId: f.seasonId, anchorKind: 'MONUMENT', anchorId: m.id,
      x: m.x, y: m.y, z: m.z, radius: 20_000, intensityHpPerMinute: 1000, mode: 'EMIT', activeFrom: at(0) });
    await arrive(attacker);
    expect((await f.db.select().from(monumentWaves))[0]?.status).toBe('LOST');
    expect(await f.db.select().from(monumentBattles)).toHaveLength(0);
    expect((await f.db.select().from(players))[0]?.dominionTaken).toBe(0);
  });

  it('rolls battle, capture, journal, cargo and returning fragments back with the caller', async () => {
    await f.db.update(monuments).set({ garrison: {} }).where(eq(monuments.id, m.id));
    const attacker = await wave(0, { DART: 4 });
    await expect(f.db.transaction(async (tx) => {
      await resolveMonumentArrival(tx, { waveId: attacker.id, generation: 0, at: at(1), adminUsernames: [] });
      throw new Error('caller rollback');
    })).rejects.toThrow('caller rollback');
    expect(await f.db.select().from(monumentBattles)).toHaveLength(0);
    expect(await f.db.select().from(monumentBattleParticipants)).toHaveLength(0);
    expect((await f.db.select().from(monumentWaves))[0]?.status).toBe('OUTBOUND');
    expect((await f.db.select().from(monuments))[0]?.controllerPlayerId).toBeNull();
  });

  it('carries neutral wounds between independent attacks and keeps the respawn template whole', async () => {
    await f.db.update(monuments).set({ garrison: { CITADEL: 1 }, garrisonTemplate: { CITADEL: 1 } }).where(eq(monuments.id, m.id));
    const first = await wave(0, { DART: 1 });
    const second = await wave(1, { DART: 1 }, { eta: 2 });
    await arrive(first);
    const [before] = await f.db.select().from(monuments);
    expect(before!.garrisonDamage.length).toBeGreaterThan(0);
    await arrive(second);
    const [after] = await f.db.select().from(monuments);
    const damage = (row: typeof monuments.$inferSelect) => row.garrisonDamage.reduce((sum, lot) => sum + lot.damageBp + (lot.remainderBp ?? 0), 0);
    expect(damage(after!)).toBeGreaterThan(damage(before!));
    expect(after?.garrisonTemplate).toEqual({ CITADEL: 1 });
  });

  it('restores a due neutral garrison before a later attack even if its respawn worker was offline', async () => {
    await f.db.update(monuments).set({ garrison: {}, emptySince: at(0) }).where(eq(monuments.id, m.id));
    const incoming = await wave(0, { CATACLYSM: 20 }, { eta: 1441 });
    await arrive(incoming);
    expect((await f.db.select().from(monumentBattles))[0]?.defenderFleet).toEqual(m.garrisonTemplate);
    expect((await f.db.select().from(monuments))[0]?.controllerPlayerId).toBe(incoming.playerId);
  });

  it('validates live garrison, template, research and damage JSON at the target boundary', async () => {
    for (const patch of [{ garrison: { DART: -1 } }, { garrisonTemplate: { DART: 0.5 } },
      { garrisonTech: { SHIP_ARMOR: -1 } }, { garrisonDamage: [{ hull: 'DART' as const, count: 2, damageBp: 1000 }] }]) {
      await f.db.update(monuments).set(patch).where(eq(monuments.id, m.id));
      await expect(f.db.transaction((tx) => lockMonument(tx, m.id))).rejects.toMatchObject({ code: 'MONUMENT_MANIFEST_INVALID' });
      await f.db.update(monuments).set({ garrison: m.garrison, garrisonTemplate: m.garrisonTemplate, garrisonTech: {}, garrisonDamage: [] }).where(eq(monuments.id, m.id));
    }
  });
});
