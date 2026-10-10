import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { MOBILE_HULLS, hangarLoad, type Fleet } from '@astera/rules';
import { buildings, clanMemberships, clans, monumentBattles, monuments, monumentShipLots, monumentWaves, planets, seasons, units } from '../src/db/schema.js';
import { quoteMonument, sendMonument } from '../src/services/monument.js';
import { advanceMonument } from '../src/services/monumentArrival.js';
import { recallMonument, resolveMonumentReturn } from '../src/services/monumentMovement.js';
import { readMonuments, readPublicMonumentFacts } from '../src/services/monumentView.js';
import { giveUnits, grant, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

let f: Fixture;
let target: typeof monuments.$inferSelect;
const request = (owner = 0, fleet: Fleet = { DART: 2 }, purpose: 'ATTACK' | 'REINFORCE' = 'ATTACK') => ({
  senderPlayerId: f.playerIds[owner]!, originPlanetId: f.planetIds[owner]!, monumentId: target.id,
  fleet, purpose, acknowledgeShieldLoss: true, clock: f.clock,
});
const send = (owner = 0, fleet?: Fleet, purpose?: 'ATTACK' | 'REINFORCE') => f.db.transaction(tx => sendMonument(tx, request(owner, fleet, purpose)));

async function park(owner: number, fleet: Fleet) {
  const id = randomUUID();
  await f.db.insert(monumentWaves).values({ id, seasonId: f.seasonId, monumentId: target.id, playerId: f.playerIds[owner]!,
    originPlanetId: f.planetIds[owner]!, unitLocation: `monument:${id}`, purpose: 'REINFORCE', status: 'HOLD',
    sentFleet: fleet, tech: {}, route: [], fuelPaid: 0, sentAt: f.clock.now(), heldAt: f.clock.now(), radiationSettledAt: f.clock.now() });
  const rows = MOBILE_HULLS.flatMap(hull => (fleet[hull] ?? 0) > 0 ? [{ hull, count: fleet[hull]! }] : []);
  await f.db.insert(monumentShipLots).values(rows.map(row => ({ ...row, waveId: id, damageBp: 0, remainderBp: 0, deuterium: 0 })));
  await f.db.insert(units).values(rows.map(row => ({ ...row, planetId: f.planetIds[owner]!, ownerPlayerId: f.playerIds[owner]!, location: `monument:${id}` })));
  await f.db.update(monuments).set({ controllerPlayerId: f.playerIds[owner]!, garrison: {} }).where(eq(monuments.id, target.id));
  return id;
}

async function makeClan() {
  const [clan] = await f.db.insert(clans).values({ seasonId: f.seasonId, name: 'Fairness', nameKey: 'fairness', tag: 'FR', createdAt: f.clock.now() }).returning();
  for (const owner of [0, 1]) await f.db.insert(clanMemberships).values({ seasonId: f.seasonId, clanId: clan!.id,
    playerId: f.playerIds[owner]!, slot: owner, role: owner === 0 ? 'LEADER' : 'MEMBER', joinedAt: f.clock.now(), matureAt: f.clock.now(), aidPolicyChangedAt: f.clock.now() });
  await f.db.update(monuments).set({ controllerPlayerId: null, controllerClanId: clan!.id }).where(eq(monuments.id, target.id));
}

beforeEach(async () => {
  f = await seedWorld(2, 20261010);
  await f.db.update(seasons).set({ rulesetVersion: 16 }).where(eq(seasons.id, f.seasonId));
  for (const planetId of f.planetIds) {
    await setLevel(f.db, planetId, 'HANGAR', 10);
    await grant(f.db, planetId, 100000, 100000);
    await setLevel(f.db, planetId, 'CORE', 9);
    await giveUnits(f.db, planetId, { DART: 20, COURIER: 10, RAMPART: 3 });
  }
  const [row] = await f.db.insert(monuments).values({ seasonId: f.seasonId, ordinal: 1, difficulty: 'HARD',
    x: 6000, y: 0, z: 0, capacity: 7270, productionPerMinute: 8, garrison: {}, settledAt: f.clock.now() }).returning();
  target = row!;
});
afterAll(async () => { await (await testDb()).close(); });

describe('personal monument fleet cycle', () => {
  it('closes the second combat dispatch while the first is still outbound, including quote', async () => {
    await send();
    await expect(send(0, { DART: 1 })).rejects.toMatchObject({ code: 'MONUMENT_FLEET_ACTIVE' });
    await expect(f.db.transaction(tx => quoteMonument(tx, request(0, { DART: 1 })))).rejects.toMatchObject({ code: 'MONUMENT_FLEET_ACTIVE' });
  });

  it('serializes simultaneous initial fleets even with ample ships, fuel, bays and monument room', async () => {
    const results = await Promise.allSettled([send(0, { DART: 1 }), send(0, { DART: 1 })]);
    expect(results.filter(row => row.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find(row => row.status === 'rejected');
    expect(rejected?.status === 'rejected' ? rejected.reason : null).toMatchObject({ code: 'MONUMENT_FLEET_ACTIVE' });
  });

  it('serializes one player launching from two different controlled worlds', async () => {
    await f.db.update(planets).set({ kind: 'COLONY', controllerPlayerId: f.playerIds[0]! }).where(eq(planets.id, f.planetIds[1]!));
    const results = await Promise.allSettled(f.planetIds.map(originPlanetId => f.db.transaction(tx =>
      sendMonument(tx, { ...request(0, { DART: 1 }), originPlanetId }))));
    expect(results.filter(row => row.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find(row => row.status === 'rejected');
    expect(rejected?.status === 'rejected' ? rejected.reason : null).toMatchObject({ code: 'MONUMENT_FLEET_ACTIVE' });
    expect(await f.db.select().from(monumentWaves)).toHaveLength(1);
  });

  it('counts an initial cargo-only launch as the personal cycle and never charges for a blocked mixed support', async () => {
    await park(1, { DART: 1 });
    await makeClan();
    await send(0, { COURIER: 1 }, 'REINFORCE');
    const beforeShips = await f.db.select().from(units);
    const beforeFuel = (await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!)))[0]!.deuterium;
    await expect(send(0, { DART: 1, COURIER: 1 }, 'REINFORCE')).rejects.toMatchObject({ code: 'MONUMENT_FLEET_ACTIVE' });
    expect(await f.db.select().from(units)).toEqual(beforeShips);
    expect((await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!)))[0]!.deuterium).toBe(beforeFuel);
    await expect(send(0, { COURIER: 1 }, 'REINFORCE')).resolves.toMatchObject({ wave: { status: 'OUTBOUND' } });
  });

  it('blocks another combat launch after recalling the whole initial outbound fleet until it really lands', async () => {
    const initial = await send(0, { DART: 2, COURIER: 1 });
    f.clock.advance(0.1);
    const turned = await f.db.transaction(tx => recallMonument(tx, { playerId: f.playerIds[0]!, waveId: initial.wave.id, all: true, clock: f.clock }));
    await expect(send()).rejects.toMatchObject({ code: 'MONUMENT_FLEET_ACTIVE' });
    f.clock.set(turned.wave.arriveAt!);
    await f.db.transaction(tx => resolveMonumentReturn(tx, { waveId: turned.wave.id, generation: turned.wave.generation, at: f.clock.now() }));
    await expect(send()).resolves.toMatchObject({ wave: { status: 'OUTBOUND' } });
  });

  it('preserves combat reinforcements on unadopted LEGACY targets', async () => {
    await f.db.update(monuments).set({ difficulty: 'LEGACY' }).where(eq(monuments.id, target.id));
    await park(0, { DART: 1 });
    await expect(send(0, { DART: 1 }, 'REINFORCE')).resolves.toMatchObject({ wave: { status: 'OUTBOUND' } });
    const view = await f.db.transaction(tx => readMonuments(tx, { playerId: f.playerIds[0]!, seasonId: f.seasonId, at: f.clock.now(), adminUsernames: [] }));
    expect(view.monuments[0]?.sendAccess.cargoOnly).toBe(false);
  });

  it('fights an occupied full target at full attack size, then holds only the capacity and returns overflow', async () => {
    const defender = { COURIER: Math.ceil(hangarLoad({ CITADEL: 1 }) / hangarLoad({ COURIER: 1 })) };
    await park(1, defender);
    const capacity = hangarLoad(defender);
    await f.db.update(monuments).set({ capacity }).where(eq(monuments.id, target.id));
    await giveUnits(f.db, f.planetIds[0]!, { CITADEL: 3 });
    const initial = await send(0, { CITADEL: 3 });
    expect(hangarLoad(initial.wave.sentFleet)).toBeGreaterThan(capacity);
    f.clock.set(initial.wave.arriveAt!);
    await f.db.transaction(tx => advanceMonument(tx, { monumentId: target.id, at: f.clock.now() }));
    expect((await f.db.select().from(monumentBattles))[0]).toMatchObject({ attackerFleet: { CITADEL: 3 }, control: 'ATTACKER' });
    const waves = await f.db.select().from(monumentWaves);
    const heldIds = new Set(waves.filter(wave => wave.status === 'HOLD').map(wave => wave.id));
    expect(heldIds.size).toBeGreaterThan(0);
    const held = await f.db.select().from(monumentShipLots);
    expect(held.filter(lot => heldIds.has(lot.waveId)).reduce((sum, lot) => sum + hangarLoad({ [lot.hull]: lot.count }), 0)).toBeLessThanOrEqual(capacity);
    expect(waves.some(wave => wave.playerId === f.playerIds[0] && wave.status === 'RETURNING' && wave.returnReason === 'CAPACITY')).toBe(true);
    await expect(send(0, { DART: 1 }, 'REINFORCE')).rejects.toMatchObject({ code: 'MONUMENT_FLEET_ACTIVE' });
  });

  it('blocks combat replacement even if only the owner cargo remains and allows cargo support', async () => {
    await park(0, { COURIER: 1 });
    await expect(send(0, { RAMPART: 1 }, 'REINFORCE')).rejects.toMatchObject({ code: 'MONUMENT_FLEET_ACTIVE' });
    await expect(send(0, { COURIER: 1, DART: 1 }, 'REINFORCE')).rejects.toMatchObject({ code: 'MONUMENT_FLEET_ACTIVE' });
    await giveUnits(f.db, f.planetIds[0]!, { GARBAGE_COLLECTOR: 1 });
    await expect(send(0, { GARBAGE_COLLECTOR: 1 }, 'REINFORCE')).rejects.toMatchObject({ code: 'MONUMENT_FLEET_ACTIVE' });
    expect((await send(0, { COURIER: 1 }, 'REINFORCE')).wave.status).toBe('OUTBOUND');
  });

  it('waits for the final personal cargo to arrive home, independently of continued clan control', async () => {
    const waveId = await park(0, { DART: 3, COURIER: 1 });
    await park(1, { DART: 1 });
    await makeClan();
    const lots = await f.db.select().from(monumentShipLots).where(eq(monumentShipLots.waveId, waveId));
    const combat = lots.find(lot => lot.hull === 'DART')!;
    const recalled = await f.db.transaction(tx => recallMonument(tx, { playerId: f.playerIds[0]!, waveId,
      selections: [{ lotId: combat.id, count: combat.count }], clock: f.clock }));
    await expect(send(0, { DART: 1 }, 'REINFORCE')).rejects.toMatchObject({ code: 'MONUMENT_FLEET_ACTIVE' });
    f.clock.set(recalled.wave.arriveAt!);
    await f.db.transaction(tx => resolveMonumentReturn(tx, { waveId: recalled.wave.id, generation: recalled.wave.generation, at: f.clock.now() }));
    await expect(send(0, { DART: 1 }, 'REINFORCE')).rejects.toMatchObject({ code: 'MONUMENT_FLEET_ACTIVE' });
    const last = await f.db.transaction(tx => recallMonument(tx, { playerId: f.playerIds[0]!, waveId, all: true, clock: f.clock }));
    await expect(send(0, { DART: 1 }, 'REINFORCE')).rejects.toMatchObject({ code: 'MONUMENT_FLEET_ACTIVE' });
    f.clock.set(last.wave.arriveAt!);
    await f.db.transaction(tx => resolveMonumentReturn(tx, { waveId: last.wave.id, generation: last.wave.generation, at: f.clock.now() }));
    expect((await send(0, { DART: 1 }, 'REINFORCE')).wave.status).toBe('OUTBOUND');
  });

  it('lets a new clan member join but applies the same personal rule from that launch', async () => {
    await park(0, { DART: 1 });
    await makeClan();
    await send(1, { DART: 1 }, 'REINFORCE');
    await expect(send(1, { DART: 1 }, 'REINFORCE')).rejects.toMatchObject({ code: 'MONUMENT_FLEET_ACTIVE' });
  });

  it('keeps hostile attack size unrestricted and does not block a separate monument', async () => {
    await f.db.update(monuments).set({ capacity: 3 }).where(eq(monuments.id, target.id));
    await send(0, { DART: 5 });
    const [other] = await f.db.insert(monuments).values({ seasonId: f.seasonId, ordinal: 2, difficulty: 'HARD',
      x: -6000, y: 0, z: 0, capacity: 7270, productionPerMinute: 8, garrison: {}, settledAt: f.clock.now() }).returning();
    expect((await f.db.transaction(tx => sendMonument(tx, { ...request(), monumentId: other!.id }))).wave.status).toBe('OUTBOUND');
  });
});

describe('Easy commander access', () => {
  it('uses the highest controlled world tier rather than the weak launch world', async () => {
    await f.db.update(monuments).set({ difficulty: 'EASY', capacity: 1550 }).where(eq(monuments.id, target.id));
    await f.db.update(planets).set({ kind: 'COLONY', controllerPlayerId: f.playerIds[0]! }).where(eq(planets.id, f.planetIds[1]!));
    await setLevel(f.db, f.planetIds[1]!, 'CORE', 10);
    await expect(send()).rejects.toMatchObject({ code: 'MONUMENT_TIER_FORBIDDEN', params: { tier: 4 } });
    expect(await f.db.select().from(monumentWaves)).toHaveLength(0);
  });

  it('publishes difficulty and exposes only the caller tier and personal cargo restriction', async () => {
    await f.db.update(monuments).set({ difficulty: 'EASY', capacity: 1550 }).where(eq(monuments.id, target.id));
    await park(0, { COURIER: 1 });
    await setLevel(f.db, f.planetIds[0]!, 'CORE', 10);
    const view = await f.db.transaction(tx => readMonuments(tx, { playerId: f.playerIds[0]!, seasonId: f.seasonId,
      at: f.clock.now(), adminUsernames: [] }));
    expect(view.monuments[0]).toMatchObject({ difficulty: 'EASY', sendAccess: { playerTier: 4, tierAllowed: false, cargoOnly: true } });
    const publicView = await f.db.transaction(tx => readPublicMonumentFacts(tx, f.seasonId, f.clock.now()));
    expect(publicView[0]).toMatchObject({ difficulty: 'EASY' });
    expect(publicView[0]).not.toHaveProperty('sendAccess');
    const other = await f.db.transaction(tx => readMonuments(tx, { playerId: f.playerIds[1]!, seasonId: f.seasonId,
      at: f.clock.now(), adminUsernames: [] }));
    expect(other.monuments[0]).toMatchObject({ sendAccess: { playerTier: 3, tierAllowed: true, cargoOnly: false } });
  });

  it('allows tier three, refuses tier four before moving fuel or ships, and still allows Hard', async () => {
    await f.db.update(monuments).set({ difficulty: 'EASY', capacity: 1550 }).where(eq(monuments.id, target.id));
    expect((await f.db.transaction(tx => quoteMonument(tx, request()))).fuel).toBeGreaterThan(0);
    await setLevel(f.db, f.planetIds[0]!, 'CORE', 10);
    await expect(send()).rejects.toMatchObject({ code: 'MONUMENT_TIER_FORBIDDEN', params: { tier: 4, maxTier: 3 } });
    expect(await f.db.select().from(monumentWaves)).toHaveLength(0);
    await f.db.update(monuments).set({ difficulty: 'HARD' }).where(eq(monuments.id, target.id));
    expect((await send()).wave.status).toBe('OUTBOUND');
  });

  it('keeps an existing Easy flight and HOLD after tier rises, but refuses new cargo too', async () => {
    await f.db.update(monuments).set({ difficulty: 'EASY', capacity: 1550 }).where(eq(monuments.id, target.id));
    const sent = await send(0, { RAMPART: 1, COURIER: 1 });
    await setLevel(f.db, f.planetIds[0]!, 'CORE', 10);
    f.clock.set(sent.wave.arriveAt!);
    await f.db.transaction(tx => advanceMonument(tx, { monumentId: target.id, at: f.clock.now() }));
    const [held] = await f.db.select().from(monumentWaves).where(eq(monumentWaves.id, sent.wave.id));
    expect(held?.status).toBe('HOLD');
    await expect(send(0, { COURIER: 1 }, 'REINFORCE')).rejects.toMatchObject({ code: 'MONUMENT_TIER_FORBIDDEN' });
    const [home] = await f.db.select().from(units).where(and(eq(units.planetId, f.planetIds[0]!), eq(units.location, 'home'), eq(units.hull, 'COURIER')));
    expect(home?.count).toBe(9);
    expect((await f.db.select().from(buildings).where(and(eq(buildings.planetId, f.planetIds[0]!), eq(buildings.type, 'CORE'))))[0]?.level).toBe(10);
  });
});
